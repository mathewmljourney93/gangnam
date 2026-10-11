# Prompts

## Build instruction (as given to Claude Code)

```
Goal:
Build a small, complete review-processing prototype for Gangnam Beauty Guide within approximately 12 minutes. Prioritise working processing, meaningful tests and clear limitations.

Context:
- Working directory: D:\Claude\Agentic_Engineer_Assessment
- Inspect files and Git status first. The folder should contain only .git.
- Origin: https://github.com/mathewmljourney93/gangnam.git
- Node.js 22 and Python 3.13 are available.
- The assessment permits an AI-assisted static page or script published on GitHub.
- The product's difficult problem is Korean review syndication, translation, deduplication, clinic normalisation and trustworthy evidence.

Chosen scope:
A static "Review Intake Workbench" using vanilla HTML/CSS/JavaScript, with processing functions that can also be tested using Node's built-in test runner. No frameworks, dependencies, backend, database or API credentials.

Implement:
1. A compact, polished, responsive interface with:
   - A visible "Synthetic demonstration data" label.
   - Editable JSON input and a Load example button.
   - A Process reviews button.
   - Counts for processed records, unresolved clinic matches and duplicate candidates.
   - Results showing original review text, supplied English translation, canonical clinic or unresolved status, and reasons for flags.
   - Download JSON output.
   - Clear, useful input errors.

2. A synthetic example dataset of approximately eight records using fictional clinics. Include:
   - Korean text with explicitly labelled prepared English translations.
   - Known clinic aliases.
   - An unknown clinic.
   - A repeated source record.
   - Identical text from different review IDs.
   - Similar but distinct reviews.
   - Missing optional information.
   Do not present fictional reviews as real patient evidence.

3. Deterministic processing:
   - Validate required IDs, source identifiers, clinic names and review text.
   - Normalise clinic names conservatively and match only an explicit alias map.
   - Never guess unknown clinics.
   - Flag repeated source+review ID records.
   - Flag matching normalised text within the same canonical clinic as possible duplicates.
   - Do not automatically merge or delete reviews, or equate identical wording with proven duplication.
   - Preserve source records and explain every flag.
   - Do not infer verified procedure, verified surgeon or translation accuracy from review text.
   - Render user-provided content as text, not HTML.

4. Use node --test for meaningful tests covering:
   - Alias matching and unknown clinics.
   - Repeated source IDs.
   - Identical text under different IDs.
   - Same text at different clinics.
   - Distinct reviews preserved.
   - Invalid input.
   - Deterministic output.
   Run the actual tests and fix failures.

5. Add a concise README with:
   - Purpose and design choices.
   - Exact local serving and test commands.
   - Input format.
   - Explicit limitations: synthetic data, prepared translations, no live ingestion or model calls, no independently verified clinical evidence.
   - GitHub Pages compatibility.
   Add PROMPTS.md containing this actual instruction and a short factual implementation decision log.

Constraints:
- Keep the implementation small.
- No scraping, live translation or medical recommendations.
- No artificial trust scores.
- Do not install dependencies.
- Do not commit, push, publish, deploy or submit yet.
- If time is tight, cut visual polish before processing and tests.
- Do not claim browser testing unless you actually performed it.

Expected output:
Files created, processing behaviour, exact test command and output, failures fixed, remaining limitations, and a local preview command.
Stop after building and testing so I can review.
```

## Implementation decision log

1. **UMD-style classic scripts instead of ES modules.** `processing.js` and `example-data.js` attach to `globalThis` in the browser and use `module.exports` in Node. One codebase serves the page and `node --test`, and the page also works from `file://`. No `package.json` is needed.
2. **The alias map is part of the input.** It sits in `clinics` rather than being hard-coded, so matching is explicit and editable. Conflicting aliases are rejected as a structural error.
3. **Clinic keys only remove whitespace and punctuation after NFKC and lower-casing.** There is no suffix stripping or fuzzy matching. Unknown names stay `unresolved` with a reason.
4. **Two duplicate signals with different meanings.** `REPEATED_SOURCE_RECORD` covers the same source and review ID. `POSSIBLE_DUPLICATE_TEXT` covers the same normalised text at the same matched clinic under a different ID. A pair that is already a repeat is not flagged a second time as a text duplicate. Unresolved clinics are excluded from text-duplicate checks.
5. **Invalid reviews are kept.** They are flagged `INVALID_RECORD` and listed in `errors`. Processing of valid reviews continues. A bad top-level shape or alias map returns `ok: false` with no records.
6. **Output keeps a JSON copy of each original record and records the translation status.** The status is `supplied-unverified` or `missing`. Output also includes fixed disclaimers. It contains no timestamps, so output is byte-for-byte deterministic, and a test checks this.
7. **The UI builds the DOM only through `createElement` and `textContent`.**
8. **Test results.** The `node --test` suite has 12 tests, and all passed on the first run, so no fixes were needed.

## Verification instruction (as given to Claude Code)

```
Goal:
Verify the existing prototype before publication. Spend no more than five minutes. Do not add features.

Context:
The build is complete and 12 processing tests reportedly pass. The browser interface has not been tested.

Instructions:
1. Inspect processing.js and app.js.
2. Check specifically:
   - Conflicting clinic aliases after normalisation cannot silently select a clinic.
   - Duplicate-text matching uses original review text, not supplied translations.
   - Repeated source-record keys cannot collide because of how source and ID are concatenated.
   - Invalid input cannot leave a previously successful export enabled or stale results presented as current.
   - User-supplied content is rendered as text.
   - Download JSON exports the current successful processing result.
3. Fix only concrete defects found. If you fix processing behaviour, add a focused regression test.
4. Run node --test and node --check app.js. Report exact results and exit codes.
5. Start the local server using python -m http.server 8000, preferably in a separate terminal.
6. If browser automation is already available, test loading examples, processing, invalid JSON and downloading output. Do not install browser tools.
7. Otherwise, state that manual browser verification is required.
8. Include the complete contents of processing.js and app.js in your response for independent review.
9. Append this actual prompt and factual findings to PROMPTS.md.

Constraints:
No new features, dependency installations, commits, pushes or deployment.
Do not claim checks you did not perform.
Stop after verification.
```

## Verification findings

Code review of `processing.js` and `app.js`:

- **Alias conflicts:** aliases that normalise to the same key under different clinic IDs were already rejected. **Defect fixed:** two clinic entries with the same `id` were accepted, and the later name silently overrode the earlier one. They are now rejected.
- **Empty alias keys:** **defect fixed.** An alias that normalised to an empty key (punctuation only) was accepted. A clinic name made only of punctuation could then silently match it. Such aliases are now rejected.
- **Duplicate text:** matching already used `original.text`, not `translationEn`. **Defect fixed:** text that normalised to an empty string (only symbols or emoji, e.g. "👍" vs "❤️") was flagged `POSSIBLE_DUPLICATE_TEXT`. It is now excluded from text comparison.
- **Record keys:** **defect fixed.** `source + '::' + id` collided for `("a::b","c")` and `("a","b::c")`. The key is now `JSON.stringify([source, id])`.
- **Invalid input after success:** already correct. A failed result clears the counts, results and disclaimers, and disables Download.
- **Rendering:** already correct. All user content goes through `textContent` or `createTextNode`.
- **Download:** already correct. It exports `lastResult`, which is set only by Process and only exported when `ok`.
- **Not fixed (behaviour note):** editing the JSON without clicking Process leaves the previous results visible and Download enabled for them. This was left as is because changing it would add behaviour.

Regression tests added: separator collision, duplicate clinic IDs and empty-key aliases, and symbol-only text. `node --test`: 15 tests, 15 pass, 0 fail, exit 0. `node --check app.js`: exit 0. The regression tests were written after the fixes and were not run against the old code.

Browser check (Playwright, already available in the session, against `python -m http.server 8000`):

- **Load example and Process:** counts 8 / 1 / 3, 8 cards, 4 flagged, Download enabled.
- **Download:** produced `review-intake-output.json`, byte-identical to `processReviews(EXAMPLE_INPUT)` run in Node.
- **Invalid JSON after a successful run:** error shown, counts reset to "–", 0 cards, Download disabled.
- **HTML and script payloads in the clinic name, ID, text and translation:** displayed as literal text. No elements were injected and no script ran.
- **Console:** the only error was a 404 for `/favicon.ico`.
- **Not tested:** mobile viewport rendering and dark mode. Temporary Playwright output (`.playwright-mcp/`) was deleted afterwards.

## Stale-export fix and publication instruction (as given to Claude Code)

```
Goal:
Fix stale export behaviour, verify it, and publish this assessment artifact to my public gangnam repository.

Context:
- Directory: D:\Claude\Agentic_Engineer_Assessment
- Origin: https://github.com/mathewmljourney93/gangnam.git
- Intended GitHub account: mathewmljourney93
- The current implementation passes 15 processing tests.
- Editing the JSON currently leaves previous results and their download enabled.

Instructions:
1. Inspect the current files and Git status.
2. Add a small shared invalidation function in app.js that clears lastResult, previous results, counts, disclaimers and errors, and disables Download.
3. Call it when the JSON editor changes and when Load example replaces the input.
4. Verify in the browser:
   - Load example and Process gives 8 / 1 / 3.
   - Download works after successful processing.
   - Editing input clears previous results and disables Download.
   - Loading the example again also invalidates previous output.
   - Processing malformed JSON shows an error and keeps Download disabled.
5. Run node --test and node --check app.js. Report actual results.
6. Append this actual prompt, the fix and factual verification results to PROMPTS.md. Update README verification notes accurately.
7. Inspect the files to be committed. Include only application source, example data, tests and documentation. Exclude temporary browser files, downloaded output, credentials and machine-specific files.
8. Rename the current branch to main if needed. Stage the intended files explicitly and commit with:
   Build review intake workbench prototype
9. Push normally using:
   git push -u origin main
   Do not force-push. If authentication or remote-history conflicts occur, report the exact error and stop.
10. Verify that git ls-remote origin refs/heads/main matches the local HEAD.
11. Report the commit hash, push results, final Git status and public repository URL.

Constraints:
- No new features or dependencies.
- Do not enable hosting or submit the assessment.
- If Git identity is missing, report it rather than inventing an email.
- Do not claim verification that was not performed.
```

## Stale-export fix

- **Change:** `app.js` gained `invalidate()`. It sets `lastResult = null` and renders an empty, not-ok result, which clears the errors, counts, disclaimers and result cards and disables Download.
- **When it runs:** on the editor's `input` event, and after Load example replaces the editor content.
- **Unchanged:** processing code and tests.

## Stale-export verification

- `node --test`: 15 tests, 15 pass, 0 fail, exit 0.
- `node --check app.js`: exit 0.
- Browser check (Playwright/Chromium, `python -m http.server 8000`, editor input entered with real key presses or Playwright `fill`):
  - **Load example, then Process:** counts 8 / 1 / 3, 8 cards, Download enabled.
  - **Download:** `review-intake-output.json` is byte-identical to `processReviews(EXAMPLE_INPUT)` run in Node.
  - **Typing a space at the end of the editor:** counts reset to "– / – / –", 0 cards, 0 disclaimers, no error box, Download disabled.
  - **Process again (8 / 1 / 3), then Load example:** counts reset, 0 cards, Download disabled.
  - **Malformed JSON `{"clinics": [], "reviews": [ oops`, then Process:** error "Input is not valid JSON: …" shown, counts "–", 0 cards, Download disabled.
  - **Console:** the only error was a 404 for `/favicon.ico`.
- Temporary Playwright output was deleted and is not committed.
