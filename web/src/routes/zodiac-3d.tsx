// Design 6: ZODIAC 3D — Illuminated Astrolabe Knowledge Orrery
// Three.js 3D implementation of the ZODIAC design with live Convex metrics.

import { useNavigate } from "@tanstack/solid-router";
import {
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { createQuery } from "../integrations/convex";
import { convexApi } from "../integrations/convex/api";
import { SECTORS } from "../lib/zodiac-data";
import { initZodiacScene } from "../lib/zodiac-scene";

const sectorRouteMap: Record<string, string> = {
  math: "/display",
  wave: "/ingest",
  music: "/recipes",
  psycho: "/hypotheses",
  geometry: "/weekly-turns",
  synthesis: "/compositions",
};

type SectorMetricRow = {
  id: string;
  sources: number;
  claims: number;
};

export function Zodiac3D() {
  const navigate = useNavigate();
  const [selSector, setSelSector] = createSignal<string>("math");

  const sectorMetrics = createQuery(convexApi.dashboard.zodiacSectors, () => ({
    limit: 200,
  }));
  const pipeline = createQuery(convexApi.dashboard.pipeline);

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

  let canvasRef!: HTMLCanvasElement;
  let cssContainerRef!: HTMLDivElement;
  let sceneHandle: ReturnType<typeof initZodiacScene> | null = null;

  onMount(() => {
    sceneHandle = initZodiacScene(canvasRef, cssContainerRef, (id) => {
      setSelSector(id);
    });
  });

  onCleanup(() => {
    sceneHandle?.cleanup();
  });

  function handleSectorSelect(id: string) {
    setSelSector(id);
    sceneHandle?.setActiveSector(id);
  }

  function handleSectorHover(id: string | null) {
    sceneHandle?.setActiveSector(id ?? selSector());
  }

  function openDomainWorkspace() {
    const destination = sectorRouteMap[selSector()] ?? "/display";
    navigate({ to: destination });
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
            Drag to orbit. Click a sector to focus. Open the selected workspace
            to drill directly into that domain flow.
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
      </div>
    </div>
  );
}
