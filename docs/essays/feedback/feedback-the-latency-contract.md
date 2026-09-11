# Feedback: The Latency Contract

## Overall Impression

The central distinction between a latency number and a latency contract is excellent. It expands real-time performance from raw delay to a bundle of obligations: when to commit, how long to speak, what can happen asynchronously, and which perceptual continuity must be maintained. The essay is compact and generative, but its technical foundation needs firmer boundaries. Five systems with different timing regimes are treated as one problem, although algorithmic latency, emission policy, duration control, asynchronous retrieval, tracking lag, and expressive microtiming are not directly comparable.

Add full citations and system-specific measurements. “Roughly one or two seconds,” “real time,” “full-duplex,” and “human-level expression remains unsolved” need definitions, evaluation settings, and attribution. Otherwise the contract concept floats above examples that readers cannot verify.

## Structure and Argument

The opening three speech systems establish the concept efficiently. The binaural and piano cases broaden it musically, but each needs a clearer link. In binaural rendering, delay can affect localization and stability, yet “smear” and “jump” may arise from tracking error, filter switching, or cue discontinuity, not simply whether an update is early or late. In expressive rendering, prediction horizon and causal access should be named: does the system see the score ahead, past performance only, or both?

The five-part control surface is the structural core and should be introduced earlier as the framework through which each example is read. A small mapping in prose would prevent conceptual slippage: streaming translation illustrates commitment threshold; TiCo illustrates duration budget; MoshiRAG illustrates background lookup; moving-source rendering illustrates continuity; performance rendering illustrates expressive slack.

The ending appropriately returns to failures, but the proposed patch combines four layers and then asks which contract breaks first. This produces interacting failures rather than diagnosis. Suggest varying one obligation at a time and measuring both task success and perceived musical disruption. The essay’s conclusion would then be genuinely testable.

## Clarity and Flow

Define latency components: input accumulation, computation, scheduling, network/retrieval delay, and output buffering. The essay currently treats “waiting for enough evidence” as latency, though it is policy-induced delay rather than merely processing delay. That distinction supports the contract thesis.

“Unfinished context still alive” is evocative but vague. It might mean maintaining hypotheses, revisability, lookahead, or buffered audio. Choose one technical formulation. Likewise, “temporal gaps of conversation” needs verification: asynchronous retrieval may overlap generation or listening, but it does not necessarily happen only in perceptual gaps.

## Style and Voice

The essay’s voice is admirably direct. The contract metaphor remains productive because the bullet list names specific obligations. Avoid universalizing from engineering systems to “music has always known this,” which is rhetorically easy but analytically empty. Give one historically or perceptually grounded musical example instead.

The drummer and reverberant-hall examples are readable, though they risk equating intentional musical timing with system latency. A drummer laying back changes event timing within a groove; that is not the same as delayed response to an input. Explicitly identify the analogy and its limit.

## Line-Level Edits

- “correct soon enough, for long enough, and with enough unfinished context still alive” Replace “correct” with task-specific success, and define “unfinished context” as retained alternatives or buffered evidence.
- “staying close to non-streaming quality at roughly one or two seconds of delay” Identify the latency metric—average lagging, computation-aware latency, or wall-clock delay—and the quality metric.
- “using time markers so the model can track its own elapsed output” Clarify whether markers represent discrete elapsed-time positions during training/inference; “track its own” anthropomorphizes the mechanism.
- “factual lookup can happen in the temporal gaps” Replace with “retrieval can run asynchronously with the conversational generation loop,” unless the paper explicitly schedules gaps.
- “If the update arrives late, the image smears. If…early but wrong, the image jumps.” Cite evidence or mark these as hypothesized failure modes; also distinguish localization lag from interpolation artifacts.
- “human-level expression remains unsolved” Specify the evaluation criterion. Competition results do not establish a singular human-level threshold.
- “A zero-latency system” Replace with “A negligibly low-processing-latency system”; physical and buffered audio systems do not literally have zero latency.
- “The audible failures will be different” Change to “may differ,” then propose listener or signal measures for each predicted failure.
