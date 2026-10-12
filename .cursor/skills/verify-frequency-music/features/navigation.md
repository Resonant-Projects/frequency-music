# Use navigation

Users open grouped destinations from the desktop header or a single mobile menu and dismiss menus with the keyboard.

## Sub-features

- `nav-desktop` shows Research, Compose, Library and Operations links.
- `nav-keyboard` opens a group with Enter and moves focus with ArrowDown.
- `nav-dismiss` closes a group with Escape.
- `nav-mobile` opens Menu and follows Essays without retaining an open panel.

## How to get to it (user POV)

- Desktop header buttons `Research`, `Compose`, `Library`, `Operations`.
- Focus a desktop group and press Enter, then ArrowDown.
- At 390 pixels wide, choose `Open navigation menu`.
- The header Home link opens `/`, but its live 3D knowledge data is outside this local-menu recipe.

## Driving it with Playwright

Preconditions:

- Doctor passes and the essay archive is usable. This proves menu access, not backend route content.

Run `./.cursor/skills/verify-frequency-music/scripts/control.py drive <run-id> navigation`.

- Desktop: scope to `page.getByRole('navigation', { name: 'Main navigation' })`. Click each exact group button. Require visible links Research: Ingest, Display, Hypotheses, Theses, Correspondences, Triage; Compose: Recipes, Compositions, Feedback, Listen; Library: Essays, Weekly Turns, Editorial, Failures; Operations: Agent Runs, Review Queue, Admin. Use link names beginning with the label because descriptions are part of the accessible name.
- Dismiss: after each group, `page.keyboard.press('Escape')`. `.app-menu-panel:visible` has count zero.
- Keyboard: focus the exact Library button; press Enter and ArrowDown. Require `.app-menu-panel:visible a` first link focused; Escape dismisses it.
- Mobile: set viewport 390 by 844. Choose `Open navigation menu`, then the link named `/^Essays/`. Start from a real local essay detail route; require link target `/essays`, the resulting archive URL, a hidden menu panel and `aria-expanded=false` on the trigger. Capture the mobile resulting state. Desktop Essays selection is checked from a detail route too.
- Proof: `navigation-actions.jsonl`, numbered PNG/ARIA pairs, trace and `navigation-result.json` record each entry and outcome.

## Gotchas

- Desktop groups unmount when closed; require visible elements, not just a stale hidden link.
- At widths 850 or below, use the mobile trigger, not invisible desktop buttons.
- Home and backend destination behavior are unverified by a visible menu link. Add dedicated journeys with their own seed requirements before claiming those routes work.
