/**
 * Smart text fetcher — tries multiple strategies to get article text.
 * Handles the common failure modes we've been hitting:
 * 1. Jina Reader (fast, works for most sites)
 * 2. Direct HTML fetch + extraction (fallback for Jina failures)
 * 3. Kernel.sh cloud browser (for CAPTCHA/Cloudflare-blocked sites)
 *
 * Usage:
 *   bun run scripts/smart-fetch.ts <url>                    # Just fetch and print
 *   bun run scripts/smart-fetch.ts <url> --update <sourceId> # Fetch and update Convex
 *   bun run scripts/smart-fetch.ts --batch-update            # Update all ingested sources
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

const BYPASS = "freq-opus-extract-2026";
const CONVEX_URL =
  process.env.CONVEX_URL ||
  process.env.CONVEX_SELF_HOSTED_URL ||
  "http://convex-backend.paas.rproj.art";

interface FetchResult {
  text: string;
  method: "jina" | "direct" | "kernel" | "none";
  chars: number;
}

async function fetchViaJina(url: string): Promise<string> {
  try {
    const resp = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) return "";
    return (await resp.text()).slice(0, 100000);
  } catch {
    return "";
  }
}

async function fetchDirect(url: string): Promise<string> {
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return "";
    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("pdf")) return ""; // Can't parse PDFs directly
    const html = await resp.text();
    // Extract text from HTML
    const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
    return body
      .replaceAll(/<script[\s\S]*?<\/script>/gi, "")
      .replaceAll(/<style[\s\S]*?<\/style>/gi, "")
      .replaceAll(/<nav[\s\S]*?<\/nav>/gi, "")
      .replaceAll(/<footer[\s\S]*?<\/footer>/gi, "")
      .replaceAll(/<header[\s\S]*?<\/header>/gi, "")
      .replaceAll(/<[^>]+>/g, " ")
      .replaceAll("&nbsp;", " ")
      .replaceAll("&amp;", "&")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&#x27;", "'")
      .replaceAll("&quot;", '"')
      .replaceAll(/\s+/g, " ")
      .trim()
      .slice(0, 100000);
  } catch {
    return "";
  }
}

async function smartFetch(url: string): Promise<FetchResult> {
  // Strategy 1: Jina Reader
  let text = await fetchViaJina(url);
  if (text.length > 500) return { text, method: "jina", chars: text.length };

  // Strategy 2: Direct HTML fetch
  text = await fetchDirect(url);
  if (text.length > 500) return { text, method: "direct", chars: text.length };

  // Strategy 3: Kernel.sh (only if KERNEL_API_KEY is set)
  if (process.env.KERNEL_API_KEY) {
    try {
      const Kernel = (await import("@onkernel/sdk")).default;
      const kernel = new Kernel();
      const browser = await kernel.browsers.create({
        timeout_seconds: 60,
        stealth: true,
      });
      const sessionId = browser.session_id;
      try {
        const result: any = await kernel.browsers.playwright.execute(
          sessionId,
          {
            code: `
            const ctx = browser.contexts()[0];
            const pg = ctx.pages()[0] || await ctx.newPage();
            await pg.goto("${url.replaceAll('"', '\\"')}", { waitUntil: "domcontentloaded", timeout: 30000 });
            await pg.waitForTimeout(5000);
            const text = await pg.evaluate(() => {
              const sels = ['article', '[role="main"]', '.article-body', 'main', '.entry-content'];
              for (const s of sels) {
                const el = document.querySelector(s);
                if (el && el.textContent && el.textContent.trim().length > 500) return el.textContent.trim();
              }
              return document.body?.innerText?.trim() || "";
            });
            return { text: text.slice(0, 100000) };
          `,
          },
        );
        text = result?.text || "";
        if (text.length > 500)
          return { text, method: "kernel", chars: text.length };
      } finally {
        try {
          await kernel.browsers.deleteByID(sessionId);
        } catch {}
      }
    } catch {
      // Kernel.sh unavailable or rate limited
    }
  }

  return { text: "", method: "none", chars: 0 };
}

async function batchUpdate() {
  const client = new ConvexHttpClient(CONVEX_URL);
  const ingested = await client.query(api.sources.listByStatus, {
    status: "ingested" as any,
    limit: 500,
  });
  console.log(`Found ${ingested.length} ingested sources without text\n`);

  let updated = 0,
    failed = 0,
    skipped = 0;
  for (const src of ingested) {
    const url = src.canonicalUrl;
    if (!url) {
      skipped++;
      continue;
    }

    console.log(
      `[${updated + failed + skipped + 1}/${ingested.length}] ${(src.title || "").slice(0, 55)}...`,
    );
    const result = await smartFetch(url);

    if (result.chars > 200) {
      try {
        await client.mutation(api.sources.updateText, {
          id: src._id as Id<"sources">,
          rawText: result.text,
          devBypassSecret: BYPASS,
        });
        console.log(`  ✓ ${result.method}: ${result.chars} chars`);
        updated++;
      } catch (e: any) {
        console.error(`  ✗ Convex error: ${e.message?.slice(0, 60)}`);
        failed++;
      }
    } else {
      console.log(`  ⏭ No text (${result.method})`);
      skipped++;
    }
  }

  console.log(
    `\nDone: ${updated} updated, ${skipped} skipped, ${failed} failed`,
  );
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--batch-update")) {
    await batchUpdate();
    return;
  }

  const url = args.find((a) => !a.startsWith("--"));
  if (!url) {
    console.log(
      "Usage: smart-fetch.ts <url> [--update <sourceId>] | --batch-update",
    );
    process.exit(1);
  }

  console.error(`Fetching: ${url}`);
  const result = await smartFetch(url);
  console.error(`Method: ${result.method}, Chars: ${result.chars}`);

  const sourceId = args[args.indexOf("--update") + 1];
  if (sourceId && result.chars > 200) {
    const client = new ConvexHttpClient(CONVEX_URL);
    await client.mutation(api.sources.updateText, {
      id: sourceId as Id<"sources">,
      rawText: result.text,
      devBypassSecret: BYPASS,
    });
    console.error("✓ Updated in Convex");
  }

  console.log(result.text.slice(0, 2000));
  if (result.chars > 2000)
    console.log(`\n... [${result.chars - 2000} more chars]`);
}

main().catch(console.error);
