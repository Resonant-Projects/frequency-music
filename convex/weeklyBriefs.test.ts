import { describe, expect, test } from "bun:test";
import { parseBriefResponse } from "./weeklyBriefs";

describe("weekly brief response parsing", () => {
  test("extracts todo items and prompt variants while stripping the JSON block", () => {
    const response = `# Week of March 26

Research summary.

\`\`\`json
{
  "todo": ["Try branch A", "Print comparison bounce"],
  "studioPrompts": {
    "tenMinuteMd": "Ten minute prompt",
    "thirtyMinuteMd": "Thirty minute prompt",
    "ninetyMinuteMd": "Ninety minute prompt"
  }
}
\`\`\``;

    const parsed = parseBriefResponse(response);

    expect(parsed.todo).toEqual(["Try branch A", "Print comparison bounce"]);
    expect(parsed.studioPrompts.tenMinuteMd).toBe("Ten minute prompt");
    expect(parsed.studioPrompts.thirtyMinuteMd).toBe("Thirty minute prompt");
    expect(parsed.studioPrompts.ninetyMinuteMd).toBe("Ninety minute prompt");
    expect(parsed.cleanBodyMd).toBe("# Week of March 26\n\nResearch summary.");
  });
});
