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

const sectorRouteMap: Record<string, string> = {
  math: "/display",
  phys: "/ingest",
  music: "/recipes",
  psycho: "/hypotheses",
  geo: "/weekly-turns",
  synth: "/compositions",
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
  const navigate = useNavigate();
  const [selSector, setSelSector] = createSignal<string>("math");
  const [webglUnavailable, setWebglUnavailable] = createSignal(false);
  const [sidebarMode, setSidebarMode] = createSignal<SidebarMode>({ kind: "overview" });

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
  const conceptEdges = createMemo<ConstellationEdge[]>(
    () =>
      ((conceptEdgesQ.data() ?? []) as Array<{
        fromId: string;
        toId: string;
        relationship: string;
      }>).map<ZodiacConstellationEdge>((edge) => ({
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
    convexApi.graph.getConceptDetail,
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
  const subTopicsQ = createQueryWithStatus(convexApi.dashboard.domainSubTopics, () => ({
    domain: selSector(),
  }));
  const subTopics = createMemo<ZodiacSubTopic[]>(
    () => (subTopicsQ.data() ?? []) as ZodiacSubTopic[],
  );

  // Phase 3: Pipeline items (loaded once)
  const pipelineItemsQ = createQueryWithStatus(convexApi.dashboard.pipelineItems);
  const pipelineItems = createMemo<{
    sources: OrbitalSource[];
    extractions: OrbitalExtraction[];
    hypotheses: OrbitalHypothesis[];
    recipes: OrbitalRecipe[];
  } | undefined>(() => pipelineItemsQ.data() as {
    sources: OrbitalSource[];
    extractions: OrbitalExtraction[];
    hypotheses: OrbitalHypothesis[];
    recipes: OrbitalRecipe[];
  } | undefined);

  // Phase 3: Item relations — conditional
  const activeItem = createMemo(() => {
    const mode = sidebarMode();
    return mode.kind === "item-detail" ? { id: mode.itemId, type: mode.itemType } : undefined;
  });
  const itemRelationsQ = createQueryWithStatus(
    convexApi.dashboard.itemRelations,
    () => ({ itemId: activeItem()?.id ?? "", itemType: activeItem()?.type ?? "source" }),
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
        (label, conceptNames) => {
          setSidebarMode({ kind: "sub-topic", label, conceptNames });
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

      sceneHandle.loadConstellations(
        selSector(),
        concepts,
        edges ?? [],
      );
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
    if (mode.kind === "item-detail" || mode.kind === "concept-detail" || mode.kind === "sub-topic") {
      setSidebarMode({ kind: "overview" });
      sceneHandle?.clearPullLines();
    }
  }

  // --- Sidebar Panel Renderers ---

  function SidebarOverview() {
    return (
      <>
        <div style="padding:36px 26px 20px;border-bottom:1px solid rgba(200,168,75,0.1)">
          <div style="font-size:9px;letter-spacing:0.4em;color:rgba(200,168,75,0.4);margin-bottom:14px">
            ∴ RESEARCH ZODIAC — 3D
          </div>
          <h1 style="font-size:34px;font-weight:300;line-height:1.15;margin:0 0 10px">
            Astrolabe
            <br />
            <em style="color:#c8a84b">Knowledge</em>
            <br />
            Orrery
          </h1>
          <p style="font-size:13px;font-weight:300;line-height:1.65;color:rgba(245,240,232,0.38);margin:0">
            Drag to orbit. Click a sector to focus. Click stars for concept details.
            Click orbiting bodies for pipeline items.
          </p>
        </div>

        <div style="padding:22px 26px;flex:1;border-bottom:1px solid rgba(200,168,75,0.1)">
          <div
            style={`font-size:9px;letter-spacing:0.35em;margin-bottom:10px;color:${activeSector().color};opacity:0.75`}
          >
            {activeSector().id.toUpperCase()} DOMAIN
          </div>
          <div
            style={`font-size:22px;color:${activeSector().color};margin-bottom:8px;font-weight:300`}
          >
            {activeSector().label}
          </div>
          <p style="font-size:12.5px;line-height:1.65;color:rgba(245,240,232,0.42);margin:0 0 18px">
            {activeSector().summary}
          </p>
          <div style="display:flex;gap:12px;margin-bottom:14px">
            <div style="flex:1;padding:10px;border:1px solid rgba(200,168,75,0.18);text-align:center">
              <div style="font-size:26px;color:#c8a84b">
                {activeSector().sources}
              </div>
              <div style="font-size:8px;letter-spacing:0.25em;color:rgba(245,240,232,0.28);margin-top:2px">
                SOURCES
              </div>
            </div>
            <div style="flex:1;padding:10px;border:1px solid rgba(139,92,246,0.18);text-align:center">
              <div style="font-size:26px;color:#8b5cf6">
                {activeSector().claims}
              </div>
              <div style="font-size:8px;letter-spacing:0.25em;color:rgba(245,240,232,0.28);margin-top:2px">
                CLAIMS
              </div>
            </div>
          </div>

          <Show when={(domainConcepts() ?? []).length > 0}>
            <div style="font-size:9px;letter-spacing:0.3em;color:rgba(200,168,75,0.3);margin:16px 0 8px">
              CONCEPTS ({(domainConcepts() ?? []).length})
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:14px">
              <For each={domainConcepts().slice(0, 12)}>
                {(concept) => (
                  <button
                    type="button"
                    onClick={() => setSidebarMode({ kind: "concept-detail", conceptId: concept._id })}
                    style="cursor:pointer;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.25);color:#c8a84b;padding:3px 8px;font-size:10px;letter-spacing:0.08em"
                  >
                    {concept.displayName}
                    <span style="opacity:0.4;margin-left:4px">{concept.mentionCount}</span>
                  </button>
                )}
              </For>
            </div>
          </Show>

          <button
            type="button"
            onClick={openDomainWorkspace}
            style="width:100%;cursor:pointer;border:1px solid rgba(200,168,75,0.45);background:#c8a84b;color:#0d0620;padding:8px 10px;letter-spacing:0.18em;font-size:10px;text-transform:uppercase"
          >
            Open Domain Workspace
          </button>
        </div>

        <div style="padding:16px 26px;flex-shrink:0">
          <div style="font-size:9px;letter-spacing:0.3em;color:rgba(200,168,75,0.3);margin-bottom:10px">
            ALL DOMAINS
          </div>
          <For each={sectors()}>
            {(sector) => (
              <button
                type="button"
                style={`display:flex;align-items:center;justify-content:space-between;padding:7px 9px;margin-bottom:3px;cursor:pointer;border:1px solid;transition:all 0.2s;border-color:${selSector() === sector.id ? `${sector.color}55` : "rgba(200,168,75,0.1)"};background:${selSector() === sector.id ? "rgba(200,168,75,0.05)" : "transparent"};width:100%;text-align:left`}
                onClick={() => handleSectorSelect(sector.id)}
                onMouseEnter={() => handleSectorHover(sector.id)}
                onMouseLeave={() => handleSectorHover(null)}
              >
                <div
                  style={`font-size:12.5px;color:${sector.color};opacity:${selSector() === sector.id ? 1 : 0.58}`}
                >
                  {sector.label}
                </div>
                <div style="font-size:10px;color:rgba(245,240,232,0.28)">
                  {sector.sources} src
                </div>
              </button>
            )}
          </For>
        </div>

        <div style="padding:0 26px 16px;flex-shrink:0;border-top:1px solid rgba(200,168,75,0.1)">
          <div style="font-size:9px;letter-spacing:0.3em;color:rgba(200,168,75,0.3);margin:12px 0 10px">
            WORKFLOW SHORTCUTS
          </div>
          <div style="display:grid;gap:6px;grid-template-columns:1fr 1fr">
            <For each={workspaceLinks}>
              {(link) => (
                <button
                  type="button"
                  data-testid="home-workspace-link"
                  onClick={() => openWorkspace(link.to)}
                  style="cursor:pointer;border:1px solid rgba(200,168,75,0.2);background:rgba(26,15,53,0.55);color:#f5f0e8;padding:7px 8px;font-size:9px;letter-spacing:0.16em;text-transform:uppercase;text-align:center"
                >
                  {link.label}
                </button>
              )}
            </For>
          </div>
        </div>

        <div style="padding:14px 26px 24px;border-top:1px solid rgba(200,168,75,0.1)">
          <div style="font-size:9px;letter-spacing:0.3em;color:rgba(200,168,75,0.3);margin-bottom:8px">
            PIPELINE
          </div>
          <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
            <For each={pipelineSummary()}>
              {(item, index) => (
                <>
                  <div style="text-align:center;min-width:46px">
                    <div style="font-size:15px;color:#c8a84b">{item.value}</div>
                    <div style="font-size:7.5px;letter-spacing:0.2em;color:rgba(245,240,232,0.25)">
                      {item.label}
                    </div>
                  </div>
                  <Show when={index() < pipelineSummary().length - 1}>
                    <div style="font-size:9px;color:rgba(200,168,75,0.25);margin-bottom:8px">
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
    const detail = createMemo<ConceptDetailData | undefined>(() => conceptDetail());
    return (
      <>
        <div style="padding:20px 26px;border-bottom:1px solid rgba(200,168,75,0.1)">
          <BackButton />
          <Show when={detail()}>
            {(detailData) => (
              <>
                <div style="font-size:9px;letter-spacing:0.35em;color:rgba(139,92,246,0.6);margin-bottom:8px">
                  CONCEPT
                </div>
                <div style="font-size:24px;color:#c8a84b;font-weight:300;margin-bottom:6px">
                  {detailData().concept.displayName}
                </div>
                <div style="font-size:11px;color:rgba(245,240,232,0.35);margin-bottom:12px">
                  {detailData().concept.domain} &middot; {detailData().concept.mentionCount} mentions &middot; {detailData().edgeCount} edges
                </div>
                <Show when={detailData().concept.description}>
                  <p style="font-size:12.5px;line-height:1.65;color:rgba(245,240,232,0.5);margin:0 0 16px">
                    {detailData().concept.description}
                  </p>
                </Show>
                <Show when={detailData().concept.aliases?.length > 0}>
                  <div style="font-size:10px;color:rgba(245,240,232,0.3);margin-bottom:16px">
                    Also: {detailData().concept.aliases.join(", ")}
                  </div>
                </Show>
              </>
            )}
          </Show>
        </div>

        <Show when={detail()}>
          {(detailData) => (
            <div style="padding:16px 26px;flex:1;overflow-y:auto">
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
          <div style="padding:26px;color:rgba(245,240,232,0.3);font-size:12px">
            Loading concept details...
          </div>
        </Show>
      </>
    );
  }

  function SidebarSubTopic() {
    const mode = () => sidebarMode() as { kind: "sub-topic"; label: string; conceptNames: string[] };
    return (
      <>
        <div style="padding:20px 26px;border-bottom:1px solid rgba(200,168,75,0.1)">
          <BackButton />
          <div style="font-size:9px;letter-spacing:0.35em;color:rgba(200,168,75,0.6);margin-bottom:8px">
            SUB-TOPIC
          </div>
          <div style="font-size:22px;color:#c8a84b;font-weight:300;margin-bottom:6px">
            {mode().label}
          </div>
          <div style="font-size:11px;color:rgba(245,240,232,0.35);margin-bottom:12px">
            {mode().conceptNames.length} concepts
          </div>
        </div>

        <div style="padding:16px 26px;flex:1;overflow-y:auto">
          <div style="font-size:9px;letter-spacing:0.3em;color:rgba(200,168,75,0.3);margin-bottom:10px">
            CONCEPTS IN CLUSTER
          </div>
          <For each={mode().conceptNames}>
            {(name) => {
              const concept = () => domainConcepts().find((c) => c.name === name);
              return (
                <button
                  type="button"
                  onClick={() => {
                    const c = concept();
                    if (c) setSidebarMode({ kind: "concept-detail", conceptId: c._id });
                  }}
                  style="display:block;width:100%;text-align:left;cursor:pointer;padding:6px 8px;margin-bottom:3px;border:1px solid rgba(200,168,75,0.12);background:transparent;color:#f5f0e8;font-size:12px"
                >
                  {concept()?.displayName ?? name}
                  <Show when={concept()}>
                    <span style="float:right;color:rgba(200,168,75,0.4);font-size:10px">
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
    const mode = () => sidebarMode() as { kind: "item-detail"; itemId: string; itemType: string; title: string };
    const relations = createMemo<ItemRelation[]>(() => itemRelations() ?? []);

    return (
      <>
        <div style="padding:20px 26px;border-bottom:1px solid rgba(200,168,75,0.1)">
          <BackButton />
          <div style="font-size:9px;letter-spacing:0.35em;color:rgba(200,168,75,0.6);margin-bottom:8px">
            {mode().itemType.toUpperCase()}
          </div>
          <div style="font-size:18px;color:#c8a84b;font-weight:300;margin-bottom:4px;line-height:1.3">
            {mode().title}
          </div>
        </div>

        <div style="padding:16px 26px;flex:1;overflow-y:auto">
          <Show when={relations().length > 0}>
            <div style="font-size:9px;letter-spacing:0.3em;color:rgba(200,168,75,0.3);margin-bottom:10px">
              RELATED ITEMS ({relations().length})
            </div>
            <For each={relations()}>
              {(rel) => (
                <button
                  type="button"
                  onClick={() =>
                    setSidebarMode({ kind: "item-detail", itemId: rel.id, itemType: rel.type, title: rel.title })
                  }
                  style="display:block;width:100%;text-align:left;cursor:pointer;padding:8px;margin-bottom:4px;border:1px solid rgba(200,168,75,0.12);background:transparent;color:#f5f0e8;font-size:12px;line-height:1.4"
                >
                  <div style="font-size:9px;letter-spacing:0.15em;color:rgba(139,92,246,0.5);margin-bottom:2px">
                    {rel.type.toUpperCase()} &middot; {rel.relationship}
                  </div>
                  <div style="color:rgba(245,240,232,0.7)">{rel.title}</div>
                </button>
              )}
            </For>
          </Show>
          <Show when={relations().length === 0}>
            <div style="color:rgba(245,240,232,0.3);font-size:12px">
              No cross-pipeline relations found.
            </div>
          </Show>
        </div>
      </>
    );
  }

  function BackButton() {
    return (
      <button
        type="button"
        onClick={goBack}
        style="cursor:pointer;border:1px solid rgba(200,168,75,0.25);background:transparent;color:#c8a84b;padding:5px 12px;font-size:10px;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:14px"
      >
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
      <div style="margin-bottom:16px">
        <div style="font-size:9px;letter-spacing:0.3em;color:rgba(200,168,75,0.3);margin-bottom:8px">
          {props.label} ({props.items.length})
        </div>
        <For each={props.items}>
          {(item) => (
            <button
              type="button"
              onClick={() =>
                setSidebarMode({ kind: "item-detail", itemId: item._id, itemType: props.type, title: item.title ?? "Untitled" })
              }
              style="display:block;width:100%;text-align:left;cursor:pointer;padding:6px 8px;margin-bottom:3px;border:1px solid rgba(200,168,75,0.12);background:transparent;color:#f5f0e8;font-size:11.5px;line-height:1.4"
            >
              <div>{item.title ?? "Untitled"}</div>
              <div style="font-size:9px;color:rgba(245,240,232,0.25);margin-top:2px">
                {item.status}
              </div>
            </button>
          )}
        </For>
      </div>
    );
  }

  if (webglUnavailable()) {
    return (
      <div style="min-height:calc(100vh - var(--app-header-height));background:#0d0620;color:#f5f0e8;padding:24px">
        <div style="max-width:1120px;margin:0 auto;display:grid;gap:16px">
          <div style="border:1px solid rgba(200,168,75,0.2);padding:18px;border-radius:8px;background:rgba(13,6,32,0.5)">
            <div style="font-size:10px;letter-spacing:0.24em;color:#c8a84b;opacity:0.72">
              HOME FALLBACK
            </div>
            <h1 style="margin:10px 0 8px;font-size:34px;font-weight:300">
              Workspace Navigator
            </h1>
            <p style="margin:0;color:rgba(245,240,232,0.66);line-height:1.6">
              3D mode is unavailable in this environment. Use direct workflow
              links below to continue managing intake, research, production, and
              participation.
            </p>
          </div>

          <div style="border:1px solid rgba(200,168,75,0.2);padding:18px;border-radius:8px;background:rgba(13,6,32,0.5)">
            <div style="font-size:10px;letter-spacing:0.24em;color:#c8a84b;opacity:0.72;margin-bottom:12px">
              QUICK ACCESS
            </div>
            <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
              <For each={workspaceLinks}>
                {(link) => (
                  <button
                    type="button"
                    data-testid="home-workspace-link"
                    onClick={() => openWorkspace(link.to)}
                    style="cursor:pointer;background:#130a31;border:1px solid rgba(200,168,75,0.28);padding:11px 12px;color:#f5f0e8;text-align:left;font-family:'IBM Plex Mono','JetBrains Mono',monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase"
                  >
                    {link.label}
                  </button>
                )}
              </For>
            </div>
          </div>

          <div style="border:1px solid rgba(200,168,75,0.2);padding:18px;border-radius:8px;background:rgba(13,6,32,0.5)">
            <div style="font-size:10px;letter-spacing:0.24em;color:#c8a84b;opacity:0.72;margin-bottom:10px">
              PIPELINE SNAPSHOT
            </div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <For each={pipelineSummary()}>
                {(item, index) => (
                  <>
                    <div style="min-width:72px;padding:8px;border:1px solid rgba(200,168,75,0.2);text-align:center">
                      <div style="font-size:20px;color:#c8a84b">
                        {item.value}
                      </div>
                      <div style="font-size:9px;letter-spacing:0.18em;color:rgba(245,240,232,0.5)">
                        {item.label}
                      </div>
                    </div>
                    <Show when={index() < pipelineSummary().length - 1}>
                      <div style="color:rgba(200,168,75,0.35)">→</div>
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
    <div style="height:calc(100vh - var(--app-header-height));background:#0d0620;color:#f5f0e8;overflow:hidden;font-family:'Cormorant Garamond',Georgia,serif;display:flex">
      <div style="position:fixed;inset:0;pointer-events:none;opacity:0.022;background-image:radial-gradient(circle,#c8a84b 1px,transparent 1px);background-size:52px 52px" />

      <div
        ref={cssContainerRef}
        style="flex:1;position:relative;overflow:hidden;min-width:0"
      >
        <canvas ref={canvasRef} style="width:100%;height:100%;display:block" />
      </div>

      <div style="width:355px;display:flex;flex-direction:column;border-left:1px solid rgba(200,168,75,0.12);overflow-y:auto;flex-shrink:0">
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
