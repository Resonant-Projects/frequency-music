# Search Frequency

Users find local page and essay titles through the search palette, select a result and return to navigation. Live research and composition search also exist, but require backend data.

## Sub-features

- `search-entry` opens the palette with the toolbar, Meta+k or Control+k.
- `search-pages` opens the Essays page result.
- `search-essays` opens a real displayed essay title result, covered by the essays journey.
- `search-selection` highlights one result and resets the selection when typing.
- `search-dismiss` supports Escape and Close search, resetting the query on reopen.
- `search-live` completes concepts/research/composition queries and distinguishes no matches from failures. Blocked in the default mode.

## How to get to it (user POV)

- Choose the header button named `Search Frequency`.
- Press `Meta+k` or `Control+k` from a page.
- Choose a result with a pointer, or highlight with ArrowDown/ArrowUp and press Enter.
- Close with Escape, `Close search`, a repeat shortcut or a backdrop click.

## Driving it with Playwright

Preconditions:

- Doctor passes. Local page/essay paths work without backend rows.
- For `search-live`, provide an approved isolated backend seeded with a known concept, source, composition and an absent query. Without that precondition report failure; never call pending data an empty result.

Run `./.cursor/skills/verify-frequency-music/scripts/control.py drive <run-id> search`. This command covers the local subset only. The essays journey separately covers essay title results. Backdrop and shortcut-toggle entry points below need separate proof if claiming the entire search feature.

- Toolbar and both shortcuts: click the exact Search Frequency button or press Meta+k/Control+k. The dialog `Search Frequency` is visible and its named combobox is focused. Fill `Essays`, choose `getByRole('option', { name: 'Essays Page', exact: true })`, require archive visible and dialog hidden, for all three entries.
- Selection: reopen with Control+k. Fill `es`, wait for Essays Page, press ArrowDown and require exactly one selected option. Fill `essa`; require zero selected options. Changing the query must clear stale selection.
- Escape/reset: press Escape and require dialog hidden. Reopen with Control+k and require empty combobox. Click `Close search` and require hidden dialog.
- Keyboard open result, additional recipe: reopen, fill `Essays`, wait for the exact option, press ArrowUp, require one selected option, then Enter. Require `/essays` and hidden dialog.
- Shortcut toggle, additional recipe: open with Control+k, press Control+k again and require hidden dialog.
- Backdrop, additional recipe: open the dialog and click `page.mouse.click(5, 5)` at desktop size, matching the existing E2E backdrop test. Require hidden dialog. This is the one coordinate-driven dismissal, not result selection.
- Live completion, blocked recipe: with the seeded isolated backend, fill the known concept title, wait until `getByRole('listbox', { name: 'Search results' })` has `aria-busy='false'`, choose the matching option in `Concepts & recent research`, and require the matching connection inspector. Repeat with the absent query and require `No matches. Try a different name or title.` only after busy is false and no error alert is present.
- Proof: action log, named-result ARIA state, screenshot, trace and `search-result.json`. Report the command's local subset separately from the unexecuted additional and live recipes.

## Gotchas

- Query length two or greater subscribes to backend research and compositions even when local results already appear.
- Research concepts debounce for 180 ms. Wait on semantic state rather than a fixed delay.
- Local results do not prove `search-live`, empty-state handling, or complete result coverage.
- Repeating a shortcut toggles the palette. A held key's repeat event should not flicker; the existing navigation E2E spec covers that separately.
