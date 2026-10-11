import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { COLORS, SECTORS } from "./zodiac-data";
import { prefersReducedMotion, watchReducedMotion } from "./zodiac-camera";
import {
  atlasPosition,
  connectedIds,
  domainPosition,
  type AtlasGraph,
  type AtlasKind,
  type AtlasNode,
} from "./knowledge-atlas";

export interface AtlasSceneState {
  selected: string | null;
  layers: Set<AtlasKind>;
  connections: boolean;
  query: string;
}
export interface AtlasScene {
  update(graph: AtlasGraph): void;
  state(state: AtlasSceneState): void;
  focus(id: string | null): void;
  reset(flat?: boolean): void;
  zoom(factor: number): void;
  rotate(enabled: boolean): void;
  enabled(value: boolean): void;
  dispose(): void;
}

export function createAtlasScene(
  canvas: HTMLCanvasElement,
  labelRoot: HTMLElement,
  onSelect: (node: AtlasNode) => void,
  onUnavailable: () => void,
): AtlasScene {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(COLORS.void, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(43, 1, 1, 3000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.minDistance = 80;
  controls.maxDistance = 2200;
  controls.maxPolarAngle = Math.PI * 0.85;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.22;
  const light = new THREE.DirectionalLight(COLORS.cream, 3);
  light.position.set(100, 300, 200);
  scene.add(light, new THREE.AmbientLight(COLORS.violetText, 1.4));

  let graph: AtlasGraph = { nodes: [], edges: [] };
  let state: AtlasSceneState = {
    selected: null,
    layers: new Set([
      "domain",
      "concept",
      "source",
      "extraction",
      "hypothesis",
      "recipe",
    ]),
    connections: true,
    query: "",
  };
  let reduced = prefersReducedMotion();
  let disposed = false;
  let visible = true;
  let enabled = true;
  let previousFit = 0;
  let dirty = true;
  let rendering = false;
  let frame = 0;
  let motionFrames = 0;
  let width = 1;
  let height = 1;
  let flat = false;
  let tween: {
    start: number;
    from: THREE.Vector3;
    to: THREE.Vector3;
    targetFrom: THREE.Vector3;
    targetTo: THREE.Vector3;
  } | null = null;
  let hovered: string | null = null;
  const objects = new Map<
    string,
    THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  >();
  const labels = new Map<string, HTMLButtonElement>();
  const points = new Map<string, THREE.Vector3>();
  const edgeObjects: Array<{
    from: string;
    to: string;
    line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  }> = [];
  const content = new THREE.Group();
  scene.add(content);
  const geo = {
    domain: new THREE.IcosahedronGeometry(9, 1),
    concept: new THREE.OctahedronGeometry(3.3),
    source: new THREE.SphereGeometry(2, 8, 6),
    extraction: new THREE.TetrahedronGeometry(2.6),
    hypothesis: new THREE.OctahedronGeometry(4),
    recipe: new THREE.BoxGeometry(4.7, 4.7, 4.7),
  };
  const colors: Record<AtlasKind, string> = {
    domain: COLORS.gold,
    concept: COLORS.cream,
    source: COLORS.gold,
    extraction: COLORS.cream,
    hypothesis: COLORS.violetText,
    recipe: COLORS.goldBright,
  };
  const instrument = new THREE.Group();
  scene.add(instrument);
  function ring(
    radius: number,
    y: number,
    opacity: number,
    color: string = COLORS.gold,
  ) {
    const path = Array.from({ length: 193 }, (_, i) => {
      const a = (i / 192) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius);
    });
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(path),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
    );
    instrument.add(line);
    return line;
  }
  ring(340, -40, 0.3);
  ring(346, -40, 0.12);
  ring(190, -40, 0.14);
  for (let i = 0; i < 120; i++) {
    const angle = (i / 120) * Math.PI * 2;
    const r = i % 10 === 0 ? 331 : 337;
    instrument.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(Math.cos(angle) * r, -40, Math.sin(angle) * r),
          new THREE.Vector3(Math.cos(angle) * 342, -40, Math.sin(angle) * 342),
        ]),
        new THREE.LineBasicMaterial({
          color: COLORS.gold,
          transparent: true,
          opacity: i % 10 === 0 ? 0.5 : 0.2,
        }),
      ),
    );
  }
  for (const sector of SECTORS) {
    const position = new THREE.Vector3(...domainPosition(sector.id));
    const orbit = ring(88, 0, 0.25, sector.color);
    orbit.position.copy(position);
    const halo = ring(92, 0, 0.1, sector.color);
    halo.position.copy(position);
  }
  ring(65, 45, 0.28, COLORS.violetText);
  ring(90, 20, 0.2);
  ring(123, -8, 0.16);
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(13, 0),
    new THREE.MeshStandardMaterial({
      color: COLORS.gold,
      wireframe: true,
      transparent: true,
      opacity: 0.7,
    }),
  );
  core.position.y = 20;
  instrument.add(core);
  const armillary = ring(30, 0, 0.5);
  armillary.position.y = 20;
  armillary.rotation.z = Math.PI / 3;
  const armillary2 = ring(34, 0, 0.25, COLORS.violetText);
  armillary2.position.y = 20;
  armillary2.rotation.x = Math.PI / 3;

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(8, 0.35, 6, 40),
    new THREE.MeshBasicMaterial({ color: COLORS.goldBright, depthTest: false }),
  );
  halo.renderOrder = 10;
  halo.visible = false;
  scene.add(halo);
  const tooltip = document.createElement("div");
  tooltip.className = "atlas-tooltip";
  tooltip.hidden = true;
  labelRoot.append(tooltip);

  function clearContent() {
    for (const mesh of objects.values()) mesh.material.dispose();
    for (const { line } of edgeObjects) {
      line.geometry.dispose();
      line.material.dispose();
    }
    content.clear();
    objects.clear();
    points.clear();
    edgeObjects.length = 0;
    for (const label of labels.values()) label.remove();
    labels.clear();
  }
  function update(next: AtlasGraph) {
    graph = next;
    clearContent();
    for (const node of graph.nodes) {
      const material = new THREE.MeshStandardMaterial({
        color: colors[node.kind],
        emissive: colors[node.kind],
        emissiveIntensity: 0.25,
        roughness: 0.4,
        metalness: 0.45,
        transparent: true,
      });
      const mesh = new THREE.Mesh(geo[node.kind], material);
      mesh.position.set(...atlasPosition(node));
      mesh.userData.id = node.id;
      content.add(mesh);
      objects.set(node.id, mesh);
      points.set(node.id, mesh.position);
      const label = document.createElement("button");
      label.type = "button";
      label.className = `atlas-space-label ${node.kind === "domain" ? "is-domain" : ""}`;
      label.textContent = node.title;
      label.setAttribute("aria-label", `Explore ${node.title}`);
      // Search and domain lists provide a stable keyboard order.
      label.tabIndex = -1;
      label.addEventListener("click", () => onSelect(node));
      labelRoot.append(label);
      labels.set(node.id, label);
    }
    for (const edge of graph.edges) {
      const start = points.get(edge.from);
      const end = points.get(edge.to);
      if (!start || !end) continue;
      const mid = start.clone().lerp(end, 0.5);
      mid.y += Math.min(start.distanceTo(end) * 0.16, 65);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(18)),
        new THREE.LineBasicMaterial({
          color: COLORS.gold,
          transparent: true,
          opacity: 0.12,
        }),
      );
      content.add(line);
      edgeObjects.push({ from: edge.from, to: edge.to, line });
    }
    applyState();
  }
  let emphasized = new Set<string>();
  function applyState() {
    emphasized = connectedIds(graph, state.selected);
    for (const node of graph.nodes) {
      const mesh = objects.get(node.id)!;
      const match =
        !state.query || node.title.toLowerCase().includes(state.query);
      // Selection and its neighbors remain discoverable even with a hidden layer.
      mesh.visible =
        node.kind === "domain" ||
        state.layers.has(node.kind) ||
        emphasized.has(node.id);
      const dim = (state.selected && !emphasized.has(node.id)) || !match;
      mesh.material.opacity = dim ? 0.14 : 1;
      mesh.material.emissiveIntensity =
        node.id === state.selected ? 0.85 : 0.25;
      mesh.scale.setScalar(node.id === state.selected ? 1.65 : 1);
    }
    for (const { line, from, to } of edgeObjects) {
      const active = from === state.selected || to === state.selected;
      line.visible =
        state.connections &&
        !!objects.get(from)?.visible &&
        !!objects.get(to)?.visible;
      line.material.opacity = state.selected ? (active ? 0.85 : 0.025) : 0.13;
      line.material.color.set(active ? COLORS.goldBright : COLORS.violetText);
    }
    const selected = state.selected && points.get(state.selected);
    halo.visible = !!selected;
    if (selected) halo.position.copy(selected);
    invalidate();
  }
  const projected = new THREE.Vector3();
  function renderLabels() {
    const occupied: Array<{ x: number; y: number }> = [];
    const candidates = [...graph.nodes].sort(
      (a, b) =>
        Number(b.id === state.selected) - Number(a.id === state.selected) ||
        Number(b.kind === "domain") - Number(a.kind === "domain") ||
        (b.mentions ?? 0) - (a.mentions ?? 0),
    );
    let count = 0;
    for (const node of candidates) {
      const label = labels.get(node.id)!;
      const mesh = objects.get(node.id)!;
      const eligible =
        node.kind === "domain" ||
        node.id === state.selected ||
        emphasized.has(node.id) ||
        (node.kind === "concept" && !state.selected) ||
        (state.query && node.title.toLowerCase().includes(state.query));
      if (
        !mesh.visible ||
        !eligible ||
        (count > 20 && node.kind !== "domain")
      ) {
        label.hidden = true;
        continue;
      }
      projected.copy(mesh.position).project(camera);
      const x = ((projected.x + 1) / 2) * width;
      const y =
        ((1 - projected.y) / 2) * height + (node.kind === "domain" ? 22 : 12);
      const collision =
        node.kind !== "domain" &&
        node.id !== state.selected &&
        occupied.some((p) => Math.abs(p.x - x) < 135 && Math.abs(p.y - y) < 32);
      label.hidden =
        collision ||
        projected.z > 1 ||
        x < 70 ||
        x > width - 70 ||
        y < 20 ||
        y > height - 32;
      if (label.hidden) continue;
      label.style.transform = `translate(${x}px, ${y}px) translate(-50%, 0)`;
      label.classList.toggle("is-selected", node.id === state.selected);
      label.classList.toggle(
        "is-muted",
        !!state.selected && !emphasized.has(node.id),
      );
      occupied.push({ x, y });
      count++;
    }
  }
  function invalidate() {
    dirty = true;
    if (
      !rendering &&
      !frame &&
      visible &&
      enabled &&
      !document.hidden &&
      !disposed
    )
      frame = requestAnimationFrame(render);
  }
  function render(now: number) {
    frame = 0;
    if (disposed || !visible || !enabled || document.hidden) return;
    rendering = true;
    if (tween) {
      const t = reduced ? 1 : Math.min((now - tween.start) / 650, 1);
      const ease = 1 - (1 - t) ** 3;
      camera.position.lerpVectors(tween.from, tween.to, ease);
      controls.target.lerpVectors(tween.targetFrom, tween.targetTo, ease);
      if (t === 1) tween = null;
      dirty = true;
    }
    const changed = controls.update();
    if (changed || dirty || motionFrames > 0) {
      halo.quaternion.copy(camera.quaternion);
      renderer.render(scene, camera);
      renderLabels();
      dirty = false;
    }
    motionFrames = Math.max(0, motionFrames - 1);
    rendering = false;
    if (tween || controls.autoRotate || changed || motionFrames > 0)
      frame = requestAnimationFrame(render);
  }
  function move(to: THREE.Vector3, target: THREE.Vector3) {
    if (reduced) {
      camera.position.copy(to);
      controls.target.copy(target);
      tween = null;
    } else
      tween = {
        start: performance.now(),
        from: camera.position.clone(),
        to,
        targetFrom: controls.target.clone(),
        targetTo: target,
      };
    invalidate();
  }
  function reset(topDown = false) {
    flat = topDown;
    const distance = fitDistance();
    move(
      new THREE.Vector3(
        0,
        flat ? distance : distance * 0.68,
        flat ? 0.1 : distance * 0.83,
      ),
      new THREE.Vector3(0, 0, 0),
    );
  }
  function fitDistance() {
    return Math.max(
      760,
      400 / (Math.tan(THREE.MathUtils.degToRad(43 / 2)) * (width / height)),
    );
  }
  function resize() {
    width = Math.max(canvas.clientWidth, 1);
    height = Math.max(canvas.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    const fit = fitDistance();
    if (previousFit && !state.selected) {
      tween = null;
      camera.position
        .sub(controls.target)
        .multiplyScalar(fit / previousFit)
        .add(controls.target);
    }
    previousFit = fit;
    invalidate();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();
  camera.position.set(0, 530, 650);
  controls.target.set(0, 0, 0);
  camera.lookAt(controls.target);
  reset();
  const stopMotion = watchReducedMotion((value) => {
    reduced = value;
    if (value) controls.autoRotate = false;
    invalidate();
  });
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) invalidate();
    else {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  });
  observer.observe(canvas);
  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else invalidate();
  };
  document.addEventListener("visibilitychange", onVisibility);
  const onControlChange = () => {
    motionFrames = 2;
    invalidate();
  };
  const onControlStart = () => {
    tween = null;
    tooltip.hidden = true;
  };
  controls.addEventListener("change", onControlChange);
  controls.addEventListener("start", onControlStart);
  let pointerStart = { x: 0, y: 0 };
  let dragging = false;
  function pick(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    // Screen-space picking supplies a usable hit area for tiny research nodes.
    let nearest: AtlasNode | undefined;
    let distance = event.pointerType === "touch" ? 24 : 13;
    for (const node of graph.nodes) {
      const mesh = objects.get(node.id)!;
      if (!mesh.visible || mesh.material.opacity < 0.2) continue;
      projected.copy(mesh.position).project(camera);
      if (projected.z > 1) continue;
      const d = Math.hypot(
        ((projected.x + 1) / 2) * width - (event.clientX - rect.left),
        ((1 - projected.y) / 2) * height - (event.clientY - rect.top),
      );
      if (d < distance) {
        distance = d;
        nearest = node;
      }
    }
    return nearest;
  }
  function pointerDown(event: PointerEvent) {
    pointerStart = { x: event.clientX, y: event.clientY };
    dragging = true;
  }
  function pointerUp(event: PointerEvent) {
    dragging = false;
    if (
      Math.hypot(
        event.clientX - pointerStart.x,
        event.clientY - pointerStart.y,
      ) > 5
    )
      return;
    const node = pick(event);
    if (node) onSelect(node);
  }
  function pointerMove(event: PointerEvent) {
    if (dragging) return;
    const node = pick(event);
    if (hovered === (node?.id ?? null)) return;
    hovered = node?.id ?? null;
    canvas.style.cursor = node ? "pointer" : "grab";
    tooltip.hidden = !node;
    if (node) {
      tooltip.textContent = `${node.kind} · ${node.title}`;
    }
  }
  function pointerLeave() {
    dragging = false;
    hovered = null;
    tooltip.hidden = true;
  }
  function contextLost(event: Event) {
    event.preventDefault();
    onUnavailable();
  }
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerleave", pointerLeave);
  canvas.addEventListener("webglcontextlost", contextLost);

  return {
    update,
    state(next) {
      state = next;
      applyState();
    },
    focus(id) {
      const point = id ? points.get(id) : null;
      if (!point) {
        reset(flat);
        return;
      }
      const node = graph.nodes.find((item) => item.id === id);
      const offset = node?.kind === "domain" ? 300 : 190;
      move(
        point.clone().add(new THREE.Vector3(0, offset * 0.7, offset)),
        point.clone(),
      );
    },
    reset,
    zoom(factor) {
      const target = controls.target.clone();
      const delta = camera.position.clone().sub(target);
      delta.setLength(
        THREE.MathUtils.clamp(
          delta.length() * factor,
          controls.minDistance,
          controls.maxDistance,
        ),
      );
      move(target.clone().add(delta), target);
    },
    rotate(enabled) {
      controls.autoRotate = enabled && !reduced;
      invalidate();
    },
    enabled(value) {
      enabled = value;
      if (value) invalidate();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      stopMotion();
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerleave", pointerLeave);
      canvas.removeEventListener("webglcontextlost", contextLost);
      controls.dispose();
      clearContent();
      tooltip.remove();
      for (const geometry of Object.values(geo)) geometry.dispose();
      instrument.traverse((obj) => {
        if (obj instanceof THREE.Line || obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
      halo.geometry.dispose();
      halo.material.dispose();
      renderer.dispose();
    },
  };
}
