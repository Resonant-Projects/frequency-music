import { describe, expect, test } from "vite-plus/test";
import { unextractableTextReason } from "./sourceText";

describe("extractable source text", () => {
  test("rejects feed excerpts, bot walls, and near-empty captures", () => {
    // Nautilus RSS teaser, stored 2026-09 (feed description only).
    expect(
      unextractableTextReason(
        "A United States Army Lieutenant was the first to forecast the deadly storms in the late 1800s. Then he was told to stop. The post In the Midst of Tornado Season, a Surprisingly Short History of Predicting Twisters appeared first on Nautilus.",
      ),
    ).toMatch(/feed excerpt/);
    expect(
      unextractableTextReason(
        "One of the most frustrating and time consuming things that happens during a mix is figuring out why certain mix elements seem buried when they are at the right level. The problem is often masking, where frequencies from one element cover another [&hellip;]",
      ),
    ).toMatch(/feed excerpt/);
    const teaser =
      "Producers chasing a warmer delay often reach for an old bucket brigade pedal instead of a pristine digital unit, because the repeats drift and darken in a way that sits better behind a vocal than a clean echo does.";
    expect(
      unextractableTextReason(
        `${teaser} [Read more](https://example.org/delay)`,
      ),
    ).toMatch(/feed excerpt/);
    expect(unextractableTextReason(`${teaser} Read more.`)).toMatch(
      /feed excerpt/,
    );
    expect(
      unextractableTextReason(
        "Title: Just a moment...\n\nPerforming security verification\nThis website uses a security service to protect against malicious bots. This page is displayed while the website verifies you are not a bot.",
      ),
    ).toMatch(/bot wall/);
    expect(
      unextractableTextReason(
        "It's all coming back to me [Read](https://nautil.us/x) now",
      ),
    ).toMatch(/only \d+ words/);
  });

  test("keeps short abstracts and full articles", () => {
    // A 54-word arXiv abstract is real content.
    expect(
      unextractableTextReason(
        "arXiv:2605.04998v3 Announce Type: replace Abstract: This revision updates a pop-to-jazz chord-generation rehearsal study. Best-epoch metrics still show that modest pop rehearsal preserves pop accuracy while improving jazz prediction, and the added ablation separates rehearsal ratio from epoch count across three random seeds, so the reported gain does not depend on one lucky initialization or a single schedule.",
      ),
    ).toBeNull();
    expect(
      unextractableTextReason(
        "Abstract from OpenAlex (W1522038856; DOI 10.14704/nq.2015.13.2.795). The full text was not captured.\n\n# Schumann Resonance and Brain Waves: A Quantum Description (2015)\n\nIn this paper for the first time we compared spectra of the brain and Schumann electromagnetic waves. We argue that both modes of electromagnetic radiation can be analyzed with the help of the Planck formula.",
      ),
    ).toBeNull();
    // A short text whose last sentence merely says "read more" is kept.
    expect(
      unextractableTextReason(
        "In a twelve-week study, children who practised a melodic instrument for twenty minutes a day showed larger gains in phonological awareness than a matched control group, and their parents reported that the participants read more books during the summer.",
      ),
    ).toBeNull();
    // A long article that merely ends with an ellipsis is not an excerpt.
    expect(
      unextractableTextReason(
        `${"The plate was excited at 440 Hz and the nodal lines were traced. ".repeat(30)}...`,
      ),
    ).toBeNull();
  });
});
