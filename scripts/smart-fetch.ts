/**
 * Smart text fetcher — tries Jina Reader, direct HTML, then Kernel.sh.
 *
 * Usage:
 *   bun run scripts/smart-fetch.ts <url>
 *   bun run scripts/smart-fetch.ts <url> --update <sourceId>
 *   bun run scripts/smart-fetch.ts --batch-update
 *   Add --dry-run to print the selected operation without network/backend access.
 */
import "varlock/auto-load";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { getConvexClient, getDevBypassSecret } from "./lib/convexClient";
import { type FetchResult, fetchViaJina } from "./lib/fetchText";
import { createSourceIngestor } from "./lib/ingest";

interface SmartResult {
  text: string;
  method: "jina" | "direct" | "kernel" | "none";
  chars: number;
}

async function fetchDirect(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return "";
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("pdf")) return "";
    const html = await response.text();
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
      .slice(0, 100_000);
  } catch {
    return "";
  }
}

async function fetchViaKernel(url: string): Promise<string> {
  if (!process.env.KERNEL_API_KEY) return "";
  try {
    const Kernel = (await import("@onkernel/sdk")).default;
    const kernel = new Kernel();
    const browser = await kernel.browsers.create({
      timeout_seconds: 60,
      stealth: true,
    });
    const sessionId = browser.session_id;
    try {
      const result = (await kernel.browsers.playwright.execute(sessionId, {
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
      })) as { text?: string };
      return result.text || "";
    } finally {
      try {
        await kernel.browsers.deleteByID(sessionId);
      } catch {
        // The browser session may already be gone after a failed execution.
      }
    }
  } catch {
    return "";
  }
}

async function smartFetch(url: string): Promise<SmartResult> {
  const jina = await fetchViaJina(url);
  if (jina.ok && jina.text.length > 500) {
    const text = jina.text.slice(0, 100_000);
    return { text, method: "jina", chars: text.length };
  }

  let text = await fetchDirect(url);
  if (text.length > 500) return { text, method: "direct", chars: text.length };

  text = await fetchViaKernel(url);
  if (text.length > 500) return { text, method: "kernel", chars: text.length };

  return { text: "", method: "none", chars: 0 };
}

const smartFetchAdapter = async (url: string): Promise<FetchResult> => {
  const result = await smartFetch(url);
  return result.chars > 200
    ? { ok: true, text: result.text }
    : { ok: false, error: `no text (${result.method})` };
};

async function main() {
  const args = process.argv.slice(2);
  const batchUpdate = args.includes("--batch-update");
  const url = args.find((arg) => !arg.startsWith("--"));
  const updateIndex = args.indexOf("--update");
  const sourceId = updateIndex === -1 ? undefined : args[updateIndex + 1];

  if (args.includes("--dry-run")) {
    if (batchUpdate) {
      console.log(
        "DRY RUN: smart refetch statuses=ingested limit=500 minLength=1000",
      );
      return;
    }
    if (!url) {
      throw new Error("Dry run requires <url> or --batch-update");
    }
    console.log(
      `DRY RUN: smart fetch url=${url} update=${sourceId ? "requested" : "no"}`,
    );
    return;
  }

  if (batchUpdate) {
    const summary = await createSourceIngestor({
      client: getConvexClient({ useCurrentDeploymentDefault: true }),
      fetchText: smartFetchAdapter,
    }).refetchByStatus(["ingested"], {
      limit: 500,
      minLength: 1000,
    });
    console.log(
      `\nDone: ${summary.updated} updated, ${summary.skipped} skipped, ${summary.failed} failed`,
    );
    return;
  }

  if (!url) {
    console.log(
      "Usage: smart-fetch.ts <url> [--update <sourceId>] | --batch-update",
    );
    process.exit(1);
  }

  console.error(`Fetching: ${url}`);
  const result = await smartFetch(url);
  console.error(`Method: ${result.method}, Chars: ${result.chars}`);

  if (sourceId && result.chars > 200) {
    await getConvexClient({ useCurrentDeploymentDefault: true }).mutation(
      api.sources.updateText,
      {
        id: sourceId as Id<"sources">,
        rawText: result.text,
        devBypassSecret: getDevBypassSecret(),
      },
    );
    console.error("✓ Updated in Convex");
  }

  console.log(result.text.slice(0, 2000));
  if (result.chars > 2000) {
    console.log(`\n... [${result.chars - 2000} more chars]`);
  }
}

main().catch(console.error);
