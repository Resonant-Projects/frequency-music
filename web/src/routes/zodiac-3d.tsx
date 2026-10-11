// Design 6: ZODIAC 3D — Illuminated Astrolabe Knowledge Orrery
// Three.js 3D implementation of the ZODIAC design with live Convex metrics.
// Phases 1-3: Constellations, Armillary Rings, Planetary Orrery with sidebar drill-down.

import { Link } from "@tanstack/solid-router";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Index,
  type JSX,
  on,
  onCleanup,
  onMount,
  Show,
  untrack,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import { css, cva, cx } from "../../styled-system/css";
import { token } from "../../styled-system/tokens";
import {
  createAnnouncer,
  eyebrowClass,
  focusRingStyle,
  srOnlyClass,
  UIList,
  UINotice,
} from "../components/ui";
import { createQuery, createQueryWithStatus } from "../integrations/convex";
import { api } from "../../../convex/_generated/api";
import type { ConstellationEdge } from "../lib/zodiac-constellations";
import { prefersReducedMotion, watchReducedMotion } from "../lib/zodiac-camera";
import { SECTORS, type SectorDef } from "../lib/zodiac-data";
import {
  buildOrbitalItemGroups,
  type OrbitalItem,
  type OrbitalItemGroups,
  orbitalItemSector,
} from "../lib/zodiac-orbits";
import { initZodiacScene, type ZodiacHandle } from "../lib/zodiac-scene";
import type {
  ConceptDetailData,
  ConstellationConcept,
  ItemRelation,
  PipelineItems,
  ZodiacConstellationEdge,
  ZodiacSubTopic,
} from "../lib/zodiac-types";

// ---------------------------------------------------------------------------
// PandaCSS style constants — Sidebar
// ---------------------------------------------------------------------------

// -- Layout --

// Below `lg` the canvas takes a fixed 60vh band and the page scrolls
// naturally, so the sidebar is never squeezed; from `lg` up the page is a
// fixed-height split with the canvas flexing beside the sidebar.
const pageContainer = css({
  height: { base: "auto", lg: "calc(100vh - var(--app-header-height))" },
  minHeight: { base: "calc(100vh - var(--app-header-height))", lg: "0" },
  background: "zodiac.void",
  color: "zodiac.cream",
  overflowX: "hidden",
  overflowY: { base: "visible", lg: "hidden" },
  fontFamily: "display",
  display: "flex",
  flexDirection: { base: "column", lg: "row" },
});

const dotOverlay = css({
  position: "fixed",
  inset: "0",
  pointerEvents: "none",
  opacity: 0.022,
  backgroundImage:
    "radial-gradient(circle, {colors.zodiac.gold} 1px, transparent 1px)",
  backgroundSize: "52px 52px",
});

const canvasWrapper = css({
  flex: { base: "0 0 60vh", lg: "1 1 0%" },
  // A definite height below `lg` so the canvas's 100% height resolves.
  height: { base: "60vh", lg: "auto" },
  position: "relative",
  overflow: "hidden",
  minWidth: "0",
});

const canvasEl = css({
  width: "100%",
  height: "100%",
  display: "block",
});

// Hover label over the canvas; the scene positions it and toggles display.
const sceneTooltip = css({
  position: "absolute",
  zIndex: 100,
  pointerEvents: "none",
  whiteSpace: "nowrap",
  fontFamily: "mono",
  fontSize: "xs",
  color: "zodiac.gold",
  background: "zodiac.void/88",
  borderWidth: "1px",
  borderColor: "zodiac.gold/35",
  padding: "4px 8px",
});

const sidebarContainer = css({
  width: { base: "100%", lg: "355px" },
  display: "flex",
  flexDirection: "column",
  borderLeftWidth: { base: "0", lg: "1px" },
  borderLeftColor: "zodiac.gold/12",
  borderTopWidth: { base: "1px", lg: "0" },
  borderTopColor: "zodiac.gold/12",
  overflowY: "auto",
  flexShrink: 0,
  // Keep the last section clear of the home indicator on notched phones.
  paddingBottom: "env(safe-area-inset-bottom)",
});

// -- Sidebar sections --

const sectionDivider = {
  borderBottomWidth: "1px",
  borderBottomColor: "zodiac.gold/10",
} as const;

const sidebarSection = css({
  padding: "36px 26px 20px",
  ...sectionDivider,
});

const sidebarSectionCompact = css({
  padding: "20px 26px",
  ...sectionDivider,
});

const sidebarSectionScrollable = cx(
  css({
    padding: "16px 26px",
    flex: "1",
    overflowY: "auto",
  }),
  "zodiac-scroll",
);

const sidebarSectionDomain = css({
  padding: "22px 26px",
  flex: "1",
  ...sectionDivider,
});

const sidebarSectionDomains = css({
  padding: "16px 26px",
  flexShrink: 0,
});

const sidebarSectionWorkflow = css({
  padding: "0 26px 16px",
  flexShrink: 0,
  borderTopWidth: "1px",
  borderTopColor: "zodiac.gold/10",
});

const sidebarSectionPipeline = css({
  padding: "14px 26px 24px",
  borderTopWidth: "1px",
  borderTopColor: "zodiac.gold/10",
});

// -- Typography --

// Every eyebrow and section heading in the sidebar is the shared eyebrow
// plus a tone, tracking and spacing. Tone and tracking override the shared
// class, so they use the doubled `&&` selector to win regardless of order.
const eyebrowVariant = cva({
  base: {
    fontWeight: "400",
    lineHeight: "1.4",
  },
  variants: {
    tone: {
      gold: {},
      violet: { "&&": { color: "zodiac.violetText" } },
      // Text-safe per-sector colour set on an ancestor (see sectorStyle).
      sector: { "&&": { color: "var(--sector-text)" } },
    },
    tracking: {
      normal: {},
      wide: { "&&": { letterSpacing: "0.35em" } },
      widest: { "&&": { letterSpacing: "0.4em" } },
    },
    space: {
      tight: { marginBottom: "8px" },
      normal: { marginBottom: "10px" },
      loose: { marginBottom: "14px" },
      top: { margin: "12px 0 10px" },
      group: { margin: "16px 0 8px" },
    },
  },
  defaultVariants: { tone: "gold", tracking: "normal", space: "tight" },
});

const eyebrow = (variant?: Parameters<typeof eyebrowVariant>[0]) =>
  cx(eyebrowClass, eyebrowVariant(variant));

const sidebarEyebrow = eyebrow({ tracking: "widest", space: "loose" });
const sidebarEyebrowSector = eyebrow({
  tone: "sector",
  tracking: "wide",
  space: "normal",
});
const sidebarEyebrowViolet = eyebrow({ tone: "violet", tracking: "wide" });
const sidebarEyebrowGold = eyebrow({ tracking: "wide" });
const sidebarEyebrowSection = eyebrow({ space: "normal" });
const sidebarEyebrowSectionTop = eyebrow({ space: "top" });
const sidebarEyebrowGroup = eyebrow({ space: "group" });
const sidebarEyebrowTight = eyebrow();

const sidebarTitle = css({
  fontSize: "34px",
  fontWeight: "300",
  lineHeight: "1.15",
  margin: "0 0 10px",
});

const sidebarTitleMd = css({
  fontSize: "22px",
  fontWeight: "300",
  marginBottom: "8px",
});

const sidebarTitleDomain = cx(
  sidebarTitleMd,
  css({ color: "var(--sector-color)" }),
);

const sidebarTitleSubTopic = cx(sidebarTitleMd, css({ color: "zodiac.gold" }));

const sidebarTitleSm = css({
  fontSize: "24px",
  color: "zodiac.gold",
  fontWeight: "300",
  marginBottom: "6px",
});

const sidebarTitleItem = css({
  fontSize: "18px",
  color: "zodiac.gold",
  fontWeight: "300",
  marginBottom: "4px",
  lineHeight: "1.3",
});

const sidebarTitleEmphasis = css({ color: "zodiac.gold" });

const sidebarBody = css({
  fontSize: "14px",
  fontWeight: "400",
  lineHeight: "1.65",
  color: "zodiac.cream/66",
});

const sidebarBodySm = css({
  fontSize: "14px",
  lineHeight: "1.65",
  color: "zodiac.cream/66",
  margin: "0 0 18px",
});

const sidebarBodyDetail = css({
  fontSize: "14px",
  lineHeight: "1.65",
  color: "zodiac.cream/66",
  margin: "0 0 16px",
});

const sidebarMeta = css({
  fontSize: "12px",
  color: "zodiac.cream/66",
  marginBottom: "12px",
});

const sidebarAliases = css({
  fontSize: "12px",
  color: "zodiac.cream/66",
  marginBottom: "16px",
});

const sidebarLoading = css({
  padding: "26px",
  color: "zodiac.cream/66",
  fontSize: "14px",
});

const sidebarEmpty = css({
  color: "zodiac.cream/66",
  fontSize: "14px",
});

// -- Stats --

const statRow = css({
  display: "flex",
  gap: "12px",
  marginBottom: "14px",
});

const statCellGold = css({
  flex: "1",
  padding: "10px",
  borderWidth: "1px",
  borderColor: "zodiac.gold/18",
  textAlign: "center",
});

const statCellViolet = css({
  flex: "1",
  padding: "10px",
  borderWidth: "1px",
  borderColor: "zodiac.violet/18",
  textAlign: "center",
});

const statValueGold = css({
  fontSize: "26px",
  color: "zodiac.gold",
});

const statValueViolet = css({
  fontSize: "26px",
  color: "zodiac.violet",
});

const statLabel = css({
  fontFamily: "mono",
  fontSize: "10px",
  letterSpacing: "0.25em",
  color: "zodiac.cream/66",
  marginTop: "2px",
});

// -- Concept tags --

const conceptTagRow = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "4px",
  marginBottom: "14px",
});

const conceptTag = css({
  cursor: "pointer",
  background: "zodiac.violet/10",
  borderWidth: "1px",
  borderColor: "zodiac.violet/25",
  color: "zodiac.gold",
  padding: "5px 10px",
  minHeight: "28px",
  fontSize: "xs",
  letterSpacing: "0.04em",
  _coarsePointer: {
    minHeight: "44px",
    padding: "10px 14px",
  },
  ...focusRingStyle,
});

const conceptTagCount = css({
  color: "zodiac.gold/78",
  marginLeft: "4px",
});

// -- Buttons and links --

// Square-cornered instrument controls (intentional; see DESIGN.md): 12px mono
// uppercase faces tracked 0.16em.
const buttonFace = {
  fontFamily: "mono",
  fontSize: "xs",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
} as const;

const openDomainLink = css({
  ...buttonFace,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  textAlign: "center",
  textDecoration: "none",
  borderWidth: "1px",
  borderColor: "zodiac.gold/45",
  background: "zodiac.gold",
  color: "zodiac.void",
  padding: "8px 10px",
  minHeight: "40px",
  _coarsePointer: {
    minHeight: "48px",
  },
  ...focusRingStyle,
});

const subTopicList = css({
  marginBottom: "14px",
});

const sectorButton = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "7px 9px",
  minHeight: "36px",
  marginBottom: "3px",
  cursor: "pointer",
  borderWidth: "1px",
  borderColor: "zodiac.gold/10",
  background: "transparent",
  transition: "all 0.2s",
  width: "100%",
  textAlign: "left",
  _pressed: {
    // The per-sector hue at a third, as before; set via --sector-color.
    borderColor: "color-mix(in srgb, var(--sector-color) 33%, transparent)",
    background: "zodiac.gold/5",
  },
  _coarsePointer: {
    minHeight: "44px",
  },
  ...focusRingStyle,
});

// Inactive labels drop the sector hue: the rest state is cream and only the
// active sector carries its (text-safe) colour.
const sectorButtonLabel = css({
  fontSize: "14px",
  color: "zodiac.cream/72",
  "[aria-pressed=true] > &": {
    color: "var(--sector-text)",
  },
});

const sectorButtonMeta = css({
  fontSize: "12px",
  color: "zodiac.cream/66",
});

const workspaceGrid = css({
  display: "grid",
  gap: "6px",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
});

const workspaceLink = css({
  ...buttonFace,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  textAlign: "center",
  textDecoration: "none",
  borderWidth: "1px",
  borderColor: "zodiac.gold/20",
  background: "zodiac.glow-inner/55",
  color: "zodiac.cream",
  padding: "7px 8px",
  minHeight: "32px",
  _coarsePointer: {
    minHeight: "44px",
  },
  ...focusRingStyle,
});

// Back, pause/resume and show-all toggles share one bar-button face.
const barButton = css({
  ...buttonFace,
  cursor: "pointer",
  borderWidth: "1px",
  borderColor: "zodiac.gold/25",
  background: "transparent",
  color: "zodiac.gold",
  padding: "5px 12px",
  minHeight: "32px",
  _coarsePointer: {
    minHeight: "44px",
  },
  ...focusRingStyle,
});

const motionToggleOverview = cx(barButton, css({ marginTop: "12px" }));

const barRow = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  marginBottom: "14px",
});

const showAllToggle = cx(barButton, css({ marginBottom: "14px" }));

// -- Pipeline --

const pipelineRow = css({
  display: "flex",
  alignItems: "center",
  gap: "5px",
  flexWrap: "wrap",
});

const pipelineCell = css({
  textAlign: "center",
  minWidth: "46px",
});

const pipelineCellValue = css({
  fontSize: "15px",
  color: "zodiac.gold",
});

const pipelineCellLabel = css({
  fontFamily: "mono",
  fontSize: "10px",
  letterSpacing: "0.2em",
  color: "zodiac.cream/66",
});

const pipelineArrow = css({
  fontSize: "10px",
  color: "zodiac.gold/55",
  marginBottom: "8px",
});

const pipelineSectionContainer = css({
  marginBottom: "16px",
});

// -- List buttons (sub-topics, concepts in a cluster, pipeline items) --

const listButtonBase = {
  display: "block",
  width: "100%",
  textAlign: "left",
  cursor: "pointer",
  padding: "6px 8px",
  minHeight: "36px",
  marginBottom: "3px",
  borderWidth: "1px",
  borderColor: "zodiac.gold/12",
  background: "transparent",
  color: "zodiac.cream",
  fontSize: "14px",
  lineHeight: "1.4",
  _coarsePointer: {
    minHeight: "44px",
  },
  ...focusRingStyle,
} as const;

const listButton = css(listButtonBase);

const relationButton = css({
  ...listButtonBase,
  padding: "8px",
  marginBottom: "4px",
});

const listButtonMeta = css({
  float: "right",
  marginLeft: "8px",
  color: "zodiac.gold/78",
  fontSize: "12px",
});

const pipelineItemStatus = css({
  fontSize: "12px",
  color: "zodiac.cream/66",
  marginTop: "2px",
});

const relationTypeLabel = css({
  fontFamily: "mono",
  fontSize: "12px",
  letterSpacing: "0.14em",
  color: "zodiac.violetText",
  marginBottom: "2px",
});

const relationTitle = css({
  color: "zodiac.cream/70",
  fontSize: "14px",
});

// ---------------------------------------------------------------------------
// PandaCSS style constants — WebGL fallback
// ---------------------------------------------------------------------------

const fallbackContainer = css({
  minHeight: "calc(100vh - var(--app-header-height))",
  background: "zodiac.void",
  color: "zodiac.cream",
  padding: "24px",
});

const fallbackGrid = css({
  maxWidth: "1120px",
  margin: "0 auto",
  display: "grid",
  gap: "16px",
});

const fallbackCard = css({
  borderWidth: "1px",
  borderColor: "zodiac.gold/20",
  padding: "18px",
  borderRadius: "8px",
  background: "zodiac.void/50",
});

const fallbackEyebrow = cva({
  base: {
    fontFamily: "mono",
    fontSize: "10px",
    fontWeight: "400",
    letterSpacing: "0.24em",
    color: "zodiac.gold/78",
  },
  variants: {
    space: {
      none: {},
      normal: { marginBottom: "10px" },
      loose: { marginBottom: "12px" },
    },
  },
  defaultVariants: { space: "none" },
});

const fallbackTitle = css({
  margin: "10px 0 8px",
  fontSize: "34px",
  fontWeight: "300",
});

const fallbackBody = css({
  fontSize: "14px",
  color: "zodiac.cream/66",
  lineHeight: "1.6",
});

const fallbackLinkGrid = css({
  display: "grid",
  gap: "10px",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))",
});

const fallbackLink = css({
  ...buttonFace,
  display: "flex",
  alignItems: "center",
  height: "100%",
  textDecoration: "none",
  background: "zodiac.glow-inner",
  borderWidth: "1px",
  borderColor: "zodiac.gold/55",
  padding: "11px 12px",
  minHeight: "44px",
  color: "zodiac.cream",
  textAlign: "left",
  ...focusRingStyle,
});

const fallbackPipelineRow = css({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
});

const fallbackPipelineCell = css({
  minWidth: "72px",
  padding: "8px",
  borderWidth: "1px",
  borderColor: "zodiac.gold/20",
  textAlign: "center",
});

const fallbackPipelineValue = css({
  fontSize: "20px",
  color: "zodiac.gold",
});

const fallbackPipelineLabel = css({
  fontFamily: "mono",
  fontSize: "10px",
  letterSpacing: "0.18em",
  color: "zodiac.cream/66",
});

const fallbackPipelineArrow = css({
  color: "zodiac.gold/58",
});

// ---------------------------------------------------------------------------

const sectorRouteMap = {
  math: "/display",
  wave: "/ingest",
  music: "/recipes",
  psycho: "/hypotheses",
  geometry: "/weekly-turns",
  synthesis: "/compositions",
} as const;

function sectorRoute(id: string) {
  return sectorRouteMap[id as keyof typeof sectorRouteMap] ?? "/display";
}

const workspaceLinks = [
  { label: "Display", to: "/display" },
  { label: "Ingest", to: "/ingest" },
  { label: "Hypotheses", to: "/hypotheses" },
  { label: "Recipes", to: "/recipes" },
  { label: "Essays", to: "/essays" },
  { label: "Weekly Turns", to: "/weekly-turns" },
  { label: "Compositions", to: "/compositions" },
  { label: "Feedback", to: "/feedback" },
  { label: "Admin", to: "/admin" },
] as const;

// Per-sector colour reaches DOM text and borders through CSS variables on an
// ancestor, so one class serves every sector.
function sectorStyle(sector: SectorDef): JSX.CSSProperties {
  return {
    "--sector-color": token.var(sector.colorToken),
    "--sector-text": token.var(sector.textToken),
  };
}

function formatCount(value: number | null) {
  return value === null ? "—" : String(value);
}

const CONCEPT_PREVIEW_COUNT = 12;
const PIPELINE_ITEM_PREVIEW_COUNT = 5;

// The orbital rings, in the order the scene draws them, with the item type
// the sidebar's item-detail mode expects (same mapping as a body click).
const ORBITAL_GROUPS = [
  { key: "sources", label: "SOURCES", type: "source" },
  { key: "extractions", label: "EXTRACTIONS", type: "extraction" },
  { key: "hypotheses", label: "HYPOTHESES", type: "hypothesis" },
  { key: "recipes", label: "RECIPES", type: "recipe" },
] as const;

const ITEM_TYPE_LABELS: Record<string, string> = {
  source: "Source",
  extraction: "Extraction",
  hypothesis: "Hypothesis",
  recipe: "Recipe",
};

type SectorMetricRow = {
  id: string;
  sources: number;
  claims: number;
};

type SidebarView =
  | { kind: "overview" }
  | { kind: "concept-detail"; conceptId: Id<"concepts"> }
  | { kind: "sub-topic"; label: string; conceptNames: string[] }
  | { kind: "item-detail"; itemId: string; itemType: string; title: string };

/** Where focus goes once the panel a mode change mounts is in the page. */
type FocusIntent = {
  /** On Back: the overview control to return to, if it still exists. */
  originKey?: string;
  /** Canvas-driven changes must not scroll the page to the sidebar. */
  preventScroll?: boolean;
};

type SidebarMode = SidebarView & {
  /** The overview control that opened this drill-down, for Back. */
  origin?: string;
  /** Present on every user-driven change; absent on first render. */
  focus?: FocusIntent;
};

type PipelineListItem = { id: string; title?: string; status: string };

type LinkedDoc = { _id: string; title?: string; status: string };

function toListItem(doc: LinkedDoc): PipelineListItem {
  return { id: doc._id, title: doc.title, status: doc.status };
}

function sameIds(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** A live list's keys, unchanged (same array) while a push keeps them. */
function createIds<T, K extends string>(
  list: () => readonly T[],
  idOf: (item: T) => K,
) {
  return createMemo<K[]>(() => list().map(idOf), [], { equals: sameIds });
}

export function Zodiac3D() {
  onMount(() => {
    document.title = "Zodiac — Frequency Music";
  });

  const [selSector, setSelSector] = createSignal<string>("math");
  const [webglUnavailable, setWebglUnavailable] = createSignal(false);
  const [sidebarMode, setSidebarMode] = createSignal<SidebarMode>({
    kind: "overview",
  });
  // Lists the reader has expanded past their preview count. Kept here, not in
  // the panels, so Back returns to the list exactly as it was left.
  const [expandedLists, setExpandedLists] = createSignal<ReadonlySet<string>>(
    new Set(),
  );
  // Polite announcement of mode changes that start on the canvas, where focus
  // cannot follow (the panel title announces sidebar-driven changes itself).
  const [liveStatus, announce] = createAnnouncer();

  // --- Convex Queries (existing, stable) ---
  const sectorMetrics = createQuery(api.dashboard.zodiacSectors, () => ({
    limit: 200,
  }));
  const pipeline = createQuery(api.dashboard.pipeline);

  // --- New queries (use createQueryWithStatus so errors don't crash the page) ---

  // Phase 1: Concepts for active sector
  const domainConceptsQ = createQueryWithStatus(
    api.graph.getConceptsForDomain,
    () => ({
      domain: selSector(),
      limit: 40,
    }),
  );
  const domainConcepts = createMemo<ConstellationConcept[]>(
    () => (domainConceptsQ.data() ?? []) as ConstellationConcept[],
  );
  const conceptsById = createMemo(
    () => new Map(domainConcepts().map((concept) => [concept._id, concept])),
  );
  const conceptsByName = createMemo(
    () => new Map(domainConcepts().map((concept) => [concept.name, concept])),
  );

  // Phase 1: Edges between those concepts. The names are the next query's
  // argument, so they only change when the names do.
  const conceptNames = createIds(domainConcepts, (c) => c.name);
  const conceptEdgesQ = createQueryWithStatus(
    api.graph.getConceptEdges,
    () => ({
      conceptNames: conceptNames(),
    }),
  );
  const conceptEdges = createMemo<ConstellationEdge[]>(() =>
    (
      (conceptEdgesQ.data() ?? []) as Array<{
        fromId: string;
        toId: string;
        relationship: string;
      }>
    ).map<ZodiacConstellationEdge>((edge) => ({
      from: edge.fromId,
      to: edge.toId,
      relationship: edge.relationship,
    })),
  );

  // Phase 1: Concept detail — conditional, only queries when sidebar is in concept-detail mode
  const activeConceptId = createMemo<Id<"concepts"> | undefined>(() => {
    const mode = sidebarMode();
    return mode.kind === "concept-detail" ? mode.conceptId : undefined;
  });
  const conceptDetailQ = createQueryWithStatus(
    api.graph.getConceptDetail,
    () => {
      const id = activeConceptId();
      if (!id) return "skip" as const;
      return { conceptId: id };
    },
  );
  const conceptDetail = createMemo<ConceptDetailData | undefined>(() =>
    activeConceptId()
      ? (conceptDetailQ.data() as ConceptDetailData | undefined)
      : undefined,
  );

  // Phase 2: Sub-topics for active sector
  const subTopicsQ = createQueryWithStatus(
    api.dashboard.domainSubTopics,
    () => ({
      domain: selSector(),
    }),
  );
  const subTopics = createMemo<ZodiacSubTopic[]>(
    () => (subTopicsQ.data() ?? []) as ZodiacSubTopic[],
  );
  const subTopicsByLabel = createMemo(
    () => new Map(subTopics().map((subTopic) => [subTopic.label, subTopic])),
  );
  const subTopicLabels = createIds(subTopics, (subTopic) => subTopic.label);

  // Phase 3: Pipeline items (live), grouped by orbital ring once per push and
  // shared by the scene and the sidebar.
  const pipelineItemsQ = createQueryWithStatus(api.dashboard.pipelineItems);
  const orbitalGroups = createMemo<OrbitalItemGroups | undefined>(() => {
    const items = pipelineItemsQ.data() as PipelineItems | undefined;
    return items ? buildOrbitalItemGroups(items) : undefined;
  });

  // The orbiting bodies drawn in the selected sector, per ring: the keyboard
  // path to everything a body click reaches.
  const sectorOrbitalItems = createMemo<OrbitalItemGroups | undefined>(() => {
    const groups = orbitalGroups();
    if (!groups) return undefined;
    const sector = selSector();
    const inSector = (items: OrbitalItem[]) =>
      items.filter((item) => orbitalItemSector(item) === sector);
    return {
      sources: inSector(groups.sources),
      extractions: inSector(groups.extractions),
      hypotheses: inSector(groups.hypotheses),
      recipes: inSector(groups.recipes),
    };
  });
  const domainPipelineCount = createMemo(() => {
    const groups = sectorOrbitalItems();
    if (!groups) return 0;
    return ORBITAL_GROUPS.reduce((sum, { key }) => sum + groups[key].length, 0);
  });

  // Phase 3: Item relations — conditional
  const activeItem = createMemo(() => {
    const mode = sidebarMode();
    return mode.kind === "item-detail"
      ? { id: mode.itemId, type: mode.itemType }
      : undefined;
  });
  const itemRelationsQ = createQueryWithStatus(
    api.dashboard.itemRelations,
    () => {
      const item = activeItem();
      if (!item?.id) return "skip" as const;
      return { itemId: item.id, itemType: item.type };
    },
  );
  const itemRelations = createMemo<ItemRelation[] | undefined>(() =>
    activeItem()
      ? (itemRelationsQ.data() as ItemRelation[] | undefined)
      : undefined,
  );

  // Sources/claims are null until the live metrics arrive, and render as an
  // em dash rather than a placeholder number.
  const sectors = createMemo(() => {
    const rows = sectorMetrics() as SectorMetricRow[] | undefined;
    const metrics = rows
      ? new Map<string, { sources: number; claims: number }>(
          rows.map((entry: SectorMetricRow) => [
            entry.id,
            {
              sources: Number(entry.sources ?? 0),
              claims: Number(entry.claims ?? 0),
            },
          ]),
        )
      : null;

    return SECTORS.map((sector) => {
      const metric = metrics?.get(sector.id);
      return {
        ...sector,
        sources: metrics ? (metric?.sources ?? 0) : null,
        claims: metrics ? (metric?.claims ?? 0) : null,
      };
    });
  });

  const activeSector = createMemo(
    () => sectors().find((sector) => sector.id === selSector()) ?? sectors()[0],
  );

  const pipelineSummary = createMemo(() => {
    const live = pipeline();
    return [
      { label: "SRC", value: live?.sources ?? 0 },
      { label: "EXT", value: live?.extractions ?? 0 },
      { label: "HYP", value: live?.hypotheses ?? 0 },
      { label: "REC", value: live?.recipes ?? 0 },
      { label: "COMP", value: live?.compositions ?? 0 },
    ];
  });

  // oxlint-disable-next-line no-unassigned-vars -- SolidJS ref pattern
  let canvasRef!: HTMLCanvasElement;
  // oxlint-disable-next-line no-unassigned-vars -- SolidJS ref pattern
  let cssContainerRef!: HTMLDivElement;
  // oxlint-disable-next-line no-unassigned-vars -- SolidJS ref pattern
  let sidebarRef!: HTMLDivElement;
  let sceneHandle: ZodiacHandle | null = null;
  const [autoRotate, setAutoRotate] = createSignal(!prefersReducedMotion());
  let stopReducedMotionWatch: (() => void) | null = null;

  function toggleAutoRotate() {
    const next = !autoRotate();
    sceneHandle?.setAutoRotate(next);
    setAutoRotate(next);
  }

  function isExpanded(key: string) {
    return expandedLists().has(key);
  }

  function toggleExpanded(key: string) {
    const next = new Set(expandedLists());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedLists(next);
  }

  // --- Sidebar focus management ---------------------------------------------
  // Every user-driven mode change carries a focus intent and mounts a fresh
  // panel (the sidebar's <Show> is keyed on the mode). The panel's title
  // claims focus as it mounts — or, on Back, the overview control that
  // started the drill-down — so focus never falls to <body>.

  function openPanel(
    view: SidebarView,
    options: { originKey?: string; fromCanvas?: boolean } = {},
  ) {
    const current = sidebarMode();
    setSidebarMode({
      ...view,
      origin: current.kind === "overview" ? options.originKey : current.origin,
      focus: { preventScroll: options.fromCanvas },
    });
  }

  function goBack() {
    const current = sidebarMode();
    if (current.kind === "overview") return;
    setSidebarMode({ kind: "overview", focus: { originKey: current.origin } });
    sceneHandle?.clearPullLines();
  }

  /** Ref for a panel title, or the text that stands in while it loads. */
  function claimFocus(el: HTMLElement) {
    const intent = untrack(sidebarMode).focus;
    if (!intent) return;
    // The panel mounts in this tick; focus it once it is in the document.
    queueMicrotask(() => {
      // Focus left <body> only if the reader moved on (the control that made
      // the change, or a loading stand-in, unmounted with the old content).
      const active = document.activeElement;
      if (active && active !== document.body) return;
      const origin = intent.originKey
        ? sidebarRef.querySelector<HTMLElement>(
            `[data-focus-key="${CSS.escape(intent.originKey)}"]`,
          )
        : null;
      (origin ?? el).focus({ preventScroll: intent.preventScroll });
    });
  }

  onMount(() => {
    try {
      sceneHandle = initZodiacScene(
        canvasRef,
        cssContainerRef,
        // onSectorClick
        (id) => {
          setSelSector(id);
          if (sidebarMode().kind !== "overview") {
            openPanel({ kind: "overview" }, { fromCanvas: true });
          }
          const sector = SECTORS.find((s) => s.id === id);
          if (sector) announce(`Domain: ${sector.label}`);
        },
        // onConceptClick
        (conceptId) => {
          openPanel(
            { kind: "concept-detail", conceptId },
            { fromCanvas: true },
          );
          const name = conceptsById().get(conceptId)?.displayName;
          announce(name ? `Concept: ${name}` : "Loading concept details…");
        },
        // onOrbitalClick
        (itemId, itemType, title) => {
          openPanel(
            { kind: "item-detail", itemId, itemType, title },
            { fromCanvas: true },
          );
          announce(`${ITEM_TYPE_LABELS[itemType] ?? "Item"}: ${title}`);
        },
        // onArmillaryClick
        (label, names) => {
          openPanel(
            { kind: "sub-topic", label, conceptNames: names },
            { fromCanvas: true },
          );
          announce(`Sub-topic: ${label}`);
        },
        { tooltipClass: sceneTooltip },
      );
      // The sidebar opens with a sector selected; light it to match.
      sceneHandle.setActiveSector(selSector());
      setAutoRotate(sceneHandle.isAutoRotating());
    } catch (error) {
      console.error("Zodiac scene initialization failed:", error);
      setWebglUnavailable(true);
    }
    // Registered after the scene's own reduced-motion watcher so that it runs
    // second and mirrors whatever the scene settled on, rather than
    // recomputing the state and overriding an explicit pause.
    stopReducedMotionWatch = watchReducedMotion(() => {
      if (sceneHandle) setAutoRotate(sceneHandle.isAutoRotating());
    });
  });

  onCleanup(() => {
    stopReducedMotionWatch?.();
    sceneHandle?.cleanup();
  });

  // Phase 1: Load constellations when concepts arrive for the selected sector
  createEffect(
    on([domainConcepts, conceptEdges], ([concepts, edges]) => {
      sceneHandle?.loadConstellations(selSector(), concepts, edges);
    }),
  );

  // Phase 2: Load armillary rings when sub-topics arrive
  createEffect(
    on(subTopics, (st) => {
      sceneHandle?.loadArmillaryRings(selSector(), st);
    }),
  );

  // Phase 3: Load orbital bodies when pipeline items arrive
  createEffect(
    on(orbitalGroups, (groups) => {
      if (groups) sceneHandle?.loadOrbitalBodies(groups);
    }),
  );

  // Phase 3: Show pull-lines when viewing item detail
  createEffect(
    on(itemRelations, (relations) => {
      const mode = sidebarMode();
      if (!sceneHandle) return;
      if (mode.kind === "item-detail" && relations) {
        sceneHandle.showPullLines(mode.itemId, relations);
      } else {
        sceneHandle.clearPullLines();
      }
    }),
  );

  // Domain buttons live in the overview, so selecting one never changes mode.
  function handleSectorSelect(id: string) {
    setSelSector(id);
    sceneHandle?.setActiveSector(id);
  }

  // Hover/focus on a domain button previews the sector (opacity only); it
  // never touches the selected sector's overlays.
  function handleSectorPreview(id: string | null) {
    sceneHandle?.previewSector(id);
  }

  function openConcept(conceptId: Id<"concepts">) {
    openPanel(
      { kind: "concept-detail", conceptId },
      { originKey: `concept:${conceptId}` },
    );
  }

  function openItem(item: PipelineListItem, type: string) {
    openPanel(
      {
        kind: "item-detail",
        itemId: item.id,
        itemType: type,
        title: item.title ?? "Untitled",
      },
      { originKey: `item:${item.id}` },
    );
  }

  // --- Sidebar Panel Renderers ---

  function MotionToggle(props: { class: string }) {
    return (
      <button type="button" onClick={toggleAutoRotate} class={props.class}>
        {autoRotate() ? "Pause rotation" : "Resume rotation"}
      </button>
    );
  }

  function ShowAllToggle(props: {
    listKey: string;
    total: number;
    label: string;
  }) {
    return (
      <button
        type="button"
        class={showAllToggle}
        aria-expanded={isExpanded(props.listKey)}
        aria-controls={`zodiac-list-${props.listKey}`}
        onClick={() => toggleExpanded(props.listKey)}
      >
        {isExpanded(props.listKey) ? (
          "Show fewer"
        ) : (
          <>
            Show all {props.total}
            <span class={srOnlyClass}> {props.label}</span>
          </>
        )}
      </button>
    );
  }

  function SidebarOverview() {
    const conceptIds = createIds(domainConcepts, (concept) => concept._id);
    const visibleConceptIds = createMemo(
      () =>
        isExpanded("concepts")
          ? conceptIds()
          : conceptIds().slice(0, CONCEPT_PREVIEW_COUNT),
      [],
      { equals: sameIds },
    );

    return (
      <>
        <div class={sidebarSection}>
          <div class={sidebarEyebrow}>
            <span aria-hidden="true">∴</span> RESEARCH ZODIAC — 3D
          </div>
          <h1 class={sidebarTitle}>
            Astrolabe
            <br />
            <em class={sidebarTitleEmphasis}>Knowledge</em>
            <br />
            Orrery
          </h1>
          <p class={sidebarBody}>
            Drag to orbit. Click a sector to focus. Click stars for concept
            details. Click orbiting bodies for pipeline items.
          </p>
          <MotionToggle class={motionToggleOverview} />
        </div>

        <div class={sidebarSectionDomain} style={sectorStyle(activeSector())}>
          <div class={sidebarEyebrowSector}>
            {activeSector().id.toUpperCase()} DOMAIN
          </div>
          <h2 class={sidebarTitleDomain} tabIndex={-1} ref={claimFocus}>
            {activeSector().label}
          </h2>
          <p class={sidebarBodySm}>{activeSector().summary}</p>
          <div class={statRow}>
            <div class={statCellGold}>
              <div class={statValueGold}>
                {formatCount(activeSector().sources)}
              </div>
              <div class={statLabel}>SOURCES</div>
            </div>
            <div class={statCellViolet}>
              <div class={statValueViolet}>
                {formatCount(activeSector().claims)}
              </div>
              <div class={statLabel}>CLAIMS</div>
            </div>
          </div>

          <Show when={conceptIds().length > 0}>
            <h3 class={sidebarEyebrowGroup}>
              CONCEPTS ({conceptIds().length})
            </h3>
            <UIList id="zodiac-list-concepts" class={conceptTagRow}>
              <For each={visibleConceptIds()}>
                {(id) => {
                  const concept = () => conceptsById().get(id);
                  return (
                    <li>
                      <button
                        type="button"
                        data-focus-key={`concept:${id}`}
                        onClick={() => openConcept(id)}
                        class={conceptTag}
                      >
                        {concept()?.displayName}
                        <span class={conceptTagCount}>
                          {concept()?.mentionCount}
                          <span class={srOnlyClass}> mentions</span>
                        </span>
                      </button>
                    </li>
                  );
                }}
              </For>
            </UIList>
            <Show when={conceptIds().length > CONCEPT_PREVIEW_COUNT}>
              <ShowAllToggle
                listKey="concepts"
                total={conceptIds().length}
                label="concepts"
              />
            </Show>
          </Show>

          <Show when={subTopicLabels().length > 0}>
            <h3 class={sidebarEyebrowGroup}>
              SUB-TOPICS ({subTopicLabels().length})
            </h3>
            <UIList class={subTopicList}>
              <For each={subTopicLabels()}>
                {(label) => {
                  const conceptNames = () =>
                    subTopicsByLabel().get(label)?.conceptNames ?? [];
                  return (
                    <li>
                      <button
                        type="button"
                        data-focus-key={`subtopic:${label}`}
                        onClick={() =>
                          openPanel(
                            {
                              kind: "sub-topic",
                              label,
                              conceptNames: conceptNames(),
                            },
                            { originKey: `subtopic:${label}` },
                          )
                        }
                        class={listButton}
                      >
                        {label}
                        <span class={listButtonMeta}>
                          {conceptNames().length} concepts
                        </span>
                      </button>
                    </li>
                  );
                }}
              </For>
            </UIList>
          </Show>

          <Show when={domainPipelineCount() > 0}>
            <h3 class={sidebarEyebrowGroup}>
              PIPELINE ITEMS ({domainPipelineCount()})
            </h3>
            <For each={ORBITAL_GROUPS}>
              {(group) => {
                const items = () => sectorOrbitalItems()?.[group.key] ?? [];
                return (
                  <Show when={items().length > 0}>
                    <PipelineSection
                      label={group.label}
                      items={items()}
                      type={group.type}
                      headingLevel="h4"
                      listKey={`pipeline-${group.key}`}
                    />
                  </Show>
                );
              }}
            </For>
          </Show>

          <Link to={sectorRoute(selSector())} class={openDomainLink}>
            Open Domain Workspace
          </Link>
        </div>

        <div class={sidebarSectionDomains}>
          <h2 class={sidebarEyebrowSection}>ALL DOMAINS</h2>
          <UIList>
            <Index each={sectors()}>
              {(sector) => (
                <li>
                  <button
                    type="button"
                    class={sectorButton}
                    aria-pressed={selSector() === sector().id}
                    style={sectorStyle(sector())}
                    onClick={() => handleSectorSelect(sector().id)}
                    onMouseEnter={() => handleSectorPreview(sector().id)}
                    onMouseLeave={() => handleSectorPreview(null)}
                    onFocus={() => handleSectorPreview(sector().id)}
                    onBlur={() => handleSectorPreview(null)}
                  >
                    <span class={sectorButtonLabel}>{sector().label}</span>
                    <span class={sectorButtonMeta}>
                      {formatCount(sector().sources)} src
                    </span>
                  </button>
                </li>
              )}
            </Index>
          </UIList>
        </div>

        <div class={sidebarSectionWorkflow}>
          <h2 class={sidebarEyebrowSectionTop}>WORKFLOW SHORTCUTS</h2>
          <UIList class={workspaceGrid}>
            <For each={workspaceLinks}>
              {(link) => (
                <li>
                  <Link
                    to={link.to}
                    data-testid="home-workspace-link"
                    class={workspaceLink}
                  >
                    {link.label}
                  </Link>
                </li>
              )}
            </For>
          </UIList>
        </div>

        <div class={sidebarSectionPipeline}>
          <h2 class={sidebarEyebrowTight}>PIPELINE</h2>
          <div class={pipelineRow}>
            <Index each={pipelineSummary()}>
              {(item, index) => (
                <>
                  <div class={pipelineCell}>
                    <div class={pipelineCellValue}>{item().value}</div>
                    <div class={pipelineCellLabel}>{item().label}</div>
                  </div>
                  <Show when={index < pipelineSummary().length - 1}>
                    <div class={pipelineArrow} aria-hidden="true">
                      →
                    </div>
                  </Show>
                </>
              )}
            </Index>
          </div>
        </div>
      </>
    );
  }

  function SidebarConceptDetail() {
    return (
      <>
        <div class={sidebarSectionCompact}>
          <BackBar />
          <Show when={conceptDetail()}>
            {(detail) => (
              <>
                <div class={sidebarEyebrowViolet}>CONCEPT</div>
                <h2 class={sidebarTitleSm} tabIndex={-1} ref={claimFocus}>
                  {detail().concept.displayName}
                </h2>
                <div class={sidebarMeta}>
                  {detail().concept.domain} &middot;{" "}
                  {detail().concept.mentionCount} mentions &middot;{" "}
                  {detail().edgeCount} edges
                </div>
                <Show when={detail().concept.description}>
                  <p class={sidebarBodyDetail}>
                    {detail().concept.description}
                  </p>
                </Show>
                <Show when={detail().concept.aliases?.length > 0}>
                  <div class={sidebarAliases}>
                    Also: {detail().concept.aliases.join(", ")}
                  </div>
                </Show>
              </>
            )}
          </Show>
        </div>

        <Show
          when={conceptDetail()}
          fallback={
            // Holds focus until the title arrives and claims it.
            <div class={sidebarLoading} tabIndex={-1} ref={claimFocus}>
              Loading concept details...
            </div>
          }
        >
          {(detail) => (
            <div class={sidebarSectionScrollable}>
              <Show when={detail().linkedSources.length > 0}>
                <PipelineSection
                  label="SOURCES"
                  items={detail().linkedSources.map(toListItem)}
                  type="source"
                />
              </Show>
              <Show when={detail().linkedHypotheses.length > 0}>
                <PipelineSection
                  label="HYPOTHESES"
                  items={detail().linkedHypotheses.map(toListItem)}
                  type="hypothesis"
                />
              </Show>
              <Show when={detail().linkedRecipes.length > 0}>
                <PipelineSection
                  label="RECIPES"
                  items={detail().linkedRecipes.map(toListItem)}
                  type="recipe"
                />
              </Show>
            </div>
          )}
        </Show>
      </>
    );
  }

  function SidebarSubTopic(props: {
    mode: Extract<SidebarView, { kind: "sub-topic" }>;
  }) {
    return (
      <>
        <div class={sidebarSectionCompact}>
          <BackBar />
          <div class={sidebarEyebrowGold}>SUB-TOPIC</div>
          <h2 class={sidebarTitleSubTopic} tabIndex={-1} ref={claimFocus}>
            {props.mode.label}
          </h2>
          <div class={sidebarMeta}>
            {props.mode.conceptNames.length} concepts
          </div>
        </div>

        <div class={sidebarSectionScrollable}>
          <h3 class={sidebarEyebrowSection}>CONCEPTS IN CLUSTER</h3>
          <UIList>
            <For each={props.mode.conceptNames}>
              {(name) => {
                const concept = () => conceptsByName().get(name);
                return (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        const c = concept();
                        if (c) openConcept(c._id);
                      }}
                      class={listButton}
                    >
                      {concept()?.displayName ?? name}
                      <Show when={concept()}>
                        {(c) => (
                          <span class={listButtonMeta}>
                            {c().mentionCount} mentions
                          </span>
                        )}
                      </Show>
                    </button>
                  </li>
                );
              }}
            </For>
          </UIList>
        </div>
      </>
    );
  }

  function SidebarItemDetail(props: {
    mode: Extract<SidebarView, { kind: "item-detail" }>;
  }) {
    const relations = createMemo<ItemRelation[]>(() => itemRelations() ?? []);

    return (
      <>
        <div class={sidebarSectionCompact}>
          <BackBar />
          <div class={sidebarEyebrowGold}>
            {props.mode.itemType.toUpperCase()}
          </div>
          <h2 class={sidebarTitleItem} tabIndex={-1} ref={claimFocus}>
            {props.mode.title}
          </h2>
        </div>

        <div class={sidebarSectionScrollable}>
          <Show
            when={relations().length > 0}
            fallback={
              <div class={sidebarEmpty}>No cross-pipeline relations found.</div>
            }
          >
            <h3 class={sidebarEyebrowSection}>
              RELATED ITEMS ({relations().length})
            </h3>
            <UIList>
              <Index each={relations()}>
                {(rel) => (
                  <li>
                    <button
                      type="button"
                      onClick={() =>
                        openPanel({
                          kind: "item-detail",
                          itemId: rel().id,
                          itemType: rel().type,
                          title: rel().title,
                        })
                      }
                      class={relationButton}
                    >
                      <div class={relationTypeLabel}>
                        {rel().type.toUpperCase()} &middot; {rel().relationship}
                      </div>
                      <div class={relationTitle}>{rel().title}</div>
                    </button>
                  </li>
                )}
              </Index>
            </UIList>
          </Show>
        </div>
      </>
    );
  }

  // Back plus the pause/resume control, so motion stays controllable in
  // every panel, not only the overview.
  function BackBar() {
    return (
      <div class={barRow}>
        <button type="button" onClick={goBack} class={barButton}>
          <span aria-hidden="true">←</span> Back
        </button>
        <MotionToggle class={barButton} />
      </div>
    );
  }

  function PipelineSection(props: {
    label: string;
    items: readonly PipelineListItem[];
    type: string;
    headingLevel?: "h3" | "h4";
    /** When set, the list previews a few items behind a Show-all toggle. */
    listKey?: string;
  }) {
    const itemsById = createMemo(
      () => new Map(props.items.map((item) => [item.id, item])),
    );
    // Rows are keyed by id: a live push that keeps the ids re-renders no row,
    // and a reorder moves rows (and a focused button) rather than relabelling.
    const visibleIds = createMemo(
      () => {
        const ids = props.items.map((item) => item.id);
        return props.listKey && !isExpanded(props.listKey)
          ? ids.slice(0, PIPELINE_ITEM_PREVIEW_COUNT)
          : ids;
      },
      [],
      { equals: sameIds },
    );
    return (
      <div class={pipelineSectionContainer}>
        <Dynamic
          component={props.headingLevel ?? "h3"}
          class={sidebarEyebrowTight}
        >
          {props.label} ({props.items.length})
        </Dynamic>
        <UIList id={props.listKey ? `zodiac-list-${props.listKey}` : undefined}>
          <For each={visibleIds()}>
            {(id) => {
              const item = () => itemsById().get(id);
              return (
                <li>
                  <button
                    type="button"
                    data-focus-key={`item:${id}`}
                    onClick={() => {
                      const current = item();
                      if (current) openItem(current, props.type);
                    }}
                    class={listButton}
                  >
                    <div>{item()?.title ?? "Untitled"}</div>
                    <div class={pipelineItemStatus}>{item()?.status}</div>
                  </button>
                </li>
              );
            }}
          </For>
        </UIList>
        <Show
          when={
            props.listKey && props.items.length > PIPELINE_ITEM_PREVIEW_COUNT
          }
        >
          <ShowAllToggle
            listKey={props.listKey ?? ""}
            total={props.items.length}
            label={props.label.toLowerCase()}
          />
        </Show>
      </div>
    );
  }

  function WebglFallback() {
    return (
      <div class={fallbackContainer}>
        <div class={fallbackGrid}>
          <div class={fallbackCard}>
            <div class={fallbackEyebrow()}>HOME FALLBACK</div>
            <h1 class={fallbackTitle}>Workspace Navigator</h1>
            <p class={fallbackBody}>
              3D mode is unavailable in this environment. Use direct workflow
              links below to continue managing intake, research, production, and
              participation.
            </p>
          </div>

          <div class={fallbackCard}>
            <h2 class={fallbackEyebrow({ space: "loose" })}>QUICK ACCESS</h2>
            <UIList class={fallbackLinkGrid}>
              <For each={workspaceLinks}>
                {(link) => (
                  <li>
                    <Link
                      to={link.to}
                      data-testid="home-workspace-link"
                      class={fallbackLink}
                    >
                      {link.label}
                    </Link>
                  </li>
                )}
              </For>
            </UIList>
          </div>

          <div class={fallbackCard}>
            <h2 class={fallbackEyebrow({ space: "normal" })}>
              PIPELINE SNAPSHOT
            </h2>
            <div class={fallbackPipelineRow}>
              <Index each={pipelineSummary()}>
                {(item, index) => (
                  <>
                    <div class={fallbackPipelineCell}>
                      <div class={fallbackPipelineValue}>{item().value}</div>
                      <div class={fallbackPipelineLabel}>{item().label}</div>
                    </div>
                    <Show when={index < pipelineSummary().length - 1}>
                      <div class={fallbackPipelineArrow} aria-hidden="true">
                        →
                      </div>
                    </Show>
                  </>
                )}
              </Index>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // The scene initialises after this tree mounts, so a WebGL failure has to
  // swap the tree reactively rather than through an early return.
  return (
    <Show when={!webglUnavailable()} fallback={<WebglFallback />}>
      <div class={pageContainer}>
        <div class={dotOverlay} />

        <div ref={cssContainerRef} class={canvasWrapper}>
          <canvas
            ref={canvasRef}
            class={canvasEl}
            role="img"
            aria-label="Interactive knowledge orrery. Use the sidebar for keyboard access."
          />
        </div>

        <div ref={sidebarRef} class={cx(sidebarContainer, "zodiac-scroll")}>
          <UINotice status={liveStatus()} class={srOnlyClass} />
          <Show when={sidebarMode().kind !== "overview"}>
            <h1 class={srOnlyClass}>Astrolabe Knowledge Orrery</h1>
          </Show>
          {/* Keyed: every mode change mounts a fresh panel, whose title then
              claims the focus the change carries. */}
          <Show when={sidebarMode()} keyed>
            {(mode) => {
              switch (mode.kind) {
                case "overview":
                  return <SidebarOverview />;
                case "concept-detail":
                  return <SidebarConceptDetail />;
                case "sub-topic":
                  return <SidebarSubTopic mode={mode} />;
                case "item-detail":
                  return <SidebarItemDetail mode={mode} />;
              }
            }}
          </Show>
        </div>
      </div>
    </Show>
  );
}
