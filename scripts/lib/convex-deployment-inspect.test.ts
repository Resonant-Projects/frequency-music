import { describe, expect, test, vi } from "vite-plus/test";
import { inspectDeployment, metadataHash } from "./convex-deployment-inspect";

const origin = "https://convex.resonantprojects.art";
function success(value: unknown) {
  return new Response(JSON.stringify({ status: "success", value }));
}
function fixture() {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      success([
        {
          id: "root",
          path: "",
          state: "active",
          httpPrefix: null,
          args: { token: "PRIVATE_COMPONENT_SECRET" },
        },
      ]),
    )
    .mockResolvedValueOnce(
      success([
        [
          null,
          [
            [
              "worker.js",
              {
                functions: [
                  {
                    name: "GET /health",
                    udfType: "HttpAction",
                    visibility: { kind: "public" },
                    args: "PRIVATE_VALIDATOR",
                  },
                ],
                sourcePackageId: "PRIVATE_PACKAGE",
                cronSpecs: [
                  [
                    "scheduled",
                    {
                      udfPath: "worker:execute",
                      cronSchedule: { type: "hourly" },
                      udfArgs: "PRIVATE_CRON_SECRET",
                    },
                  ],
                ],
              },
            ],
          ],
        ],
      ]),
    )
    .mockResolvedValueOnce(
      success({
        active: JSON.stringify({
          tables: [{ name: "jobs", validator: "PRIVATE_SCHEMA_LITERAL" }],
        }),
      }),
    );
}

describe("privileged deployment metadata inspection", () => {
  test("uses fixed authenticated read-only queries and excludes private argument values", async () => {
    const fetcher = fixture();
    const result = await inspectDeployment(origin, "INERT_ADMIN", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(
      fetcher.mock.calls.map(
        ([, init]) =>
          JSON.parse(typeof init?.body === "string" ? init.body : "null").path,
      ),
    ).toEqual([
      "_system/frontend/components:list",
      "_system/frontend/modules:listForAllComponents",
      "_system/frontend/getSchemas",
    ]);
    for (const [url, init] of fetcher.mock.calls) {
      expect(url).toBe(`${origin}/api/query`);
      expect(init).toMatchObject({
        method: "POST",
        redirect: "error",
        headers: { Authorization: "Convex INERT_ADMIN" },
      });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
    expect(result).toMatchObject({
      deploymentAuthorized: false,
      functionValidatorsIncluded: false,
      consistency: "separate-query-snapshots-not-atomic",
      components: [{ argsCount: 1, argsOmitted: true }],
    });
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_|INERT_ADMIN/);
    expect(result.modules[0]?.modules[0]?.functions[0]?.name).toBe(
      "GET /health",
    );
    expect(result.schemas[0]?.activeHash).toMatch(/^[a-f0-9]{64}$/);
  });
  test("rejects unauthenticated and unapproved requests before transport", async () => {
    const fetcher = fixture();
    await expect(inspectDeployment(origin, "", fetcher)).rejects.toThrow();
    await expect(
      inspectDeployment("https://other.example", "inert", fetcher),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  test("fails closed on oversized responses, invalid envelopes and partial component inventories", async () => {
    for (const response of [
      new Response("x".repeat(4 * 1024 * 1024 + 1)),
      success({ wrong: true }),
      new Response(
        JSON.stringify({ status: "error", errorMessage: "PRIVATE_FAILURE" }),
      ),
      new Response("PRIVATE_AUTH", { status: 403 }),
    ]) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response);
      await expect(
        inspectDeployment(origin, "inert", fetcher),
      ).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(success([]))
      .mockResolvedValueOnce(success([]));
    await expect(inspectDeployment(origin, "inert", fetcher)).rejects.toThrow(
      "Incomplete",
    );
  });
  test("visits each component schema explicitly and rejects excessive component counts", async () => {
    const child = {
      id: "child",
      path: "workflow",
      state: "active",
      httpPrefix: null,
      args: {},
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(success([child]))
      .mockResolvedValueOnce(
        success([
          [null, []],
          ["child", []],
        ]),
      )
      .mockResolvedValueOnce(success({}))
      .mockResolvedValueOnce(success({}));
    const result = await inspectDeployment(origin, "inert", fetcher);
    expect(result.schemas.map((schema) => schema.componentId)).toEqual([
      null,
      "child",
    ]);
    const request = fetcher.mock.calls[3]?.[1]?.body;
    if (typeof request !== "string") throw new Error("Expected request");
    expect(JSON.parse(request).args).toEqual([{ componentId: "child" }]);
    const excessive = vi.fn<typeof fetch>().mockResolvedValueOnce(
      success(
        Array.from({ length: 101 }, (_, i) => ({
          ...child,
          id: `child${i}`,
          path: `child${i}`,
        })),
      ),
    );
    await expect(
      inspectDeployment(origin, "inert", excessive),
    ).rejects.toThrow();
    expect(excessive).toHaveBeenCalledTimes(1);
  });

  test("does not retry rejected transport and cancels an over-limit response stream", async () => {
    const rejected = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("PRIVATE_TRANSPORT"));
    await expect(
      inspectDeployment(origin, "inert", rejected),
    ).rejects.toThrow();
    expect(rejected).toHaveBeenCalledTimes(1);
    const cancel = vi.fn();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(4 * 1024 * 1024 + 1));
      },
      cancel,
    });
    await expect(
      inspectDeployment(
        origin,
        "inert",
        vi.fn<typeof fetch>().mockResolvedValue(new Response(stream)),
      ),
    ).rejects.toThrow();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  test("fails closed when the shared deadline aborts before reading more metadata", async () => {
    const controller = new AbortController();
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(controller.signal);
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      controller.abort();
      return success([]);
    });
    try {
      await expect(inspectDeployment(origin, "inert", fetcher)).rejects.toThrow(
        "limit",
      );
      expect(timeout).toHaveBeenCalledWith(20_000);
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      timeout.mockRestore();
    }
  });

  test("rejects duplicate function and cron metadata", async () => {
    const fn = {
      name: "execute",
      udfType: "Action",
      visibility: { kind: "internal" },
    };
    for (const module of [
      { functions: [fn, fn] },
      {
        functions: [],
        cronSpecs: [
          [
            "same",
            { udfPath: "worker:execute", cronSchedule: { type: "hourly" } },
          ],
          [
            "same",
            { udfPath: "worker:execute", cronSchedule: { type: "hourly" } },
          ],
        ],
      },
    ]) {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(success([]))
        .mockResolvedValueOnce(success([[null, [["worker.js", module]]]]));
      await expect(inspectDeployment(origin, "inert", fetcher)).rejects.toThrow(
        "Duplicate",
      );
      expect(fetcher).toHaveBeenCalledTimes(2);
    }
  });

  test("decodes only bounded cron schedule integers and strips argument values", async () => {
    const integer = (value: bigint) => {
      const bytes = Buffer.alloc(8);
      bytes.writeBigInt64LE(value);
      return { $integer: bytes.toString("base64") };
    };
    async function inspectSchedule(schedule: unknown) {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(success([]))
        .mockResolvedValueOnce(
          success([
            [
              null,
              [
                [
                  "crons.js",
                  {
                    functions: [],
                    cronSpecs: [
                      [
                        "daily",
                        {
                          udfPath: "worker:execute",
                          udfArgs: { $bytes: "PRIVATE_SECRET" },
                          cronSchedule: schedule,
                          private: "PRIVATE_EXTRA",
                        },
                      ],
                    ],
                  },
                ],
              ],
            ],
          ]),
        )
        .mockResolvedValueOnce(success({}));
      return inspectDeployment(origin, "inert", fetcher);
    }
    const result = await inspectSchedule({
      type: "daily",
      hourUTC: integer(9n),
      minuteUTC: integer(30n),
      private: "PRIVATE_SCHEDULE",
    });
    expect(result.modules[0]?.modules[0]?.crons[0]).toEqual({
      identifier: "daily",
      udfPath: "worker:execute",
      schedule: { type: "daily", hourUTC: 9, minuteUTC: 30 },
      argsOmitted: true,
    });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_");
    for (const schedule of [
      { type: "daily", hourUTC: integer(24n) },
      { type: "interval", seconds: integer(-1n) },
      { type: "weekly", dayOfWeek: integer(7n), hourUTC: integer(0n) },
      { type: "monthly", day: integer(0n), hourUTC: integer(0n) },
      { type: "hourly", minuteUTC: 30 },
      { type: "cron", cronExpr: "PRIVATE_TOKEN" },
    ])
      await expect(inspectSchedule(schedule)).rejects.toThrow();
    expect(
      (await inspectSchedule({ type: "cron", cronExpr: "*/5 * * * *" }))
        .modules[0]?.modules[0]?.crons[0]?.schedule,
    ).toEqual({ type: "cron", cronExpr: "*/5 * * * *" });
  });

  test("rejects aggregate response bytes even when each response is within its limit", async () => {
    const padded = (value: unknown) =>
      new Response(
        JSON.stringify({
          status: "success",
          value,
          ignoredPadding: "x".repeat(3_500_000),
        }),
      );
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        padded([
          {
            id: "one",
            path: "one",
            state: "active",
            httpPrefix: null,
            args: {},
          },
          {
            id: "two",
            path: "two",
            state: "active",
            httpPrefix: null,
            args: {},
          },
        ]),
      )
      .mockResolvedValueOnce(
        padded([
          [null, []],
          ["one", []],
          ["two", []],
        ]),
      )
      .mockResolvedValueOnce(padded({}))
      .mockResolvedValueOnce(padded({}))
      .mockResolvedValueOnce(padded({}));
    await expect(inspectDeployment(origin, "inert", fetcher)).rejects.toThrow(
      "limit",
    );
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  test("canonical schema hashes ignore object key order but preserve changes and reject deep input", () => {
    expect(metadataHash({ b: 2, a: 1 })).toBe(metadataHash({ a: 1, b: 2 }));
    expect(metadataHash({ a: 2 })).not.toBe(metadataHash({ a: 1 }));
    let nested: unknown = null;
    for (let i = 0; i < 70; i++) nested = [nested];
    expect(() => metadataHash(nested)).toThrow();
  });
});
