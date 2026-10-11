import { describe, expect, test, vi } from "vite-plus/test";
import { graph as correspondenceMinerGraph } from "../src/graphs/correspondence-miner";
import { graph as evidenceHunterGraph } from "../src/graphs/evidence-hunter";
import { graph as hypothesisDrafterGraph } from "../src/graphs/hypothesis-drafter";
import { graph as researchPipelineGraph } from "../src/graphs/research-pipeline";
import { graph as sourceScoutGraph } from "../src/graphs/source-scout";

describe("production graph compilation", () => {
  test("imports every registered LangGraph without state-channel collisions", () => {
    expect(correspondenceMinerGraph).toBeDefined();
    expect(evidenceHunterGraph).toBeDefined();
    expect(hypothesisDrafterGraph).toBeDefined();
    expect(researchPipelineGraph).toBeDefined();
    expect(sourceScoutGraph).toBeDefined();
  });

  test("executes the weekly brief with the installed Deep Agents runtime", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-only");
    vi.stubEnv("ANTHROPIC_API_URL", undefined);
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("WEEKLY_BRIEF_AGENT_MODEL", undefined);
    vi.stubEnv("LANGSMITH_TRACING", "false");
    vi.stubEnv("LANGCHAIN_TRACING_V2", "false");
    const fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url !== "https://api.anthropic.com/v1/messages") {
          throw new Error(`Unexpected external request: ${url}`);
        }
        const request =
          input instanceof Request ? input : new Request(input, init);
        const body = await request.clone().json();
        expect(body.tools).toContainEqual(
          expect.objectContaining({
            name: "get_extraction",
            input_schema: expect.objectContaining({
              properties: { id: { type: "string" } },
            }),
          }),
        );
        return Response.json({
          id: "msg_dependency_upgrade_test",
          type: "message",
          role: "assistant",
          model: "claude-sonnet-5-5",
          content: [{ type: "text", text: "Mock weekly brief completed." }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 5 },
        });
      },
    );
    vi.stubGlobal("fetch", fetch);
    try {
      const { agent } = await import("../src/agents/weekly-brief");
      expect(agent).toBeDefined();
      expect(fetch).not.toHaveBeenCalled();
      const result = await agent.invoke({
        messages: [
          { role: "user", content: "Complete the test weekly brief." },
        ],
      });
      expect(result.messages.at(-1)?.content).toBe(
        "Mock weekly brief completed.",
      );
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});
