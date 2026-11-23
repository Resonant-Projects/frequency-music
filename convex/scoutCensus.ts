/* eslint-disable no-underscore-dangle -- Convex document ids are named `_id`. */
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { type DisplaySectorId, resolveDomainSector } from "./domainMappings";
import {
  BOOTSTRAP_RESEARCH_DOMAINS,
  RESEARCH_AREAS,
  SCOUT_EXCLUDED_DOMAINS,
  type ScoutThinDomain,
} from "./shared/researchTopics";

const SCOUT_DOMAIN_SCAN_LIMIT = 50;
const SCOUT_CONCEPTS_PER_DOMAIN_LIMIT = 50;
const SCOUT_TOTAL_CONCEPT_LIMIT = 100;
const SCOUT_SOURCE_EDGES_PER_CONCEPT_LIMIT = 50;
const SCOUT_CONJECTURE_SCAN_LIMIT = 100;
const SCOUT_TARGET_LIMIT = 5;

export function scoutConceptLimitPerDomain(
  domainCount: number,
  remainingBudget = SCOUT_TOTAL_CONCEPT_LIMIT,
): number {
  return Math.max(
    1,
    Math.min(
      SCOUT_CONCEPTS_PER_DOMAIN_LIMIT,
      Math.ceil(remainingBudget / Math.max(1, domainCount)),
    ),
  );
}

type ThinDomain = ScoutThinDomain & {
  sectorMapping: DisplaySectorId;
};

type DomainEvidence = {
  domain: string;
  sector: DisplaySectorId;
  conceptCount: number;
  sourceIds: Set<string>;
};

type StarvedConjecture = {
  correspondenceId: Id<"correspondences">;
  statement: string;
  conceptA: string;
  conceptB: string;
  evidenceCount: number;
};

async function sampleDomainEvidence(ctx: QueryCtx): Promise<DomainEvidence[]> {
  // A descending creation-time window includes newly-added domains immediately.
  // This stays approximate and bounded; a persisted rotation cursor is overkill here.
  const domainRows = await ctx.db
    .query("conceptDomains")
    .order("desc")
    .take(SCOUT_DOMAIN_SCAN_LIMIT);
  // Core research areas must remain reachable when newer registry rows fill
  // the bounded scan. Eight indexed registry reads supplement that scan;
  // the shared concept sample budget below remains unchanged.
  const bootstrapRows = await Promise.all(
    BOOTSTRAP_RESEARCH_DOMAINS.map((name) =>
      ctx.db
        .query("conceptDomains")
        .withIndex("by_name", (q) => q.eq("name", name))
        .first(),
    ),
  );
  const activeDomains = [
    ...new Map(
      [...bootstrapRows.filter((row) => row !== null), ...domainRows].map(
        (row) => [row.name, row],
      ),
    ).values(),
  ]
    .filter(
      (domain) =>
        domain.status !== "deprecated" &&
        !SCOUT_EXCLUDED_DOMAINS.includes(domain.name),
    )
    .toSorted((left, right) => left.name.localeCompare(right.name));

  let remainingConceptBudget = SCOUT_TOTAL_CONCEPT_LIMIT;
  const evidence: DomainEvidence[] = [];
  for (const [index, domain] of activeDomains.entries()) {
    // At most 58 registry + 100 concept + (100 x 50) edge rows = 5,158.
    // The index range holds only on-mission concepts, newest first, so
    // off-mission rows never consume the sample and recent intake is seen.
    const concepts = await ctx.db
      .query("concepts")
      .withIndex("by_domain_relevance", (q) =>
        q.eq("domain", domain.name).eq("missionRelevance", "on"),
      )
      .order("desc")
      .take(
        scoutConceptLimitPerDomain(
          activeDomains.length - index,
          remainingConceptBudget,
        ),
      );
    // Empty domains consume no concept rows. Redistribute their unused slots
    // and division remainders among the domains still to inspect.
    remainingConceptBudget -= concepts.length;
    const approvedBootstrap =
      BOOTSTRAP_RESEARCH_DOMAINS.includes(domain.name) &&
      (domain.status === "known" || domain.status === "experimental");
    if (concepts.length === 0 && !approvedBootstrap) continue;

    const sourceIds = new Set<string>();
    for (const concept of concepts) {
      const edges = await ctx.db
        .query("edges")
        .withIndex("by_to_fromType", (q) =>
          q
            .eq("toType", "concept")
            .eq("toId", concept.name)
            .eq("fromType", "source"),
        )
        .take(SCOUT_SOURCE_EDGES_PER_CONCEPT_LIMIT);
      for (const edge of edges) sourceIds.add(edge.fromId);
    }
    evidence.push({
      domain: domain.name,
      sector: resolveDomainSector(domain.name, [domain]),
      conceptCount: concepts.length,
      sourceIds,
    });
  }
  return evidence;
}

export async function computeThinDomains(ctx: QueryCtx): Promise<ThinDomain[]> {
  const domains = await sampleDomainEvidence(ctx);
  // Need is judged per research area: evidence filed under any domain that
  // resolves to a sector (e.g. `music-production` → synthesis) serves it.
  const pooled = new Map<
    DisplaySectorId,
    { conceptCount: number; sourceIds: Set<string> }
  >();
  for (const domain of domains) {
    const sector = pooled.get(domain.sector) ?? {
      conceptCount: 0,
      sourceIds: new Set<string>(),
    };
    sector.conceptCount += domain.conceptCount;
    for (const sourceId of domain.sourceIds) sector.sourceIds.add(sourceId);
    pooled.set(domain.sector, sector);
  }

  // Scout runs weekly. Rotate equal-need sectors each UTC week so all six
  // areas receive turns within the five-target cap, even if intake yields no concepts.
  const offset =
    Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % RESEARCH_AREAS.length;
  const sectorRank = (sector: DisplaySectorId) => {
    const index = RESEARCH_AREAS.findIndex((area) => area.sector === sector);
    return (index - offset + RESEARCH_AREAS.length) % RESEARCH_AREAS.length;
  };
  // Rows carry their sector's pooled counts; within a sector the thinnest
  // domain ranks first, so it names the area's search target.
  const rows = domains.map((domain) => {
    const sector = pooled.get(domain.sector) ?? {
      conceptCount: 0,
      sourceIds: new Set<string>(),
    };
    return {
      domain,
      row: {
        domain: domain.domain,
        sectorMapping: domain.sector,
        onMissionConceptCount: sector.conceptCount,
        sourceCount: sector.sourceIds.size,
      },
    };
  });
  type RankedRow = (typeof rows)[number];
  const byNeed =
    (rotate: boolean) =>
    (left: RankedRow, right: RankedRow): number =>
      left.row.sourceCount - right.row.sourceCount ||
      left.row.onMissionConceptCount - right.row.onMissionConceptCount ||
      (rotate
        ? sectorRank(left.domain.sector) - sectorRank(right.domain.sector)
        : 0) ||
      left.domain.sourceIds.size - right.domain.sourceIds.size ||
      left.domain.conceptCount - right.domain.conceptCount ||
      left.row.domain.localeCompare(right.row.domain);
  const ranked = rows.toSorted(byNeed(true));
  // Reserve the first slots for distinct display areas, so tuning/theory or
  // production/instrument cannot consume the whole five-domain courtesy cap.
  const selected = new Set<string>();
  const sectors = new Set<string>();
  for (const { row } of ranked) {
    if (sectors.has(row.sectorMapping)) continue;
    selected.add(row.domain);
    sectors.add(row.sectorMapping);
    if (selected.size === SCOUT_TARGET_LIMIT) break;
  }
  for (const { row } of ranked) {
    if (selected.size === SCOUT_TARGET_LIMIT) break;
    selected.add(row.domain);
  }
  return ranked
    .filter(({ row }) => selected.has(row.domain))
    .toSorted(byNeed(false))
    .map(({ row }) => row);
}

export async function computeStarvedConjectures(
  ctx: QueryCtx,
): Promise<StarvedConjecture[]> {
  // Adds at most 100 correspondence reads plus 10 concept hydrations, keeping
  // the complete scout census at no more than 5,268 document reads.
  const conjectures = await ctx.db
    .query("correspondences")
    .withIndex("by_status_updatedAt", (q) => q.eq("status", "conjectured"))
    .order("asc")
    .take(SCOUT_CONJECTURE_SCAN_LIMIT);
  const rankedConjectures = conjectures.toSorted(
    (left, right) =>
      left.evidence.length - right.evidence.length ||
      left.updatedAt - right.updatedAt ||
      left._id.localeCompare(right._id),
  );
  const hydratedConjectures = await Promise.all(
    rankedConjectures
      .slice(0, SCOUT_TARGET_LIMIT)
      .map(async (correspondence) => {
        const [conceptA, conceptB] = await Promise.all([
          ctx.db.get("concepts", correspondence.conceptAId),
          ctx.db.get("concepts", correspondence.conceptBId),
        ]);
        if (!conceptA || !conceptB) return null;
        return {
          correspondenceId: correspondence._id,
          statement: correspondence.statement,
          conceptA: conceptA.name,
          conceptB: conceptB.name,
          evidenceCount: correspondence.evidence.length,
        };
      }),
  );
  return hydratedConjectures.filter(
    (target): target is NonNullable<typeof target> => target !== null,
  );
}
