/**
 * Dump a source's text to stdout for manual analysis.
 * Usage: bun run scripts/dump-source.ts <sourceId>
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const client = new ConvexHttpClient(process.env.CONVEX_URL!);

async function main() {
  const sourceId = process.argv[2];
  if (!sourceId) {
    console.error("Usage: dump-source.ts <sourceId>");
    process.exit(1);
  }

  const source = await client.query(api.sources.get, { id: sourceId as any });
  if (!source) {
    console.error("Not found");
    process.exit(1);
  }

  const text = source.rawText || source.transcript || "";
  console.log(
    JSON.stringify({
      id: source._id,
      title: source.title,
      url: source.url,
      type: source.type,
      textLength: text.length,
      text: text.slice(0, 15000), // Cap at 15k chars
    }),
  );
}

main().catch(console.error);
