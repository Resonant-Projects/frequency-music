import { expect, test } from "@playwright/test";
import { KNOWN_GRAPH_NAMES } from "../../../convex/shared/agentContract";

const labels = [
  "All graphs",
  "Failure Investigation",
  "Research Pipeline",
  "Weekly Brief",
  "Correspondence Miner",
  "Evidence Hunter",
  "Hypothesis Drafter",
  "Source Scout",
  "Transcript Capture",
  "Hypothesis Tournament",
];

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/agent-runs");
});

test("offers every registered graph with a readable label", async ({
  page,
}) => {
  const options = page.getByLabel("Graph", { exact: true }).getByRole("option");
  await expect(options).toHaveText(labels);
  expect(
    await options.evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLOptionElement).value),
    ),
  ).toEqual(["", ...KNOWN_GRAPH_NAMES]);
});

for (const graphName of KNOWN_GRAPH_NAMES) {
  test(`filters both the run list and counts by ${graphName} and clears to all graphs`, async ({
    page,
  }) => {
    const graph = page.getByLabel("Graph", { exact: true });
    const queries = () =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              agentRunsFixture: { runQueries: Record<string, unknown> };
            }
          ).agentRunsFixture.runQueries,
      );
    await graph.selectOption(graphName);
    await expect.poll(queries).toEqual({
      "agentRuns:listRecentPublic": { limit: 40, graphName },
      "agentRuns:statusCountsPublic": { limit: 100, graphName },
    });
    await graph.selectOption("");
    await expect.poll(queries).toEqual({
      "agentRuns:listRecentPublic": { limit: 40 },
      "agentRuns:statusCountsPublic": { limit: 100 },
    });
  });
}
