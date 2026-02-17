## Minimal Schema (Loop-Critical Only)

> This is the smallest durable shape that supports: weekly briefs, micro-studies, comparisons, versioning, and public write-ups later.

### inboxItems
- `id`
- `type`: `pdf | url | youtube | rssItem | notionPage | voiceTranscript`
- `title`
- `url?`
- `fileRef?`
- `capturedAt`
- `origin`: `rss | notion | manual | webhook`
- `status`: `new | extracted | ignored`

### sources
- `id`
- `inboxItemId?`
- `canonicalUrl?`
- `title`
- `author?`
- `publishedAt?`
- `rawTextRef?` (or chunk refs)
- `visibility`: `private | public`
- `licenseNotes?`

### extractions
- `id`
- `sourceId`
- `model`
- `promptVersion`
- `summaryBullets[]`
- `claims[]`: `{ text, snippetRef, evidenceType, actionability }`
- `parameters[]`: `{ name, value, unit, notes? }`
- `concepts[]`
- `createdAt`

### hypotheses
- `id`
- `version`
- `status`: `draft | queued | active | evaluated | retired`
- `resolution?`: `supported | inconclusive | contradicted`
- `statement`
- `targetMetrics`: `{ bodily, goosebumps, earConsonance, musicality, composability }`
- `rationaleLinks[]`: pointers to claims/notes/sources
- `createdAt`
- `supersedesHypothesisId?`

### recipes
- `id`
- `hypothesisId`
- `bars`: `16 | 24 | 32` (default 16–32)
- `timeSignature`: default `4/4`
- `bpmTarget?`
- `bpmRange?`: `{ min, max }`
- `tuningSystem`
- `referencePitchHz?`
- `pitchRules`
- `harmonyRules`
- `rhythmRules`
- `timbreRules`
- `arrangementSketch`
- `expansionPath`
- `createdAt`

### protocols
- `id`
- `recipeId`
- `studyType`: `litmus | comparison`
- `durationSeconds`
- `panelPlanned[]`: `self | wife | colleague`
- `listeningContextPlan`
- `baselineArtifactId?`
- `whatVaries[]`
- `whatStaysConstant[]`
- `createdAt`

### artifacts
- `id`
- `recipeId`
- `protocolId`
- `type`: `microStudy | expandedStudy | fullTrack`
- `versionLabel`: e.g. `v0.1`
- `audioUrl?`
- `projectLink?` (DAW project folder link)
- `renderNotes`
- `createdAt`

### observations
- `id`
- `artifactId`
- `listenerRole`: `self | wife | colleague`
- `listeningContextActual`
- `scores`: `{ bodily, goosebumps, earConsonance, musicality, composability }` (0–5)
- `computed`: `{ pitchConsonance01?, audioConsonance01? }`
- `notes`
- `verdict`: `expand | revise | retire | hold`
- `createdAt`

### weeklyBriefs
- `id`
- `weekOf` (YYYY-MM-DD)
- `generatedAt`
- `sourceIdsIncluded[]`
- `experimentHypothesisIds[]`
- `contentMarkdown` (store the rendered brief)
