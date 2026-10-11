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
  type JSX,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import { css, cva, cx } from "../../styled-system/css";
import { createQuery, createQueryWithStatus } from "../integrations/convex";
import { api } from "../../../convex/_generated/api";
import type { ConstellationEdge } from "../lib/zodiac-constellations";
import { prefersReducedMotion, watchReducedMotion } from "../lib/zodiac-camera";
import { COLORS, SECTORS, textSafeSectorColor } from "../lib/zodiac-data";
import {
  buildOrbitalItemGroups,
  type OrbitalItem,
  orbitalItemSector,
} from "../lib/zodiac-orbits";
import { initZodiacScene, type ZodiacHandle } from "../lib/zodiac-scene";
import type {
  ConceptDetailData,
  ConstellationConcept,
  ItemRelation,
  OrbitalExtraction,
  OrbitalHypothesis,
  OrbitalRecipe,
  OrbitalSource,
  ZodiacConstellationEdge,
  ZodiacSubTopic,
} from "../lib/zodiac-types";

// ---------------------------------------------------------------------------
// PandaCSS style constants — Sidebar
// ---------------------------------------------------------------------------

const focusRing = {
  _focusVisible: {
    borderColor: "zodiac.gold",
    outline: "2px solid",
    outlineColor: "zodiac.gold",
    outlineOffset: "2px",
  },
} as const;

const srOnly = css({ srOnly: true });

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
  borderStyle: "solid",
  borderColor: "zodiac.gold/35",
  padding: "4px 8px",
});

const sidebarContainer = css({
  width: { base: "100%", lg: "355px" },
  display: "flex",
  flexDirection: "column",
  borderLeftWidth: { base: "0", lg: "1px" },
  borderLeftStyle: "solid",
  borderLeftColor: "zodiac.gold/12",
  borderTopWidth: { base: "1px", lg: "0" },
  borderTopStyle: "solid",
  borderTopColor: "zodiac.gold/12",
  overflowY: "auto",
  flexShrink: 0,
  // Keep the last section clear of the home indicator on notched phones.
  paddingBottom: "env(safe-area-inset-bottom)",
});

// -- Sidebar sections --

const sectionDivider = {
  borderBottomWidth: "1px",
  borderBottomStyle: "solid",
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

const sidebarSectionScrollable = css({
  padding: "16px 26px",
  flex: "1",
  overflowY: "auto",
});

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
  borderTopStyle: "solid",
  borderTopColor: "zodiac.gold/10",
});

const sidebarSectionPipeline = css({
  padding: "14px 26px 24px",
  borderTopWidth: "1px",
  borderTopStyle: "solid",
  borderTopColor: "zodiac.gold/10",
});

// -- Typography --

// Every eyebrow and section heading in the sidebar: 10px mono uppercase,
// tracked wide, gold at the 78% floor unless a tone says otherwise.
const eyebrow = cva({
  base: {
    fontFamily: "mono",
    fontSize: "10px",
    fontWeight: "400",
    lineHeight: "1.4",
    letterSpacing: "0.3em",
    textTransform: "uppercase",
    color: "zodiac.gold/78",
  },
  variants: {
    tone: {
      gold: {},
      violet: { color: "zodiac.violetText" },
      // Text-safe per-sector colour set on an ancestor (see sectorStyle).
      sector: { color: "var(--sector-text)" },
    },
    tracking: {
      normal: {},
      wide: { letterSpacing: "0.35em" },
      widest: { letterSpacing: "0.4em" },
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

const sidebarBody = css({
  fontSize: "14px",
  fontWeight: "400",
  lineHeight: "1.65",
  color: "zodiac.cream/66",
  margin: "0",
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
  borderStyle: "solid",
  borderColor: "zodiac.gold/18",
  textAlign: "center",
});

const statCellViolet = css({
  flex: "1",
  padding: "10px",
  borderWidth: "1px",
  borderStyle: "solid",
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
  borderStyle: "solid",
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
  ...focusRing,
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
  borderStyle: "solid",
  borderColor: "zodiac.gold/45",
  background: "zodiac.gold",
  color: "zodiac.void",
  padding: "8px 10px",
  minHeight: "40px",
  _coarsePointer: {
    minHeight: "48px",
  },
  ...focusRing,
});

const plainList = css({
  listStyle: "none",
  margin: "0",
  padding: "0",
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
  borderStyle: "solid",
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
  ...focusRing,
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
  borderStyle: "solid",
  borderColor: "zodiac.gold/20",
  background: "zodiac.glow-inner/55",
  color: "zodiac.cream",
  padding: "7px 8px",
  minHeight: "32px",
  _coarsePointer: {
    minHeight: "44px",
  },
  ...focusRing,
});

// Back, pause/resume and show-all toggles share one bar-button face.
const barButton = css({
  ...buttonFace,
  cursor: "pointer",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "zodiac.gold/25",
  background: "transparent",
  color: "zodiac.gold",
  padding: "5px 12px",
  minHeight: "32px",
  _coarsePointer: {
    minHeight: "44px",
  },
  ...focusRing,
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
  borderStyle: "solid",
  borderColor: "zodiac.gold/12",
  background: "transparent",
  color: "zodiac.cream",
  fontSize: "14px",
  lineHeight: "1.4",
  _coarsePointer: {
    minHeight: "44px",
  },
  ...focusRing,
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
  borderStyle: "solid",
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
  margin: "0",
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
  borderStyle: "solid",
  borderColor: "zodiac.gold/55",
  padding: "11px 12px",
  minHeight: "44px",
  color: "zodiac.cream",
  textAlign: "left",
  ...focusRing,
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
  borderStyle: "solid",
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

// Sector colours are design tokens; DOM text and borders reference them as
// CSS variables rather than raw hex, so per-sector colour stays dynamic.
const COLOR_VARS: Record<string, string> = {
  [COLORS.violet]: "var(--colors-zodiac-violet)",
  [COLORS.violetText]: "var(--colors-zodiac-violet-text)",
  [COLORS.gold]: "var(--colors-zodiac-gold)",
  [COLORS.cream]: "var(--colors-zodiac-cream)",
};

function sectorStyle(color: string): JSX.CSSProperties {
  return {
    "--sector-color": COLOR_VARS[color] ?? COLOR_VARS[COLORS.gold],
    "--sector-text":
      COLOR_VARS[textSafeSectorColor(color)] ?? COLOR_VARS[COLORS.gold],
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

type SidebarMode =
  | { kind: "overview" }
  | { kind: "concept-detail"; conceptId: Id<"concepts"> }
  | { kind: "sub-topic"; label: string; conceptNames: string[] }
  | { kind: "item-detail"; itemId: string; itemType: string; title: string };

type PipelineListItem = { _id: string; title?: string; status: string };

function toPipelineListItem(item: OrbitalItem): PipelineListItem {
  return { _id: item.id, title: item.title, status: item.status };
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
  const [liveStatus, setLiveStatus] = createSignal("");

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

  // Phase 1: Edges between those concepts
  const conceptNames = createMemo(() => domainConcepts().map((c) => c.name));
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

  // Phase 3: Pipeline items (live)
  const pipelineItemsQ = createQueryWithStatus(api.dashboard.pipelineItems);
  const pipelineItems = createMemo<
    | {
        sources: OrbitalSource[];
        extractions: OrbitalExtraction[];
        hypotheses: OrbitalHypothesis[];
        recipes: OrbitalRecipe[];
      }
    | undefined
  >(
    () =>
      pipelineItemsQ.data() as
        | {
            sources: OrbitalSource[];
            extractions: OrbitalExtraction[];
            hypotheses: OrbitalHypothesis[];
            recipes: OrbitalRecipe[];
          }
        | undefined,
  );

  // The orbiting bodies drawn in the selected sector, grouped by ring: the
  // keyboard path to everything a body click reaches.
  const domainPipelineGroups = createMemo(() => {
    const items = pipelineItems();
    if (!items) return [];
    const groups = buildOrbitalItemGroups(
      items.sources,
      items.extractions,
      items.hypotheses,
      items.recipes,
    );
    const sector = selSector();
    return ORBITAL_GROUPS.map((group) => ({
      ...group,
      items: groups[group.key]
        .filter((item) => orbitalItemSector(item) === sector)
        .map(toPipelineListItem),
    })).filter((group) => group.items.length > 0);
  });
  const domainPipelineCount = createMemo(() =>
    domainPipelineGroups().reduce((sum, group) => sum + group.items.length, 0),
  );

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

  // --- Sidebar focus management ---------------------------------------------
  // Each panel registers its title (tabIndex -1). After a mode change focus
  // moves to the new title, or — on Back — to the overview control that
  // started the drill-down, so focus never falls to <body>.
  let panelTitleEl: HTMLElement | undefined;
  const registerPanelTitle = (el: HTMLElement) => {
    panelTitleEl = el;
  };
  let overviewOriginKey: string | null = null;
  let restoreOriginOnRender = false;
  let modeChangeFromCanvas = false;
  let titleFocusPending = false;

  function isExpanded(key: string) {
    return expandedLists().has(key);
  }

  function toggleExpanded(key: string) {
    const next = new Set(expandedLists());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedLists(next);
  }

  function announce(message: string) {
    setLiveStatus("");
    queueMicrotask(() => setLiveStatus(message));
  }

  function openPanel(
    mode: SidebarMode,
    options: { originKey?: string; fromCanvas?: boolean } = {},
  ) {
    if (sidebarMode().kind === "overview") {
      overviewOriginKey = options.originKey ?? null;
    }
    modeChangeFromCanvas = options.fromCanvas ?? false;
    setSidebarMode(mode);
  }

  function focusPanelTitle(preventScroll: boolean) {
    if (panelTitleEl?.isConnected) {
      titleFocusPending = false;
      panelTitleEl.focus({ preventScroll });
      return;
    }
    // The title is not rendered yet (concept detail still loading): hold
    // focus on the panel's loading text until the title arrives.
    const fallback = sidebarRef?.querySelector<HTMLElement>(
      "[data-panel-fallback]",
    );
    if (fallback) {
      titleFocusPending = true;
      fallback.focus({ preventScroll });
    }
  }

  createEffect(
    on(
      sidebarMode,
      (mode, prev) => {
        // Re-selecting a domain within the overview keeps focus on its button.
        if (mode.kind === "overview" && prev?.kind === "overview") return;
        const fromCanvas = modeChangeFromCanvas;
        modeChangeFromCanvas = false;
        const originKey = restoreOriginOnRender ? overviewOriginKey : null;
        restoreOriginOnRender = false;
        requestAnimationFrame(() => {
          if (originKey) {
            const origin = sidebarRef?.querySelector<HTMLElement>(
              `[data-focus-key="${CSS.escape(originKey)}"]`,
            );
            if (origin) {
              origin.focus();
              return;
            }
          }
          // A canvas click must not scroll the page to the sidebar.
          focusPanelTitle(fromCanvas);
        });
      },
      { defer: true },
    ),
  );

  // When a loading panel's title arrives, finish the pending focus move.
  createEffect(
    on(
      () => Boolean(conceptDetail()),
      (ready) => {
        if (!ready || !titleFocusPending) return;
        requestAnimationFrame(() => {
          // The loading text that held focus is gone; only reclaim focus if
          // it fell to <body> (the reader has not moved on).
          const active = document.activeElement;
          if (active && active !== document.body) return;
          focusPanelTitle(true);
        });
      },
      { defer: true },
    ),
  );

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
          const name = domainConcepts().find(
            (c) => c._id === conceptId,
          )?.displayName;
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
    on([domainConcepts, conceptEdges], () => {
      const concepts = domainConcepts();
      const edges = conceptEdges();
      if (!concepts || !sceneHandle) return;

      sceneHandle.loadConstellations(selSector(), concepts, edges ?? []);
    }),
  );

  // Phase 2: Load armillary rings when sub-topics arrive
  createEffect(
    on(subTopics, () => {
      const st = subTopics();
      if (!st || !sceneHandle) return;
      sceneHandle.loadArmillaryRings(selSector(), st);
    }),
  );

  // Phase 3: Load orbital bodies when pipeline items arrive
  createEffect(
    on(pipelineItems, () => {
      const items = pipelineItems();
      if (!items || !sceneHandle) return;
      sceneHandle.loadOrbitalBodies(
        items.sources,
        items.extractions,
        items.hypotheses,
        items.recipes,
      );
    }),
  );

  // Phase 3: Show pull-lines when viewing item detail
  createEffect(
    on(itemRelations, () => {
      const relations = itemRelations();
      const mode = sidebarMode();
      if (!sceneHandle) return;
      if (mode.kind === "item-detail" && relations) {
        sceneHandle.showPullLines(mode.itemId, relations);
      } else {
        sceneHandle.clearPullLines();
      }
    }),
  );

  function handleSectorSelect(id: string) {
    setSelSector(id);
    if (sidebarMode().kind !== "overview") setSidebarMode({ kind: "overview" });
    sceneHandle?.setActiveSector(id);
  }

  // Hover/focus on a domain button previews the sector (opacity only); it
  // never touches the selected sector's overlays.
  function handleSectorPreview(id: string | null) {
    sceneHandle?.previewSector(id);
  }

  function goBack() {
    if (sidebarMode().kind === "overview") return;
    restoreOriginOnRender = true;
    modeChangeFromCanvas = false;
    setSidebarMode({ kind: "overview" });
    sceneHandle?.clearPullLines();
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
        itemId: item._id,
        itemType: type,
        title: item.title ?? "Untitled",
      },
      { originKey: `item:${item._id}` },
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
            <span class={srOnly}> {props.label}</span>
          </>
        )}
      </button>
    );
  }

  function SidebarOverview() {
    const visibleConcepts = createMemo(() =>
      isExpanded("concepts")
        ? domainConcepts()
        : domainConcepts().slice(0, CONCEPT_PREVIEW_COUNT),
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
            <em class={css({ color: "zodiac.gold" })}>Knowledge</em>
            <br />
            Orrery
          </h1>
          <p class={sidebarBody}>
            Drag to orbit. Click a sector to focus. Click stars for concept
            details. Click orbiting bodies for pipeline items.
          </p>
          <MotionToggle class={motionToggleOverview} />
        </div>

        <div
          class={sidebarSectionDomain}
          style={sectorStyle(activeSector().color)}
        >
          <div class={sidebarEyebrowSector}>
            {activeSector().id.toUpperCase()} DOMAIN
          </div>
          <h2 class={sidebarTitleDomain} tabIndex={-1} ref={registerPanelTitle}>
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

          <Show when={domainConcepts().length > 0}>
            <h3 class={sidebarEyebrowGroup}>
              CONCEPTS ({domainConcepts().length})
            </h3>
            <ul
              role="list"
              id="zodiac-list-concepts"
              class={cx(plainList, conceptTagRow)}
            >
              <For each={visibleConcepts()}>
                {(concept) => (
                  <li>
                    <button
                      type="button"
                      data-focus-key={`concept:${concept._id}`}
                      onClick={() => openConcept(concept._id)}
                      class={conceptTag}
                    >
                      {concept.displayName}
                      <span class={conceptTagCount}>
                        {concept.mentionCount}
                        <span class={srOnly}> mentions</span>
                      </span>
                    </button>
                  </li>
                )}
              </For>
            </ul>
            <Show when={domainConcepts().length > CONCEPT_PREVIEW_COUNT}>
              <ShowAllToggle
                listKey="concepts"
                total={domainConcepts().length}
                label="concepts"
              />
            </Show>
          </Show>

          <Show when={subTopics().length > 0}>
            <h3 class={sidebarEyebrowGroup}>
              SUB-TOPICS ({subTopics().length})
            </h3>
            <ul role="list" class={cx(plainList, subTopicList)}>
              <For each={subTopics()}>
                {(subTopic) => (
                  <li>
                    <button
                      type="button"
                      data-focus-key={`subtopic:${subTopic.label}`}
                      onClick={() =>
                        openPanel(
                          {
                            kind: "sub-topic",
                            label: subTopic.label,
                            conceptNames: subTopic.conceptNames,
                          },
                          { originKey: `subtopic:${subTopic.label}` },
                        )
                      }
                      class={listButton}
                    >
                      {subTopic.label}
                      <span class={listButtonMeta}>
                        {subTopic.conceptNames.length} concepts
                      </span>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>

          <Show when={domainPipelineCount() > 0}>
            <h3 class={sidebarEyebrowGroup}>
              PIPELINE ITEMS ({domainPipelineCount()})
            </h3>
            <For each={domainPipelineGroups()}>
              {(group) => (
                <PipelineSection
                  label={group.label}
                  items={group.items}
                  type={group.type}
                  headingLevel="h4"
                  listKey={`pipeline-${group.key}`}
                />
              )}
            </For>
          </Show>

          <Link to={sectorRoute(selSector())} class={openDomainLink}>
            Open Domain Workspace
          </Link>
        </div>

        <div class={sidebarSectionDomains}>
          <h2 class={sidebarEyebrowSection}>ALL DOMAINS</h2>
          <ul role="list" class={plainList}>
            <For each={sectors()}>
              {(sector) => (
                <li>
                  <button
                    type="button"
                    class={sectorButton}
                    aria-pressed={selSector() === sector.id}
                    style={sectorStyle(sector.color)}
                    onClick={() => handleSectorSelect(sector.id)}
                    onMouseEnter={() => handleSectorPreview(sector.id)}
                    onMouseLeave={() => handleSectorPreview(null)}
                    onFocus={() => handleSectorPreview(sector.id)}
                    onBlur={() => handleSectorPreview(null)}
                  >
                    <span class={sectorButtonLabel}>{sector.label}</span>
                    <span class={sectorButtonMeta}>
                      {formatCount(sector.sources)} src
                    </span>
                  </button>
                </li>
              )}
            </For>
          </ul>
        </div>

        <div class={sidebarSectionWorkflow}>
          <h2 class={sidebarEyebrowSectionTop}>WORKFLOW SHORTCUTS</h2>
          <ul role="list" class={cx(plainList, workspaceGrid)}>
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
          </ul>
        </div>

        <div class={sidebarSectionPipeline}>
          <h2 class={sidebarEyebrowTight}>PIPELINE</h2>
          <div class={pipelineRow}>
            <For each={pipelineSummary()}>
              {(item, index) => (
                <>
                  <div class={pipelineCell}>
                    <div class={pipelineCellValue}>{item.value}</div>
                    <div class={pipelineCellLabel}>{item.label}</div>
                  </div>
                  <Show when={index() < pipelineSummary().length - 1}>
                    <div class={pipelineArrow} aria-hidden="true">
                      →
                    </div>
                  </Show>
                </>
              )}
            </For>
          </div>
        </div>
      </>
    );
  }

  function SidebarConceptDetail() {
    const detail = createMemo<ConceptDetailData | undefined>(() =>
      conceptDetail(),
    );
    return (
      <>
        <div class={sidebarSectionCompact}>
          <BackBar />
          <Show when={detail()}>
            {(detailData) => (
              <>
                <div class={sidebarEyebrowViolet}>CONCEPT</div>
                <h2
                  class={sidebarTitleSm}
                  tabIndex={-1}
                  ref={registerPanelTitle}
                >
                  {detailData().concept.displayName}
                </h2>
                <div class={sidebarMeta}>
                  {detailData().concept.domain} &middot;{" "}
                  {detailData().concept.mentionCount} mentions &middot;{" "}
                  {detailData().edgeCount} edges
                </div>
                <Show when={detailData().concept.description}>
                  <p class={sidebarBodyDetail}>
                    {detailData().concept.description}
                  </p>
                </Show>
                <Show when={detailData().concept.aliases?.length > 0}>
                  <div class={sidebarAliases}>
                    Also: {detailData().concept.aliases.join(", ")}
                  </div>
                </Show>
              </>
            )}
          </Show>
        </div>

        <Show when={detail()}>
          {(detailData) => (
            <div class={cx(sidebarSectionScrollable, "zodiac-scroll")}>
              <Show when={detailData().linkedSources.length > 0}>
                <PipelineSection
                  label="SOURCES"
                  items={detailData().linkedSources}
                  type="source"
                />
              </Show>
              <Show when={detailData().linkedHypotheses.length > 0}>
                <PipelineSection
                  label="HYPOTHESES"
                  items={detailData().linkedHypotheses}
                  type="hypothesis"
                />
              </Show>
              <Show when={detailData().linkedRecipes.length > 0}>
                <PipelineSection
                  label="RECIPES"
                  items={detailData().linkedRecipes}
                  type="recipe"
                />
              </Show>
            </div>
          )}
        </Show>

        <Show when={!detail()}>
          <div class={sidebarLoading} tabIndex={-1} data-panel-fallback>
            Loading concept details...
          </div>
        </Show>
      </>
    );
  }

  function SidebarSubTopic() {
    const mode = () =>
      sidebarMode() as {
        kind: "sub-topic";
        label: string;
        conceptNames: string[];
      };
    return (
      <>
        <div class={sidebarSectionCompact}>
          <BackBar />
          <div class={sidebarEyebrowGold}>SUB-TOPIC</div>
          <h2
            class={sidebarTitleSubTopic}
            tabIndex={-1}
            ref={registerPanelTitle}
          >
            {mode().label}
          </h2>
          <div class={sidebarMeta}>{mode().conceptNames.length} concepts</div>
        </div>

        <div class={cx(sidebarSectionScrollable, "zodiac-scroll")}>
          <h3 class={sidebarEyebrowSection}>CONCEPTS IN CLUSTER</h3>
          <ul role="list" class={plainList}>
            <For each={mode().conceptNames}>
              {(name) => {
                const concept = () =>
                  domainConcepts().find((c) => c.name === name);
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
                        <span class={listButtonMeta}>
                          {concept()?.mentionCount} mentions
                        </span>
                      </Show>
                    </button>
                  </li>
                );
              }}
            </For>
          </ul>
        </div>
      </>
    );
  }

  function SidebarItemDetail() {
    const mode = () =>
      sidebarMode() as {
        kind: "item-detail";
        itemId: string;
        itemType: string;
        title: string;
      };
    const relations = createMemo<ItemRelation[]>(() => itemRelations() ?? []);

    return (
      <>
        <div class={sidebarSectionCompact}>
          <BackBar />
          <div class={sidebarEyebrowGold}>{mode().itemType.toUpperCase()}</div>
          <h2 class={sidebarTitleItem} tabIndex={-1} ref={registerPanelTitle}>
            {mode().title}
          </h2>
        </div>

        <div class={cx(sidebarSectionScrollable, "zodiac-scroll")}>
          <Show when={relations().length > 0}>
            <h3 class={sidebarEyebrowSection}>
              RELATED ITEMS ({relations().length})
            </h3>
            <ul role="list" class={plainList}>
              <For each={relations()}>
                {(rel) => (
                  <li>
                    <button
                      type="button"
                      onClick={() =>
                        openPanel({
                          kind: "item-detail",
                          itemId: rel.id,
                          itemType: rel.type,
                          title: rel.title,
                        })
                      }
                      class={relationButton}
                    >
                      <div class={relationTypeLabel}>
                        {rel.type.toUpperCase()} &middot; {rel.relationship}
                      </div>
                      <div class={relationTitle}>{rel.title}</div>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <Show when={relations().length === 0}>
            <div class={sidebarEmpty}>No cross-pipeline relations found.</div>
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
    items: PipelineListItem[];
    type: string;
    headingLevel?: "h3" | "h4";
    /** When set, the list previews a few items behind a Show-all toggle. */
    listKey?: string;
  }) {
    const visibleItems = createMemo(() =>
      props.listKey && !isExpanded(props.listKey)
        ? props.items.slice(0, PIPELINE_ITEM_PREVIEW_COUNT)
        : props.items,
    );
    return (
      <div class={pipelineSectionContainer}>
        <Dynamic
          component={props.headingLevel ?? "h3"}
          class={sidebarEyebrowTight}
        >
          {props.label} ({props.items.length})
        </Dynamic>
        <ul
          role="list"
          class={plainList}
          id={props.listKey ? `zodiac-list-${props.listKey}` : undefined}
        >
          <For each={visibleItems()}>
            {(item) => (
              <li>
                <button
                  type="button"
                  data-focus-key={`item:${item._id}`}
                  onClick={() => openItem(item, props.type)}
                  class={listButton}
                >
                  <div>{item.title ?? "Untitled"}</div>
                  <div class={pipelineItemStatus}>{item.status}</div>
                </button>
              </li>
            )}
          </For>
        </ul>
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
            <ul role="list" class={cx(plainList, fallbackLinkGrid)}>
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
            </ul>
          </div>

          <div class={fallbackCard}>
            <h2 class={fallbackEyebrow({ space: "normal" })}>
              PIPELINE SNAPSHOT
            </h2>
            <div class={fallbackPipelineRow}>
              <For each={pipelineSummary()}>
                {(item, index) => (
                  <>
                    <div class={fallbackPipelineCell}>
                      <div class={fallbackPipelineValue}>{item.value}</div>
                      <div class={fallbackPipelineLabel}>{item.label}</div>
                    </div>
                    <Show when={index() < pipelineSummary().length - 1}>
                      <div class={fallbackPipelineArrow} aria-hidden="true">
                        →
                      </div>
                    </Show>
                  </>
                )}
              </For>
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
          <p role="status" aria-live="polite" class={srOnly}>
            {liveStatus()}
          </p>
          <Show when={sidebarMode().kind !== "overview"}>
            <h1 class={srOnly}>Astrolabe Knowledge Orrery</h1>
          </Show>
          <Show when={sidebarMode().kind === "overview"}>
            <SidebarOverview />
          </Show>
          <Show when={sidebarMode().kind === "concept-detail"}>
            <SidebarConceptDetail />
          </Show>
          <Show when={sidebarMode().kind === "sub-topic"}>
            <SidebarSubTopic />
          </Show>
          <Show when={sidebarMode().kind === "item-detail"}>
            <SidebarItemDetail />
          </Show>
        </div>
      </div>
    </Show>
  );
}
