import { describe, expect, test } from "bun:test";
import { parseEssay } from "./parse-essay";

describe("parseEssay", () => {
  test("parses standard Freq byline with date", () => {
    const input = `# The Ground Note: Why Everything in Music Is Relative

*Freq — March 20, 2026*

---

## The Same Notes, Different Worlds

First paragraph here.`;

    const result = parseEssay(input, "the-ground-note.md");
    expect(result.title).toBe("The Ground Note: Why Everything in Music Is Relative");
    expect(result.slug).toBe("the-ground-note");
    expect(result.publishDate).toBe("2026-03-20");
    expect(result.draft).toBe(false);
    expect(result.essayNumber).toBeNull();
    expect(result.body).toStartWith("## The Same Notes, Different Worlds");
    expect(result.body).not.toContain("Freq —");
    expect(result.body).not.toContain("# The Ground Note");
  });

  test("parses reversed date format", () => {
    const input = `# Beyond the Integers

*February 25, 2026 — Freq*

## The Problem`;

    const result = parseEssay(input, "beyond-the-integers.md");
    expect(result.publishDate).toBe("2026-02-25");
  });

  test("parses By Freq dot format", () => {
    const input = `# The Comma Problem

*By Freq · February 21, 2026*

## Content`;

    const result = parseEssay(input, "the-comma-problem.md");
    expect(result.publishDate).toBe("2026-02-21");
  });

  test("parses Essay # format with italic", () => {
    const input = `# The Grain of Listening

*Essay #87 — April 2, 2026*

*On why perception keeps choosing the discrete.*

## Content`;

    const result = parseEssay(input, "the-grain-of-listening.md");
    expect(result.publishDate).toBe("2026-04-02");
    expect(result.essayNumber).toBe(87);
  });

  test("parses Essay # format with bold", () => {
    const input = `# Everything Is a Resonant Body

**Essay #80** — March 31, 2026

*How rooms and neural networks act as transfer functions.*

## Content`;

    const result = parseEssay(input, "everything-is-a-resonant-body.md");
    expect(result.publishDate).toBe("2026-03-31");
    expect(result.essayNumber).toBe(80);
  });

  test("parses bare date", () => {
    const input = `# The Spheres Revisited

*March 5, 2026*

## Content`;

    const result = parseEssay(input, "the-spheres-revisited.md");
    expect(result.publishDate).toBe("2026-03-05");
  });

  test("parses month-only date as first of month", () => {
    const input = `# The Grain of Identity

*Freq · March 2026*

## Content`;

    const result = parseEssay(input, "the-grain-of-identity.md");
    expect(result.publishDate).toBe("2026-03-01");
  });

  test("returns null date when no date found", () => {
    const input = `# The Color of Chaos: Why Music Lives at the Edge of Order

*Why do some sequences of notes feel alive while others feel dead?*

## The Spectrum of Randomness`;

    const result = parseEssay(input, "the-color-of-chaos.md");
    expect(result.publishDate).toBeNull();
  });

  test("respects draft: true frontmatter", () => {
    const input = `---
draft: true
---
# Some Draft Essay

*Freq — March 20, 2026*

## Content`;

    const result = parseEssay(input, "some-draft.md");
    expect(result.draft).toBe(true);
  });

  test("draft: false means published", () => {
    const input = `---
draft: false
---
# Published Essay

*Freq — March 20, 2026*

## Content`;

    const result = parseEssay(input, "published.md");
    expect(result.draft).toBe(false);
  });

  test("strips title, byline, and first separator from body", () => {
    const input = `# Title

*Freq — March 20, 2026*

---

## First Section

Paragraph.`;

    const result = parseEssay(input, "test.md");
    expect(result.body).toBe("## First Section\n\nParagraph.");
  });

  test("parses underscore-emphasized byline", () => {
    const input = `# The Mirror in the Chord

_Freq — March 20, 2026_

## Content`;

    const result = parseEssay(input, "the-mirror-in-the-chord.md");
    expect(result.publishDate).toBe("2026-03-20");
  });

  test("derives slug from filename", () => {
    const result = parseEssay("# Test\n\n## Body", "the-ground-note.md");
    expect(result.slug).toBe("the-ground-note");
  });
});
