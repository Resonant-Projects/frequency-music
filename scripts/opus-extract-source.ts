/**
 * Fetch a source's text and title for manual Opus extraction.
 * Outputs just the essential info needed for analysis.
 * Usage: CONVEX_URL=... bun run scripts/opus-extract-source.ts <sourceId>
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const client = new ConvexHttpClient(process.env.CONVEX_URL!);

async function main() {
  const sourceId = process.argv[2];
  if (!sourceId) {
    console.error("Usage: opus-extract-source.ts <sourceId>");
    process.exit(1);
  }

  const source = await client.query(api.sources.get, { id: sourceId as any });
  if (!source) {
    console.error("Source not found");
    process.exit(1);
  }

  const text = source.rawText || source.transcript || "";

  // Output compact info
  console.log(`TITLE: ${source.title}`);
  console.log(`URL: ${source.url}`);
  console.log(`TYPE: ${source.type}`);
  console.log(`TEXT_LENGTH: ${text.length}`);
  console.log(`---TEXT---`);
  console.log(text.slice(0, 12000));
  if (text.length > 12000)
    console.log(`\n... [truncated, ${text.length - 12000} more chars]`);
}

main().catch(console.error);
