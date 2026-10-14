---
name: Frequency
description: An illuminated astrolabe for a research-to-composition pipeline — deep indigo void, antique gold discovery, speculative violet.
colors:
  void: "#0d0620"
  gold: "#c8a84b"
  violet: "#8b5cf6"
  violet-text: "#a78bfa"
  cream: "#f5f0e8"
  error: "#f87171"
  success: "#51c475"
  warning: "#e8b04a"
  info: "#a78bfa"
  gold-bright: "#dcc06a"
  glow-inner: "#1a0f35"
typography:
  display:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "clamp(1.5rem, 4vw, 1.875rem)"
    fontWeight: 300
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.14em"
  body:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: "normal"
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.18em"
  micro:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.3em"
rounded:
  l1: "6px"
  l2: "8px"
  l3: "12px"
  full: "9999px"
spacing:
  "1": "0.25rem"
  "1.5": "0.375rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.25rem"
  "6": "1.5rem"
components:
  button-solid:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.void}"
    typography: "{typography.label}"
    rounded: "{rounded.l2}"
    padding: "0.5rem 0.75rem"
  button-solid-hover:
    backgroundColor: "{colors.gold-bright}"
    textColor: "{colors.void}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.cream}"
    typography: "{typography.label}"
    rounded: "{rounded.l2}"
    padding: "0.5rem 0.75rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.cream}"
    typography: "{typography.label}"
    rounded: "{rounded.l2}"
    padding: "0.5rem 0.75rem"
  input:
    backgroundColor: "rgba(26, 15, 53, 0.45)"
    textColor: "{colors.cream}"
    rounded: "{rounded.l2}"
    padding: "0.5rem 0.75rem"
    height: "2.5rem"
    width: "100%"
  badge-gold:
    backgroundColor: "transparent"
    textColor: "{colors.gold}"
    rounded: "{rounded.full}"
    padding: "0.25rem 0.625rem"
  badge-violet:
    backgroundColor: "transparent"
    textColor: "{colors.violet}"
    rounded: "{rounded.full}"
    padding: "0.25rem 0.625rem"
  card:
    backgroundColor: "rgba(13, 6, 32, 0.72)"
    textColor: "{colors.cream}"
    rounded: "{rounded.l3}"
    padding: "1.25rem"
  nav-link:
    backgroundColor: "transparent"
    textColor: "rgba(245, 240, 232, 0.7)"
    rounded: "0"
    padding: "0.25rem 0.5rem"
  nav-link-active:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.void}"
    rounded: "0"
    padding: "0.25rem 0.5rem"
  section-heading:
    backgroundColor: "transparent"
    textColor: "{colors.gold}"
    typography: "{typography.headline}"
---

# Design System: Frequency

## Overview

**Creative North Star: "The Illuminated Astrolabe"**

_The North Star, its three founding principles, and the colour roles were carried forward from the incumbent `web/docs/zodiac-style-guide.md`; this document records them as the system-wide identity rather than newly choosing one._

Frequency is not a dashboard. It is a medieval precision instrument pointed at a research cosmos: a deep indigo void in which sources, extractions, hypotheses, recipes and compositions are plotted, glow when found, and dim back down when at rest. Every surface in the app — the 3D orrery home, the archive grids, the review queues — is built from the same three moves: a void that reads as active negative space rather than empty background, antique gold that marks anything discovered or confirmed, and speculative violet that marks anything still provisional. Nothing decorative sits on the void. Information emerges from it.

The register is deep, precise and quiet. Density is instrument-like: mono uppercase labels tracked wide, hairline gold rules, numerals that read as measurements. Type is a light-weight Cormorant Garamond serif that gives long-form editorial prose the bearing of an illuminated manuscript, offset by JetBrains Mono for anything that behaves like an instrument reading. Discovery — and only discovery — glows: bloom filters in the 3D scene, focus rings and border lifts in the 2D shell.

The confirmed anti-references are the generic SaaS dashboard, the grid of same-size icon cards, and light mode. There is no light theme and no plan for one; the void is the identity, not a colour-scheme preference. The product truth that constrains all of this is the pipeline itself — Sources → Extraction → Hypothesis → Recipe → Composition — which is why gold reads as "confirmed" and violet reads as "not yet".

**Key Characteristics:**

- Dark-only. The deep indigo void is the sole canvas; there is no light mode.
- Gold is earned, never ambient — it marks confirmation, discovery and the single primary action.
- Violet is speculation — hypotheses, drafts, unreviewed pairs.
- Elevation is a 1px hairline, not a shadow.
- Opacity carries epistemic state, but never below AA contrast.
- Mono uppercase, wide-tracked labels against light serif prose.
- Glow is a response to state, never a resting decoration.

## Colors

A cold indigo ground lit by two warm-vs-cool accents: gold for what is known, violet for what is proposed, parchment for what is read.

### Primary

- **Antique Gold** (`colors.gold`): The accent of discovery and confirmation. It carries pipeline markers, section headings, the "← Back" affordance, focus rings and outlines, hairline borders and dividers, active nav pills, and the single solid primary action per surface. As a border it lives at low alpha (12–22% at rest, 45–50% on hover or when active); as text it sits at 78% minimum and rises to full only when the element is engaged.

### Secondary

- **Speculative Violet** (`colors.violet`): Marks the provisional half of the pipeline — hypothesis surfaces, agent drafts, unreviewed concept pairs, concept tags, and the hypothesis domain rings in the orrery. Used as a border (24% rest, 50% when the queue item is active), a wash fill (5–12%), and as a heading colour. It is never the primary action.
- **Lifted Violet** (`colors.violet-text`): The text-safe step of the same hue, used wherever violet has to be legible at small sizes — sidebar eyebrows, inline labels, metadata.

### Neutral

- **Deep Indigo Void** (`colors.void`): The page ground and the substance of every panel. Cards are the void at 72% alpha over itself; the fixed header is the void at 70% behind a blur; the sticky review decide-bar is the void at 94%. Also the text colour on solid gold.
- **Inner Glow Indigo** (`colors.glow-inner`): A slightly lifted void used for the radial glow at the centre of the orrery and as the fill of input fields (at 45% alpha), so a field reads as a shallow well in the void rather than a box on top of it.
- **Parchment Cream** (`colors.cream`): All body copy, card text and headings that are not gold. Full strength for primary headings and values, 82% for long-form prose, 66% for secondary and meta copy.

### Tertiary

- **Signal Red** (`colors.error`): Error text and assertive live-region alerts only, plus the "blocked" side of a pass/fail check. It is the assertive end of the status vocabulary and never decorates anything.

### Semantic status roles

Four derived roles carry machine-reported state — pipeline status dots in the orrery, stance glyphs on evidence rows, pre-publish check borders. They are roles, not new accents: nothing chooses them for decoration, and they only appear where the backend has said something is passing, failing, waiting or needing a human.

- **Signal Green** (`colors.success`): Confirmed, extracted, active, in use, and a passing pre-publish check.
- **Signal Amber** (`colors.warning`): Needs review — the one state that asks a human to act. It is a lighter, warmer step than Antique Gold so the two never read as the same mark side by side.
- **Signal Info** (`colors.info`): Queued and text-ready — work the pipeline has accepted but not yet done. It is the same value as Lifted Violet, because "not yet" is already violet's job.
- **Bright Gold** (`colors.gold-bright`): The engaged step of Antique Gold — the solid primary button on hover, and the `promoted_followers` pipeline dot.

### Named Rules

**The Opacity Is Certainty Rule.** Opacity communicates epistemic state, not style: resting elements sit at reduced alpha and engaged elements rise. The observed tiers are fixed — cream text at 1.0 (primary headings and values), 0.82 (prose), 0.66 (secondary and meta, and the floor); gold labels at 0.78 (floor) rising to 1.0 when active; gold borders at 0.12–0.22 at rest and 0.45–0.50 on hover or when active; violet borders at 0.24 at rest and 0.50 when active; fills at 0.05–0.12. Borders and fills may go as low as the system needs. **Text may not.** 0.66 on cream and 0.78 on gold are AA floors, not starting points.

**The One Gold Action Rule.** A solid gold background is the primary action and there is at most one per surface (`UIButton variant="solid"`, plus the active nav pill, which is navigation state rather than an action). Everything else is an outline or a ghost. If two solid gold buttons appear in one view, one of them is wrong.

**The Lifted Violet Rule.** Speculative Violet is a surface, border, ring and heading colour — it only reaches 4.66:1 on the void at full alpha. Any violet text smaller than a heading uses Lifted Violet instead.

## Typography

**Display Font:** Cormorant Garamond (with Georgia, serif)
**Body Font:** Cormorant Garamond (with Georgia, serif)
**Label/Mono Font:** JetBrains Mono (with monospace)

Both families are self-hosted through Fontsource; there is no CDN dependency. Cormorant at weight 300–400 gives the long-form essay and composition surfaces the air of an illuminated manuscript — high contrast strokes, generous line height, slightly negative tracking on large titles. JetBrains Mono, always uppercase and always tracked wide, does the instrument work: labels, badges, metadata, button faces, timestamps. The pairing is the whole voice of the product in two typefaces — the manuscript and the measuring device.

### Hierarchy

- **Display** (300, `clamp(1.5rem, 4vw, 1.875rem)`, 1.3): Page and detail-page titles; steps from 1.5rem to 1.875rem at the medium breakpoint. Essay cards and the featured essay push the same face larger (20–36px) and the essay hero to 48–60px, all at the poster line height of 1.08 with −0.01em tracking.
- **Headline** (400, 0.75rem, 0.14em, uppercase, gold): Section headings and dividers inside cards and detail pages. This is the mono face, not the serif — a heading in this system reads as an instrument legend.
- **Title** (300, 34 / 24 / 22 / 18px, 1.15–1.3): The orrery sidebar's four-step title ladder — 34px for the selected sector, 24px for a domain, 22px for a sub-panel, 18px for an item row. Light weight throughout; gold from 24px down.
- **Body** (400, 1rem / 1.75 in prose, 14px / 1.65 in dense panels): Body copy at 1rem and above runs at 1.75 line height; below 1rem, including mono code and data blocks, it runs at 1.65. Markdown prose sits at cream 82%; sidebar and card body copy at 14px and cream 66%. Prose measure is capped at 48rem (or 72ch on text-only pages).
- **Label** (400, 0.75rem, 0.14–0.20em, uppercase, mono): Field labels, back links, metadata lines, button faces (0.18em), badges (0.20em). Letter-spacing is what makes a label a label.
- **Micro** (400, 10px, 0.30–0.40em, uppercase, gold at 78%): Eyebrows above titles and stat cells. This is the smallest type in the system and it is a hard floor.

### Named Rules

**The Ten Pixel Floor Rule.** No text renders below 10px, and 10px is reserved for wide-tracked uppercase eyebrows and stat labels. Dense panel body copy starts at 14px; prose starts at 16px. Any size that "needs" to be 8 or 9px is a label that should be 10px, or content that should not be there.

**The Tracked Caps Rule.** Uppercase in this system is always mono and always tracked to at least 0.14em. Uppercase serif, or untracked uppercase, reads as a mistake rather than an instrument.

**The Token Rule.** Every value in a Panda style is a token. `web/panda.config.ts` turns on `strictTokens` and `strictPropertyValues`, so a raw value fails the web typecheck. The typography tokens are the steps above: line heights `poster` 1.08, `display` 1.3, `label` 1.4, `dense` 1.65 and `prose` 1.75; tracking `display` −0.01em, `label` 0.14em, `labelWide` 0.18em, `labelWider` 0.2em and `micro` 0.3em; `fontSizes.micro` 10px; measures `sizes.measure` 72ch and `sizes.reading` 48rem; `sizes.container` 1200px; and the borders `hairline` (1px) and `focus` (2px). New type snaps to the nearest step for its role. A value that is not a design decision, such as a `calc()` offset or a gradient, uses Panda's `[...]` escape hatch, which keeps it easy to grep.

## Layout

The shell uses a fixed header with a wordmark, grouped Ark UI Solid Navigation Menu, and global search. Its actual height is measured into `--app-header-height`, which reserves space on `main`. The navigation stays on one row: Home, Research, Compose, Library, and Operations. Below 851px, one Menu trigger opens a scrollable panel containing Home and the four groups; search remains beside it. Menus overlay the page without changing header height.

Content pages use one container: a centred grid capped at 1200px, 1rem of padding on mobile and 1.5rem from the medium breakpoint up, with a 1.5rem gap between stacked sections. Reading surfaces narrow further — essay and correspondence bodies cap at 48rem or 72ch — because the serif body face needs a short measure.

Collections are responsive grids, not fixed columns: one column on mobile, two at the medium breakpoint, three at extra-large, with gaps stepping 1rem → 1.25rem → 1.5rem. The 3D home is the one split layout — below the large breakpoint the canvas takes 60vh above a full-width panel; at large and up it becomes a flexible canvas beside a fixed 355px sidebar with a gold hairline seam between them.

Spacing follows the Panda scale and in practice only seven steps are used: 0.25, 0.375, 0.5, 0.75, 1, 1.25 and 1.5rem. Card padding is 1.25rem; the orrery sidebar uses a looser, hand-set instrument rhythm (26px horizontal, 14–36px vertical) because it is one contiguous instrument face rather than a stack of cards.

Any scrollable container that is not the page itself takes the `.zodiac-scroll` treatment: a 5px track, a thumb that is fully transparent at rest, fades to gold at 25% when the container is hovered, and 45% when the thumb itself is hovered.

## Elevation & Depth

This system is flat and tonal. Depth comes from two sources only: 1px hairline borders in gold at low alpha, and the translucency of the void layered over itself — a card is the void at 72% on the void, a field is the inner glow at 45%, the decide-bar is the void at 94%. There is no ambient shadow, no resting elevation ramp, and no surface-container scale. The fixed header's 8px backdrop blur is the one intentional glass surface in the product, and it exists to keep the nav legible over scrolling content, not to create hierarchy.

Shadows exist, but only as state. Essay cards cast a deep diffuse shadow when hovered, together with a 2–3px lift and a border that brightens from 22% to 48% gold. The sticky review decide-bar casts an upward shadow so it reads as detached from the queue scrolling beneath it. Recipe cards emit a faint gold glow on hover. In the 3D scene, glow is a Gaussian bloom applied to the hub and to interaction-triggered highlights, never to resting geometry.

### Shadow Vocabulary

- **Card hover lift** (`box-shadow: 0 22px 48px rgba(0, 0, 0, 0.24)`): Essay and essay-detail cards on hover, paired with `translateY(-3px)`.
- **Detached bar** (`box-shadow: 0 -12px 40px rgba(13, 6, 32, 0.6)`): The sticky review decide-bar, casting upward against the queue.
- **Gold discovery glow** (`box-shadow: 0 0 12px rgba(200, 168, 75, 0.08)`): A faint bloom on recipe cards on hover — the 2D echo of the orrery's bloom filter.

### Named Rules

**The Hairline Rule.** Elevation at rest is a 1px border, never a shadow. A surface earns a shadow only in response to a state — hover on essay cards, stickiness on the decide-bar. If a new surface wants a resting shadow, it wants a hairline instead.

**The Glow Is A Verb Rule.** Glow reports that something happened: found, focused, selected, hovered. A permanent glow on a resting element is decoration, and decoration does not sit on the void.

## Shapes

Corners are quiet. The Park UI `lg` radius scale gives three steps and all three are in use: `l1` (6px) for inline code and small inset blocks, `l2` (8px) for every control — buttons, inputs, selects, textareas — and `l3` (12px) for every card, panel and the decide-bar. Badges are the one full-round shape, taking the pill radius so they read as tokens rather than blocks.

Borders are uniformly 1px and uniformly hairline. There is no 2px border anywhere except the markdown blockquote's left rule and the focus outline; there are no dashed borders in the 2D UI (the dashes belong to the orrery's pipeline rings).

The orrery sidebar is deliberately square: its instrument controls — domain buttons, workspace grid, back and motion toggles — carry no radius at all. Squared corners inside the astrolabe panel and rounded corners in the document surfaces is the intended contrast, not drift.

The one recurring geometry outside the 3D scene is the gold hairline divider: a full-width 1px rule in gold at 22%, used between detail-page sections and inside markdown, with 1.5rem of air above and below.

## Components

The component character is refined and restrained: thin gold outlines, wide-tracked mono uppercase faces, and colour that shifts by a few percent of alpha rather than by swapping hues.

### Buttons

- **Shape:** Softly rounded (`rounded.l2`, 8px), 1px border on every variant including ghost, mono uppercase at 0.75rem tracked 0.18em, 0.75rem/0.5rem padding, 0.5rem gap for an optional icon.
- **Solid (primary):** Gold fill, gold border, void text; on hover both fill and border step up to Bright Gold. Reserved by the One Gold Action Rule for the single primary action on a surface. The face stays quiet at rest and brightens rather than dims when engaged.
- **Outline (default):** Transparent fill, gold border at 45%, cream text; on hover the border rises to 75% gold and the label holds at full cream. This is the default variant and the one most buttons should use.
- **Ghost:** Transparent fill and border, cream text at 72%, gaining a gold wash at 8% and full cream text on hover. Use for tertiary and destructive-adjacent actions inside a dense row.
- **Focus:** Every variant takes the same treatment — a 2px solid gold outline with 2px offset. The focus ring is the most gold thing on any screen, and that is deliberate.
- **Disabled:** 50% opacity and `not-allowed`; no colour change.

### Badges

- **Style:** Fully rounded pill, transparent fill, 1px border, mono uppercase tracked 0.20em, 0.25rem/0.625rem padding. Long values wrap anywhere rather than overflowing.
- **Tones:** Gold (confirmed, pipeline state) at 45% border; violet (speculative, draft) at 45% border; cream (neutral metadata) at 38% border. Text takes the tone's full-strength colour.
- The badge face is 10px, in line with the Ten Pixel Floor Rule. It was 8px until this pass; do not reintroduce 8px anywhere.

### Cards / Containers

- **Corner Style:** Gently rounded (`rounded.l3`, 12px).
- **Background:** The void at 72% over the page — translucent, so the ground reads through. Essay archive cards go denser (92%) because they carry a hover shadow; featured cards go lighter (45%).
- **Border:** 1px gold at 22%, brightening to 45–48% on hover for interactive cards.
- **Shadow Strategy:** None at rest. See Elevation & Depth.
- **Internal Padding:** 1.25rem.
- **Glass variant:** An opt-in 8px backdrop blur for cards that overlay the 3D canvas. Do not use it on ordinary document surfaces.

### Inputs / Fields

- **Style:** Inner-glow indigo at 45% fill, 1px gold border at 28%, `rounded.l2`, cream text in the mono face at 0.875rem, full width, 2.5rem minimum height. Textareas add a 7rem minimum height and vertical-only resize. Placeholders are cream at 50% — placeholder text only, never content.
- **Focus:** The border goes full gold and a 2px gold outline appears at 1px offset. Border and outline together, so the field reads as lit rather than merely outlined.
- **Labels:** Mono uppercase at 0.75rem tracked 0.14em, cream at 75%, sitting above the field with 1rem of air above and 0.375rem below.
- **Error:** Errors are not styled onto the field. They surface in the notice region (see below) in Signal Red.

### Navigation

- Ark UI Solid's `NavigationMenu` owns triggers, link semantics, keyboard movement, and content visibility. The shell uses the installed 5.39.3 release.
- `web/src/lib/app-navigation.ts` groups every destination and supplies the same catalog to global search. `web/src/components/app-navigation.tsx` renders the menu and uses TanStack links for client-side routing.
- Desktop controls are square, 44px high, in the mono face. The active page or group receives a gold underline; the open trigger receives a hairline outline. No wrapping row of destination pills.
- Menu panels attach directly beneath their own trigger, sharing its right edge and opening its bottom border into the panel. The trigger and panel use the same indigo fill, including on hover, with a continuous gold hairline around their combined outline. Desktop menus use a compact single column of title/description links. Active links use a quiet gold wash. Mobile uses the same connected outline with one scrollable panel of named groups.
- Menu links use a subtle gold wash on hover and press. Navigation headers have no press flash or animated chevron rotation. Tab focus uses the shared gold outline. Escape closes the open menu without leaving a focus border.
- Global search opens a native modal dialog on every page with Command/Control+K, with a platform-specific shortcut hint in the header. The combobox keeps input focus while arrow keys select results; Enter opens a result, Tab stays within the dialog, and Escape dismisses without leaving a focus border. It searches site pages, indexed concepts, essay titles, and bounded recent research; results state the scope. The palette uses a centered indigo panel, a gold hairline, and a dim backdrop without entrance animation.

### Notice Regions

The signature accessibility primitive: two always-mounted live regions — a polite `role="status"` in cream at 75% and an assertive `role="alert"` in Signal Red — rendered unconditionally so assistive tech observes them before text arrives, and visually hidden via `:empty` (never `display: none`, which would drop them from the accessibility tree) so they cost no layout at rest. Status and error messaging goes here, not into ad-hoc coloured paragraphs.

### The Orrery Sidebar

The 3D home's right-hand panel is the system's reference instrument face: a 355px column of hairline-separated sections, each opening with a 10px gold eyebrow tracked 0.30–0.40em, then a light-weight title from the 34/24/22/18px ladder, then 14px body copy at 66% cream. Stat cells are bordered boxes — gold border for confirmed counts, violet for speculative ones — with a 26px numeral over a 10px tracked label. Controls are square-cornered. A fixed, non-interactive gold dot grid at 2.2% opacity lies over the whole surface as the parchment grain of the void.

## Do's and Don'ts

### Do:

- **Do** build depth from hairlines and translucency — 1px gold borders at 12–22% over the void at 45–94% alpha.
- **Do** keep exactly one solid gold surface per view: the primary action, or the active nav pill.
- **Do** use violet for anything unreviewed, drafted or hypothesised, and gold for anything confirmed.
- **Do** switch to Lifted Violet the moment violet text drops below heading size.
- **Do** hold cream text at 0.66 alpha or above and gold labels at 0.78 or above, however faint the surrounding chrome is.
- **Do** set uppercase in JetBrains Mono with at least 0.14em of tracking.
- **Do** cap prose measure at 48rem (or 72ch) and run it at 1rem with 1.75 line height.
- **Do** give every interactive element the same 2px gold focus outline.
- **Do** guard hover lifts and the orrery's auto-rotation behind `prefers-reduced-motion`.
- **Do** put status and error text in the always-mounted notice regions.
- **Do** apply `.zodiac-scroll` to any inner scroll container.

### Don't:

- **Don't** add a light theme, a light surface, or a white card. The void is the identity.
- **Don't** give a surface a resting box-shadow; shadows are a response to hover or stickiness only.
- **Don't** set text below 10px, and don't use 10px for anything but a wide-tracked uppercase eyebrow or stat label.
- **Don't** use backdrop blur outside the fixed header and the opt-in glass card over the 3D canvas.
- **Don't** introduce a new accent hue. Gold, violet and the status roles are the whole vocabulary, and the status roles are only for state the system reports — never for emphasis.
- **Don't** let a decorative element sit on the void — every mark should be information emerging from it.
- **Don't** build a grid of equal-weight icon cards or any other generic dashboard furniture.
- **Don't** round the orrery sidebar's instrument controls, and don't square the document cards.
- **Don't** style errors onto the input border; the notice region carries them.
- **Don't** write a raw `rgba()` colour into a style object. Every colour is a `zodiac.*` token, and alpha is the `token/NN` modifier.
- **Don't** apply glow to a resting element.
