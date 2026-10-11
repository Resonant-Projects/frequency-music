---
version: 1
slug: "web-src-routes-zodiac-3d-tsx"
primary_target: "web/src/routes/zodiac-3d.tsx"
related_targets: ["web/src/lib/knowledge-atlas.ts","web/src/lib/knowledge-atlas-scene.ts","web/src/routes/knowledge-atlas.css"]
---

# Home knowledge atlas

Mode: Operate, with spatial exploration. The user requested a complete 3D organizational display for seeing connections. Existing product truth comes from DESIGN.md, the zodiac style guide, and the live graph contracts. User-confirmed priority: connection exploration in a full viewport space with minimal surrounding UI.

## Direction contract

THESIS: A navigable knowledge atlas makes the research graph visible and explains each selected relationship.

OWN-WORLD: Preserve Frequency's indigo, gold, violet, Cormorant and mono instrument labels. Domain constellations occupy a dimensional astrolabe, with different geometry for concepts and pipeline records.

STORY: Survey domains, find a named object, select it, then follow the listed and illuminated connections. Distinguish organization from recorded relationships.

FIRST VIEWPORT: The space fills the viewport beneath the global navigation. Selecting an object slides the inspector over its right edge. Camera and layer controls remain visible; search lives in the global header.

FORM: Code-led implementation of the user's pinned 3D organizational space inside the existing astrolabe world. No replacement brand or raster assets.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Implemented behavior

The home extends the existing astrolabe identity. `DESIGN.md` records the updated shared navigation; `.impeccable/design.json` remains unchanged. The atlas uses the existing zodiac colors, Cormorant Garamond and JetBrains Mono, square instrument controls, gold hairlines, and a single primary action in the inspector. Its full viewport map and sliding inspector are local choices, not new global tokens.

- `web/src/lib/knowledge-atlas.ts` owns graph assembly, identity-based positions, neighborhood selection, and relationship labels. Six outer domain constellations organize concepts; inner orbits organize sources, extractions, hypotheses, and recipes. Placement does not imply a relationship.
- `web/src/lib/knowledge-atlas-scene.ts` owns geometry, camera controls, projected HTML labels, pointer selection, and rendering. Node shapes distinguish record kinds. Selection emphasizes the object and its recorded neighbors. Curves have no arrows and do not encode evidence strength or causation.
- `web/src/routes/zodiac-3d.tsx` owns subscriptions, layers, selection history, and the inspector. Selecting research can add returned neighbors beyond the initial sample. Back retains previously discovered objects. Collection links lead to the relevant workspace.
- `web/src/routes/knowledge-atlas.css` owns this page's layout and controls. The space fills the viewport below the measured shell header. Selection opens an overlay drawer and focuses its heading; Focus in space closes the drawer and returns focus to the map. Coarse pointers receive controls at least 44px tall.

Space is the only view. The user removed the page header, separate domain navigation, coverage strip, pipeline footer, and duplicate workspace links. Domains remain selectable through their projected labels and global search. The inspector has no heading strip or Clear button. Escape resets the selection and closes the drawer without transferring focus or leaving a focus ring. Back navigation stays pinned at the bottom of the inspector while its content scrolls. Relationship rows align an icon beside the title, with type and relationship in one metadata row underneath; the relationship footnote is removed. Back to overview also closes the drawer. Inactive layers use muted text and dimmed marks, without a strikeout. The entire layer bar is hidden at mobile widths (700px and below), allowing the canvas to fill the freed space. Hidden drawer contents are inert. Reduced motion disables drawer motion, rotation and camera tweening. Rendering pauses while the scene is hidden or offscreen.

`web/src/components/site-search.tsx` adds a native modal search palette to the global header, with Command/Control+K, a platform-specific shortcut hint, combobox result selection that retains input focus, Enter navigation, and Escape dismissal without a leftover focus ring. Results lazy-load in `site-search-results.tsx`: site pages, indexed concepts, essay titles, and existing bounded recent pipeline/composition queries. Its scope is displayed in the results. `space-navigation.tsx` carries a selected search result into the home inspector from any route. The search is not a full-text index of the entire research archive. WebGL failure directs users to this search.

## Coverage and review limits

The initial graph contains recent pipeline research and up to 24 concepts per domain. The user removed the always-visible coverage and totals strips. Missing connections in the sample do not establish that none exist. Selection errors, retry, loading, and empty states remain in the drawer. Global search reports partial query failures.

Documentation review sampled the route, stylesheet, graph helpers, scene code, relationship tests, and saved desktop and mobile-selection captures in `.impeccable/review/`. Earlier captures show the superseded stacked layout. The refinement adds browser tests for viewport bounds, drawer selection, dismissal and focus, global search navigation, and mobile sizing. They do not establish complete live graph coverage.

Live review encountered an existing `leanConcept` return-validation failure when a concept contained `lastProbedAt`. The local fix in `convex/graph.ts` omits that internal field, and `harness/graph.harness.test.ts` adds a domain-query and detail-query regression. No backend deployment was performed; live validation of the repaired response remains outstanding.

The older zodiac guide's disc dimensions and renderer description describe the previous scene. Its new atlas subsection identifies the current geometry files. Existing global documentation drift, including older typography and glow prescriptions, is outside this page's scope and was not canonized as atlas guidance.

## Header and footer refinement

The shell uses Ark UI Solid Navigation Menu 5.39.3 with Home and four groups: Research, Compose, Library and Operations. Each desktop dropdown attaches to its active trigger with a continuous border, matching background, and aligned right edge. Mobile exposes the same destinations through one attached Menu panel. Route changes and Escape close the menu; search remains in the header. The atlas workbench defines a shared CSS grid row for the layer bar and inspector footer, so their dividers and content centers align even when controls wrap.
