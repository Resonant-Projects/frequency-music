---
title: "Phase Four Fixture"
slug: "phase-four-fixture"
kind: "experiment_recap"
publishedAt: "2026-03-31T00:00:00.000Z"
dek: "A deterministic export fixture used to verify the Astro editorial loader."
evidenceStatus: "mixed"
uncertaintySummary: "The fixture proves the export contract shape, not the editorial quality of a real artifact."
whyItMatters: "This keeps the public pipeline testable without depending on a live publishing run."
campaignSlug: "fixtures-and-smoke-tests"
thesisSlugs: ["public-export-contract"]
canonicalAppUrl: "https://app.resonantprojects.art/editorial/fixture-phase-four"
---

## What We Tried

- Created a deterministic markdown export fixture inside `frequency-music`.
- Pointed the Astro editorial loader at the local snapshot by default.

## What Changed

The public site can now render editorial entries from the export contract even when no live publish action has run yet.

## Why It Matters

It gives the cross-repo integration a stable shape to validate.

## Uncertainty

This fixture should eventually be replaced or supplemented by real published artifacts from the live workflow.
