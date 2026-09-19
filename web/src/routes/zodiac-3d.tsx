// Design 6: ZODIAC 3D — Illuminated Astrolabe Knowledge Orrery
// Three.js 3D implementation of the ZODIAC design with live Convex metrics.
// Phases 1-3: Constellations, Armillary Rings, Planetary Orrery with sidebar drill-down.

import { useNavigate } from "@tanstack/solid-router";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { css } from "../../styled-system/css";
import { createQuery, createQueryWithStatus } from "../integrations/convex";
import { api } from "../../../convex/_generated/api";
import type { ConstellationEdge } from "../lib/zodiac-constellations";
import { prefersReducedMotion, watchReducedMotion } from "../lib/zodiac-camera";
import { COLORS, SECTORS } from "../lib/zodiac-data";
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
    outlineOffset: "1px",
  },
} as const;

// -- Layout --

const pageContainer = css({
  height: "calc(100vh - var(--app-header-height))",
  background: "zodiac.void",
  color: "zodiac.cream",
  overflowX: "hidden",
  overflowY: { base: "auto", lg: "hidden" },
  fontFamily: "display",
  display: "flex",
  flexDirection: { base: "column", lg: "row" },
});

const dotOverlay = css({
  position: "fixed",
  inset: "0",
  pointerEvents: "none",
  opacity: 0.022,
  backgroundImage: "radial-gradient(circle, #c8a84b 1px, transparent 1px)",
  backgroundSize: "52px 52px",
});

const canvasWrapper = css({
  flex: "1",
  position: "relative",
  overflow: "hidden",
  minWidth: "0",
  height: { base: "60vh", lg: "auto" },
});

const canvasEl = css({
  width: "100%",
  height: "100%",
  display: "block",
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
});

// -- Sidebar sections --

const sidebarSection = css({
  padding: "36px 26px 20px",
  borderBottomWidth: "1px",
  borderBottomStyle: "solid",
  borderBottomColor: "zodiac.gold/10",
});

const sidebarSectionCompact = css({
  padding: "20px 26px",
  borderBottomWidth: "1px",
  borderBottomStyle: "solid",
  borderBottomColor: "zodiac.gold/10",
});

const sidebarSectionScrollable = css({
  padding: "16px 26px",
  flex: "1",
  overflowY: "auto",
});

const sidebarSectionDomain = css({
  padding: "22px 26px",
  flex: "1",
  borderBottomWidth: "1px",
  borderBottomStyle: "solid",
  borderBottomColor: "zodiac.gold/10",
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

const sidebarEyebrow = css({
  fontSize: "10px",
  letterSpacing: "0.4em",
  color: "zodiac.gold/78",
  marginBottom: "14px",
});

const sidebarEyebrowSmall = css({
  fontSize: "10px",
  letterSpacing: "0.35em",
  opacity: 1,
  marginBottom: "10px",
});

const sidebarEyebrowViolet = css({
  fontSize: "10px",
  letterSpacing: "0.35em",
  color: "zodiac.violetText",
  marginBottom: "8px",
});

const sidebarEyebrowGold = css({
  fontSize: "10px",
  letterSpacing: "0.35em",
  color: "zodiac.gold/78",
  marginBottom: "8px",
});

const sidebarEyebrowSection = css({
  fontSize: "10px",
  letterSpacing: "0.3em",
  color: "zodiac.gold/78",
  marginBottom: "10px",
});

const sidebarEyebrowSectionTop = css({
  fontSize: "10px",
  letterSpacing: "0.3em",
  color: "zodiac.gold/78",
  margin: "12px 0 10px",
});

const sidebarEyebrowConceptsLabel = css({
  fontSize: "10px",
  letterSpacing: "0.3em",
  color: "zodiac.gold/78",
  margin: "16px 0 8px",
});

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

const statValue = css({
  fontSize: "26px",
});

const statLabel = css({
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
  fontSize: "10px",
  letterSpacing: "0.08em",
  _coarsePointer: {
    minHeight: "44px",
    padding: "10px 14px",
  },
  ...focusRing,
});

const conceptTagCount = css({
  opacity: 0.78,
  marginLeft: "4px",
});

// -- Buttons --

const openDomainBtn = css({
  width: "100%",
  cursor: "pointer",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "zodiac.gold/45",
  background: "zodiac.gold",
  color: "zodiac.void",
  padding: "8px 10px",
  minHeight: "40px",
  letterSpacing: "0.18em",
  fontSize: "10px",
  textTransform: "uppercase",
  _coarsePointer: {
    minHeight: "48px",
  },
  ...focusRing,
});

const sectorButton = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "7px 9px",
  minHeight: "36px",
  marginBottom: "3px",
  cursor: "pointer",
  border: "1px solid",
  transition: "all 0.2s",
  width: "100%",
  textAlign: "left",
  _coarsePointer: {
    minHeight: "44px",
  },
  ...focusRing,
});

const sectorButtonLabel = css({
  fontSize: "14px",
});

const sectorButtonMeta = css({
  fontSize: "12px",
  color: "zodiac.cream/66",
});

const workspaceGrid = css({
  display: "grid",
  gap: "6px",
  gridTemplateColumns: "1fr 1fr",
});

const workspaceButton = css({
  cursor: "pointer",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "zodiac.gold/20",
  background: "zodiac.glow-inner/55",
  color: "zodiac.cream",
  padding: "7px 8px",
  minHeight: "32px",
  fontSize: "10px",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  textAlign: "center",
  _coarsePointer: {
    minHeight: "44px",
  },
  ...focusRing,
});

// Mirrors backButton; gives the auto-rotating orrery a pause/resume control.
const motionToggleButton = css({
  cursor: "pointer",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "zodiac.gold/25",
  background: "transparent",
  color: "zodiac.gold",
  padding: "5px 12px",
  minHeight: "32px",
  fontSize: "10px",
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  marginTop: "12px",
  _coarsePointer: {
    minHeight: "44px",
  },
  ...focusRing,
});

const backButton = css({
  cursor: "pointer",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "zodiac.gold/25",
  background: "transparent",
  color: "zodiac.gold",
  padding: "5px 12px",
  minHeight: "32px",
  fontSize: "10px",
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  marginBottom: "14px",
  _coarsePointer: {
    minHeight: "44px",
  },
  ...focusRing,
});

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

const pipelineSectionEyebrow = css({
  fontSize: "10px",
  letterSpacing: "0.3em",
  color: "zodiac.gold/78",
  marginBottom: "8px",
});

const pipelineItemButton = css({
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
});

const pipelineItemStatus = css({
  fontSize: "10px",
  color: "zodiac.cream/66",
  marginTop: "2px",
});

// -- Sub-topic / Item-detail list buttons --

const listButton = css({
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
  _coarsePointer: {
    minHeight: "44px",
  },
  ...focusRing,
});

const listButtonMentions = css({
  float: "right",
  color: "zodiac.gold/78",
  fontSize: "10px",
});

const relationButton = css({
  display: "block",
  width: "100%",
  textAlign: "left",
  cursor: "pointer",
  padding: "8px",
  minHeight: "36px",
  marginBottom: "4px",
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
});

const relationTypeLabel = css({
  fontSize: "10px",
  letterSpacing: "0.15em",
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

const fallbackEyebrow = css({
  fontSize: "10px",
  letterSpacing: "0.24em",
  color: "zodiac.gold",
  opacity: 0.72,
});

const fallbackEyebrowSpaced = css({
  fontSize: "10px",
  letterSpacing: "0.24em",
  color: "zodiac.gold",
  opacity: 0.72,
  marginBottom: "12px",
});

const fallbackEyebrowPipeline = css({
  fontSize: "10px",
  letterSpacing: "0.24em",
  color: "zodiac.gold",
  opacity: 0.72,
  marginBottom: "10px",
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
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
});

const fallbackLinkButton = css({
  cursor: "pointer",
  background: "zodiac.glow-inner",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "zodiac.gold/55",
  padding: "11px 12px",
  minHeight: "44px",
  color: "zodiac.cream",
  textAlign: "left",
  fontFamily: "mono",
  fontSize: "11px",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
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
  fontSize: "10px",
  letterSpacing: "0.18em",
  color: "zodiac.cream/66",
});

const fallbackPipelineArrow = css({
  color: "zodiac.gold/58",
});

// ---------------------------------------------------------------------------

const sectorRouteMap: Record<string, string> = {
  math: "/display",
  wave: "/ingest",
  music: "/recipes",
  psycho: "/hypotheses",
  geometry: "/weekly-turns",
  synthesis: "/compositions",
};

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

export function Zodiac3D() {
  onMount(() => {
    document.title = "Zodiac — Frequency Music";
  });

  const navigate = useNavigate();
  const [selSector, setSelSector] = createSignal<string>("math");
  const [webglUnavailable, setWebglUnavailable] = createSignal(false);
  const [sidebarMode, setSidebarMode] = createSignal<SidebarMode>({
    kind: "overview",
  });

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
      return id ? { conceptId: id } : {};
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

  // Phase 3: Pipeline items (loaded once)
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

  const sectors = createMemo(() => {
    const rows = (sectorMetrics() ?? []) as SectorMetricRow[];
    const metrics = new Map<string, { sources: number; claims: number }>(
      rows.map((entry: SectorMetricRow) => [
        entry.id,
        {
          sources: Number(entry.sources ?? 0),
          claims: Number(entry.claims ?? 0),
        },
      ]),
    );

    return SECTORS.map((sector) => {
      const metric = metrics.get(sector.id);
      return {
        ...sector,
        sources: metric?.sources ?? sector.sources,
        claims: metric?.claims ?? sector.claims,
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
  let sceneHandle: ZodiacHandle | null = null;
  const [autoRotate, setAutoRotate] = createSignal(!prefersReducedMotion());

  function toggleAutoRotate() {
    const next = !autoRotate();
    sceneHandle?.setAutoRotate(next);
    setAutoRotate(next);
  }

  onMount(() => {
    try {
      sceneHandle = initZodiacScene(
        canvasRef,
        cssContainerRef,
        // onSectorClick
        (id) => {
          setSelSector(id);
          setSidebarMode({ kind: "overview" });
        },
        // onConceptClick
        (conceptId) => {
          setSidebarMode({ kind: "concept-detail", conceptId });
        },
        // onOrbitalClick
        (itemId, itemType, title) => {
          setSidebarMode({ kind: "item-detail", itemId, itemType, title });
        },
        // onArmillaryClick
        (label, names) => {
          setSidebarMode({ kind: "sub-topic", label, conceptNames: names });
        },
      );
      setAutoRotate(sceneHandle.isAutoRotating());
    } catch (error) {
      console.error("Zodiac scene initialization failed:", error);
      setWebglUnavailable(true);
    }
  });

  const stopReducedMotionWatch = watchReducedMotion((reduced) => {
    setAutoRotate(!reduced);
  });

  onCleanup(() => {
    stopReducedMotionWatch();
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
    setSidebarMode({ kind: "overview" });
    sceneHandle?.setActiveSector(id);
  }

  function handleSectorHover(id: string | null) {
    sceneHandle?.setActiveSector(id ?? selSector());
  }

  function openDomainWorkspace() {
    const destination = sectorRouteMap[selSector()] ?? "/display";
    void navigate({ to: destination });
  }

  function openWorkspace(path: string) {
    void navigate({ to: path });
  }

  function goBack() {
    const mode = sidebarMode();
    if (
      mode.kind === "item-detail" ||
      mode.kind === "concept-detail" ||
      mode.kind === "sub-topic"
    ) {
      setSidebarMode({ kind: "overview" });
      sceneHandle?.clearPullLines();
    }
  }

  // --- Sidebar Panel Renderers ---

  function SidebarOverview() {
    return (
      <>
        <div class={sidebarSection}>
          <div class={sidebarEyebrow}>∴ RESEARCH ZODIAC — 3D</div>
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
          <button
            type="button"
            onClick={toggleAutoRotate}
            class={motionToggleButton}
          >
            {autoRotate() ? "Pause rotation" : "Resume rotation"}
          </button>
        </div>

        <div class={sidebarSectionDomain}>
          <div
            class={sidebarEyebrowSmall}
            style={{ color: activeSector().color }}
          >
            {activeSector().id.toUpperCase()} DOMAIN
          </div>
          <div class={sidebarTitleMd} style={{ color: activeSector().color }}>
            {activeSector().label}
          </div>
          <p class={sidebarBodySm}>{activeSector().summary}</p>
          <div class={statRow}>
            <div class={statCellGold}>
              <div class={statValue} style={{ color: COLORS.gold }}>
                {activeSector().sources}
              </div>
              <div class={statLabel}>SOURCES</div>
            </div>
            <div class={statCellViolet}>
              <div class={statValue} style={{ color: COLORS.violet }}>
                {activeSector().claims}
              </div>
              <div class={statLabel}>CLAIMS</div>
            </div>
          </div>

          <Show when={(domainConcepts() ?? []).length > 0}>
            <div class={sidebarEyebrowConceptsLabel}>
              CONCEPTS ({(domainConcepts() ?? []).length})
            </div>
            <div class={conceptTagRow}>
              <For each={domainConcepts().slice(0, 12)}>
                {(concept) => (
                  <button
                    type="button"
                    onClick={() =>
                      setSidebarMode({
                        kind: "concept-detail",
                        conceptId: concept._id,
                      })
                    }
                    class={conceptTag}
                  >
                    {concept.displayName}
                    <span class={conceptTagCount}>{concept.mentionCount}</span>
                  </button>
                )}
              </For>
            </div>
          </Show>

          <button
            type="button"
            onClick={openDomainWorkspace}
            class={openDomainBtn}
          >
            Open Domain Workspace
          </button>
        </div>

        <div class={sidebarSectionDomains}>
          <div class={sidebarEyebrowSection}>ALL DOMAINS</div>
          <For each={sectors()}>
            {(sector) => (
              <button
                type="button"
                class={sectorButton}
                aria-pressed={selSector() === sector.id}
                style={{
                  "border-color":
                    selSector() === sector.id
                      ? `${sector.color}55`
                      : `${COLORS.gold}1a`,
                  background:
                    selSector() === sector.id
                      ? `${COLORS.gold}0d`
                      : "transparent",
                }}
                onClick={() => handleSectorSelect(sector.id)}
                onMouseEnter={() => handleSectorHover(sector.id)}
                onMouseLeave={() => handleSectorHover(null)}
              >
                <div
                  class={sectorButtonLabel}
                  style={{
                    // Inactive labels drop the sector hue: at any alpha that
                    // stays legible the violet sectors still fail on the void,
                    // so the rest state is cream and only the active sector
                    // carries colour.
                    color:
                      selSector() === sector.id ? sector.color : COLORS.cream,
                    opacity: selSector() === sector.id ? 1 : 0.72,
                  }}
                >
                  {sector.label}
                </div>
                <div class={sectorButtonMeta}>{sector.sources} src</div>
              </button>
            )}
          </For>
        </div>

        <div class={sidebarSectionWorkflow}>
          <div class={sidebarEyebrowSectionTop}>WORKFLOW SHORTCUTS</div>
          <div class={workspaceGrid}>
            <For each={workspaceLinks}>
              {(link) => (
                <button
                  type="button"
                  data-testid="home-workspace-link"
                  onClick={() => openWorkspace(link.to)}
                  class={workspaceButton}
                >
                  {link.label}
                </button>
              )}
            </For>
          </div>
        </div>

        <div class={sidebarSectionPipeline}>
          <div
            class={css({
              fontSize: "10px",
              letterSpacing: "0.3em",
              color: "zodiac.gold/78",
              marginBottom: "8px",
            })}
          >
            PIPELINE
          </div>
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
          <BackButton />
          <Show when={detail()}>
            {(detailData) => (
              <>
                <div class={sidebarEyebrowViolet}>CONCEPT</div>
                <div class={sidebarTitleSm}>
                  {detailData().concept.displayName}
                </div>
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
            <div class={sidebarSectionScrollable}>
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
          <div class={sidebarLoading}>Loading concept details...</div>
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
          <BackButton />
          <div class={sidebarEyebrowGold}>SUB-TOPIC</div>
          <div class={sidebarTitleMd} style={{ color: COLORS.gold }}>
            {mode().label}
          </div>
          <div class={sidebarMeta}>{mode().conceptNames.length} concepts</div>
        </div>

        <div class={sidebarSectionScrollable}>
          <div class={sidebarEyebrowSection}>CONCEPTS IN CLUSTER</div>
          <For each={mode().conceptNames}>
            {(name) => {
              const concept = () =>
                domainConcepts().find((c) => c.name === name);
              return (
                <button
                  type="button"
                  onClick={() => {
                    const c = concept();
                    if (c)
                      setSidebarMode({
                        kind: "concept-detail",
                        conceptId: c._id,
                      });
                  }}
                  class={listButton}
                >
                  {concept()?.displayName ?? name}
                  <Show when={concept()}>
                    <span class={listButtonMentions}>
                      {concept()?.mentionCount} mentions
                    </span>
                  </Show>
                </button>
              );
            }}
          </For>
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
          <BackButton />
          <div class={sidebarEyebrowGold}>{mode().itemType.toUpperCase()}</div>
          <div class={sidebarTitleItem}>{mode().title}</div>
        </div>

        <div class={sidebarSectionScrollable}>
          <Show when={relations().length > 0}>
            <div class={sidebarEyebrowSection}>
              RELATED ITEMS ({relations().length})
            </div>
            <For each={relations()}>
              {(rel) => (
                <button
                  type="button"
                  onClick={() =>
                    setSidebarMode({
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
              )}
            </For>
          </Show>
          <Show when={relations().length === 0}>
            <div class={sidebarEmpty}>No cross-pipeline relations found.</div>
          </Show>
        </div>
      </>
    );
  }

  function BackButton() {
    return (
      <button type="button" onClick={goBack} class={backButton}>
        ← Back
      </button>
    );
  }

  function PipelineSection(props: {
    label: string;
    items: Array<{ _id: string; title?: string; status: string }>;
    type: string;
  }) {
    return (
      <div class={pipelineSectionContainer}>
        <div class={pipelineSectionEyebrow}>
          {props.label} ({props.items.length})
        </div>
        <For each={props.items}>
          {(item) => (
            <button
              type="button"
              onClick={() =>
                setSidebarMode({
                  kind: "item-detail",
                  itemId: item._id,
                  itemType: props.type,
                  title: item.title ?? "Untitled",
                })
              }
              class={pipelineItemButton}
            >
              <div>{item.title ?? "Untitled"}</div>
              <div class={pipelineItemStatus}>{item.status}</div>
            </button>
          )}
        </For>
      </div>
    );
  }

  if (webglUnavailable()) {
    return (
      <div class={fallbackContainer}>
        <div class={fallbackGrid}>
          <div class={fallbackCard}>
            <div class={fallbackEyebrow}>HOME FALLBACK</div>
            <h1 class={fallbackTitle}>Workspace Navigator</h1>
            <p class={fallbackBody}>
              3D mode is unavailable in this environment. Use direct workflow
              links below to continue managing intake, research, production, and
              participation.
            </p>
          </div>

          <div class={fallbackCard}>
            <div class={fallbackEyebrowSpaced}>QUICK ACCESS</div>
            <div class={fallbackLinkGrid}>
              <For each={workspaceLinks}>
                {(link) => (
                  <button
                    type="button"
                    data-testid="home-workspace-link"
                    onClick={() => openWorkspace(link.to)}
                    class={fallbackLinkButton}
                  >
                    {link.label}
                  </button>
                )}
              </For>
            </div>
          </div>

          <div class={fallbackCard}>
            <div class={fallbackEyebrowPipeline}>PIPELINE SNAPSHOT</div>
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

  return (
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

      <div class={`${sidebarContainer} zodiac-scroll`}>
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
  );
}
