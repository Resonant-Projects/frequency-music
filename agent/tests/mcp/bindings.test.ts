import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { createWave2Operations } from "../../src/mcp/backend";
import { agentToolArgs } from "../../../convex/shared/agentToolArgs";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("canonical Wave 2 MCP operations", () => {
  test("binds the five real manifest names and uses existing secret transport", async () => {
    vi.stubEnv("CONVEX_SITE_URL", "https://convex.example.test");
    vi.stubEnv("AGENT_TOOL_SECRET", "outbound-only");
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify(null), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetcher);
    const operations = createWave2Operations();
    const proposal = {
      channel: "telegram",
      conversationId: "chat",
      messageRef: "message",
      transcript: "Defer",
    };
    const cases = [
      ["docket.list", "listDocket", { weekly: true }],
      ["docket.card", "getDocketCard", { cardId: "card" }],
      [
        "decision.propose",
        "proposeDecision",
        {
          command: {
            action: "defer",
            target: { kind: "composition", id: "composition" },
            payload: {},
          },
          proposal,
        },
      ],
      [
        "listening.propose",
        "proposeListening",
        {
          command: {
            action: "createListeningSession",
            target: { kind: "composition", id: "composition" },
            payload: {
              conditions: {
                listeningMethod: "headphones",
                timeOfDay: "evening",
              },
            },
          },
          proposal,
        },
      ],
      [
        "delivery.record",
        "recordDocketDelivery",
        {
          cardId: "card",
          channel: "telegram",
          contentHash: "a".repeat(64),
          phase: "posting",
        },
      ],
    ] as const;
    for (const [name, binding, args] of cases) {
      const op = operations[name];
      expect(Object.keys(op.args.shape)).toEqual(
        Object.keys(agentToolArgs[binding].shape),
      );
      await op.invoke(args, new AbortController().signal);
      const [url, init] = fetcher.mock.calls.at(-1)! as unknown as [
        string,
        RequestInit,
      ];
      expect(url).toBe(`https://convex.example.test/agent-tools/${binding}`);
      expect(JSON.parse(init.body as string)).toEqual({
        secret: "outbound-only",
        ...args,
      });
    }
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(() =>
      operations["decision.propose"].invoke(
        cases[3][2],
        new AbortController().signal,
      ),
    ).toThrow();
    expect(() =>
      operations["listening.propose"].invoke(
        { ...cases[3][2], actor: "human" },
        new AbortController().signal,
      ),
    ).toThrow();
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
  test("results cannot disclose signer authority or introduce audio playback", () => {
    const operations = createWave2Operations();
    const result = {
      intentId: "intent",
      code: "D-1",
      status: "proposed",
      expiresAt: 42,
      pageUrl: "/agent-drafts?intent=intent",
    };
    expect(
      operations["decision.propose"].result.safeParse(result).success,
    ).toBe(true);
    expect(
      operations["decision.propose"].result.safeParse({
        ...result,
        signature: {},
      }).success,
    ).toBe(false);
    expect(
      operations["decision.propose"].result.safeParse({
        ...result,
        status: "applied",
      }).success,
    ).toBe(false);
    expect(
      operations["docket.list"].result.safeParse(Array(11).fill({})).success,
    ).toBe(false);
    expect(operations["docket.card"].result.safeParse(null).success).toBe(true);
  });
});
