# Feedback: The Evidence Budget

## Overall Impression

“Evidence budget” is a productive phrase, but the essay never makes it precise enough to unify its examples. Sometimes the budget means quantity of available input, sometimes time before action, sometimes feature diversity, sometimes metadata access, and sometimes environmental information. These resources are not fungible, so “amount” is misleading. The piece would be stronger if it defined an evidence budget as a task-specific allocation across channels, time, and prior knowledge, then stated that no single scalar measures it. The musical extrapolations are often compelling, particularly revealing rhythm early and harmony late, but they need clearer separation from the papers’ empirical findings.

## Structure and Argument

The source/temporal/spatial organization is sensible, yet the opening previews five domains while the body adds and drops examples unevenly. Infant cry analysis appears under temporal evidence even though the cited feature fusion concerns representation as much as time. Room generation is called a “quiet third term,” though the earlier working parameter ultimately names five budgets. Reorganize around the final taxonomy—source, temporal, feature, metadata, room—and use one or two sources per category rather than forcing every paper into a tripartite arc.

Several relationships are asserted as parallels without showing a shared constraint. SR-CorrNet’s architectural bottleneck and FSD50K-Solo’s curation pipeline both concern evidence quality, but an RIR generator conditioned on text/images has a generative inverse problem, not necessarily a deadline or budget. Explain what is limited in each case and what action must follow.

The composition section should address tradeoffs. More evidence does not always improve a judgment if channels conflict or introduce shortcuts. Nor does “withholding” evidence necessarily create an artistic budget unless a listener had a plausible route to that evidence. The ending is lyrical, but “where signal processing becomes composition” overclaims; describe it as one transferable design lens.

## Clarity and Flow

Many empirical statements need citations adjacent to them and operational details. Does FSD50K-Solo synthesize “controlled mixtures,” clean events, or both? How is source purity labeled? What anomalous-sound metric changes when identity is withheld, and by how much? Which infant-cry causes, datasets, and domain shifts were tested? Were RIRs generated from both text and images, and what made them “plausible”—acoustic metrics, listening studies, or both?

The phrase “correlations are crushed” is rhetorically vivid but does not identify an operation or measured information loss. “No single feature owns the event” is also metaphorical; say instead that complementary feature sets improved the reported classifier under the tested protocol, if that is what the study showed.

## Style and Voice

The essay’s cadence is effective, particularly the series “A source… A room… A meter…”. Preserve those lines after the concept is bounded. Avoid presenting machine-learning vocabulary as automatically compositional: “spend the budget,” “coalition of partial witnesses,” and “proof” work metaphorically, but the reader needs periodic reminders that model confidence is not formal proof or human perception.

## Line-Level Edits

- “Every listening system has an evidence budget” → “Every listening task constrains which evidence is available, through which channels, and by what deadline.”
- “That budget is the amount…” → “Here, ‘budget’ names a multidimensional constraint, not a single quantity.”
- “before correlations are crushed by a late bottleneck” → “before the architecture compresses cues the separator relies on; specify the relevant layer and ablation.”
- “A single-source label…has to be earned” → “A single-source label depends on an explicit dominance or contamination criterion.”
- “Some of what looked like anomaly detection was partly source recognition” → “The reported degradation suggests that performance partly depended on machine-identity inference.”
- “Pitch motion…become a coalition” → “Pitch, spectral-envelope, and time–frequency features provide complementary inputs whose incremental value should be reported.”
- “generate plausible acoustic spaces” → “generate RIRs judged by [named objective measures and/or listening protocol].”
- “room response no physical source could inhabit” → “a room response inconsistent with the source’s apparent distance or geometry,” unless physical impossibility is actually modeled.
- “Listening is action under limited proof” → “Listening and machine inference both involve action under limited, time-dependent evidence, though their mechanisms differ.”
