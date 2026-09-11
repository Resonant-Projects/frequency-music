# Feedback: The Evidence Horizon

## Overall Impression

The essay asks an excellent question—when is there enough evidence to act?—and its language of timed commitments has genuine compositional value. The definition of “evidence horizon,” however, is unstable. “The point beyond which waiting…stops being useful” sounds like a latest useful deadline, while the examples often concern the earliest sufficient time to act. Architectural information loss, corpus inclusion, missing metadata, and inverse room generation are then all described as horizons despite lacking a shared temporal boundary. Define at least two cases: an earliest-commitment threshold and a latest-preservation boundary. Otherwise the concept absorbs every form of uncertainty.

## Structure and Argument

The paper-by-paper section is orderly but repetitive and too similar to “The Evidence Budget” and “The Early Separation Principle.” To earn a separate essay, this one should focus narrowly on sequential decision theory: evidence accumulation, confidence thresholds, latency costs, revision, and abstention. SR-CorrNet can illustrate a representation’s latest useful point for retaining cues; Streaming SpeechLLM can illustrate earliest justified action. The dataset, anomaly, and RIR cases fit less naturally and should either be reframed with explicit decision points or reduced.

The account of FSD50K-Solo asks whether an event “remained itself enough,” which is poetic but not a horizon. Dataset curation applies a selection criterion after observing a clip; unless window length or sequential evidence is central, it is better described as an evidence threshold. Likewise, withholding machine identity is a contextual constraint, not automatically a horizon. Distinguishing thresholds from horizons would sharpen the whole argument.

The tool proposal needs methodological realism. Estimating when “room identity,” “source continuity,” or “meter” becomes “sufficiently supported” requires target definitions, calibrated confidence, task-specific costs, and ground truth. The example timestamps imply precision the essay has not justified. Add the possibility of revision: a live system may act provisionally, then update or contradict itself. That would create a stronger compositional link than a single irreversible crossing.

The ending is concise and defensible once “accurate by when” is paired with accuracy about what and at what cost. It should not imply every sound accumulates toward a stable meaning; some evidence remains ambiguous or becomes less reliable with time.

## Clarity and Flow

Define “enough” operationally: a calibrated posterior above a threshold, expected loss below a bound, stable listener identification, or something else. Different facts will require different criteria. “Stops being possible” may refer to latency deadlines or information already discarded; state which.

Several source claims need metrics and citations. What bottleneck and ablation support SR-CorrNet’s critique? How does Streaming SpeechLLM learn emission timing, and what latency metric is used? How much does anomalous-sound performance degrade without identity? What evidence supports calling a generated RIR a spatial decision rather than conditional synthesis? The source list also includes infant cry modeling although the body never discusses it; remove that source or integrate it.

## Style and Voice

The voice is most effective in concise contrasts: “premature commitment and stale correctness.” Preserve this. The repeated “X makes the horizon…” construction becomes formulaic and disguises weak fits. Let examples that truly involve timing carry the essay. “The room keeps supplying evidence after the source has stopped” is vivid and exact enough to retain, provided it is framed as late reverberant evidence rather than room “identity” automatically becoming known.

## Line-Level Edits

- “the point beyond which waiting for more signal stops being useful” → “a task-specific boundary governing when action first becomes justified or when delaying action becomes too costly.”
- “speech separation model must decide early enough” → “a separation architecture must preserve source-discriminating cues before its representation suppresses them.”
- “has this event remained itself enough” → “does this clip meet the project’s operational threshold for single-source dominance?”
- “The system lives in the gap…” → add the named latency/quality tradeoff and whether outputs can be revised.
- “performance degradation tracks implicit machine identification accuracy” → report the association statistic and avoid causal language unless supported.
- “A room is inferred” → “An RIR is generated conditionally from indirect descriptors; whether it recovers a particular room is a separate evaluation question.”
- “Early evidence supports action” → “Some cues are available early enough to support provisional action.”
- “source identity became stable after 180 ms” → “under a named classifier and confidence criterion, source prediction first remained above threshold after 180 ms.”
- “Sound does not arrive as meaning” → “Meaning emerges through time-dependent inference, context, and revision.”
