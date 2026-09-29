import { readFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import {
  buildNarrationPrompt,
  CALIBRATION_PASSAGE,
  NARRATION_PROMPT_VERSION,
  parseNarrationScript,
  scriptWordCount,
} from "./narrationPrompt";

describe("narration prompt", () => {
  test("prompt names the target length and forbids markdown", () => {
    const { system, prompt } = buildNarrationPrompt({
      kind: "weeklyBrief",
      bodyMd: "# Brief\n- item",
      targetMinutes: 10,
      studioPrompts: { tenMin: "a", thirtyMin: "b", ninetyMin: "c" },
    });
    expect(system).toMatch(/no headers|no markdown/i);
    expect(prompt).toContain("1500 words");
    expect(prompt).toContain("[pause]");
    expect(NARRATION_PROMPT_VERSION).toBe("narration.v1");
  });

  test("parser splits paragraphs on [pause], reads the chapter block, rejects markdown residue", () => {
    const text = [
      "Welcome to the weekly turn.",
      "[pause]",
      "First experiment: the fifth against the third.",
      "[pause]",
      "Studio prompts. Ten minutes: tune one drone.",
      "",
      "CHAPTERS",
      "0: Welcome",
      "1: Experiments",
      "2: Studio prompts",
    ].join("\n");
    const script = parseNarrationScript(text);
    expect(script.paragraphs).toHaveLength(3);
    expect(script.chapters).toEqual([
      { title: "Welcome", startParagraph: 0 },
      { title: "Experiments", startParagraph: 1 },
      { title: "Studio prompts", startParagraph: 2 },
    ]);
    expect(scriptWordCount(script)).toBeGreaterThan(10);
    expect(() =>
      parseNarrationScript("## Heading\n[pause]\nx\n\nCHAPTERS\n0: a"),
    ).toThrow(/markdown/);
    expect(() => parseNarrationScript("plain\n")).toThrow(/CHAPTERS/);
  });

  test("standalone [pause] at the edges is dropped; an inline marker throws", () => {
    const trailing = parseNarrationScript(
      "First.\n[pause]\nSecond one.\n[pause]\n\nCHAPTERS\n0: a",
    );
    expect(trailing.paragraphs).toEqual(["First.", "Second one."]);
    const leading = parseNarrationScript("[pause]\nHello\n\nCHAPTERS\n0: a");
    expect(leading.paragraphs).toEqual(["Hello"]);
    expect(() =>
      parseNarrationScript("Hello. [pause] Second.\n\nCHAPTERS\n0: a"),
    ).toThrow(/stray \[pause\]/);
    expect(() =>
      parseNarrationScript("Hello.\n[pause] Second.\n\nCHAPTERS\n0: a"),
    ).toThrow(/stray \[pause\]/);
  });

  test("chapter block tolerates CRLF line endings", () => {
    const script = parseNarrationScript(
      "One.\r\n[pause]\r\nTwo.\r\n\r\nCHAPTERS\r\n0: First\r\n1: Second\r\n",
    );
    expect(script.paragraphs).toEqual(["One.", "Two."]);
    expect(script.chapters).toEqual([
      { title: "First", startParagraph: 0 },
      { title: "Second", startParagraph: 1 },
    ]);
  });

  test("calibration passage matches the checked-in fixture and parses", () => {
    const fixture = readFileSync(
      "media/fixtures/calibration-passage.md",
      "utf8",
    ).trim();
    expect(CALIBRATION_PASSAGE).toBe(fixture);
    const script = parseNarrationScript(CALIBRATION_PASSAGE);
    expect(script.paragraphs).toHaveLength(3);
    expect(script.chapters).toEqual([
      { title: "Beating", startParagraph: 0 },
      { title: "Body", startParagraph: 1 },
      { title: "Numbers", startParagraph: 2 },
    ]);
    const words = scriptWordCount(script);
    expect(words).toBeGreaterThanOrEqual(180);
    expect(words).toBeLessThanOrEqual(260);
  });
});
