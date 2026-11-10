import { convexTest } from "convex-test";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test";
import { modules } from "../harness/modules";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { seedUser } from "./testHelpers";

// Scheduled passage indexing stays queued; these tests only read the rows.
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const hypothesisArgs = {
  title: "Creator identity",
  question: "Who created this hypothesis?",
  hypothesis: "The signed-in writer is recorded as its creator.",
  rationaleMd: "createdBy must hold a users id, not a Clerk subject.",
  sourceIds: [],
};

const url = "https://example.org/resubmit";
const firstText = "Stored text about interval ratios and tuning. ".repeat(3);

async function signedInWriter(t: ReturnType<typeof convexTest>) {
  const userId = await seedUser(t, "user_writer");
  return { userId, writer: t.withIdentity({ subject: "user_writer" }) };
}

async function storedSource(
  t: ReturnType<typeof convexTest>,
  id: Id<"sources">,
) {
  const source = await t.run((ctx) => ctx.db.get("sources", id));
  if (!source) throw new Error("source missing");
  return source;
}

describe("creatorOf on create", () => {
  test("a signed-in writer's hypothesis records their users id", async () => {
    const t = convexTest(schema, modules);
    const { userId, writer } = await signedInWriter(t);
    const id = await writer.mutation(api.hypotheses.create, hypothesisArgs);
    const row = await t.run((ctx) => ctx.db.get("hypotheses", id));
    expect(row?.createdBy).toBe(userId);
  });

  test("a signed-in writer's recipe records their users id", async () => {
    const t = convexTest(schema, modules);
    const { userId, writer } = await signedInWriter(t);
    const hypothesisId = await writer.mutation(
      api.hypotheses.create,
      hypothesisArgs,
    );
    const id = await writer.mutation(api.recipes.create, {
      hypothesisId,
      title: "Creator recipe",
      bodyMd: "Render one phrase twice.",
      parameters: [],
      dawChecklist: [],
    });
    const row = await t.run((ctx) => ctx.db.get("recipes", id));
    expect(row?.createdBy).toBe(userId);
  });

  test("a signed-in writer's URL Source records their users id", async () => {
    const t = convexTest(schema, modules);
    const { userId, writer } = await signedInWriter(t);
    const { id } = await writer.mutation(api.sources.createFromUrlInput, {
      url,
    });
    expect((await storedSource(t, id)).createdBy).toBe(userId);
  });

  test("the service identity records system", async () => {
    const t = convexTest(schema, modules);
    const id = await t
      .withIdentity({ subject: "system" })
      .mutation(api.hypotheses.create, hypothesisArgs);
    const row = await t.run((ctx) => ctx.db.get("hypotheses", id));
    expect(row?.createdBy).toBe("system");
  });
});

describe("URL resubmit", () => {
  test("a resubmit without text keeps the stored text and title", async () => {
    const t = convexTest(schema, modules);
    const { writer } = await signedInWriter(t);
    const first = await writer.mutation(api.sources.createFromUrlInput, {
      url,
      title: "T",
      rawText: firstText,
    });
    const before = await storedSource(t, first.id);
    expect(before.rawTextSha256).toBeDefined();

    const again = await writer.mutation(api.sources.createFromUrlInput, {
      url,
    });
    expect(again).toEqual({
      id: first.id,
      created: false,
      contentChanged: false,
    });
    const after = await storedSource(t, first.id);
    expect(after.rawText).toBe(firstText);
    expect(after.title).toBe("T");
    expect(after.rawTextSha256).toBe(before.rawTextSha256);
  });

  test("a resubmit with new text still replaces it", async () => {
    const t = convexTest(schema, modules);
    const { writer } = await signedInWriter(t);
    const first = await writer.mutation(api.sources.createFromUrlInput, {
      url,
      title: "T",
      rawText: firstText,
    });
    await writer.mutation(api.sources.createFromUrlInput, { url });
    const newText = "Replacement text about just intonation. ".repeat(3);
    const third = await writer.mutation(api.sources.createFromUrlInput, {
      url,
      rawText: newText,
    });
    expect(third.contentChanged).toBe(true);
    const after = await storedSource(t, first.id);
    expect(after.rawText).toBe(newText);
    expect(after.title).toBe("T");
  });

  test("a resubmit by another writer keeps createdBy and type", async () => {
    const t = convexTest(schema, modules);
    const { userId: firstUserId, writer } = await signedInWriter(t);
    const { id: sourceId } = await writer.mutation(
      api.sources.createFromUrlInput,
      { url, title: "Seeded" },
    );
    // A Source of another type that shares the URL's dedupe key.
    await t.run((ctx) => ctx.db.patch("sources", sourceId, { type: "pdf" }));
    await seedUser(t, "user_other");
    const other = t.withIdentity({ subject: "user_other" });

    const result = await other.mutation(api.sources.createFromUrlInput, {
      url,
      rawText: firstText,
    });
    expect(result).toEqual({
      id: sourceId,
      created: false,
      contentChanged: true,
    });
    const after = await storedSource(t, sourceId);
    expect(after.createdBy).toBe(firstUserId);
    expect(after.type).toBe("pdf");
    expect(after.rawText).toBe(firstText);
  });
});
