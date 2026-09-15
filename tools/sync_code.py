#!/usr/bin/env python3
"""Synchronize framework-owned files from the canonical Entreluma repository.

Template copies keep their own site configuration, stories, media, branding, and
local documentation. This script only checks or overwrites the explicit list of
framework-owned files below.
"""

from __future__ import annotations

import argparse
import ast
import difflib
import os
from pathlib import Path, PurePosixPath
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


SOURCE_OWNER = "rsnyder"
SOURCE_REPO = "entreluma"
DEFAULT_REF = "main"

# Keep this list explicit. A downstream site must never have its stories, media,
# identity, configuration, or local documentation overwritten by a core sync.
FILES_TO_SYNC = (
    ".github/workflows/pages-deploy.yml",
    ".ruby-version",
    "Gemfile",
    "Gemfile.lock",
    "_admin/2026-02-15-entreluma-action-links.md",
    "_admin/2026-02-15-entreluma-authors-guide.md",
    "_admin/2026-02-15-entreluma-display-modes.md",
    "_admin/2026-02-15-entreluma-entity-info-popups.md",
    "_admin/2026-02-15-entreluma-formatting-tips.md",
    "_admin/2026-02-15-entreluma-iframe-viewer.md",
    "_admin/2026-02-15-entreluma-image-compare-viewer.md",
    "_admin/2026-02-15-entreluma-image-viewer.md",
    "_admin/2026-02-15-entreluma-map-viewer.md",
    "_admin/2026-02-15-entreluma-overview.md",
    "_admin/2026-02-15-entreluma-preview-setup.md",
    "_admin/2026-02-15-entreluma-troubleshooting.md",
    "_admin/2026-02-15-entreluma-viewers-overview.md",
    "_admin/2026-02-15-entreluma-vis-network-viewer.md",
    "_admin/2026-02-15-entreluma-youtube-viewer.md",
    "_admin/2026-07-06-entreluma-authoring-a-visual-narrative.md",
    "_admin/2026-09-14-entreluma-vimeo-viewer.md",
    "_admin/index.md",
    "_data/contact.yml",
    "_data/share.yml",
    "_includes/cite-this.html",
    "_includes/col2-toggle.html",
    "_includes/embed/_iframe.html",
    "_includes/embed/iframe.html",
    "_includes/embed/image-compare.html",
    "_includes/embed/image.html",
    "_includes/embed/map.html",
    "_includes/embed/vis-network.html",
    "_includes/embed/vimeo.html",
    "_includes/embed/youtube.html",
    "_includes/featured_posts.html",
    "_includes/footer.html",
    "_includes/head.html",
    "_includes/media-url.html",
    "_includes/pdf-download.html",
    "_includes/post_index_item.html",
    "_includes/refactor-content.html",
    "_includes/sidebar.html",
    "_includes/search-loader.html",
    "_layouts/admin.html",
    "_layouts/home.html",
    "_layouts/post.html",
    "_plugins/md5_filter.rb",
    "_plugins/posts-lastmod-hook.rb",
    "_posts/.template.md",
    "assets/components/image-compare.html",
    "assets/components/image.html",
    "assets/components/map.html",
    "assets/components/vis-network.html",
    "assets/components/vimeo.html",
    "assets/components/youtube.html",
    "assets/css/entreluma.css",
    "assets/entreluma-preview.json",
    "assets/img/leaflet/marker-icon-2x.png",
    "assets/img/leaflet/marker-icon.png",
    "assets/img/leaflet/marker-shadow.png",
    "assets/js/entreluma-component.js",
    "assets/js/entreluma-iiif.mjs",
    "assets/js/entreluma-local-image.js",
    "assets/js/entreluma-pagefind.mjs",
    "assets/js/entreluma-vimeo.mjs",
    "assets/js/entreluma.js",
    "assets/js/vendor/Leaflet.SmoothWheelZoom.js",
    "docs/dependencies.md",
    "docs/postmessage-protocol.md",
    "docs/repository-boundary.md",
    "docs/search.md",
    "docs/upstream-sync.md",
    "tools/check_consistency.py",
    "tools/prove_local_media.rb",
    "tools/sync_code.py",
    "tools/test_iiif.mjs",
    "tools/test_pagefind.mjs",
    "tools/test_vimeo.mjs",
)


def repository_root() -> Path:
    """Find the destination repository from this script or the current folder."""
    candidates = (Path(__file__).resolve().parent, Path.cwd().resolve())
    for candidate in candidates:
        for directory in (candidate, *candidate.parents):
            if (directory / ".git").exists():
                return directory
    raise RuntimeError("could not find a Git repository containing this script")


def validate_manifest(manifest: tuple[str, ...]) -> None:
    for item in manifest:
        path = PurePosixPath(item)
        if path.is_absolute() or ".." in path.parts:
            raise RuntimeError(f"unsafe manifest path: {item}")
    if len(manifest) != len(set(manifest)):
        raise RuntimeError("the sync manifest contains duplicate paths")


def manifest_from_script(source: bytes) -> tuple[str, ...]:
    """Read the literal FILES_TO_SYNC value without executing upstream code."""
    try:
        tree = ast.parse(source.decode("utf-8"), filename="upstream tools/sync_code.py")
        for node in tree.body:
            if not isinstance(node, ast.Assign):
                continue
            if any(isinstance(target, ast.Name) and target.id == "FILES_TO_SYNC" for target in node.targets):
                value = ast.literal_eval(node.value)
                if not isinstance(value, (list, tuple)) or not all(
                    isinstance(item, str) for item in value
                ):
                    break
                manifest = tuple(value)
                validate_manifest(manifest)
                return manifest
    except (SyntaxError, UnicodeDecodeError, ValueError) as error:
        raise RuntimeError(f"cannot parse the upstream sync manifest: {error}") from error
    raise RuntimeError("upstream tools/sync_code.py has no literal FILES_TO_SYNC manifest")


def read_local_source(source_root: Path, relative_path: str) -> bytes:
    path = source_root / relative_path
    try:
        return path.read_bytes()
    except OSError as error:
        raise RuntimeError(f"cannot read {path}: {error}") from error


def read_remote_source(relative_path: str, ref: str) -> bytes:
    encoded_ref = quote(ref, safe="")
    encoded_path = "/".join(quote(part, safe="") for part in relative_path.split("/"))
    url = (
        f"https://raw.githubusercontent.com/{SOURCE_OWNER}/{SOURCE_REPO}/"
        f"{encoded_ref}/{encoded_path}"
    )
    headers = {"User-Agent": "entreluma-sync-code"}
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    for attempt in range(2):
        try:
            with urlopen(Request(url, headers=headers), timeout=30) as response:
                return response.read()
        except (HTTPError, URLError, TimeoutError) as error:
            if attempt == 0:
                time.sleep(3)
                continue
            raise RuntimeError(f"cannot fetch {relative_path}: {error}") from error
    raise AssertionError("unreachable")


def text_diff(relative_path: str, current: bytes | None, wanted: bytes) -> str:
    if current is None:
        return f"  {relative_path}: missing locally"
    try:
        before = current.decode("utf-8").splitlines(keepends=True)
        after = wanted.decode("utf-8").splitlines(keepends=True)
    except UnicodeDecodeError:
        return f"  {relative_path}: binary content differs"
    return "".join(
        difflib.unified_diff(
            before,
            after,
            fromfile=f"local/{relative_path}",
            tofile=f"upstream/{relative_path}",
        )
    ).rstrip()


def atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    old_mode = path.stat().st_mode if path.exists() else None
    temporary_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temporary:
            temporary.write(content)
            temporary_name = temporary.name
        if old_mode is not None:
            os.chmod(temporary_name, old_mode)
        os.replace(temporary_name, path)
    finally:
        if temporary_name and os.path.exists(temporary_name):
            os.unlink(temporary_name)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true", help="report drift without writing")
    mode.add_argument("--apply", action="store_true", help="overwrite drifted managed files")
    mode.add_argument("--list", action="store_true", help="list managed paths")
    parser.add_argument(
        "--ref",
        default=DEFAULT_REF,
        help=f"Entreluma branch, tag, or commit to fetch (default: {DEFAULT_REF})",
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        help="read from a local Entreluma checkout instead of GitHub",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="show unified text diffs while checking",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    validate_manifest(FILES_TO_SYNC)

    if args.list:
        print("\n".join(FILES_TO_SYNC))
        return 0

    destination_root = repository_root()
    source_root = args.source_dir.expanduser().resolve() if args.source_dir else None
    source_label = str(source_root) if source_root else f"{SOURCE_OWNER}/{SOURCE_REPO}@{args.ref}"
    print(f"Entreluma source: {source_label}")
    print(f"Destination: {destination_root}")

    # Read the upstream script first so files newly added to its manifest are
    # included in this same run. The manifest is parsed as a literal; upstream
    # Python is never executed. Read every source before touching the destination
    # so a failed fetch can never leave a partially updated template copy.
    upstream: dict[str, bytes] = {}
    try:
        script_path = "tools/sync_code.py"
        upstream_script = (
            read_local_source(source_root, script_path)
            if source_root
            else read_remote_source(script_path, args.ref)
        )
        manifest = manifest_from_script(upstream_script)
        for relative_path in manifest:
            upstream[relative_path] = upstream_script if relative_path == script_path else (
                read_local_source(source_root, relative_path)
                if source_root
                else read_remote_source(relative_path, args.ref)
            )
    except RuntimeError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    drifted: list[str] = []
    current_content: dict[str, bytes | None] = {}
    for relative_path, wanted in upstream.items():
        destination = destination_root / relative_path
        try:
            current = destination.read_bytes()
        except FileNotFoundError:
            current = None
        except OSError as error:
            print(f"error: cannot read {destination}: {error}", file=sys.stderr)
            return 2
        current_content[relative_path] = current
        if current != wanted:
            drifted.append(relative_path)

    if args.check:
        if not drifted:
            print(f"Core files are synchronized ({len(manifest)} checked).")
            return 0
        print(f"Core drift found in {len(drifted)} of {len(manifest)} managed files:")
        for relative_path in drifted:
            print(f"  {relative_path}")
            if args.verbose:
                print(text_diff(relative_path, current_content[relative_path], upstream[relative_path]))
        print("Run again with --apply after reviewing the affected paths.")
        return 1

    for relative_path in drifted:
        atomic_write(destination_root / relative_path, upstream[relative_path])
    if drifted:
        print(f"Updated {len(drifted)} managed files:")
        for relative_path in drifted:
            print(f"  {relative_path}")
    else:
        print(f"Core files are already synchronized ({len(manifest)} checked).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
