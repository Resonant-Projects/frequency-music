// Design 6: ZODIAC 3D — Illuminated Astrolabe Knowledge Orrery
// Three.js 3D implementation of the ZODIAC design.
// Same panel system as design3.tsx, with the SVG astrolabe replaced by a 3D scene.

import { createSignal, onMount, onCleanup, For } from 'solid-js'
import { SECTORS } from '../lib/zodiac-data'
import { initZodiacScene } from '../lib/zodiac-scene'

export function Zodiac3D() {
  const [hovSector, setHovSector] = createSignal<string | null>(null)
  const [selSector, setSelSector] = createSignal<string>('math')

  const activeSector = () => SECTORS.find((s) => s.id === selSector()) ?? SECTORS[0]

  let canvasRef!: HTMLCanvasElement
  let cssContainerRef!: HTMLDivElement
  let sceneHandle: ReturnType<typeof initZodiacScene> | null = null

  onMount(() => {
    sceneHandle = initZodiacScene(canvasRef, cssContainerRef, (id) => {
      setSelSector(id)
      setHovSector(null)
    })
  })

  onCleanup(() => {
    sceneHandle?.cleanup()
  })

  function handleSectorSelect(id: string) {
    setSelSector(id)
    sceneHandle?.setActiveSector(id)
  }

  function handleSectorHover(id: string | null) {
    setHovSector(id)
    sceneHandle?.setActiveSector(id ?? selSector())
  }

  return (
    <div style="min-height:100vh;background:#0d0620;color:#f5f0e8;overflow:hidden;font-family:'Cormorant Garamond',Georgia,serif;display:flex">
      {/* Background dot grid (same as 2D) */}
      <div style="position:fixed;inset:0;pointer-events:none;opacity:0.022;background-image:radial-gradient(circle,#c8a84b 1px,transparent 1px);background-size:52px 52px" />

      {/* Left: Three.js canvas container */}
      <div
        ref={cssContainerRef!}
        style="flex:1;position:relative;overflow:hidden;min-width:0"
      >
        <canvas
          ref={canvasRef!}
          style="width:100%;height:100%;display:block"
        />
      </div>

      {/* Right: Content panel — identical to design3.tsx */}
      <div style="width:355px;display:flex;flex-direction:column;border-left:1px solid rgba(200,168,75,0.12);overflow-y:auto;flex-shrink:0">
        {/* Header */}
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
            Drag to orbit. Click a sector to focus. The Z-axis encodes information depth.
          </p>
        </div>

        {/* Selected sector detail */}
        <div style="padding:22px 26px;flex:1;border-bottom:1px solid rgba(200,168,75,0.1)">
          <div style={`font-size:9px;letter-spacing:0.35em;margin-bottom:10px;color:${activeSector().color};opacity:0.75`}>
            {activeSector().id.toUpperCase()} DOMAIN
          </div>
          <div style={`font-size:22px;color:${activeSector().color};margin-bottom:8px;font-weight:300`}>
            {activeSector().label}
          </div>
          <p style="font-size:12.5px;line-height:1.65;color:rgba(245,240,232,0.42);margin:0 0 18px">
            {activeSector().summary}
          </p>
          <div style="display:flex;gap:12px;margin-bottom:0">
            <div style="flex:1;padding:10px;border:1px solid rgba(200,168,75,0.18);text-align:center">
              <div style="font-size:26px;color:#c8a84b">{activeSector().sources}</div>
              <div style="font-size:8px;letter-spacing:0.25em;color:rgba(245,240,232,0.28);margin-top:2px">SOURCES</div>
            </div>
            <div style="flex:1;padding:10px;border:1px solid rgba(139,92,246,0.18);text-align:center">
              <div style="font-size:26px;color:#8b5cf6">{activeSector().claims}</div>
              <div style="font-size:8px;letter-spacing:0.25em;color:rgba(245,240,232,0.28);margin-top:2px">CLAIMS</div>
            </div>
          </div>
        </div>

        {/* Domain list */}
        <div style="padding:16px 26px;flex-shrink:0">
          <div style="font-size:9px;letter-spacing:0.3em;color:rgba(200,168,75,0.3);margin-bottom:10px">
            ALL DOMAINS
          </div>
          <For each={SECTORS}>
            {(s) => (
              <div
                role="button"
                tabIndex={0}
                style={`display:flex;align-items:center;justify-content:space-between;padding:7px 9px;margin-bottom:3px;cursor:pointer;border:1px solid;transition:all 0.2s;border-color:${selSector() === s.id ? `${s.color}55` : 'rgba(200,168,75,0.1)'};background:${selSector() === s.id ? 'rgba(200,168,75,0.05)' : 'transparent'}`}
                onClick={() => handleSectorSelect(s.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSectorSelect(s.id) }}
                onMouseEnter={() => handleSectorHover(s.id)}
                onMouseLeave={() => handleSectorHover(null)}
              >
                <div style={`font-size:12.5px;color:${s.color};opacity:${selSector() === s.id ? 1 : 0.58}`}>
                  {s.label}
                </div>
                <div style="font-size:10px;color:rgba(245,240,232,0.28)">{s.sources} src</div>
              </div>
            )}
          </For>
        </div>

        {/* Pipeline summary */}
        <div style="padding:14px 26px 24px;border-top:1px solid rgba(200,168,75,0.1)">
          <div style="font-size:9px;letter-spacing:0.3em;color:rgba(200,168,75,0.3);margin-bottom:8px">PIPELINE</div>
          <div style="display:flex;align-items:center;gap:5px">
            {/* Static pipeline totals — update from Convex when live data available */}
            {[
              { label: 'SRC', value: 47 }, { label: 'EXT', value: 23 },
              { label: 'HYP', value: 8  }, { label: 'REC', value: 3  },
            ].map((item, i, arr) => (
              <>
                <div style="text-align:center">
                  <div style="font-size:15px;color:#c8a84b">{item.value}</div>
                  <div style="font-size:7.5px;letter-spacing:0.2em;color:rgba(245,240,232,0.25)">{item.label}</div>
                </div>
                {i < arr.length - 1 && <div style="font-size:9px;color:rgba(200,168,75,0.25);margin-bottom:8px">→</div>}
              </>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
