/* eslint-disable no-underscore-dangle -- Convex document ids are named `_id`. */
/** Verify the six named feeds once, then archive-disable confirmed failures. */
// oxlint-disable-next-line import/no-unassigned-import -- Varlock must load before env access.
import "varlock/auto-load";
import { api } from "../convex/_generated/api";
import { parseRSSXML } from "../convex/ingest";
import { getConvexClient, getDevBypassSecret } from "./lib/convexClient";

const TARGETS = [
  { label: "3Blue1Brown", name: "3blue1brown" },
  { label: "Adam Neely", name: "adam neely" },
  { label: "David Bennett Piano", name: "david bennett piano" },
  { label: "CymaScope", name: "cymascope" },
  { label: "Robert Edward Grant (YouTube)", name: "robert edward grant" },
  { label: "Sound on Sound", name: "sound on sound" },
] as const;

function targetForName(name: string) {
  const normalized = name.toLowerCase();
  return TARGETS.find(
    (target) =>
      normalized === target.name ||
      (target.name === "robert edward grant" &&
        normalized.startsWith(target.name)),
  );
}

const apply = process.argv.includes("--apply");
const client = getConvexClient();
const devBypassSecret = getDevBypassSecret();
const feeds = await client.query(api.feeds.list, {});
const targets = feeds.filter((feed) => targetForName(feed.name) !== undefined);
const foundLabels = new Set(
  targets.map((feed) => targetForName(feed.name)?.label),
);
const missing = TARGETS.filter((target) => !foundLabels.has(target.label)).map(
  (target) => target.label,
);
if (missing.length > 0) {
  console.warn(`missing registry rows: ${missing.join(", ")}`);
}

let disabled = 0;
let stillLive = 0;
let alreadyDisabled = 0;
for (const feed of targets) {
  if (!feed.enabled) {
    console.log(`ALREADY DISABLED ${feed.name}`);
    alreadyDisabled++;
    continue;
  }
  let failureReason: string | undefined;
  try {
    const response = await fetch(feed.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      headers: {
        "user-agent": "ResonantProjects/1.0 (research aggregator)",
        accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
    });
    if (!response.ok) {
      failureReason = `HTTP ${response.status} from ${feed.url}`;
    } else {
      const parsed = parseRSSXML(await response.text());
      if (parsed.items.length === 0) {
        failureReason = `no RSS/Atom items parsed from ${feed.url}`;
      }
    }
  } catch (error) {
    failureReason = `poll failed for ${feed.url}: ${error instanceof Error ? error.message : String(error)}`;
  }
  if (!failureReason) {
    console.log(`LIVE ${feed.name} ${feed.url}`);
    stillLive++;
    continue;
  }
  console.log(
    `${apply ? "DISABLE" : "WOULD DISABLE"} ${feed.name}: ${failureReason}`,
  );
  if (apply) {
    await client.mutation(api.feeds.setEnabled, {
      id: feed._id,
      enabled: false,
      disabledReason: `${failureReason}; verified ${new Date().toISOString()}`,
      devBypassSecret,
    });
    disabled++;
  }
}

console.log(apply ? "APPLIED" : "DRY RUN (use --apply to execute)");
console.log(
  `targets=${targets.length} disabled=${disabled} alreadyDisabled=${alreadyDisabled} stillLive=${stillLive} missing=${missing.length}`,
);
