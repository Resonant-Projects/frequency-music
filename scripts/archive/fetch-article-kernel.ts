/**
 * Fetch full article text using Kernel.sh cloud browsers.
 * Uses server-side Playwright execution (no CDP connection needed).
 *
 * Usage: KERNEL_API_KEY=... bun run scripts/fetch-article-kernel.ts <url> [sourceId]
 */
import Kernel from "@onkernel/sdk";

interface KernelExecutionResult {
  text?: string;
  title?: string;
  result?: {
    text?: string;
    title?: string;
  };
}

async function main() {
  const url = process.argv[2];
  const sourceId = process.argv[3];

  if (!url) {
    console.error("Usage: fetch-article-kernel.ts <url> [sourceId]");
    process.exit(1);
  }

  console.error(`Fetching: ${url}`);

  const kernel = new Kernel();

  const kernelBrowser = await kernel.browsers.create({
    timeout_seconds: 120,
    stealth: true,
  });

  const sessionId = kernelBrowser.session_id;
  console.error(`Browser: ${sessionId}`);

  try {
    // Execute Playwright code server-side on Kernel
    const result = await kernel.browsers.playwright.execute(sessionId, {
      code: `
        const ctx = browser.contexts()[0];
        const pg = ctx.pages()[0] || await ctx.newPage();
        await pg.goto("${url}", { waitUntil: "domcontentloaded", timeout: 30000 });
        await pg.waitForTimeout(5000);
        
        const text = await pg.evaluate(() => {
          const selectors = [
            'article', '[role="main"]', '.article-body', '.article-content',
            '.entry-content', '.hlFld-Fulltext', '.NLM_sec_level_1', 'main',
          ];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent && el.textContent.trim().length > 500) {
              return el.textContent.trim();
            }
          }
          return document.body?.innerText?.trim() || "";
        });
        
        const title = await pg.title();
        return { title, textLength: text.length, text: text.slice(0, 80000) };
      `,
    });

    console.error(`Result: ${JSON.stringify(result).slice(0, 200)}`);

    const data = result as KernelExecutionResult;
    const text = data?.text || data?.result?.text || JSON.stringify(data);
    const title = data?.title || data?.result?.title || "";

    console.error(`Title: ${title}`);
    console.error(`Text length: ${text.length} chars`);

    // Save to file
    const fs = await import("node:fs");
    fs.writeFileSync(`/tmp/kernel-text-${sourceId || "output"}.txt`, text);

    console.log(text.slice(0, 3000));
    if (text.length > 3000)
      console.log(`\n... [${text.length - 3000} more chars]`);
  } catch (e: unknown) {
    if (e instanceof Error) {
      console.error(`Error: ${e.message}`);
      console.error(JSON.stringify(e, null, 2).slice(0, 500));
    } else {
      console.error(`Error: ${String(e)}`);
      try {
        console.error(JSON.stringify(e, null, 2).slice(0, 500));
      } catch {
        // ignore non-serializable errors
      }
    }
    throw e;
  } finally {
    await kernel.browsers.deleteByID(sessionId);
    console.error("Cleaned up");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
