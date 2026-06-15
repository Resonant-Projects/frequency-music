/**
 * Fetch blocked articles using Kernel.sh cloud browsers.
 * Keeps browser sessions alive for manual attachment.
 *
 * Usage: KERNEL_API_KEY=... bun run scripts/fetch-blocked-kernel.ts
 */
import "varlock/auto-load";
import Kernel from "@onkernel/sdk";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { writeFileSync, appendFileSync } from "fs";

const BYPASS = process.env.AUTH_BYPASS_SECRET ?? process.env.DEV_BYPASS_SECRET;
if (!BYPASS) {
  console.error("AUTH_BYPASS_SECRET (or DEV_BYPASS_SECRET) is required — set it in 1Password / .env.local");
  process.exit(1);
}
const client = new ConvexHttpClient(process.env.CONVEX_URL!);

interface BlockedSource {
  id: string;
  title: string;
  url: string;
  reason: string;
}

const BLOCKED: BlockedSource[] = [
  // PMC CAPTCHA-blocked (got ~410 chars instead of full text)
  {
    id: "jx7aya0a4y1kje0xs0rp61n9gs8260k7",
    title: "Qualitative Analysis of Noetic Experiences",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9364752/",
    reason: "PMC CAPTCHA",
  },
  {
    id: "jx738krg6mbv1bb8ezefcjfy4x827cv9",
    title: "Non-Contact Biofield Practices: Narrative Review",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8296239/",
    reason: "PMC CAPTCHA",
  },
  {
    id: "jx70nvxt87z3jr9czce9cxngfh826qzw",
    title: "Clinical Studies of Biofield Therapies",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4654788/",
    reason: "PMC CAPTCHA",
  },
  {
    id: "jx70q2w84sw2r31wgkkwj5k7hs827hxn",
    title: "Biofield Science and Healing: History",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4654789/",
    reason: "PMC CAPTCHA",
  },
  {
    id: "jx78j7pq0hbsx71n6vqf9evms1827bv3",
    title: "Singing Bowls Systematic Review",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12063014/",
    reason: "PMC CAPTCHA",
  },
  // ResearchGate PDFs (Jina returned 0 chars)
  {
    id: "jx7a3z9azbhr84hphaeznx8vp5827ars",
    title: "Sacred Science of Sound: Music and Mathematics",
    url: "https://www.researchgate.net/publication/275711911_The_Sacred_Science_of_Sound_Music_and_Mathematics",
    reason: "ResearchGate blocked",
  },
  {
    id: "jx76v6hrvdyhdrste3tngxeqtx8260nq",
    title: "Pythagoras, Music, Sacred Geometry, and Genetic Code",
    url: "https://www.researchgate.net/publication/335910464_Pythagoras_music_sacred_geometry_and_genetic_code",
    reason: "ResearchGate blocked",
  },
  {
    id: "jx70awak2ng08veat4dtvg20mh8263h0",
    title: "Brain Waves and the Schumann Resonance",
    url: "https://www.researchgate.net/publication/384040884_Brain_Waves_and_the_Schumann_Resonance_Exploring_the_Electromagnetic_Connection_Between_the_Earth_and_Human_Consciousness",
    reason: "ResearchGate blocked",
  },
  {
    id: "jx7aa4vrprfb3xsdraktektxnn8276ms",
    title: "Schumann Resonance and Brain Waves: Quantum Description",
    url: "https://www.researchgate.net/publication/281316806_Schumann_Resonance_and_Brain_Waves_A_Quantum_Description",
    reason: "ResearchGate blocked",
  },
  // IFLScience (Jina returned 0 chars)
  {
    id: "jx7f2xjetx571g7wjn362p6ar1826y2m",
    title: "What Are Ley Lines And Do They Really Exist?",
    url: "https://www.iflscience.com/what-are-ley-lines-and-do-they-really-exist-71960",
    reason: "IFLScience blocked",
  },
];

async function fetchWithKernel(
  kernel: Kernel,
  src: BlockedSource,
): Promise<{ text: string; sessionId: string }> {
  const browser = await kernel.browsers.create({
    timeout_seconds: 300, // 5 min keepalive
    stealth: true,
  });
  const sessionId = browser.session_id;
  console.log(`  Browser ${sessionId} → ${src.url.slice(0, 60)}...`);

  try {
    const result: any = await kernel.browsers.playwright.execute(sessionId, {
      code: `
        const ctx = browser.contexts()[0];
        const pg = ctx.pages()[0] || await ctx.newPage();
        await pg.goto("${src.url}", { waitUntil: "domcontentloaded", timeout: 45000 });
        await pg.waitForTimeout(8000);
        
        const text = await pg.evaluate(() => {
          const selectors = [
            'article', '[role="main"]', '.article-body', '.article-content',
            '.entry-content', '.hlFld-Fulltext', '.NLM_sec_level_1', 'main',
            '#mc', '.litNLM', '.jig-ncbiinpagenav',
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
        return { title, textLength: text.length, text: text.slice(0, 100000) };
      `,
    });

    const text = result?.text || result?.result?.text || "";
    return { text, sessionId };
  } catch (e: any) {
    console.error(`  Error: ${e.message?.slice(0, 100)}`);
    return { text: "", sessionId };
  }
  // NOTE: Not deleting browser — keeping alive for Keith to attach
}

async function main() {
  const kernel = new Kernel();
  const logFile = "/tmp/kernel-fetch-log.txt";
  writeFileSync(logFile, `Kernel.sh fetch log — ${new Date().toISOString()}\n\n`);

  const results: { src: BlockedSource; text: string; sessionId: string }[] = [];

  // Process sequentially to avoid rate limits
  for (const src of BLOCKED) {
    console.log(`\n[${BLOCKED.indexOf(src) + 1}/${BLOCKED.length}] ${src.title}`);
    const { text, sessionId } = await fetchWithKernel(kernel, src);
    console.log(`  Got ${text.length} chars (session: ${sessionId})`);
    results.push({ src, text, sessionId });

    appendFileSync(
      logFile,
      `${src.id} | ${src.title} | ${text.length} chars | session: ${sessionId}\n`,
    );

    if (text.length > 500) {
      // Update source in Convex with full text
      try {
        await client.mutation(api.sources.updateText as any, {
          id: src.id,
          rawText: text.slice(0, 100000),
          status: "text_ready",
          devBypassSecret: BYPASS,
        });
        console.log(`  ✓ Updated in Convex`);
        appendFileSync(logFile, `  → Updated in Convex\n`);
      } catch (e: any) {
        console.log(`  ⚠ Convex update failed: ${e.message?.slice(0, 80)}`);
        // Save to file as fallback
        writeFileSync(`/tmp/kernel-text-${src.id}.txt`, text);
        appendFileSync(logFile, `  → Saved to /tmp/kernel-text-${src.id}.txt\n`);
      }
    } else {
      appendFileSync(logFile, `  → Too short, needs manual clip\n`);
    }
  }

  // Summary
  const fetched = results.filter((r) => r.text.length > 500);
  const needClip = results.filter((r) => r.text.length <= 500);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`RESULTS: ${fetched.length} fetched, ${needClip.length} need manual clip`);
  console.log(`\nFetched OK:`);
  for (const r of fetched) {
    console.log(`  ✓ ${r.src.title} (${r.text.length} chars)`);
  }
  if (needClip.length > 0) {
    console.log(`\nNeed Keith to clip to Notion:`);
    for (const r of needClip) {
      console.log(`  ✗ ${r.src.title}`);
      console.log(`    ${r.src.url}`);
    }
  }

  // Keep sessions alive summary
  console.log(`\nActive browser sessions (kept alive for 5 min):`);
  for (const r of results) {
    console.log(`  ${r.sessionId} → ${r.src.url.slice(0, 70)}`);
  }

  appendFileSync(logFile, `\n---\nFetched: ${fetched.length}, Need clip: ${needClip.length}\n`);
}

main().catch(console.error);
