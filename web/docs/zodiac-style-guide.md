# ZODIAC Style & Aesthetics System

## Single Source of Truth — Illuminated Astrolabe Knowledge Graph

---

## Context

The ZODIAC design distills the frequency-music project's aesthetic into an astronomical astrolabe metaphor: a dark cosmic disc divided into six domain sectors, where knowledge accumulates as glowing scatter-dots orbiting a central hub, pipeline stages as inner concentric dashed rings, and arc-curved labels burned along sector boundaries like text on a medieval instrument. This document extracts that visual DNA as a reusable system and extends it into a Three.js 3D implementation where the full connection graph can be explored spatially.

**2D Source:** `web/src/routes/design3.tsx`
**3D Route:** `web/src/routes/zodiac-3d.tsx`
**3D Libs:** `web/src/lib/zodiac-*.ts`

---

## 1. Design Philosophy

**Name:** *Illuminated Astrolabe*

The ZODIAC is neither a chart nor a graph — it is an instrument. Medieval astrolabes were precision tools for navigating the cosmos; this design treats a knowledge graph with the same gravity. Every visual decision follows from three principles:

1. **The Void is primary** — Deep indigo space (`#0d0620`) is not empty background but active negative space. Information emerges from it rather than sitting on top of it.
2. **Gold is discovery** — Antique gold (`#c8a84b`) marks things that have been found, confirmed, or connected. It is the color of the pipeline: sources → extraction → hypothesis → recipe.
3. **Opacity encodes certainty** — Opacity is not decoration; it communicates epistemic state. Resting elements are at 18–38% opacity. Engaged elements rise to 75–95%. The full 100% is reserved for selected/hub states only.

---

## 2. Color System

### Primary Palette

| Token | Hex | Role |
|---|---|---|
| `void` | `#0d0620` | Background, deep space canvas |
| `gold` | `#c8a84b` | Primary accent — pipeline, connections, hub, tick marks |
| `violet` | `#8b5cf6` | Secondary — hypothesis domains, speculation, inner rings |
| `cream` | `#f5f0e8` | Tertiary — established knowledge domains, body text |
| `glow-inner` | `#1a0f35` | Radial gradient inner glow (slightly lighter void) |

### Domain Color Assignments

| Domain | Color Token | Hex |
|---|---|---|
| Mathematics | `violet` | `#8b5cf6` |
| Wave Physics | `gold` | `#c8a84b` |
| Music Theory | `cream` | `#f5f0e8` |
| Psychoacoustics | `violet` | `#8b5cf6` |
| Geometry | `gold` | `#c8a84b` |
| Synthesis | `cream` | `#f5f0e8` |

*Pattern: violet for the speculative/mathematical, gold for the physical/structural, cream for the practiced/compositional.*

### Opacity Scale

Opacity communicates state, not style. These are the semantic vocabulary:

| State | Opacity | Applied to |
|---|---|---|
| Background dot grid | 0.022 | Radial-gradient dot pattern |
| Pipeline rings | 0.22 | Dashed concentric inner rings |
| Sector fill (resting) | 0.03 | Sector ring-arc fill |
| Sector arcs (resting) | 0.30–0.38 | Inner and outer arc strokes |
| Spoke lines (resting) | 0.22 | Radial sector boundary lines |
| Source dots (pulse low) | 0.40 | Pulsing scatter dots (trough) |
| Arc labels (resting) | 0.58 | Curved domain name text |
| Tick marks (minor) | 0.18 | 5° degree marks |
| Tick marks (major) | 0.45 | 30° degree marks |
| Ring labels | 0.38 | SOURCES/EXTRACT/etc. text |
| Sector fill (active) | 0.10 | Sector ring-arc fill on hover/select |
| Sector arcs (active) | 0.75–0.85 | Arc strokes on hover/select |
| Arc labels (active) | 1.00 | Curved text on hover/select |
| Source dots (pulse high) | 0.90 | Pulsing scatter dots (peak) |
| Hub dot | 0.90 | Center gold circle |
| Hub outer ring | 0.88 | Outer hub circle |

---

## 3. Typography

**Primary typeface:** `'Cormorant Garamond', Georgia, serif`
*Used for all labels, panel text, arc labels, and micro-typography.*

### Type Scale

| Use | Size | Weight | Letter-spacing | Case |
|---|---|---|---|---|
| Panel title | 34px | 300 (light) | default | mixed |
| Panel em highlight | 34px | 300 | default | italic |
| Domain label (panel) | 22px | 300 | default | title |
| Panel body | 13px | 300 | default | sentence |
| Domain list items | 12.5px | 400 | default | title |
| Panel subheads | 12.5px | 400 | default | sentence |
| Sector arc labels | 10.5px | 400 | 0.20em | **ALL CAPS** |
| Source count (midpoint) | 9.5px | 400 | default | numeric |
| Micro section labels | 9px | 400 | 0.40em | **ALL CAPS** |
| Hub label | 9px | 400 | 0.28em | **ALL CAPS** |
| Ring labels | 7px | 400 | 0.18em | **ALL CAPS** |
| Pipeline codes | 7.5px | 400 | 0.20em | **ALL CAPS** |

### Typographic Rules

- Section labels always use the `∴` prefix or letter-spacing 0.3–0.4em with color at 30–40% opacity
- Italic `<em>` in panel titles always inherits gold `#c8a84b`
- Arc labels use `startOffset="50%" text-anchor="middle"` for centration
- Bottom-half sectors reverse arc direction so text always reads left-to-right

---

## 4. Spatial Architecture — Ring Radii

All measurements are in SVG units within an 800×800 viewBox centered at (400, 400).
In Three.js these map 1:1, centered at origin (0, 0, 0).

```text
r=6    — Hub gold dot (center)
r=22   — Hub violet dashed inner ring
r=36   — Hub outer boundary circle (gold stroke)
r=50   — Hub label position (below center at y+50)

r=58   — RECIPE pipeline ring (innermost dashed)
r=92   — HYPOTHESIS pipeline ring
r=128  — EXTRACT pipeline ring
r=160  — SOURCES pipeline ring (outermost dashed)

r=175  — Inner sector boundary (sector arc starts here)
r=220  — Arc label radius (textPath arcs drawn here)
r=246  — Source count badge position (active sectors)
r=265  — Outer sector boundary (sector arc ends here)

r=268  — Outer double-ring (thin, 0.3px)
r=280  — Outer double-ring (primary, 0.6px)

r=282–315  — Source scatter dot zone (just outside outer ring)
             Dots placed at specific (angleRel, r) within sector
```

### Sector Geometry

```text
6 sectors, each spanning 60° (π/3 radians)
Starting angle: -π/2 (top / 12 o'clock)
Rotation: clockwise

Sector fill:    ring-arc from r=175 to r=265
Inner arc:      r=175, stroke 0.6px idle → 1.2px active
Outer arc:      r=265, stroke 0.8px idle → 1.8px active
Radial spoke:   drawn only at sector start angle, r=175 to r=265
```

### Tick Marks (Astrolabe Degree Ring)

```text
72 total marks at every 5° (0°, 5°, 10° ... 355°)
Minor ticks (non-30°): r1=269 → r2=280, 0.4px, opacity 0.18
Major ticks (every 30°): r1=266 → r2=280, 0.9px, opacity 0.45
All ticks: stroke color #c8a84b
```

---

## 5. Node Taxonomy

Four node types exist in the system:

| Node Type | Shape | Size | Z-position (3D) | Color |
|---|---|---|---|---|
| **Hub** | Circle + center dot | r=36 outer / r=6 dot | Z=0 | `#c8a84b` gold |
| **Domain** | Arc-bounded sector | r=175–265 | Z=0 | Per-domain color |
| **Source** | Circle scatter dot | r=3.2 | Z=30–60 (above disc) | Per-domain color |
| **Pipeline stage** | Dashed ring | r=58–160 | Z=-10 to Z=-40 (below disc) | Alternating gold/violet |

### Source Dot Placement

Each source dot is positioned within its sector using a polar coordinate:

```text
angle = sector.startAngle + dot.angleRel × (sector.endAngle - sector.startAngle)
x = cx + dot.r × cos(angle)
y = cy + dot.r × sin(angle)
```

`dot.r` ranges 282–315 (outside the outer boundary ring).
`dot.angleRel` ranges 0.18–0.85 (distributes dots across the sector width).

---

## 6. Animation System

### Source Dot Pulse

```css
@keyframes z3-pulse {
  0%, 100% { opacity: 0.40 }
  50%       { opacity: 0.90 }
}
.z3-dot {
  animation: z3-pulse ease-in-out infinite alternate;
}
```

**Duration:** `2.0 + (dotIndex × 0.5) + (sectorIndex × 0.1)` seconds
**Delay:** `(dotIndex × 0.35) + (sectorIndex × 0.2)` seconds
*Staggered so no two dots pulse identically — creates organic breathing.*

### Transition Timing

```text
Sector hover/select state changes: transition: all 0.25s ease
Opacity changes on labels: transition: opacity 0.25s ease
```

### Interaction States

```text
Resting:  sector fill 3%, arcs 30-38%, labels 58%
Hovered:  sector fill 10%, arcs 75-85%, outer arc gets z3-sm glow filter
Selected: same as Hovered — persists after mouse leaves
Active:   isHovered OR isSelected
```

---

## 7. Glow Filters

Two SVG blur-merge filters define the glow vocabulary:

```xml
<filter id="z3-glow">    <!-- Primary: hub, large nodes -->
  <feGaussianBlur stdDeviation="5" result="b"/>
  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>

<filter id="z3-sm">      <!-- Subtle: sector outer arcs on hover, source dots -->
  <feGaussianBlur stdDeviation="2.5" result="b"/>
  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
```

*Rule: `z3-glow` (σ=5) for hub and permanent glow elements. `z3-sm` (σ=2.5) for interaction-triggered glow on hover/select only.*

---

## 8. Background Texture

```css
background-image: radial-gradient(circle, #c8a84b 1px, transparent 1px);
background-size: 52px 52px;
opacity: 0.022;
```

This dot grid is the "parchment grain" of the indigo void. It must be `pointer-events: none` and `position: fixed` so it never affects layout.

---

## 9. Panel System (Right Sidebar)

```
Width:      355px
Background: #0d0620 (same as canvas)
Border:     1px solid rgba(200,168,75,0.12) on left edge
Overflow:   scroll-y
```

**Section separators:** `1px solid rgba(200,168,75,0.10)`

### Panel Sections (top to bottom)

1. **Header** — `padding: 36px 26px 20px`
   - Micro label: 9px, letter-spacing 0.4em, gold 40% opacity, `∴` prefix
   - Title: 34px, weight 300, italic em in gold
   - Subtitle: 13px, weight 300, cream 38% opacity

2. **Selected domain detail** — `padding: 22px 26px`
   - Domain ID in domain color at 75% opacity, 9px, letter-spacing 0.35em
   - Domain name: 22px, domain color, weight 300
   - Summary: 12.5px, cream 42% opacity, line-height 1.65
   - Stats cards: two columns, `padding: 10px`, bordered in domain color at 18% opacity

3. **Domain list** — `padding: 16px 26px`
   - Each item: flex row, 7px 9px padding, 1px border, 12.5px label
   - Active border: `domain.color + '55'`
   - Active background: `rgba(200,168,75,0.05)`
   - Inactive border: `rgba(200,168,75,0.10)`

4. **Pipeline summary** — `padding: 14px 26px 24px`
   - Chain: SRC → EXT → HYP → REC
   - Values: 15px, `#c8a84b`
   - Codes: 7.5px, letter-spacing 0.2em, cream 25% opacity
   - Separator arrow: 9px, gold 25% opacity

---

## 10. Three.js Implementation Architecture

### Concept: From 2D Disc to 3D Orrery

The 2D astrolabe becomes a **suspended 3D orrery** — a mechanical model of the research cosmos. The Z-axis encodes information depth:

```
Z = +60 to +30   Source sphere nodes floating above the disc
Z =   0          The astrolabe disc plane (hub, sectors, tick ring)
Z = -10 to -40   Pipeline infrastructure rings below the disc
```

### Coordinate System

SVG units map 1:1 to Three.js world units. SVG was 800×800 centered at (400,400); Three.js centers at origin. Y-axis is flipped (SVG Y increases downward, Three.js Y increases upward):

```
SVG (400,400) → Three.js (0, 0, 0)
SVG angle θ   → Three.js: x = r·cos(θ), y = -r·sin(θ)
```

### Scene Setup

```typescript
scene.background = new THREE.Color('#0d0620')
scene.fog = new THREE.FogExp2('#0d0620', 0.0008)

camera.position.set(0, -120, 520)  // slightly below and in front

// Post-processing: RenderPass → UnrealBloomPass
UnrealBloomPass: strength=1.2, radius=0.6, threshold=0.3
```

### 3D Edge Types

| Edge | Geometry | Z control |
|---|---|---|
| Hub → Domain | Straight Line | Z=0 |
| Domain → Source | QuadraticBezierCurve3, control point Z=80 | Arcs upward |
| Source → Claim | Dashed Line2 (zoom-unlocked) | Z=50–80 |

### OrbitControls Defaults

```typescript
controls.autoRotate = true
controls.autoRotateSpeed = 0.15   // slow drift
controls.minDistance = 200
controls.maxDistance = 1200
controls.maxPolarAngle = Math.PI * 0.72  // don't go under disc
```

### CSS3DRenderer for Labels

Domain arc labels use CSS3DObject positioned at r=220, Z=5, rotated tangent to the arc. This preserves Cormorant Garamond rendering quality without GPU text atlasing. CSS3DRenderer canvas is layered over WebGLRenderer canvas with `pointer-events: none`.

---

## 11. File Structure

```
web/
├── docs/
│   └── zodiac-style-guide.md     ← THIS DOCUMENT
│
└── src/
    ├── routes/
    │   └── zodiac-3d.tsx         ← Default route / — SolidJS component
    │
    └── lib/
        ├── zodiac-data.ts        ← Types, constants, sector/pipeline data
        ├── zodiac-materials.ts   ← Three.js material factory functions
        ├── zodiac-geometry.ts    ← Geometry builders (disc, sectors, nodes)
        ├── zodiac-edges.ts       ← Edge/connection curve generation
        ├── zodiac-camera.ts      ← OrbitControls, focus animation
        └── zodiac-scene.ts       ← Scene init, renderer, animation loop
```

---

## 12. Verification

```bash
# Confirm style guide
cat web/docs/zodiac-style-guide.md

# Build check
cd web && bun run build   # 0 errors

# Dev server
cd web && bun run dev     # navigate to /
```

Visual checklist:
- [ ] Deep indigo void background with faint dot grid
- [ ] 6 sector arcs glow in domain colors on hover
- [ ] Source spheres float above the disc plane
- [ ] Pipeline rings visible below disc at oblique camera angles
- [ ] Bloom post-processing creates soft glow around hub and active nodes
- [ ] OrbitControls allow free 3D exploration
- [ ] Clicking a sector tweens camera to face that sector
- [ ] Right HTML panel updates on sector click (same as 2D ZODIAC)
- [ ] Cormorant Garamond arc labels readable from default camera position
