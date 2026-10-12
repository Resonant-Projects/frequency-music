# Read essays

Readers browse the essay archive, reveal older writing, open the full text and move between essays without creating research records.

## Sub-features

- `essays-archive` shows the latest dispatch, counts and the first 24 archive cards.
- `essays-more` reveals 24 further cards and focuses the first new title.
- `essays-detail` opens full text through latest, archive, newly revealed and related title cards.
- `essays-reload` loads a detail URL directly after reload.
- `essays-entry` opens the archive through desktop/mobile navigation and all search controls.
- `essays-search-detail` opens an essay title result from Search Frequency.
- `essays-missing` reports an unknown slug without showing stale text.

## How to get to it (user POV)

- Navigate to `/essays` or an existing `/essays/<slug>` URL.
- Desktop header: `Library`, then `Essays`.
- Mobile header: `Open navigation menu`, then the `Essays` link under Library.
- Header `Search Frequency`, `Meta+k`, or `Control+k`, then the `Essays Page` result.
- Choose a Latest dispatch title, an Archive title, a newly revealed title after `Show more`, or a Continue Reading card.
- Search for an essay's displayed title and choose its `Essay` result.
- On a detail page, choose its `Essays` back link.

## Driving it with Playwright

Preconditions:

- Doctor passes for the owned local frontend and a fresh Chromium context.
- The real committed corpus has at least 49 essays. Missing corpus/pagination data is a failure, not a skipped pagination assertion.

Run `./.cursor/skills/verify-frequency-music/scripts/control.py drive <run-id> essays`.

- Archive: `page.goto(base + '/essays')`. `main.getByRole('heading', { name: 'Essays', exact: true })` is visible and the title is `Essays — Frequency Music`. `main.locator('a[href^="/essays/"]')` has 25 links, one latest and 24 archive cards.
- Latest: choose `titles.first().click()`. Save its displayed title and href before clicking. The destination URL, matching H1, `Essay text`, body text and `Continue Reading` heading prove a full read, not a card-only render.
- Direct detail: `page.reload()` at the selected detail URL. The same H1 and Essay text return.
- Related: choose the first detail `main` link whose href starts with `/essays/`. A different full essay opens. Choose `main.getByRole('link', { name: 'Essays', exact: true })` to restore the archive.
- Archive: choose `titles.nth(1)` and prove its full text. Return with the Essays back link.
- Pagination: `page.getByRole('button', { name: 'Show more', exact: true }).click()`. Require 49 title links and focus on `titles.nth(25)`, then open that newly revealed essay and prove its body. Return to the archive.
- Desktop entry: choose `navigation.getByRole('button', { name: 'Library', exact: true })` and `navigation.getByRole('link', { name: /^Essays/ })`. The archive is visible.
- Mobile entry: `page.setViewportSize({ width: 390, height: 844 })`, choose `Open navigation menu`, then its `Essays` link. Require archive visible. Restore desktop size.
- Search entries: for the toolbar button, `page.keyboard.press('Meta+k')`, and `page.keyboard.press('Control+k')`, open Search Frequency. Fill its named combobox with `Essays`. Choose the option named `Essays Page` and require the archive and a closed dialog for each entry.
- Essay search: open the toolbar palette, fill its combobox with the observed latest title and click the matching option in `getByRole('group', { name: 'Essays', exact: true })`. Require that title's full detail H1.
- Missing: `page.goto(base + '/essays/verification-nonexistent-essay')`. Require `Essay not found.` and title `Essay not found — Frequency Music`.
- Proof: `<run-id>/essays-actions.jsonl`, numbered PNG/ARIA pairs, `essays-trace.zip`, `essays-console.json`, and `essays-result.json` must survive cleanup. HTTP writes, external requests and page errors fail this read-only proof.

## Gotchas

- Latest title changes with the corpus. Observe its real title/href; never seed a fake latest essay or set router state internally.
- Header menus include descriptions in link names, so use `^Essays` there and exact `Essays` for the main back link.
- The card count assumes the current page size of 24. A real design change requires a recipe/helper update.
- The first related card excludes the current essay. Reload before opening it if you need to prove direct-route loading.
- Search also requests live research. Local results are real, but backend requests to port 9 remain unavailable. This recipe does not assert global search completion or auth correctness.
