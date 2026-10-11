import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  untrack,
} from "solid-js";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { createQueryWithStatus } from "../integrations/convex";
import { COLORS, SECTORS } from "../lib/zodiac-data";
import { prefersReducedMotion, watchReducedMotion } from "../lib/zodiac-camera";
import {
  ATLAS_LAYERS,
  atlasId,
  buildAtlas,
  mergeAtlas,
  mergeDiscoveredNodes,
  relationshipLabel,
  type AtlasEdge,
  type AtlasKind,
  type AtlasNode,
} from "../lib/knowledge-atlas";
import {
  createAtlasScene,
  type AtlasScene,
} from "../lib/knowledge-atlas-scene";
import type { ConstellationConcept } from "../lib/zodiac-types";
import { useSpaceNavigation } from "../lib/space-navigation";
import "./knowledge-atlas.css";

const layerNames: Record<AtlasKind, string> = {
  domain: "Domains",
  concept: "Concepts",
  source: "Sources",
  extraction: "Extractions",
  hypothesis: "Hypotheses",
  recipe: "Recipes",
};
const destinations: Partial<Record<AtlasKind, string>> = {
  source: "/display",
  extraction: "/display",
  hypothesis: "/hypotheses",
  recipe: "/recipes",
};

function AtlasMark(props: { kind: AtlasKind }) {
  return (
    <svg
      class="atlas-mark"
      data-kind={props.kind}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.3"
      aria-hidden="true"
    >
      <Show when={props.kind === "source" || props.kind === "domain"}>
        <circle cx="10" cy="10" r="5" />
        <Show when={props.kind === "domain"}>
          <ellipse
            cx="10"
            cy="10"
            rx="9"
            ry="3"
            transform="rotate(-35 10 10)"
          />
        </Show>
      </Show>
      <Show when={props.kind === "concept" || props.kind === "hypothesis"}>
        <path d="M10 2 17 10 10 18 3 10Z" />
        <Show when={props.kind === "concept"}>
          <path d="M10 2v16M3 10h14" />
        </Show>
      </Show>
      <Show when={props.kind === "extraction"}>
        <path d="m10 3 7 13H3Z" />
      </Show>
      <Show when={props.kind === "recipe"}>
        <path d="M4 4h12v12H4Z" />
      </Show>
    </svg>
  );
}

export function Zodiac3D() {
  const domainQueries = SECTORS.map((sector) =>
    createQueryWithStatus(api.graph.getConceptsForDomain, () => ({
      domain: sector.id,
      limit: 24,
    })),
  );
  const concepts = createMemo(() => [
    ...new Map(
      domainQueries
        .flatMap((q, index) =>
          ((q.data() ?? []) as ConstellationConcept[]).map((concept) => ({
            ...concept,
            sector: concept.domain === "general" ? "music" : SECTORS[index].id,
          })),
        )
        .map((node) => [node._id, node]),
    ).values(),
  ]);
  const edgesQ = createQueryWithStatus(api.graph.getConceptEdges, () =>
    concepts().length
      ? { conceptNames: concepts().map((node) => node.name) }
      : "skip",
  );
  const itemsQ = createQueryWithStatus(api.dashboard.pipelineItems);
  const [selected, setSelected] = createSignal<AtlasNode | null>(null);
  const [history, setHistory] = createSignal<AtlasNode[]>([]);
  const navigation = useSpaceNavigation();
  const [drawerOpen, setDrawerOpen] = createSignal(false);
  const [layers, setLayers] = createSignal(
    new Set<AtlasKind>([...ATLAS_LAYERS, "domain"]),
  );
  const [connections, setConnections] = createSignal(true);
  const [rotating, setRotating] = createSignal(false);
  const [flat, setFlat] = createSignal(false);
  const [reduced, setReduced] = createSignal(prefersReducedMotion());
  const [unavailable, setUnavailable] = createSignal(false);
  const [ready, setReady] = createSignal(false);
  const [retry, setRetry] = createSignal(0);
  const detailQ = createQueryWithStatus(api.graph.getConceptDetail, () => {
    retry();
    const node = selected();
    return node?.kind === "concept"
      ? { conceptId: node.recordId as Id<"concepts"> }
      : "skip";
  });
  const relationsQ = createQueryWithStatus(api.dashboard.itemRelations, () => {
    retry();
    const node = selected();
    return node && node.kind !== "concept" && node.kind !== "domain"
      ? { itemId: node.recordId, itemType: node.kind }
      : "skip";
  });
  const baseGraph = createMemo(() =>
    buildAtlas(concepts(), edgesQ.data() ?? [], itemsQ.data()),
  );
  // Keep previously visited records so Back remains meaningful outside the initial sample.
  const [discovered, setDiscovered] = createSignal<AtlasNode[]>([]);
  const [discoveredEdges, setDiscoveredEdges] = createSignal<AtlasEdge[]>([]);
  createEffect(() => {
    const detail = detailQ.data();
    const relations = relationsQ.data();
    // Selection can change before the query effects clear the previous result.
    // Only query updates may add discoveries to the currently selected node.
    const node = untrack(selected);
    if (!node) return;
    const additions: AtlasNode[] = [];
    const links: AtlasEdge[] = [];
    if (node.kind === "concept" && detail?.concept._id === node.recordId) {
      for (const [kind, records] of [
        ["source", detail.linkedSources],
        ["hypothesis", detail.linkedHypotheses],
        ["recipe", detail.linkedRecipes],
      ] as const) {
        for (const record of records) {
          const id = atlasId(kind, record._id);
          additions.push({
            id,
            recordId: record._id,
            kind,
            title: record.title ?? "Untitled source",
            status: record.status,
          });
          links.push({ from: node.id, to: id, label: "linked research" });
        }
      }
    } else if (node.kind !== "domain" && node.kind !== "concept") {
      for (const relation of relations ?? []) {
        if (
          !ATLAS_LAYERS.includes(relation.type as (typeof ATLAS_LAYERS)[number])
        )
          continue;
        const id = atlasId(relation.type, relation.id);
        additions.push({
          id,
          recordId: relation.id,
          kind: relation.type as AtlasKind,
          title: relation.title,
        });
        // itemRelations does not return direction, so this is an undirected connection.
        links.push({ from: node.id, to: id, label: relation.relationship });
      }
    }
    if (additions.length) {
      setDiscovered((previous) => mergeDiscoveredNodes(previous, additions));
      setDiscoveredEdges((previous) => [
        ...new Map(
          [...previous, ...links].map((edge) => [JSON.stringify(edge), edge]),
        ).values(),
      ]);
    }
  });
  const graph = createMemo(() =>
    mergeAtlas(baseGraph(), discovered(), discoveredEdges()),
  );
  const related = createMemo(() => {
    const node = selected();
    if (!node || node.kind === "domain") return [];
    const nodes = new Map(graph().nodes.map((item) => [item.id, item]));
    return graph()
      .edges.filter((edge) => edge.from === node.id || edge.to === node.id)
      .map((edge) => ({
        node: nodes.get(edge.from === node.id ? edge.to : edge.from)!,
        label: relationshipLabel(edge, node.id),
      }))
      .filter(
        (item, index, list) =>
          list.findIndex(
            (other) =>
              other.node.id === item.node.id && other.label === item.label,
          ) === index,
      );
  });
  const matchingNodes = createMemo(() => {
    const domain = selected()?.kind === "domain" ? selected()?.domain : null;
    return graph()
      .nodes.filter(
        (node) =>
          node.kind !== "domain" &&
          layers().has(node.kind) &&
          (!domain || node.domain === domain),
      )
      .sort(
        (a, b) =>
          (b.mentions ?? 0) - (a.mentions ?? 0) ||
          a.title.localeCompare(b.title),
      );
  });
  const loading = () =>
    itemsQ.isLoading() || domainQueries.some((query) => query.isLoading());
  const selectedLoading = () =>
    selected()?.kind === "concept"
      ? detailQ.isLoading()
      : relationsQ.isLoading();
  const selectedError = () =>
    selected()?.kind === "concept" ? detailQ.isError() : relationsQ.isError();
  let scene: AtlasScene | undefined;
  let canvas!: HTMLCanvasElement;
  let labels!: HTMLDivElement;
  let inspector!: HTMLElement;
  let returnFocus: HTMLElement | null = null;
  let revealFrame = 0;
  function reveal(destination: "map" | "inspector") {
    setDrawerOpen(destination === "inspector");
    cancelAnimationFrame(revealFrame);
    revealFrame = requestAnimationFrame(() => {
      if (destination === "inspector") {
        const content = inspector.querySelector<HTMLElement>(
          ".atlas-inspector-content",
        );
        if (content) content.scrollTop = 0;
        inspector
          .querySelector<HTMLElement>("h2")
          ?.focus({ preventScroll: true });
      } else canvas.focus({ preventScroll: true });
    });
  }
  function select(node: AtlasNode, remember = true) {
    const active = document.activeElement;
    if (active instanceof HTMLElement && !inspector?.contains(active))
      returnFocus = active;
    const current = selected();
    if (remember && current && current.id !== node.id)
      setHistory((previous) => [...previous, current].slice(-30));
    setSelected(node);
    reveal("inspector");
    // Preserve the wide framing; focus is a deliberate camera action.
  }
  function reset(restoreFocus = true) {
    cancelAnimationFrame(revealFrame);
    if (!restoreFocus && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    } else if (inspector.contains(document.activeElement)) {
      (returnFocus?.isConnected ? returnFocus : canvas).focus({
        preventScroll: true,
      });
    }
    setDrawerOpen(false);
    setSelected(null);
    setHistory([]);
    scene?.reset(flat());
  }
  function back() {
    const previous = history().at(-1);
    if (!previous) {
      reset();
      return;
    }
    setHistory((items) => items.slice(0, -1));
    setSelected(previous);
    reveal("inspector");
  }
  function toggleLayer(kind: AtlasKind) {
    setLayers((previous) => {
      const next = new Set(previous);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }
  function toggleRotation() {
    const next = !rotating();
    setRotating(next);
    scene?.rotate(next);
  }
  onMount(() => {
    document.title = "Knowledge atlas · Frequency Music";
    const clearOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing || event.defaultPrevented)
        return;
      event.preventDefault();
      reset(false);
    };
    window.addEventListener("keydown", clearOnEscape);
    const stopMotion = watchReducedMotion((value) => {
      setReduced(value);
      if (value) setRotating(false);
    });
    try {
      scene = createAtlasScene(canvas, labels, select, () => {
        setUnavailable(true);
        setRotating(false);
        scene?.dispose();
        scene = undefined;
      });
      setReady(true);
    } catch (error) {
      console.error("Knowledge atlas renderer unavailable", error);
      setUnavailable(true);
    }
    onCleanup(() => {
      window.removeEventListener("keydown", clearOnEscape);
      cancelAnimationFrame(revealFrame);
      stopMotion();
      scene?.dispose();
    });
  });
  createEffect(() => {
    if (ready()) scene?.update(graph());
  });
  createEffect(() => {
    if (ready())
      scene?.state({
        selected: selected()?.id ?? null,
        layers: layers(),
        connections: connections(),
        query: "",
      });
  });
  createEffect(() => {
    if (ready()) scene?.enabled(!unavailable());
  });

  createEffect(() => {
    const node = navigation.pending();
    if (!node) return;
    untrack(() => {
      setDiscovered((nodes) => mergeDiscoveredNodes(nodes, [node]));
      setLayers((previous) => new Set([...previous, node.kind]));
      select(node);
      navigation.select(null);
    });
  });

  return (
    <div
      class="knowledge-atlas"
      style={{
        "--atlas-void": COLORS.void,
        "--atlas-gold": COLORS.gold,
        "--atlas-cream": COLORS.cream,
        "--atlas-violet": COLORS.violetText,
        "--atlas-raised": COLORS.glowInner,
      }}
    >
      <div class="atlas-workbench">
        <section class="atlas-map" aria-label="Knowledge space">
          <div
            class="atlas-stage"
            classList={{ "is-unavailable": unavailable() }}
          >
            <canvas
              ref={(element) => {
                canvas = element;
              }}
              class="atlas-canvas"
              role="img"
              tabindex="0"
              aria-label="3D knowledge atlas. Drag to orbit, scroll to zoom. Use the top-bar search for keyboard access."
              aria-hidden={unavailable()}
            />
            <div
              ref={(element) => {
                labels = element;
              }}
              class="atlas-labels"
              aria-hidden={unavailable()}
            />
            <Show when={unavailable()}>
              <div class="atlas-unavailable" role="status">
                <p>
                  3D is unavailable in this browser. Use the search in the top
                  bar to explore concepts and research.
                </p>
              </div>
            </Show>
            <Show when={!unavailable()}>
              <div
                class="atlas-camera"
                role="group"
                aria-label="Camera controls"
              >
                <button
                  type="button"
                  title="Zoom in"
                  aria-label="Zoom in"
                  onClick={() => scene?.zoom(0.8)}
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.4"
                    aria-hidden="true"
                  >
                    <path d="M4 10h12M10 4v12" />
                  </svg>
                </button>
                <button
                  type="button"
                  title="Zoom out"
                  aria-label="Zoom out"
                  onClick={() => scene?.zoom(1.25)}
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.4"
                    aria-hidden="true"
                  >
                    <path d="M4 10h12" />
                  </svg>
                </button>
                <button type="button" onClick={() => scene?.reset(flat())}>
                  Reset view
                </button>
                <button
                  type="button"
                  aria-pressed={flat()}
                  onClick={() => {
                    setFlat(!flat());
                    scene?.reset(flat());
                  }}
                >
                  Top view
                </button>
                <button
                  type="button"
                  disabled={reduced()}
                  aria-pressed={rotating()}
                  onClick={toggleRotation}
                >
                  {rotating() ? "Pause rotation" : "Rotate"}
                </button>
              </div>
              <div class="atlas-gesture-hint">
                Drag to orbit <span>·</span> Scroll to zoom <span>·</span>{" "}
                Select to trace
              </div>
            </Show>
          </div>
          <div class="atlas-layer-bar">
            <span class="atlas-control-label">Layers</span>
            <For each={ATLAS_LAYERS}>
              {(kind) => (
                <button
                  type="button"
                  aria-pressed={layers().has(kind)}
                  onClick={() => toggleLayer(kind)}
                >
                  <AtlasMark kind={kind} />
                  {layerNames[kind]}
                </button>
              )}
            </For>
            <button
              type="button"
              class="atlas-connections-toggle"
              aria-pressed={connections()}
              onClick={() => setConnections(!connections())}
            >
              Connections {connections() ? "on" : "off"}
            </button>
          </div>
        </section>
        <aside
          ref={(element) => {
            inspector = element;
          }}
          class="atlas-inspector"
          classList={{ "is-open": drawerOpen() }}
          inert={!drawerOpen()}
          aria-hidden={!drawerOpen()}
          aria-label="Connection inspector"
        >
          <Show when={selected()}>
            {(node) => (
              <>
                <div class="atlas-inspector-content">
                  <div class="atlas-selection">
                    <h2 tabindex="-1">{node().title}</h2>
                    <div class="atlas-selection-kind">
                      <AtlasMark kind={node().kind} />
                      {node().kind}
                      <Show when={node().status}>
                        <span class="atlas-record-status">
                          {" "}
                          · {node().status?.replaceAll("_", " ")}
                        </span>
                      </Show>
                    </div>
                    <Show when={node().mentions !== undefined}>
                      <p class="atlas-meta">
                        {node().mentions} mentions in the research
                      </p>
                    </Show>
                    <Show when={node().kind === "domain"}>
                      <p>
                        {
                          SECTORS.find((sector) => sector.id === node().domain)
                            ?.summary
                        }
                      </p>
                    </Show>
                    <Show
                      when={
                        node().kind === "concept" &&
                        detailQ.data()?.concept.description
                      }
                    >
                      <p>{detailQ.data()?.concept.description}</p>
                    </Show>
                    <div class="atlas-selection-actions">
                      <button
                        type="button"
                        class="atlas-primary"
                        disabled={unavailable()}
                        onClick={() => {
                          scene?.focus(node().id);
                          reveal("map");
                        }}
                      >
                        Focus in space
                      </button>
                      <Show when={destinations[node().kind]}>
                        {(href) => (
                          <a href={href()}>
                            Open {layerNames[node().kind].toLowerCase()}
                          </a>
                        )}
                      </Show>
                    </div>
                  </div>
                  <Show
                    when={node().kind === "domain"}
                    fallback={
                      <div class="atlas-relations">
                        <div class="atlas-section-title">
                          <h3>Connected research</h3>
                          <span>{related().length}</span>
                        </div>
                        <Show when={selectedError()}>
                          <p role="alert" class="atlas-message">
                            Connections could not load.{" "}
                            <button
                              type="button"
                              class="atlas-text-button"
                              onClick={() => setRetry((value) => value + 1)}
                            >
                              Retry
                            </button>
                          </p>
                        </Show>
                        <Show when={selectedLoading()}>
                          <p class="atlas-message" role="status">
                            Loading connections…
                          </p>
                        </Show>
                        <Show
                          when={
                            !selectedLoading() &&
                            !selectedError() &&
                            !related().length
                          }
                        >
                          <p class="atlas-message">
                            No connections were returned for this object in the
                            loaded graph. Other research may exist outside this
                            sample.
                          </p>
                        </Show>
                        <For each={related()}>
                          {(relation) => (
                            <button
                              type="button"
                              class="atlas-relation"
                              onClick={() => select(relation.node)}
                            >
                              <AtlasMark kind={relation.node.kind} />
                              <span class="atlas-relation-body">
                                <span class="atlas-relation-title">
                                  {relation.node.title}
                                </span>
                                <span class="atlas-relation-meta">
                                  <small>{relation.node.kind}</small>
                                  <span aria-hidden="true">·</span>
                                  <span class="atlas-relation-label">
                                    {relation.label.replaceAll("_", " ")}
                                  </span>
                                </span>
                              </span>
                            </button>
                          )}
                        </For>
                      </div>
                    }
                  >
                    <div class="atlas-relations">
                      <div class="atlas-section-title">
                        <h3>Concepts in this domain</h3>
                        <span>{matchingNodes().length}</span>
                      </div>
                      <For each={matchingNodes()}>
                        {(concept) => (
                          <button
                            type="button"
                            class="atlas-relation"
                            onClick={() => select(concept)}
                          >
                            <AtlasMark kind="concept" />
                            <span class="atlas-relation-body">
                              <span class="atlas-relation-title">
                                {concept.title}
                              </span>
                              <small>{concept.mentions} mentions</small>
                            </span>
                          </button>
                        )}
                      </For>
                      <Show when={!matchingNodes().length}>
                        <p class="atlas-message">
                          {loading()
                            ? "Loading concepts…"
                            : "No concepts in the current sample. Check the Concepts layer or explore another domain."}
                        </p>
                      </Show>
                    </div>
                  </Show>
                </div>
                <footer class="atlas-inspector-footer">
                  <button type="button" class="atlas-back" onClick={back}>
                    {history().length
                      ? "Back to previous object"
                      : "Back to overview"}
                  </button>
                </footer>
              </>
            )}
          </Show>
        </aside>
      </div>
    </div>
  );
}
