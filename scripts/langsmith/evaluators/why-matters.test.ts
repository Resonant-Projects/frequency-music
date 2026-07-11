import { describe, expect, test } from "vite-plus/test";
import type { Example, Run } from "langsmith";
import { whyThisMattersEvaluator } from "./why-matters";

function score(whyThisMatters: string) {
  return whyThisMattersEvaluator(
    { outputs: { whyThisMatters } } as unknown as Run,
    {} as unknown as Example,
  ).score;
}

describe("whyThisMattersEvaluator", () => {
  test("does not count short substrings inside ordinary words", () => {
    expect(
      score(
        "The researcher learns clearly near the archive and finds charming keyboard ideas.",
      ),
    ).toBe(0);
  });

  test("counts explicit musical stake language", () => {
    expect(
      score(
        "This changes listening because the rhythm and tuning alter how the studio feels.",
      ),
    ).toBe(1);
  });
});
