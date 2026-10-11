# Review Intake Workbench

A small static prototype for **Gangnam Beauty Guide** that takes in Korean clinic reviews, matches each review's clinic name to a known clinic using an explicit alias list, and flags possible duplicates for a person to review. Every flag comes with a written reason. Nothing is merged, deleted or guessed.

> **Synthetic demonstration data.** All clinics, sources and reviews in the example are fictional. English translations are written in advance and marked `[Prepared translation]`. They are not real patient evidence.

## Design choices

- **Vanilla HTML/CSS/JS with no build step or dependencies.** `processing.js` is a set of pure functions. It loads as a browser global and as a CommonJS module, so the page and the tests run the same code.
- **Conservative clinic matching.** Names are normalised only by Unicode NFKC, lower-casing, and removing whitespace and punctuation. A name matches only if it appears in the supplied `clinics` alias list. Anything else stays `unresolved`. There is no fuzzy matching and no suffix stripping (`Byeol Sample Derm` ≠ `Byeol Sample Dermatology`).
- **Duplicates are candidates for review, not decisions:**
  - `REPEATED_SOURCE_RECORD`: the same `source` and `sourceReviewId` appear more than once. Every copy is flagged and kept.
  - `POSSIBLE_DUPLICATE_TEXT`: two reviews at the same matched clinic have the same normalised text under different source/review IDs. Identical wording is explicitly *not* treated as proof of duplication. Matching text at *different* clinics is not flagged.
- **Every input record is kept.** Each output record contains a copy of the original record, the clinic match status, the translation status and a list of flags with reasons and related input indexes.
- **Invalid reviews are kept too.** They are flagged `INVALID_RECORD` and left out of matching. Structural errors, such as malformed JSON, a missing array or conflicting aliases, stop processing with readable messages.
- **No inference beyond the data.** No procedure, surgeon or translation accuracy is inferred. There are no trust scores.
- **Deterministic.** Output follows input order and contains no timestamps or randomness.
- **Safe rendering.** All user-supplied content is inserted with `textContent`, never as HTML.

## Run locally

Serve the folder (any static server works):

```
python -m http.server 8000
```

Then open http://localhost:8000/. Opening `index.html` directly with `file://` also works, because the page uses no `fetch` or ES modules.

Run the tests (Node 22, built-in test runner, nothing to install):

```
node --test
```

## Input format

```json
{
  "clinics": [
    { "id": "clinic-haneul-demo", "name": "Haneul Demo Clinic", "aliases": ["하늘데모의원"] }
  ],
  "reviews": [
    {
      "source": "demo-source-a",
      "sourceReviewId": "A-1001",
      "clinicName": "하늘데모의원",
      "text": "상담이 친절했어요.",
      "language": "ko",
      "translationEn": "[Prepared translation] The consultation was kind.",
      "rating": 5,
      "date": "2026-09-01"
    }
  ]
}
```

- **Required for each review:** `source`, `sourceReviewId`, `clinicName` and `text`, each a non-empty string.
- **Optional:** `language`, `translationEn`, `rating` and `date`. They are passed through unchanged.
- **Aliases must be unambiguous.** An alias that normalises to the same key under two different clinics is rejected.

## Files

| File | Purpose |
|---|---|
| `index.html`, `styles.css`, `app.js` | The user interface |
| `processing.js` | Validation, normalisation, matching and flagging |
| `example-data.js` | Synthetic example of 8 reviews and 2 clinics |
| `test/processing.test.js` | `node --test` suite |

## Limitations

- **Synthetic data only.** No real clinics, patients or reviews are included.
- **Prepared translations.** Translations are supplied with the input, not produced or checked. The output marks them `supplied-unverified`.
- **No live ingestion, scraping, translation or model calls.** Everything runs offline on the JSON you paste.
- **No independently verified clinical evidence.** Review text is not evidence of a procedure, a surgeon or an outcome, and this tool gives no medical recommendations.
- **Exact matching only.** Duplicate detection finds only exact normalised text. Paraphrases, partial copies and translated copies are not detected.
- **Unresolved clinics are skipped.** They are not checked for text duplicates.
- **Hand-maintained alias list.** Unknown spellings stay unresolved until someone adds them.
- **No browser tests in the repository.** The UI was checked once in an interactive Playwright session (see Verification below). It is not covered by a repeatable test suite.

## Verification

- `node --test`: 15 processing tests, all passing (Node 22).
- `node --check app.js`: passes.
- One-off browser check (Playwright/Chromium, desktop viewport, served with `python -m http.server 8000`):
  - Load example then Process shows 8 processed / 1 unresolved / 3 duplicate candidates.
  - Download JSON saves a file identical to the Node processing result.
  - Typing in the editor, or clicking Load example again, clears the previous results and disables Download.
  - Malformed JSON shows an error and Download stays disabled.
  - HTML and script content in the input is displayed as text.
- Not checked: phone-width layout, dark mode, browsers other than Chromium.

## GitHub Pages

The site is fully static, with relative paths and no build step. To publish it, enable Pages for the repository's default branch (root folder) and `index.html` is served as is.
