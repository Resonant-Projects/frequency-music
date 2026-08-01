# Passages embed with text-embedding-3-large while claims/concepts stay on 3-small

The passage index (@convex-dev/rag over full source text) uses `text-embedding-3-large` at 3072 dimensions for retrieval quality on nuanced research prose, while the existing claim/concept vector indexes remain on `text-embedding-3-small` at 1536 dimensions. This deliberately splits the system into two incompatible embedding spaces: a stored claim/concept vector can never be compared against a passage vector — anything crossing spaces must re-embed the *text* with the other model, never reuse a stored vector.

## Consequences

- This is a transitional state, not the end-state: migrating claims and concepts to 3-large is a declared roadmap follow-on (the `needsEmbedding`/`embeddingModel`-mismatch machinery in `convex/shared/embeddingText.ts` was built for exactly this kind of migration, but it re-embeds every claim and changes two schema vector indexes, so it is its own project).
- Until that migration, do not "optimize" a cross-space lookup by reusing a stored 1536d vector against the passage index or vice versa — dimension aside, the spaces are semantically incomparable.

## Considered Options

- 3-small everywhere (one unified space, cheapest) — rejected: retrieval quality matters most for prose passages, and passages are the new, quality-sensitive surface.
- 3-large downprojected to 1536d — rejected: dimension parity would misleadingly suggest comparability with 3-small vectors that doesn't exist.
