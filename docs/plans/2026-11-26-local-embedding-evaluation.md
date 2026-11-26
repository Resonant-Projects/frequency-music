# Evaluate local passage embeddings

The [research note](../research/2026-11-26-local-embeddings.md) recommends trying Qwen3-Embedding-4B on an RTX 5090. This plan produces a measured decision about moving passage retrieval to local inference. The [migration plan](./2026-11-26-local-embedding-migration.md) depends on that decision.

## Establish a reproducible comparison

1. Use the [isolated Convex workflow](../../scripts/local-convex/README.md) with redistributable papers, articles, PDFs and transcripts. Include the known `432 Hz precise temperament tuning` mixed-source case, or a fixture with the same checked expectations if the original source text cannot be shared. Populate both indexes from identical stored source text using the existing chunker, filter and result limits. Keep the corpus, query labels and expected Source IDs in a reproducible fixture. Keep private source text out of committed fixtures and evaluation reports.
2. Before comparing models, label 48 queries covering exact terminology, paraphrases, mixed-source evidence and plausible distractors. Label which Sources and passages actually support each query. Mark the mixed-source case and required type-filter, archive-exclusion and provenance checks as regressions that must pass. Split the queries evenly into a development set for model and instruction selection and a held-out set for the final comparison.
3. Use `text-embedding-3-large` at 3,072 dimensions for the passage baseline. Record the corpus and configuration used for any cached baseline. Obtain approval for a bounded hosted comparison before making paid calls, and publish the estimate and cap in the test record. Use isolated Convex credentials and confirm the target before running a Convex CLI command.

## Run the candidates

1. Start a pinned vLLM pooling runtime on the assigned GPU with Qwen3-Embedding-4B in BF16 at 2,048 dimensions. Use 0.6B at 1,024 as the lightweight comparison. Both widths are supported by the repository's pinned RAG component. Pin weights, runtime, dimension, normalization and query instruction in the run manifest. Embed documents as plain text and use a fixed retrieval instruction on queries. Verify result order, token usage, finite vectors, expected width and input bounds with a fixture that exercises the longest supported chunk.
2. Call the private, authenticated endpoint from the isolated Convex action runtime. Measure warm p95 query latency, p95 time from saving source text to finding its passage, completed source indexing rate, and peak GPU memory with ingest and queries running together. Record what else was running on the host and separate the duration of embedding calls from Convex writes. Record failures, retries and any provider quota or Convex write-limit errors next to the throughput numbers.
3. Compare vector-only rankings on the development set to expose differences between models, then judge the held-out set through the existing hybrid retrieval and response packing in [passage search](../../convex/passageSearch.ts). Report Source Recall@8 and passage nDCG@8, plus the concrete misses and false matches. Repeat filtered searches and verify that matched text, Source identity and provenance survive hydration. Stop the test service after recording results unless the GPU allocation covers continuing work.

## Decision and handoff

Proposed passage acceptance requires held-out Recall@8 and nDCG@8 at or above the hosted baseline, all marked regressions passing, and warm p95 end-to-end query latency and source-to-searchable time at or below the corresponding baseline with the same workload. Choose the lighter model if it clears the same conditions. Record results, remaining GPU capacity and the exact model configuration. If neither candidate clears the conditions, report which gate failed and keep the hosted passage path serving while evaluating a targeted follow-up.

The deliverable is a test receipt with the corpus revision, query labels, comparison results and selected configuration or a decision to defer. The test uses isolated infrastructure. Production access, model serving changes on the shared host, and deployment require the applicable operator approval.
