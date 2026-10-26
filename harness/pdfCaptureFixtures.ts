import type { convexTest } from "convex-test";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

export type T = ReturnType<typeof convexTest>;

export const prose =
  "Just intonation tunes each interval to a small whole-number ratio, and the scale that results depends on which ratios the composer allows. ".repeat(
    4,
  );
export const pdfBytes = (body = "text") => new Blob([`%PDF-1.7\n${body}`]);

export const reader = (t: T) => t.withIdentity({ subject: "reader" });

export async function upload(
  t: T,
  body = "text",
  fileName = "tuning-and-temperament.pdf",
) {
  const storageId = await t.run((ctx) => ctx.storage.store(pdfBytes(body)));
  const result = await reader(t).mutation(api.pdfCapture.createFromPdfUpload, {
    storageId,
    fileName,
    tags: ["tuning"],
  });
  return { ...result, storageId };
}

export const source = (t: T, id: Id<"sources">) =>
  t.run((ctx) => ctx.db.get("sources", id));

export const scheduled = (t: T) =>
  t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());

export async function startAttempt(t: T, id: Id<"sources">) {
  const seq = (await source(t, id))!.metadata.pdfCapture.seq as number;
  const plan = await t.mutation(internal.pdfCapture.startPdfAttempt, {
    sourceId: id,
    seq,
  });
  return { seq, plan };
}
