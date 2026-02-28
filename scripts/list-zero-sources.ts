import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const client = new ConvexHttpClient(process.env.CONVEX_URL!);
const summary = JSON.parse(readFileSync("/tmp/ext-summary.json", "utf-8"));
const zeros = summary.filter((e: any) => e.claims === 0 && e.params === 0);

async function main() {
  for (const z of zeros) {
    const source = await client.query(api.sources.get, { id: z.sourceId });
    const title = source?.title?.slice(0, 70) || "UNKNOWN";
    const type = source?.type || "?";
    const textLen = source?.rawText?.length || 0;
    console.log(
      `${z.sourceId} | ${type.padEnd(10)} | ${textLen.toString().padStart(6)} | ${title}`,
    );
  }
}
main();
