/**
 * Build a structured bibliography from all extracted sources.
 * Outputs:
 *   - docs/reference/bibliography.md (human-readable, organized by topic)
 *   - data/bibliography.json (machine-readable for web app)
 *
 * Usage: CONVEX_URL=... bun run scripts/build-bibliography.ts
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { writeFileSync, mkdirSync } from "fs";

const CONVEX_URL = process.env.CONVEX_URL || "http://convex-backend.paas.rproj.art";

interface BibEntry {
  id: string;
  title: string;
  url: string;
  type: string;
  status: string;
  tags: string[];
  topics: string[];
  claimCount: number;
  paramCount: number;
  extractionId?: string;
  textLength: number;
  createdAt: number;
}

interface TopicGroup {
  topic: string;
  count: number;
  entries: BibEntry[];
}

// Map tags to broader topic categories
function categorize(tags: string[], url: string, title: string): string[] {
  const tagMap: Record<string, string> = {
    "sacred geometry": "Sacred Geometry & Architecture",
    "esoteric-research": "Esoteric & Complementary Research",
    "ley lines": "Earth Energy & Ley Lines",
    "rory-duff": "Earth Energy & Ley Lines",
    "crystal bowls": "Sound Healing & Therapy",
    "toning/chanting": "Sound Healing & Therapy",
    "biofield/EM healing": "Biofield Science",
    "consciousness": "Consciousness & Perception",
    "noetic science": "Consciousness & Perception",
    "cymatics": "Cymatics & Wave Physics",
    "multi-dimensional cosmos": "Physics & Cosmology",
    "electromagnetic fields": "Biofield Science",
    "microtuning": "Tuning Systems & Temperament",
    "xenharmonic": "Tuning Systems & Temperament",
    "music-theory": "Music Theory & Analysis",
    "psychoacoustics": "Psychoacoustics & Perception",
    "AI-music": "AI & Music Technology",
    "spectral": "Spectral Analysis",
    "robert-grant": "Geometric Music Theory",
    "vibroacoustic therapy": "Sound Healing & Therapy",
    "binaural beats": "Sound Healing & Therapy",
    "40Hz gamma": "Sound Healing & Therapy",
    "rife frequencies": "Sound Healing & Therapy",
    "faraday waves": "Cymatics & Wave Physics",
    "biophotons": "Biofield Science",
    "throat singing": "Vocal & Overtone Research",
    "overtone singing": "Vocal & Overtone Research",
  };

  const topics = new Set<string>();
  for (const tag of tags) {
    const mapped = tagMap[tag];
    if (mapped) topics.add(mapped);
  }

  // URL-based categorization for untagged sources
  if (topics.size === 0) {
    const u = url.toLowerCase();
    const t = title.toLowerCase();
    if (u.includes("arxiv.org")) topics.add("AI & Computational Audio (arXiv)");
    else if (u.includes("tandfonline.com") || u.includes("jmm")) topics.add("Journal of Mathematics & Music");
    else if (u.includes("youtube.com") || u.includes("youtu.be")) topics.add("YouTube & Video");
    else if (u.includes("pmc.ncbi.nlm.nih.gov") || u.includes("pubmed.ncbi")) topics.add("Biomedical Research (PMC/PubMed)");
    else if (u.includes("researchgate.net")) topics.add("Academic Papers (ResearchGate)");
    else if (u.includes("archive.org")) topics.add("Books & Archives");
    else if (u.includes("quantamagazine.org")) topics.add("Science Journalism");
    else if (u.includes("nautil.us")) topics.add("Science Journalism");
    else if (u.includes("robertedwardgrant.com")) topics.add("Geometric Music Theory");
    else if (u.includes("wikipedia.org")) topics.add("Reference (Wikipedia)");
    // Title-based fallback
    else if (t.includes("speech") || t.includes("audio") || t.includes("music generation")) topics.add("AI & Computational Audio");
    else if (t.includes("tuning") || t.includes("temperament") || t.includes("intonation")) topics.add("Tuning Systems & Temperament");
    else topics.add("General / Uncategorized");
  }

  return [...topics];
}

async function main() {
  const client = new ConvexHttpClient(CONVEX_URL);

  // Fetch all non-archived sources
  const statuses = ["extracted", "text_ready", "ingested"] as const;
  const allSources: any[] = [];
  for (const status of statuses) {
    const batch = await client.query(api.sources.listByStatus, { status: status as any, limit: 1000 });
    allSources.push(...batch);
  }

  console.log(`Processing ${allSources.length} sources...`);

  // Build bibliography entries
  const entries: BibEntry[] = allSources.map((s: any) => ({
    id: s._id,
    title: s.title || "Untitled",
    url: s.canonicalUrl || "",
    type: s.type || "url",
    status: s.status,
    tags: s.tags || [],
    topics: categorize(s.tags || [], s.canonicalUrl || "", s.title || ""),
    claimCount: 0, // Will be filled from extractions
    paramCount: 0,
    textLength: s.rawText?.length || s.transcript?.length || 0,
    createdAt: s._creationTime || Date.now(),
  }));

  // Group by topic
  const topicMap = new Map<string, BibEntry[]>();
  for (const entry of entries) {
    for (const topic of entry.topics) {
      if (!topicMap.has(topic)) topicMap.set(topic, []);
      topicMap.get(topic)!.push(entry);
    }
  }

  const groups: TopicGroup[] = [...topicMap.entries()]
    .map(([topic, entries]) => ({ topic, count: entries.length, entries: entries.sort((a, b) => a.title.localeCompare(b.title)) }))
    .sort((a, b) => b.count - a.count);

  // Summary stats
  const stats = {
    totalSources: entries.length,
    extracted: entries.filter(e => e.status === "extracted").length,
    textReady: entries.filter(e => e.status === "text_ready").length,
    ingested: entries.filter(e => e.status === "ingested").length,
    withText: entries.filter(e => e.textLength > 200).length,
    topicCount: groups.length,
    generatedAt: new Date().toISOString(),
  };

  // Write JSON for web app
  const jsonOutput = { stats, groups };
  writeFileSync("data/bibliography.json", JSON.stringify(jsonOutput, null, 2));
  console.log(`Wrote data/bibliography.json (${groups.length} topics, ${entries.length} entries)`);

  // Write Markdown bibliography
  let md = `# Research Bibliography\n\n`;
  md += `*Generated ${new Date().toISOString().split("T")[0]} — ${stats.totalSources} sources across ${stats.topicCount} topics*\n\n`;
  md += `| Status | Count |\n|--------|-------|\n`;
  md += `| Extracted | ${stats.extracted} |\n`;
  md += `| Text Ready | ${stats.textReady} |\n`;
  md += `| Ingested (metadata only) | ${stats.ingested} |\n`;
  md += `| **Total** | **${stats.totalSources}** |\n\n`;
  md += `---\n\n`;

  for (const group of groups) {
    md += `## ${group.topic} (${group.count})\n\n`;
    for (const entry of group.entries) {
      const statusIcon = entry.status === "extracted" ? "✅" : entry.status === "text_ready" ? "📄" : "📌";
      const textInfo = entry.textLength > 0 ? ` (${Math.round(entry.textLength / 1000)}k chars)` : "";
      if (entry.url) {
        md += `- ${statusIcon} [${entry.title}](${entry.url})${textInfo}\n`;
      } else {
        md += `- ${statusIcon} ${entry.title}${textInfo}\n`;
      }
    }
    md += `\n`;
  }

  mkdirSync("docs/reference", { recursive: true });
  writeFileSync("docs/reference/bibliography.md", md);
  console.log(`Wrote docs/reference/bibliography.md`);
}

main().catch(console.error);
