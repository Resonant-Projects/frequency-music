/**
 * Fetch blocked batch-2 sources via Kernel.sh (sequential, cleanup after each)
 */
import Kernel from "@onkernel/sdk";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

const client = new ConvexHttpClient(process.env.CONVEX_URL!);
const BYPASS = "freq-opus-extract-2026";

const BLOCKED = [
  // PMC CAPTCHA-blocked (410 chars)
  {
    id: "jx739hqw3hr3yfm68th7g78g0182av7n",
    title: "Resonance Theory of Consciousness",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6834646/",
  },
  {
    id: "jx73mfp5qf3mmy9kycded7fnnn82agdx",
    title: "Sound Vibration on Human Health",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8157227/",
  },
  {
    id: "jx7bfqyh4cezj2z934vetvjns182bdcq",
    title: "40Hz Parkinson's RCT",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7349639/",
  },
  {
    id: "jx7ay9s1hg4hyfpf5nykrfxmxn82bp1n",
    title: "Binaural Beats Systematic Review",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10198548/",
  },
  {
    id: "jx7e4vmxbg9d8eya6bfyvd1een82brwk",
    title: "Gamma Entrainment Mood/Memory",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7683678/",
  },
  // Other blocked
  {
    id: "jx760gfg4kjra0v2s41w8kh9cn82ajn5",
    title: "String Theory Britannica",
    url: "https://www.britannica.com/science/string-theory/Dimensions-and-vibrations",
  },
  {
    id: "jx72f7qz2xzdz3cn53nnmgxt6h82amhr",
    title: "Dean Radin Psi Encyclopedia",
    url: "https://psi-encyclopedia.spr.ac.uk/articles/dean-radin/",
  },
  {
    id: "jx7ab96jfhdve0xj2z0cv2as8n82b0vc",
    title: "Personalized Binaural Beats Frontiers",
    url: "https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.764068/full",
  },
];

async function main() {
  const kernel = new Kernel();

  for (let i = 0; i < BLOCKED.length; i++) {
    const src = BLOCKED[i];
    console.log("\n[" + (i + 1) + "/" + BLOCKED.length + "] " + src.title);
    let sessionId = "";
    try {
      const browser = await kernel.browsers.create({
        timeout_seconds: 90,
        stealth: true,
      });
      sessionId = browser.session_id;

      const result: any = await kernel.browsers.playwright.execute(sessionId, {
        code: `
          const ctx = browser.contexts()[0];
          const pg = ctx.pages()[0] || await ctx.newPage();
          await pg.goto("${src.url}", { waitUntil: "domcontentloaded", timeout: 45000 });
          await pg.waitForTimeout(8000);
          const text = await pg.evaluate(() => {
            const sels = ['article', '[role="main"]', '.article-body', 'main', '#mc', '.litNLM', '.c-article-body'];
            for (const s of sels) {
              const el = document.querySelector(s);
              if (el && el.textContent && el.textContent.trim().length > 500) return el.textContent.trim();
            }
            return document.body?.innerText?.trim() || "";
          });
          const title = await pg.title();
          return { title, textLength: text.length, text: text.slice(0, 100000) };
        `,
      });

      const text = result?.text || result?.result?.text || "";
      console.log("  Got " + text.length + " chars");

      if (text.length > 500) {
        await client.mutation(api.sources.updateText, {
          id: src.id as Id<"sources">,
          rawText: text.slice(0, 100000),
          devBypassSecret: BYPASS,
        });
        console.log("  ✓ Updated in Convex");
      } else {
        console.log("  ✗ Too short — needs manual clip");
      }
    } catch (e: any) {
      console.error("  Error: " + (e.message?.slice(0, 100) || "unknown"));
    } finally {
      if (sessionId) {
        try {
          await kernel.browsers.deleteByID(sessionId);
        } catch {}
      }
    }
  }
}

main().catch(console.error);
