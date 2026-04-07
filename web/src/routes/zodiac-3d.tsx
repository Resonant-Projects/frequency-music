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
import { convexApi } from "../integrations/convex/api";
import type { ConstellationEdge } from "../lib/zodiac-constellations";
import { SECTORS } from "../lib/zodiac-data";
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
    boxShadow: "0 0 0 1px rgba(200, 168, 75, 0.4)",
    outline: "none",
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
  borderLeft: { base: "none", lg: "1px solid rgba(200, 168, 75, 0.12)" },
  borderTop: { base: "1px solid rgba(200, 168, 75, 0.12)", lg: "none" },
  overflowY: "auto",
  flexShrink: 0,
});

// -- Sidebar sections --

const sidebarSection = css({
  padding: "36px 26px 20px",
  borderBottom: "1px solid rgba(200, 168, 75, 0.1)",
});

const sidebarSectionCompact = css({
  padding: "20px 26px",
  borderBottom: "1px solid rgba(200, 168, 75, 0.1)",
});

const sidebarSectionScrollable = css({
  padding: "16px 26px",
  flex: "1",
  overflowY: "auto",
});

const sidebarSectionDomain = css({
  padding: "22px 26px",
  flex: "1",
  borderBottom: "1px solid rgba(200, 168, 75, 0.1)",
});

const sidebarSectionDomains = css({
  padding: "16px 26px",
  flexShrink: 0,
});

const sidebarSectionWorkflow = css({
  padding: "0 26px 16px",
  flexShrink: 0,
  borderTop: "1px solid rgba(200, 168, 75, 0.1)",
});

const sidebarSectionPipeline = css({
  padding: "14px 26px 24px",
  borderTop: "1px solid rgba(200, 168, 75, 0.1)",
});

// -- Typography --

const sidebarEyebrow = css({
  fontSize: "9px",
  letterSpacing: "0.4em",
  color: "rgba(200, 168, 75, 0.58)",
  marginBottom: "14px",
});

const sidebarEyebrowSmall = css({
  fontSize: "9px",
  letterSpacing: "0.35em",
  opacity: 0.75,
  marginBottom: "10px",
});

const sidebarEyebrowViolet = css({
  fontSize: "9px",
  letterSpacing: "0.35em",
  color: "rgba(139, 92, 246, 0.6)",
  marginBottom: "8px",
});

const sidebarEyebrowGold = css({
  fontSize: "9px",
  letterSpacing: "0.35em",
  color: "rgba(200, 168, 75, 0.6)",
  marginBottom: "8px",
});

const sidebarEyebrowSection = css({
  fontSize: "9px",
  letterSpacing: "0.3em",
  color: "rgba(200, 168, 75, 0.55)",
  marginBottom: "10px",
});

const sidebarEyebrowSectionTop = css({
  fontSize: "9px",
  letterSpacing: "0.3em",
  color: "rgba(200, 168, 75, 0.55)",
  margin: "12px 0 10px",
});

const sidebarEyebrowConceptsLabel = css({
  fontSize: "9px",
  letterSpacing: "0.3em",
  color: "rgba(200, 168, 75, 0.55)",
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
  fontSize: "13px",
  fontWeight: "300",
  lineHeight: "1.65",
  color: "rgba(245, 240, 232, 0.58)",
  margin: "0",
});

const sidebarBodySm = css({
  fontSize: "12.5px",
  lineHeight: "1.65",
  color: "rgba(245, 240, 232, 0.58)",
  margin: "0 0 18px",
});

const sidebarBodyDetail = css({
  fontSize: "12.5px",
  lineHeight: "1.65",
  color: "rgba(245, 240, 232, 0.55)",
  margin: "0 0 16px",
});

const sidebarMeta = css({
  fontSize: "11px",
  color: "rgba(245, 240, 232, 0.58)",
  marginBottom: "12px",
});

const sidebarAliases = css({
  fontSize: "10px",
  color: "rgba(245, 240, 232, 0.55)",
  marginBottom: "16px",
});

const sidebarLoading = css({
  padding: "26px",
  color: "rgba(245, 240, 232, 0.55)",
  fontSize: "12px",
});

const sidebarEmpty = css({
  color: "rgba(245, 240, 232, 0.55)",
  fontSize: "12px",
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
  border: "1px solid rgba(200, 168, 75, 0.18)",
  textAlign: "center",
});

const statCellViolet = css({
  flex: "1",
  padding: "10px",
  border: "1px solid rgba(139, 92, 246, 0.18)",
  textAlign: "center",
});

const statValue = css({
  fontSize: "26px",
});

const statLabel = css({
  fontSize: "8px",
  letterSpacing: "0.25em",
  color: "rgba(245, 240, 232, 0.55)",
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
  background: "rgba(139, 92, 246, 0.1)",
  border: "1px solid rgba(139, 92, 246, 0.25)",
  color: "zodiac.gold",
  padding: "3px 8px",
  fontSize: "10px",
  letterSpacing: "0.08em",
  ...focusRing,
});

const conceptTagCount = css({
  opacity: 0.58,
  marginLeft: "4px",
});

// -- Buttons --

const openDomainBtn = css({
  width: "100%",
  cursor: "pointer",
  border: "1px solid rgba(200, 168, 75, 0.45)",
  background: "zodiac.gold",
  color: "zodiac.void",
  padding: "8px 10px",
  letterSpacing: "0.18em",
  fontSize: "10px",
  textTransform: "uppercase",
  ...focusRing,
});

const sectorButton = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "7px 9px",
  marginBottom: "3px",
  cursor: "pointer",
  border: "1px solid",
  transition: "all 0.2s",
  width: "100%",
  textAlign: "left",
  ...focusRing,
});

const sectorButtonLabel = css({
  fontSize: "12.5px",
});

const sectorButtonMeta = css({
  fontSize: "10px",
  color: "rgba(245, 240, 232, 0.55)",
});

const workspaceGrid = css({
  display: "grid",
  gap: "6px",
  gridTemplateColumns: "1fr 1fr",
});

const workspaceButton = css({
  cursor: "pointer",
  border: "1px solid rgba(200, 168, 75, 0.2)",
  background: "rgba(26, 15, 53, 0.55)",
  color: "zodiac.cream",
  padding: "7px 8px",
  fontSize: "9px",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  textAlign: "center",
  ...focusRing,
});

const backButton = css({
  cursor: "pointer",
  border: "1px solid rgba(200, 168, 75, 0.25)",
  background: "transparent",
  color: "zodiac.gold",
  padding: "5px 12px",
  fontSize: "10px",
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  marginBottom: "14px",
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
  fontSize: "7.5px",
  letterSpacing: "0.2em",
  color: "rgba(245, 240, 232, 0.55)",
});

const pipelineArrow = css({
  fontSize: "9px",
  color: "rgba(200, 168, 75, 0.55)",
  marginBottom: "8px",
});

const pipelineSectionContainer = css({
  marginBottom: "16px",
});

const pipelineSectionEyebrow = css({
  fontSize: "9px",
  letterSpacing: "0.3em",
  color: "rgba(200, 168, 75, 0.55)",
  marginBottom: "8px",
});

const pipelineItemButton = css({
  display: "block",
  width: "100%",
  textAlign: "left",
  cursor: "pointer",
  padding: "6px 8px",
  marginBottom: "3px",
  border: "1px solid rgba(200, 168, 75, 0.12)",
  background: "transparent",
  color: "zodiac.cream",
  fontSize: "11.5px",
  lineHeight: "1.4",
  ...focusRing,
});

const pipelineItemStatus = css({
  fontSize: "9px",
  color: "rgba(245, 240, 232, 0.55)",
  marginTop: "2px",
});

// -- Sub-topic / Item-detail list buttons --

const listButton = css({
  display: "block",
  width: "100%",
  textAlign: "left",
  cursor: "pointer",
  padding: "6px 8px",
  marginBottom: "3px",
  border: "1px solid rgba(200, 168, 75, 0.12)",
  background: "transparent",
  color: "zodiac.cream",
  fontSize: "12px",
  ...focusRing,
});

const listButtonMentions = css({
  float: "right",
  color: "rgba(200, 168, 75, 0.58)",
  fontSize: "10px",
});

const relationButton = css({
  display: "block",
  width: "100%",
  textAlign: "left",
  cursor: "pointer",
  padding: "8px",
  marginBottom: "4px",
  border: "1px solid rgba(200, 168, 75, 0.12)",
  background: "transparent",
  color: "zodiac.cream",
  fontSize: "12px",
  lineHeight: "1.4",
  ...focusRing,
});

const relationTypeLabel = css({
  fontSize: "9px",
  letterSpacing: "0.15em",
  color: "rgba(139, 92, 246, 0.55)",
  marginBottom: "2px",
});

const relationTitle = css({
  color: "rgba(245, 240, 232, 0.7)",
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
  border: "1px solid rgba(200, 168, 75, 0.2)",
  padding: "18px",
  borderRadius: "8px",
  background: "rgba(13, 6, 32, 0.5)",
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
  color: "rgba(245, 240, 232, 0.66)",
  lineHeight: "1.6",
});

const fallbackLinkGrid = css({
  display: "grid",
  gap: "10px",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
});

const fallbackLinkButton = css({
  cursor: "pointer",
  background: "#130a31",
  border: "1px solid rgba(200, 168, 75, 0.55)",
  padding: "11px 12px",
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
  border: "1px solid rgba(200, 168, 75, 0.2)",
  textAlign: "center",
});

const fallbackPipelineValue = css({
  fontSize: "20px",
  color: "zodiac.gold",
});

const fallbackPipelineLabel = css({
  fontSize: "9px",
  letterSpacing: "0.18em",
  color: "rgba(245, 240, 232, 0.55)",
});

const fallbackPipelineArrow = css({
  color: "rgba(200, 168, 75, 0.58)",
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
  const sectorMetrics = createQuery(convexApi.dashboard.zodiacSectors, () => ({
    limit: 200,
  }));
  const pipeline = createQuery(convexApi.dashboard.pipeline);

  // --- New queries (use createQueryWithStatus so errors don't crash the page) ---

  // Phase 1: Concepts for active sector
  const domainConceptsQ = createQueryWithStatus(convexApi.graph.getConceptsForDomain, () => ({
    domain: selSector(),
    limit: 40,
  }));
  const domainConcepts = createMemo<ConstellationConcept[]>(
    () => (domainConceptsQ.data() ?? []) as ConstellationConcept[],
  );

  // Phase 1: Edges between those concepts
  const conceptNames = createMemo(() => domainConcepts().map((c) => c.name));
  const conceptEdgesQ = createQueryWithStatus(convexApi.graph.getConceptEdges, () => ({
    conceptNames: conceptNames(),
  }));
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
  const conceptDetailQ = createQueryWithStatus(convexApi.graph.getConceptDetail, () => {
    const id = activeConceptId();
    return id ? { conceptId: id } : {};
  });
  const conceptDetail = createMemo<ConceptDetailData | undefined>(() =>
    activeConceptId() ? (conceptDetailQ.data() as ConceptDetailData | undefined) : undefined,
  );

  // Phase 2: Sub-topics for active sector
  const subTopicsQ = createQueryWithStatus(convexApi.dashboard.domainSubTopics, () => ({
    domain: selSector(),
  }));
  const subTopics = createMemo<ZodiacSubTopic[]>(
    () => (subTopicsQ.data() ?? []) as ZodiacSubTopic[],
  );

  // Phase 3: Pipeline items (loaded once)
  const pipelineItemsQ = createQueryWithStatus(convexApi.dashboard.pipelineItems);
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
    return mode.kind === "item-detail" ? { id: mode.itemId, type: mode.itemType } : undefined;
  });
  const itemRelationsQ = createQueryWithStatus(convexApi.dashboard.itemRelations, () => ({
    itemId: activeItem()?.id ?? "",
    itemType: activeItem()?.type ?? "source",
  }));
  const itemRelations = createMemo<ItemRelation[] | undefined>(() =>
    activeItem() ? (itemRelationsQ.data() as ItemRelation[] | undefined) : undefined,
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
    } catch (error) {
      console.error("Zodiac scene initialization failed:", error);
      setWebglUnavailable(true);
    }
  });

  onCleanup(() => {
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
    navigate({ to: destination });
  }

  function openWorkspace(path: string) {
    navigate({ to: path });
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
            Drag to orbit. Click a sector to focus. Click stars for concept details. Click orbiting
            bodies for pipeline items.
          </p>
        </div>

        <div class={sidebarSectionDomain}>
          <div class={sidebarEyebrowSmall} style={{ color: activeSector().color }}>
            {activeSector().id.toUpperCase()} DOMAIN
          </div>
          <div class={sidebarTitleMd} style={{ color: activeSector().color }}>
            {activeSector().label}
          </div>
          <p class={sidebarBodySm}>{activeSector().summary}</p>
          <div class={statRow}>
            <div class={statCellGold}>
              <div class={statValue} style={{ color: "#c8a84b" }}>
                {activeSector().sources}
              </div>
              <div class={statLabel}>SOURCES</div>
            </div>
            <div class={statCellViolet}>
              <div class={statValue} style={{ color: "#8b5cf6" }}>
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

          <button type="button" onClick={openDomainWorkspace} class={openDomainBtn}>
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
                    selSector() === sector.id ? `${sector.color}55` : "rgba(200,168,75,0.1)",
                  background: selSector() === sector.id ? "rgba(200,168,75,0.05)" : "transparent",
                }}
                onClick={() => handleSectorSelect(sector.id)}
                onMouseEnter={() => handleSectorHover(sector.id)}
                onMouseLeave={() => handleSectorHover(null)}
              >
                <div
                  class={sectorButtonLabel}
                  style={{
                    color: sector.color,
                    opacity: selSector() === sector.id ? 1 : 0.58,
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
              fontSize: "9px",
              letterSpacing: "0.3em",
              color: "rgba(200, 168, 75, 0.55)",
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
                    <div class={pipelineArrow}>→</div>
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
    const detail = createMemo<ConceptDetailData | undefined>(() => conceptDetail());
    return (
      <>
        <div class={sidebarSectionCompact}>
          <BackButton />
          <Show when={detail()}>
            {(detailData) => (
              <>
                <div class={sidebarEyebrowViolet}>CONCEPT</div>
                <div class={sidebarTitleSm}>{detailData().concept.displayName}</div>
                <div class={sidebarMeta}>
                  {detailData().concept.domain} &middot; {detailData().concept.mentionCount}{" "}
                  mentions &middot; {detailData().edgeCount} edges
                </div>
                <Show when={detailData().concept.description}>
                  <p class={sidebarBodyDetail}>{detailData().concept.description}</p>
                </Show>
                <Show when={detailData().concept.aliases?.length > 0}>
                  <div class={sidebarAliases}>Also: {detailData().concept.aliases.join(", ")}</div>
                </Show>
              </>
            )}
          </Show>
        </div>

        <Show when={detail()}>
          {(detailData) => (
            <div class={sidebarSectionScrollable}>
              <Show when={detailData().linkedSources.length > 0}>
                <PipelineSection label="SOURCES" items={detailData().linkedSources} type="source" />
              </Show>
              <Show when={detailData().linkedHypotheses.length > 0}>
                <PipelineSection
                  label="HYPOTHESES"
                  items={detailData().linkedHypotheses}
                  type="hypothesis"
                />
              </Show>
              <Show when={detailData().linkedRecipes.length > 0}>
                <PipelineSection label="RECIPES" items={detailData().linkedRecipes} type="recipe" />
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
          <div class={sidebarTitleMd} style={{ color: "#c8a84b" }}>
            {mode().label}
          </div>
          <div class={sidebarMeta}>{mode().conceptNames.length} concepts</div>
        </div>

        <div class={sidebarSectionScrollable}>
          <div class={sidebarEyebrowSection}>CONCEPTS IN CLUSTER</div>
          <For each={mode().conceptNames}>
            {(name) => {
              const concept = () => domainConcepts().find((c) => c.name === name);
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
                    <span class={listButtonMentions}>{concept()?.mentionCount} mentions</span>
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
            <div class={sidebarEyebrowSection}>RELATED ITEMS ({relations().length})</div>
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
              3D mode is unavailable in this environment. Use direct workflow links below to
              continue managing intake, research, production, and participation.
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
                      <div class={fallbackPipelineArrow}>→</div>
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
        <canvas ref={canvasRef} class={canvasEl} />
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
