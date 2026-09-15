# Syncing Entreluma template copies

Template copies can compare or update their reusable framework files with
`tools/sync_code.py`. The script reads from the canonical
[`rsnyder/entreluma`](https://github.com/rsnyder/entreluma) repository and only
operates on an explicit manifest embedded in the script.

Check for drift without changing files:

```sh
python3 tools/sync_code.py --check
```

Review the listed paths, then apply the latest `main` branch:

```sh
python3 tools/sync_code.py --apply
```

Use `--ref` with a release tag or commit SHA for a reproducible update, and
`--verbose` with `--check` to print text diffs:

```sh
python3 tools/sync_code.py --check --ref <tag-or-commit> --verbose
python3 tools/sync_code.py --apply --ref <tag-or-commit>
```

Maintainers can test unpublished Entreluma changes against a template copy by
reading from a local checkout:

```sh
python3 tools/sync_code.py --check --source-dir /path/to/entreluma
```

After applying an update, inspect the Git diff and run the repository's tests.
The script downloads or reads every source file before it writes anything, so a
failed fetch cannot leave a partially updated copy.

## Ownership boundary

The managed manifest contains the shared runtime, viewer components, layouts,
includes, author documentation, dependency lockfile, deployment workflow, and
validation tools. It includes `tools/sync_code.py` itself so future updates to
the manifest propagate to template copies. Run `--list` to see the exact paths.

The following remain owned by each template copy and are never overwritten:

- `_config.yml` and repository-specific data
- README, homepage, About page, and other local navigation
- Published stories and their media (except `_posts/.template.md`)
- Branding, favicons, analytics, and custom CSS
- Local documentation and additions configured through site data

Upstream changes that require a new `_config.yml` setting must be reviewed and
merged manually. The tool also does not delete unlisted files; removals and
renames called out in release notes should be reviewed separately.
