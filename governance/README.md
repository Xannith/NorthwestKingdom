# Governance Documents

This directory contains HTML pages converted from MLC governance source documents.

## Source

Source files are stored in Google Drive at `~/gdrive/Claude` (rclone mount) and
copied locally to `governance/_source/` before conversion.
`governance/_source/` is listed in `.gitignore` — it is a working directory only.

## Regenerate after adding or updating a document

```bash
# 1. Copy updated file(s) from Google Drive
cp -v ~/gdrive/Claude/*.docx governance/_source/
cp -v ~/gdrive/Claude/*.pdf  governance/_source/

# 2. Rebuild (from repo root)
python3 tools/build-governance.py

# 3. Review the output, then commit
git add governance/
git commit -m "Regenerate governance docs from source"
```

Regeneration is **idempotent** — re-running replaces all output files rather than
duplicating them.

## Adding a new document

1. Add the file to Google Drive and copy it to `governance/_source/`.
2. Add an entry to the `DOCUMENTS` catalog in `tools/build-governance.py`.
3. Run the build script.

## How search works

- `governance/search-index.json` is a JSON array generated at build time. It
  contains title, category, URL, and full body text for every document.
- `assets/js/governance-search.js` loads the index via `fetch()` and queries it
  using [MiniSearch](https://lucaong.github.io/minisearch/) (vendored at
  `assets/js/vendor/minisearch.min.js`).
- Search is scoped to governance documents only.
- The index rebuilds every time `build-governance.py` runs.

## Notes on specific documents

- **Articles of Incorporation** — converted via OCR from a scanned PDF. Flag for
  human proofreading before relying on specific wording.
- **Nonmember Voting Policy** and **Voting: Nonmember Voting Policy** — two files
  covering overlapping content. Both are retained as distinct pages. Review whether
  one supersedes the other.
