import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { modules } from "../harness/modules";
import { internal } from "./_generated/api";
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
