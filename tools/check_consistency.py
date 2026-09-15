#!/usr/bin/env python3
"""Repo consistency checks, run in CI after the Jekyll build.

Checks:
  1. Exactly one Shoelace version is referenced across the repo (multiple
     simultaneous versions double-load the library and can conflict).

Exits non-zero on failure.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# All Shoelace references are converged on a single pinned version; any
# regression (new unversioned or divergent reference) fails CI.
SHOELACE_STRICT = True

# Directories that never contain framework source
SKIP_DIRS = {".git", "_site", ".jekyll-cache", "node_modules", "vendor"}
TEXT_SUFFIXES = {".html", ".js", ".css", ".md", ".yml", ".yaml", ".scss", ".json"}

errors: list[str] = []
warnings: list[str] = []


def iter_text_files():
    for path in REPO.rglob("*"):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.is_file() and path.suffix in TEXT_SUFFIXES:
            yield path


def check_shoelace_versions() -> None:
    versions: dict[str, set[str]] = {}
    pattern = re.compile(r"@shoelace-style/shoelace(?:@(\d+\.\d+\.\d+))?/")
    for path in iter_text_files():
        for m in pattern.finditer(path.read_text(errors="ignore")):
            ver = m.group(1) or "(unversioned)"
            versions.setdefault(ver, set()).add(str(path.relative_to(REPO)))
    if len(versions) > 1:
        detail = "; ".join(
            f"{v} in {', '.join(sorted(files))}" for v, files in sorted(versions.items())
        )
        msg = f"Shoelace referenced at {len(versions)} versions: {detail}"
        (errors if SHOELACE_STRICT else warnings).append(msg)
    elif "(unversioned)" in versions:
        files = ", ".join(sorted(versions["(unversioned)"]))
        msg = f"Shoelace referenced without a pinned version in: {files}"
        (errors if SHOELACE_STRICT else warnings).append(msg)


def main() -> int:
    check_shoelace_versions()

    for w in warnings:
        print(f"WARNING: {w}")
    for e in errors:
        print(f"ERROR: {e}")
    if not errors and not warnings:
        print("All consistency checks passed.")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
