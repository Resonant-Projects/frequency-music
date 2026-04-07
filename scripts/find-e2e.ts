import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const c = new ConvexHttpClient(process.env.CONVEX_URL!);

async function main() {
  // Hypotheses
  const hyps = await c.query(api.hypotheses.listByStatus, { limit: 200 });
  console.log(`=== HYPOTHESES (${hyps.length}) ===`);
  const e2eHyps: string[] = [];
  for (const h of hyps) {
    const text = JSON.stringify(h).toLowerCase();
    const isE2E = /e2e|test hypothesis|test question/i.test(text);
    if (isE2E) {
      console.log(`🗑️  ${h._id} | ${(h.question || h.hypothesis || "").slice(0, 80)}`);
      e2eHyps.push(h._id);
    }
  }
  console.log(`E2E: ${e2eHyps.length}/${hyps.length}\n`);

  // Compositions
  const comps = await c.query(api.compositions.list, { limit: 200 });
  console.log(`=== COMPOSITIONS (${comps.length}) ===`);
  const e2eComps: string[] = [];
  for (const comp of comps) {
    const text = JSON.stringify(comp).toLowerCase();
    const isE2E = /e2e|test composition|test title/i.test(text);
    if (isE2E) {
      console.log(`🗑️  ${comp._id} | ${(comp.title || comp.description || "").slice(0, 80)}`);
      e2eComps.push(comp._id);
    }
  }
  console.log(`E2E: ${e2eComps.length}/${comps.length}\n`);

  // Recipes
  const recipes = await c.query(api.recipes.listByStatus, { limit: 200 });
  console.log(`=== RECIPES (${recipes.length}) ===`);
  const e2eRecipes: string[] = [];
  for (const r of recipes) {
    const text = JSON.stringify(r).toLowerCase();
    const isE2E = /e2e|test recipe|test title/i.test(text);
    if (isE2E) {
      console.log(`🗑️  ${r._id} | ${(r.title || r.description || "").slice(0, 80)}`);
      e2eRecipes.push(r._id);
    }
  }
  console.log(`E2E: ${e2eRecipes.length}/${recipes.length}\n`);

  // Also dump ALL entries briefly so we can spot other junk
  console.log("=== ALL HYPOTHESES (brief) ===");
  for (const h of hyps) {
    console.log(`  ${h._id} | ${h.status} | ${(h.question || "").slice(0, 60)}`);
  }
  console.log("\n=== ALL COMPOSITIONS (brief) ===");
  for (const comp of comps) {
    console.log(`  ${comp._id} | ${(comp.title || comp.description || "").slice(0, 60)}`);
  }
  console.log("\n=== ALL RECIPES (brief) ===");
  for (const r of recipes) {
    console.log(`  ${r._id} | ${r.status} | ${(r.title || r.description || "").slice(0, 60)}`);
  }
}

main();
