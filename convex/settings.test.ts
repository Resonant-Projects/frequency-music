import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { modules } from "../harness/modules";
import { api, internal } from "./_generated/api";
import schema from "./schema";

describe("settings", () => {
  test("get returns null until set; set upserts by key", async () => {
    const t = convexTest(schema, modules);
    expect(
      await t.query(internal.settings.get, { key: "houseVoiceId" }),
    ).toBeNull();
    await t.mutation(internal.settings.set, {
      key: "houseVoiceId",
      value: "breeze-2",
    });
    await t.mutation(internal.settings.set, {
      key: "houseVoiceId",
      value: "inworld-max",
    });
    expect(await t.query(internal.settings.get, { key: "houseVoiceId" })).toBe(
      "inworld-max",
    );
    const rows = await t.run((ctx) => ctx.db.query("settings").collect());
    expect(rows).toHaveLength(1);
  });

  test("setHouseVoice rejects unknown voices", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(internal.settings.setHouseVoiceInternal, {
        voiceId: "kokoro",
      }),
    ).rejects.toThrow(/unknown voice/);
    await t.mutation(internal.settings.setHouseVoiceInternal, {
      voiceId: "gemini-flash-tts",
    });
    expect(await t.query(internal.settings.get, { key: "houseVoiceId" })).toBe(
      "gemini-flash-tts",
    );
  });
});

async function scheduledJobs(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) =>
    ctx.db.system.query("_scheduled_functions").collect(),
  );
}

describe("setHouseVoice initial narration", () => {
  // Fake timers keep scheduled jobs pending so the queue can be inspected.
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  const identity = { subject: "user_1", tokenIdentifier: "clerk|user_1" };

  test("first choice schedules one 14-day reconcile; repeats and changes do not", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const asKeith = t.withIdentity(identity);

    expect(
      await asKeith.mutation(api.settings.setHouseVoice, {
        voiceId: "breeze-2",
      }),
    ).toEqual({ initialNarrationScheduled: true });
    // Same voice clicked again, then a different voice chosen.
    expect(
      await asKeith.mutation(api.settings.setHouseVoice, {
        voiceId: "breeze-2",
      }),
    ).toEqual({ initialNarrationScheduled: false });
    expect(
      await asKeith.mutation(api.settings.setHouseVoice, {
        voiceId: "gemini-flash-tts",
      }),
    ).toEqual({ initialNarrationScheduled: false });

    const jobs = await scheduledJobs(t);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.name).toMatch(/^episodes(\.js)?:reconcile$/);
    expect(jobs[0]?.args).toEqual([{ daysBack: 14 }]);
    expect(await t.query(internal.settings.get, { key: "houseVoiceId" })).toBe(
      "gemini-flash-tts",
    );

    // The scheduled reference resolves and runs to completion; with no
    // briefs there is nothing to narrate.
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const [finished] = await scheduledJobs(t);
    expect(finished?.state.kind).toBe("success");
  });

  test("a voice set by the internal helper still lets the first human choice start narration", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await t.mutation(internal.settings.setHouseVoiceInternal, {
      voiceId: "breeze-2",
    });
    expect(await scheduledJobs(t)).toHaveLength(0);

    const result = await t
      .withIdentity(identity)
      .mutation(api.settings.setHouseVoice, { voiceId: "breeze-2" });
    expect(result).toEqual({ initialNarrationScheduled: true });
    expect(await scheduledJobs(t)).toHaveLength(1);
  });

  test("unknown voices and anonymous callers change nothing", async () => {
    vi.useFakeTimers();
    vi.stubEnv("AUTH_BYPASS_ENABLED", "false");
    const t = convexTest(schema, modules);
    await expect(
      t
        .withIdentity(identity)
        .mutation(api.settings.setHouseVoice, { voiceId: "kokoro" }),
    ).rejects.toThrow(/unknown voice/);
    await expect(
      t.mutation(api.settings.setHouseVoice, { voiceId: "breeze-2" }),
    ).rejects.toThrow(/Authentication required/);

    expect(await scheduledJobs(t)).toHaveLength(0);
    expect(
      await t.query(internal.settings.get, { key: "houseVoiceId" }),
    ).toBeNull();
    expect(
      await t.query(internal.settings.get, {
        key: "initialNarrationScheduledAt",
      }),
    ).toBeNull();
  });
});
