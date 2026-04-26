#!/usr/bin/env python3
"""
convert_ve_compare.py

Walks through all markdown files in a directory, finds pairs of
Juncture <param ve-compare curtain ...> / <param ve-compare ...> tags,
and replaces them with {% include embed/image-compare.html %} includes.

Usage:
    # Dry run — shows what would change without writing anything
    python convert_ve_compare.py path/to/_posts

    # Actually write the changes
    python convert_ve_compare.py path/to/_posts --write

    # Also search subdirectories (default is recursive)
    python convert_ve_compare.py path/to/ --write

    # Limit to a single file
    python convert_ve_compare.py path/to/file.md --write
"""

import re
import sys
import os
import argparse
from pathlib import Path


# ---------------------------------------------------------------------------
# Regex to extract a named attribute from a <param ...> tag string
# ---------------------------------------------------------------------------
def get_attr(tag: str, name: str) -> str:
    m = re.search(rf'{re.escape(name)}="([^"]*)"', tag, re.IGNORECASE)
    return m.group(1).strip() if m else ""


# ---------------------------------------------------------------------------
# Convert a single file's content, returning (new_content, count_replaced)
# ---------------------------------------------------------------------------
def convert_content(text: str) -> tuple[str, int]:
    """
    Finds every pair:
        <param ve-compare curtain url="BEFORE" label="LABEL_A">
        <param ve-compare url="AFTER" label="LABEL_B">

    and replaces them with:

        {% include embed/image-compare.html
          before="BEFORE"
          after="AFTER"
          caption="LABEL_A / LABEL_B"
          aspect="1.5" %}

    The two <param> lines may be separated by optional whitespace/blank lines.
    A blank line is ensured before the include so kramdown treats it as a block.
    """

    # Match the curtain (before) param — ve-compare and curtain in any order
    curtain_pat = (
        r'<param\b'                         # opening tag
        r'(?=[^>]*\bve-compare\b)'          # must have ve-compare
        r'(?=[^>]*\bcurtain\b)'             # must have curtain
        r'[^>]*>'                           # rest of tag
    )

    # Match the after param — ve-compare but NOT curtain
    after_pat = (
        r'<param\b'                         # opening tag
        r'(?=[^>]*\bve-compare\b)'          # must have ve-compare
        r'(?![^>]*\bcurtain\b)'             # must NOT have curtain
        r'[^>]*>'                           # rest of tag
    )

    # Full pattern: curtain param, optional blank lines, after param
    pattern = re.compile(
        rf'({curtain_pat})'                 # group 1: before tag
        r'[ \t]*\n'                         # newline after before tag
        r'(?:[ \t]*\n)*'                    # optional blank lines between
        rf'({after_pat})',                  # group 2: after tag
        re.IGNORECASE
    )

    count = 0

    def replace_pair(m: re.Match) -> str:
        nonlocal count

        before_tag = m.group(1)
        after_tag  = m.group(2)

        before_url = get_attr(before_tag, "url")
        after_url  = get_attr(after_tag,  "url")

        if not before_url or not after_url:
            print(f"  [SKIP] missing url in pair:\n    {before_tag}\n    {after_tag}")
            return m.group(0)

        before_label = get_attr(before_tag, "label") or "Before"
        after_label  = get_attr(after_tag,  "label") or "After"

        # Build a readable caption from both labels
        if before_label and after_label and before_label != after_label:
            caption = f"{before_label} / {after_label}"
        else:
            caption = before_label or after_label

        include = (
            f'\n{{% include embed/image-compare.html\n'
            f'  before="{before_url}"\n'
            f'  after="{after_url}"\n'
            f'  caption="{caption}"\n'
            f'  aspect="1.5" %}}'
        )

        count += 1
        return include

    new_text = pattern.sub(replace_pair, text)
    return new_text, count


# ---------------------------------------------------------------------------
# Process a single file
# ---------------------------------------------------------------------------
def process_file(path: Path, write: bool) -> int:
    try:
        original = path.read_text(encoding="utf-8")
    except Exception as e:
        print(f"[ERROR] Could not read {path}: {e}")
        return 0

    if "ve-compare" not in original:
        return 0  # nothing to do, skip silently

    converted, count = convert_content(original)

    if count == 0:
        return 0

    print(f"  {'WRITE' if write else 'DRY RUN'} {path}  ({count} replacement{'s' if count != 1 else ''})")

    if write:
        try:
            path.write_text(converted, encoding="utf-8")
        except Exception as e:
            print(f"  [ERROR] Could not write {path}: {e}")

    return count


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Convert Juncture <param ve-compare> pairs to Jekyll image-compare includes."
    )
    parser.add_argument(
        "path",
        help="Path to a markdown file or a directory to search recursively."
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Write changes to disk. Without this flag, runs as a dry run."
    )
    args = parser.parse_args()

    target = Path(args.path)

    if not target.exists():
        print(f"Error: {target} does not exist.")
        sys.exit(1)

    if target.is_file():
        files = [target]
    else:
        files = sorted(target.rglob("*.md"))

    if not files:
        print("No markdown files found.")
        sys.exit(0)

    print(f"{'DRY RUN' if not args.write else 'WRITING'} — scanning {len(files)} file(s) under {target}\n")

    total_files = 0
    total_replacements = 0

    for f in files:
        count = process_file(f, write=args.write)
        if count:
            total_files += 1
            total_replacements += count

    print(f"\nDone. {total_replacements} replacement(s) across {total_files} file(s).")
    if not args.write and total_replacements:
        print("Run with --write to apply changes.")


if __name__ == "__main__":
    main()