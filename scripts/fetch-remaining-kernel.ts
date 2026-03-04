/**
 * Fetch remaining 5 blocked sources via Kernel.sh (one at a time, cleanup after each)
 */
import Kernel from "@onkernel/sdk";
import { writeFileSync } from "fs";

const SOURCES = [
  { id: "jx7a3z9azbhr84hphaeznx8vp5827ars", title: "Sacred Science of Sound", url: "https://www.researchgate.net/publication/275711911_The_Sacred_Science_of_Sound_Music_and_Mathematics" },
  { id: "jx76v6hrvdyhdrste3tngxeqtx8260nq", title: "Pythagoras Music Sacred Geometry Genetic Code", url: "https://www.researchgate.net/publication/335910464_Pythagoras_music_sacred_geometry_and_genetic_code" },
  { id: "jx70awak2ng08veat4dtvg20mh8263h0", title: "Brain Waves and Schumann Resonance", url: "https://www.researchgate.net/publication/384040884_Brain_Waves_and_the_Schumann_Resonance_Exploring_the_Electromagnetic_Connection_Between_the_Earth_and_Human_Consciousness" },
  { id: "jx7aa4vrprfb3xsdraktektxnn8276ms", title: "Schumann Resonance Quantum Description", url: "https://www.researchgate.net/publication/281316806_Schumann_Resonance_and_Brain_Waves_A_Quantum_Description" },
  { id: "jx7f2xjetx571g7wjn362p6ar1826y2m", title: "Ley Lines: Do They Really Exist?", url: "https://www.iflscience.com/what-are-ley-lines-and-do-they-really-exist-71960" },
];

async function main() {
  const kernel = new Kernel();

  for (const src of SOURCES) {
    console.log(`\n[${SOURCES.indexOf(src) + 1}/${SOURCES.length}] ${src.title}`);
    let sessionId = "";
    try {
      const browser = await kernel.browsers.create({ timeout_seconds: 120, stealth: true });
      sessionId = browser.session_id;
      console.log(`  Browser: ${sessionId}`);

      const result: any = await kernel.browsers.playwright.execute(sessionId, {
        code: `
          const ctx = browser.contexts()[0];
          const pg = ctx.pages()[0] || await ctx.newPage();
          await pg.goto("${src.url}", { waitUntil: "domcontentloaded", timeout: 45000 });
          await pg.waitForTimeout(10000);
          
          const text = await pg.evaluate(() => {
            // ResearchGate specific selectors
            const selectors = [
              '.research-detail-middle-section', '.nova-legacy-e-text--size-m',
              '[itemprop="articleBody"]', '.publication-full-text',
              'article', '[role="main"]', '.article-body', 'main',
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
      console.log(`  Got ${text.length} chars`);

      if (text.length > 500) {
        writeFileSync("/tmp/kernel-text-" + src.id + ".txt", text);
        console.log("  ✓ Saved to /tmp");
      } else {
        console.log("  ✗ Too short — needs manual clip");
        console.log("  CLIP: " + src.url);
      }
    } catch (e: any) {
      console.error("  Error: " + (e.message?.slice(0, 100) || "unknown"));
      console.log("  CLIP: " + src.url);
    } finally {
      if (sessionId) {
        try { await kernel.browsers.deleteByID(sessionId); } catch {}
      }
    }
  }
}

main().catch(console.error);
