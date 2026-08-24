# Feedback — "Calibration Before Anomaly"

## Overall Impression
This essay does important framing work by pulling the abstract notion of "calibration before anomaly" out of machine-learning detection tasks and planting it squarely in the compositional domain. The move from anomalous-sound-detection papers to the four musical baselines (source, gesture, space, style) is genuinely generative, and the studio experiment at the end gives the reader a concrete handle. The piece is working.

## Structure / Argument
- The progression from ML motivation → four baselines → studio experiment → open question is clean, but the leap from FSD50K-Solo's corpus curation directly into "every musical deviation depends on a prior listening frame" skips an argumentative bridge. A sentence or two explaining why corpus-level baseline contamination translates into musical deviation-as-perception would tighten the logic.
- The four baselines (1–4) are introduced as a list, but they're not then re-integrated into the studio experiment. The experiment only gestures at source and space; it never operationalizes gesture or style. That makes the framework feel asserted rather than demonstrated.
- "Only after that can the abnormal sing" is a nice tagline, but it arrives without the essay having actually shown how the abnormal comes into being. The piece ends on a claim the body hasn't earned the right to make yet.

## Clarity / Flow
- "Standard benchmarks often assume that the machine identity is known at test time" — the shift from machine to machine ("machine identity") is initially confusing; does "identity" mean model, device, or category?
- "Domain shift across infants and datasets is not just noise around the task. It is evidence that each source brings its own acoustic baseline." The connection between domain shift and acoustic baseline is asserted, not unpacked, and a reader unfamiliar with the infant-cry literature will struggle to follow.
- The transition from SR-CorrNet to FSD50K-Solo to "compositional concept" happens in three consecutive paragraphs without connective transitions, making the conceptual jump feel abrupt.

## Style / Voice
- The overall voice is consistent—scholarly but accessible, with flashes of the poetic ("the abnormal sing"). However, the ML-paragraphs carry a more technical tone than the composition paragraphs, and the register whiplash can pull the reader out.
- "A scraper" should be "a scrape" (a scraper is a tool).
- "A noisy bow stroke is a flaw in one passage and the desired sound in another" — "flaw" and "desired sound" are fine, but the essay generally doesn't name the genre, composer, or historical context it's drawing from, so these assertions feel under-supported.
- The sources list at the bottom uses opaque IDs rather than readable citations. If these are the grounding references, they should be formatted as full citations so readers can actually consult them.

## Line-Level Notes
- "anomaly is not heard first. Calibration is." — punchy, but the period creates a staccato that feels unintentional. Consider a semicolon or colon.
- "It was calibrating itself to a source." — good, but "It" is ambiguous; better to name the system or model explicitly.
- "A classifier that ignores the baseline mistakes individuality for error." — strong line, but "individuality for error" could be tightened to "mistakes individuality for error" or rephrased to "mistakes the individual for the erroneous."
- "This is where the extraction cluster becomes compositionally useful." — "extraction cluster" is jargon from the ML context; it's never defined here in compositional terms. Define it or drop it.
