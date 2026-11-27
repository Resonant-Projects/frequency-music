# Decay and rhythm distance: pending graph links

## Research result

- Essay: [The Decay Behind the Distance](../essays/the-decay-behind-the-distance.md).
- Reviewed six recent live extractions on November 27, 2026 UTC. The two selected sources support a bounded hypothesis about acoustic rendering and rhythm similarity; the other four concern broad science without a new verified music-specific mechanism.
- Read both selected retained source captures, not merely their extraction summaries. An independent source audit checked short quotes, the review's directed-swap example, the distinction between reviewer opinion and reference physics, and the envelope derivation. Linked perceptual studies and the complete textbook were not inspected.
- New hypothesis: similarity judgments for a fixed pair of onset patterns may depend on decay. A symbolic onset distance does not, by itself, establish perceptual invariance across acoustic renderings. Neither source reports the proposed experiment.
- Mathematical check: normalized overlap of isolated equal-decay causal exponential envelopes is `exp(-abs(delta)/tau)`. At a 50 ms shift, time constants of 20, 80, and 320 ms give 0.082085, 0.535261, and 0.855345. Independent derivation and numerical integration checked this signal-level statement; it is not a listener result or Toussaint-metric calculation.

## Proposed concept links — NOT applied to Convex

These are a durable research handoff, not live graph records. Resolve existing concept identities and classification before creating anything; the names below are candidate concepts, not verified database IDs. Do not promote the perceptual conjecture to established evidence.

| Candidate relation | Type and justification | Provenance |
| --- | --- | --- |
| damping → temporal persistence | Reference-supported physical relation: damping changes transient persistence. No numerical instrument prescription. | Fletcher and Rossing, retained §1.5 and §1.8 prose |
| directed swap distance → rhythmic grouping | Attributed critique: the reviewer describes a minimal directed swap with a different grouping. Not an independently reproduced perceptual experiment. | Gómez-Martín, Chapter 33 discussion |
| onset-only rhythm distance ↔ acoustic decay | New conjecture: decay may moderate the relationship between a symbolic distance and listener similarity judgments. | Cross-source deduction; controlled experiment proposed in essay |
| envelope overlap → representation limits | Mathematical illustration: a fixed shift does not determine normalized envelope overlap without a decay constant. Not a perceptual proxy validated here. | Independently derived toy model in essay |

Source and extraction provenance:

- Gómez-Martín review: source `jx78vfkaj98n0vsrmv0nfnnwys8jweef`; extraction `j970pkpz7vjb995m71yf21afj58jym6q`; DOI [10.1080/17459737.2022.2025625](https://www.tandfonline.com/doi/full/10.1080/17459737.2022.2025625).
- Fletcher and Rossing excerpt: source `jx7c7jewmet40t0t4449kwff218jx5w3`; extraction `j97a40c51w4cddsny3ac207m7d8jy1dk`; [retained PDF URL](https://csclub.uwaterloo.ca/~pbarfuss/The_Physics_of_Musical_Instruments.pdf).

## Execution boundaries

The configured legacy backend returned HTTP 503 and both requested CLI functions returned bare `Error`. Credential-free reads succeeded at the currently documented `https://convex.resonantprojects.art` endpoint. Raw Source reads also succeeded there using the working HTTP client; Python's default HTTP client received an edge-policy 403, so that error was not treated as proof that the deployment was down.

The approved Varlock resolver could not connect to the 1Password desktop app. No authenticated extraction request reached the current endpoint, and no graph mutation was attempted without its required service identity. No extraction workflow ID was obtained. Live extraction and graph updates remain blocked; use the documented provenance-stamped service tools after credentials are restored, not internal mutations or a human-approval bypass.

The primary checkout has two local commits and is 472 commits behind `origin/main`; `git pull --ff-only` refused to reconcile that divergence. This essay and handoff were isolated on `freq/decay-distance-20261127` in the existing current-base operational worktree. The original checkout and commits were preserved.

## Validation

- Envelope formula independently checked; midpoint integration at 10 microseconds over five seconds matched all three table entries within `1e-7`.
- New Markdown files checked for size, citations, local links, and whitespace.
- Full repository verification could not start: `vp: command not found`. The operational worktree inherits older dependencies through its existing `node_modules` link; its Biome 2.4.2 also rejects the current 2.6.2 config. Neither environment issue was changed for this documentation-only task.
