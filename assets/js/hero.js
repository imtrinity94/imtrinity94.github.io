import * as THREE from "three";
import { FontLoader } from "../vendor/FontLoader.js";

// Hero: a slowly turning cluster of glass-wireframe objects from the
// automation / orchestration / cloud world. Every page view picks a random
// set from a pool of ~70 objects, a random colour palette and a random
// arrangement, so it looks different for every visitor.
// Scrolling down ungroups the cluster, then each object shatters into
// glowing glass shards that drift away and fade out; scrolling up rebuilds it.
// The cluster only appears in the empty space beside the hero text and is
// sized to fit it; if there is no room (phones, narrow windows) it is not shown.
// With reduce-motion on, it still turns slowly but the glints stop.
const canvas = document.getElementById("hero-gl");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
} catch (e) {
  canvas.remove();
}

if (renderer) {
  new FontLoader().load(new URL("../vendor/glyphs.json", import.meta.url).href, start, undefined, () => start(null));
}

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

const PI = Math.PI;
const rand = (a, b) => a + Math.random() * (b - a);

function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
  return m;
}

// merge a list of [geometry, matrix] parts into one non-indexed geometry
function merge(list) {
  const parts = list.map(([g, m]) => {
    const x = g.index ? g.toNonIndexed() : g.clone();
    if (m) x.applyMatrix4(m);
    return x.getAttribute("position").array;
  });
  const out = new Float32Array(parts.reduce((n, a) => n + a.length, 0));
  let o = 0;
  parts.forEach((a) => { out.set(a, o); o += a.length; });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(out, 3));
  return g;
}

// primitive part builders: each returns [geometry, matrix]
const box = (w, h, d, x, y, z, rx, ry, rz) => [new THREE.BoxGeometry(w, h, d), M(x, y, z, rx, ry, rz)];
const cyl = (r, h, x, y, z, rx, ry, rz, seg = 16, r2) => [new THREE.CylinderGeometry(r, r2 === undefined ? r : r2, h, seg, 1), M(x, y, z, rx, ry, rz)];
const cone = (r, h, x, y, z, rx, ry, rz, seg = 10) => [new THREE.ConeGeometry(r, h, seg), M(x, y, z, rx, ry, rz)];
const tor = (r, t, arc, x, y, z, rx, ry, rz) => [new THREE.TorusGeometry(r, t, 6, 28, arc === undefined ? PI * 2 : arc), M(x, y, z, rx, ry, rz)];
const ball = (r, x, y, z, detail = 1) => [new THREE.IcosahedronGeometry(r, detail), M(x, y, z)];
const oct = (r, x, y, z) => [new THREE.OctahedronGeometry(r, 0), M(x, y, z)];
const ext = (shape, depth, x, y, z, rx, ry, rz) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  return [g, M(x, y, z, rx, ry, rz)];
};
// a thin bar from (x1,y1) to (x2,y2) in the z=z plane
const bar = (x1, y1, x2, y2, t = 0.045, z = 0, d) => {
  const len = Math.hypot(x2 - x1, y2 - y1);
  return box(len, t, d === undefined ? t : d, (x1 + x2) / 2, (y1 + y2) / 2, z, 0, 0, Math.atan2(y2 - y1, x2 - x1));
};
const poly = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s; };
const circle = (r) => { const s = new THREE.Shape(); s.absarc(0, 0, r, 0, PI * 2, false); return s; };
const hole = (r, x = 0, y = 0) => { const p = new THREE.Path(); p.absarc(x, y, r, 0, PI * 2, true); return p; };
const rrect = (w, h, r) => {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
};

function cloudShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.9, -0.3);
  s.absarc(-0.55, 0.0, 0.32, PI * 1.1, PI * 0.45, true);
  s.absarc(0.0, 0.18, 0.45, PI * 0.9, PI * 0.15, true);
  s.absarc(0.55, -0.02, 0.33, PI * 0.6, -PI * 0.2, true);
  s.lineTo(0.75, -0.3);
  s.closePath();
  return s;
}
const arrowShape = (up) => poly(up
  ? [[-0.09, -0.2], [0.09, -0.2], [0.09, 0.02], [0.18, 0.02], [0, 0.22], [-0.18, 0.02], [-0.09, 0.02]]
  : [[-0.09, 0.2], [0.09, 0.2], [0.09, -0.02], [0.18, -0.02], [0, -0.22], [-0.18, -0.02], [-0.09, -0.02]]);

function gearShape(teeth, r, holeR = 0.3) {
  const s = new THREE.Shape();
  const inner = r * 0.78, step = (PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    [[inner, a], [r, a + step * 0.15], [r, a + step * 0.45], [inner, a + step * 0.6]].forEach(([rr, aa], k) => {
      const x = Math.cos(aa) * rr, y = Math.sin(aa) * rr;
      if (i === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y);
    });
    s.lineTo(Math.cos(a + step) * inner, Math.sin(a + step) * inner);
  }
  s.holes.push(hole(r * holeR));
  return s;
}

function hexShape(r, holeR) {
  const pts = [];
  for (let i = 0; i < 6; i++) pts.push([Math.cos(i * PI / 3 + PI / 6) * r, Math.sin(i * PI / 3 + PI / 6) * r]);
  const s = poly(pts);
  if (holeR) {
    const h = new THREE.Path();
    for (let i = 5; i >= 0; i--) { const x = Math.cos(i * PI / 3 + PI / 6) * holeR, y = Math.sin(i * PI / 3 + PI / 6) * holeR; i === 5 ? h.moveTo(x, y) : h.lineTo(x, y); }
    s.holes.push(h);
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* The object pool                                                     */
/* ------------------------------------------------------------------ */

const POOL = {
  // ---- cloud & infrastructure ----
  cloud: () => [ext(cloudShape(), 0.3)],
  cloudUpload: () => [ext(cloudShape(), 0.28), ext(arrowShape(true), 0.12, 0, -0.02, 0.22)],
  cloudDownload: () => [ext(cloudShape(), 0.28), ext(arrowShape(false), 0.12, 0, -0.02, 0.22)],
  multiCloud: () => [ext(cloudShape(), 0.2, -0.25, 0.25, 0, 0, 0, 0), ext(cloudShape(), 0.2, 0.3, -0.25, 0.15)],
  serverRack: () => { const p = [box(0.62, 1.15, 0.5)]; for (let i = 0; i < 4; i++) p.push(box(0.48, 0.12, 0.06, 0, 0.38 - i * 0.25, 0.27)); return p; },
  bladeServer: () => { const p = [box(1.2, 0.22, 0.6)]; for (let i = 0; i < 6; i++) p.push(box(0.1, 0.1, 0.05, -0.45 + i * 0.13, 0, 0.32)); p.push(box(0.25, 0.08, 0.05, 0.42, 0, 0.32)); return p; },
  dataCenter: () => { const p = []; for (let k = -1; k <= 1; k++) { p.push(box(0.36, 0.95, 0.4, k * 0.42)); for (let i = 0; i < 3; i++) p.push(box(0.26, 0.08, 0.05, k * 0.42, 0.28 - i * 0.24, 0.22)); } return p; },
  database: () => [cyl(0.42, 0.95), cyl(0.44, 0.05, 0, 0.16), cyl(0.44, 0.05, 0, -0.16)],
  diskPlatter: () => [ext((() => { const s = circle(0.55); s.holes.push(hole(0.1)); return s; })(), 0.06), tor(0.36, 0.012), bar(0.05, 0.05, 0.42, 0.35, 0.05, 0.06)],
  cpuChip: () => { const p = [box(0.7, 0.7, 0.1), box(0.42, 0.42, 0.06, 0, 0, 0.07)]; for (let i = 0; i < 5; i++) { const o = -0.24 + i * 0.12; p.push(box(0.05, 0.16, 0.03, o, 0.42), box(0.05, 0.16, 0.03, o, -0.42), box(0.16, 0.05, 0.03, 0.42, o), box(0.16, 0.05, 0.03, -0.42, o)); } return p; },
  ramStick: () => { const p = [box(1.3, 0.32, 0.04)]; for (let i = 0; i < 6; i++) p.push(box(0.15, 0.18, 0.05, -0.5 + i * 0.2, 0.03, 0.04)); p.push(box(1.1, 0.04, 0.05, 0, -0.17)); return p; },
  networkSwitch: () => { const p = [box(1.25, 0.2, 0.55)]; for (let i = 0; i < 8; i++) p.push(box(0.09, 0.08, 0.04, -0.5 + i * 0.12, 0, 0.29)); return p; },
  router: () => [box(0.9, 0.22, 0.55), cyl(0.025, 0.55, -0.3, 0.38, -0.15, 0, 0, 0.2, 6), cyl(0.025, 0.55, 0.3, 0.38, -0.15, 0, 0, -0.2, 6), ball(0.04, -0.25, 0, 0.28, 0), ball(0.04, -0.12, 0, 0.28, 0)],
  loadBalancer: () => [box(0.5, 0.2, 0.2, 0, 0.42), box(0.3, 0.2, 0.2, -0.55, -0.42), box(0.3, 0.2, 0.2, 0, -0.42), box(0.3, 0.2, 0.2, 0.55, -0.42), bar(0, 0.32, -0.55, -0.32), bar(0, 0.32, 0, -0.32), bar(0, 0.32, 0.55, -0.32)],
  firewall: () => { const p = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) p.push(box(0.36, 0.18, 0.22, -0.4 + c * 0.4 + (r % 2 ? 0.2 : 0), -0.3 + r * 0.2)); return p; },
  vmMonitor: () => [box(1.0, 0.65, 0.06, 0, 0.18), box(0.88, 0.53, 0.02, 0, 0.18, 0.04), box(0.08, 0.28, 0.06, 0, -0.27), box(0.45, 0.04, 0.25, 0, -0.42)],
  laptop: () => [box(1.1, 0.05, 0.7, 0, -0.3, 0.1), box(1.1, 0.68, 0.04, 0, 0.05, -0.27, -0.25), box(0.95, 0.55, 0.02, 0, 0.06, -0.24, -0.25)],
  terminal: () => [box(1.1, 0.75, 0.06), box(1.1, 0.12, 0.08, 0, 0.32), ball(0.025, -0.48, 0.32, 0.05, 0), ball(0.025, -0.4, 0.32, 0.05, 0), bar(-0.42, 0.08, -0.28, -0.02, 0.05, 0.05), bar(-0.42, -0.12, -0.28, -0.02, 0.05, 0.05), box(0.2, 0.05, 0.05, -0.12, -0.14, 0.05)],
  regionGlobe: () => [ball(0.55, 0, 0, 0, 1), tor(0.6, 0.015, PI * 2, 0, 0, 0, PI / 2), tor(0.6, 0.015, PI * 2, 0, 0, 0, 0, PI / 2)],
  satellite: () => [box(0.3, 0.3, 0.3), box(0.55, 0.3, 0.03, -0.5, 0, 0), box(0.55, 0.3, 0.03, 0.5, 0, 0), cone(0.15, 0.12, 0, 0.24, 0, 0, 0, 0, 12)],
  wifi: () => [tor(0.22, 0.03, PI / 2, 0, -0.25, 0, 0, 0, PI / 4), tor(0.42, 0.03, PI / 2, 0, -0.25, 0, 0, 0, PI / 4), tor(0.62, 0.03, PI / 2, 0, -0.25, 0, 0, 0, PI / 4), ball(0.06, 0, -0.25, 0, 0)],
  hexCluster: () => { const p = [ext(hexShape(0.22, 0.14), 0.12)]; for (let i = 0; i < 6; i++) p.push(ext(hexShape(0.22, 0.14), 0.12, Math.cos(i * PI / 3) * 0.4, Math.sin(i * PI / 3) * 0.4)); return p; },
  helm: () => { const p = [ext((() => { const s = circle(0.55); s.holes.push(hole(0.45)); return s; })(), 0.08), ext(circle(0.1), 0.1)]; for (let i = 0; i < 8; i++) { const a = i * PI / 4; p.push(bar(Math.cos(a) * 0.1, Math.sin(a) * 0.1, Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0.05)); } return p; },
  container: () => [box(0.7, 0.7, 0.7), box(0.5, 0.5, 0.72)],
  containerStack: () => [box(0.42, 0.42, 0.42, -0.23, -0.22), box(0.42, 0.42, 0.42, 0.23, -0.22, 0.05), box(0.42, 0.42, 0.42, 0, 0.22, 0.02, 0, 0.3)],
  shippingContainer: () => { const p = [box(1.3, 0.5, 0.5)]; for (let i = 0; i < 7; i++) p.push(box(0.04, 0.46, 0.52, -0.54 + i * 0.18)); return p; },
  // ---- orchestration & automation ----
  gearBig: () => [ext(gearShape(10, 0.55), 0.18)],
  gearSmall: () => [ext(gearShape(7, 0.4, 0.35), 0.16)],
  gearPair: () => [ext(gearShape(9, 0.42), 0.14, -0.28, 0.12), ext(gearShape(7, 0.3), 0.14, 0.36, -0.22, 0, 0, 0, 0.2)],
  workflow: () => [box(0.34, 0.24, 0.14, -0.55, 0.3), box(0.34, 0.24, 0.14, 0.55, 0.3), box(0.34, 0.24, 0.14, 0, -0.38), bar(-0.38, 0.3, 0.38, 0.3), bar(-0.5, 0.18, -0.05, -0.26), bar(0.5, 0.18, 0.05, -0.26)],
  decision: () => [box(0.42, 0.42, 0.14, 0, 0, 0, 0, 0, PI / 4), box(0.32, 0.2, 0.14, -0.7, 0), box(0.32, 0.2, 0.14, 0.7, 0), bar(-0.54, 0, -0.3, 0), bar(0.3, 0, 0.54, 0), bar(0, 0.3, 0, 0.6), box(0.32, 0.2, 0.14, 0, 0.7)],
  pipeline: () => [cyl(0.12, 0.5, -0.5, 0, 0, 0, 0, PI / 2), cyl(0.12, 0.5, 0.05, 0, 0, 0, 0, PI / 2), cyl(0.12, 0.35, 0.5, 0, 0, 0, 0, PI / 2), tor(0.14, 0.035, PI * 2, -0.22, 0, 0, 0, PI / 2), tor(0.14, 0.035, PI * 2, 0.32, 0, 0, 0, PI / 2), cone(0.18, 0.2, 0.78, 0, 0, 0, 0, -PI / 2)],
  scheduler: () => [tor(0.5, 0.05), ext(circle(0.06), 0.06), bar(0, 0, 0, 0.36, 0.06), bar(0, 0, 0.26, -0.12, 0.06), cyl(0.06, 0.12, 0, 0.6, 0), box(0.2, 0.06, 0.08, 0, 0.68)],
  hourglass: () => [cone(0.35, 0.45, 0, 0.23, 0, PI), cone(0.35, 0.45, 0, -0.23, 0), box(0.85, 0.06, 0.85, 0, 0.48), box(0.85, 0.06, 0.85, 0, -0.48)],
  refresh: () => [tor(0.42, 0.05, PI * 1.55, 0, 0, 0, 0, 0, PI * 0.3), cone(0.12, 0.22, 0.42 * Math.cos(PI * 0.3), -0.42 * Math.sin(PI * 0.3) + 0.05, 0, 0, 0, PI * 0.8)],
  sync: () => [tor(0.42, 0.045, PI * 0.8, 0, 0, 0, 0, 0, PI * 0.1), tor(0.42, 0.045, PI * 0.8, 0, 0, 0, 0, 0, PI * 1.1), cone(0.11, 0.2, -0.38, 0.14, 0, 0, 0, PI * 0.95), cone(0.11, 0.2, 0.38, -0.14, 0, 0, 0, -PI * 0.05)],
  runButton: () => [ext(poly([[-0.3, -0.38], [0.42, 0], [-0.3, 0.38]]), 0.18)],
  pauseButton: () => [box(0.2, 0.7, 0.16, -0.18), box(0.2, 0.7, 0.16, 0.18)],
  stopButton: () => [ext(rrect(0.66, 0.66, 0.1), 0.16)],
  lightning: () => [ext(poly([[0.12, 0.6], [-0.3, -0.02], [-0.02, -0.02], [-0.14, -0.6], [0.3, 0.06], [0.02, 0.06]]), 0.16)],
  rocket: () => [cyl(0.16, 0.7, 0, 0, 0, 0, 0, 0, 12), cone(0.16, 0.32, 0, 0.51, 0, 0, 0, 0, 12), box(0.04, 0.25, 0.2, 0.17, -0.3), box(0.04, 0.25, 0.2, -0.17, -0.3), cone(0.1, 0.18, 0, -0.42, 0, PI, 0, 0, 8)],
  robotArm: () => [box(0.5, 0.12, 0.4, 0, -0.5), cyl(0.07, 0.5, 0, -0.22), ball(0.1, 0, 0.05, 0, 0), bar(0, 0.05, 0.42, 0.32, 0.12, 0, 0.12), ball(0.08, 0.42, 0.32, 0, 0), box(0.06, 0.2, 0.06, 0.48, 0.18), box(0.06, 0.2, 0.06, 0.36, 0.18)],
  funnel: () => [cyl(0.5, 0.45, 0, 0.2, 0, 0, 0, 0, 16, 0.12), cyl(0.12, 0.4, 0, -0.22, 0, 0, 0, 0, 12)],
  plug: () => [box(0.42, 0.5, 0.3), box(0.06, 0.25, 0.06, -0.1, 0.37), box(0.06, 0.25, 0.06, 0.1, 0.37), cyl(0.05, 0.4, 0, -0.45, 0, 0, 0, 0, 8)],
  // ---- networking & data ----
  networkMesh: () => { const ico = new THREE.IcosahedronGeometry(0.5, 0); const p = [[ico]]; const a = ico.getAttribute("position"), seen = new Set(); for (let i = 0; i < a.count; i++) { const k = [a.getX(i), a.getY(i), a.getZ(i)].map((v) => v.toFixed(3)).join(); if (!seen.has(k)) { seen.add(k); p.push(oct(0.07, a.getX(i), a.getY(i), a.getZ(i))); } } return p; },
  treeGraph: () => [oct(0.11, 0, 0.5, 0), oct(0.09, -0.35, 0, 0), oct(0.09, 0.35, 0, 0), oct(0.07, -0.55, -0.45, 0), oct(0.07, -0.15, -0.45, 0), oct(0.07, 0.15, -0.45, 0), oct(0.07, 0.55, -0.45, 0), bar(0, 0.5, -0.35, 0, 0.03), bar(0, 0.5, 0.35, 0, 0.03), bar(-0.35, 0, -0.55, -0.45, 0.03), bar(-0.35, 0, -0.15, -0.45, 0.03), bar(0.35, 0, 0.15, -0.45, 0.03), bar(0.35, 0, 0.55, -0.45, 0.03)],
  gitBranch: () => [tor(0.09, 0.03, PI * 2, -0.25, -0.5), tor(0.09, 0.03, PI * 2, -0.25, 0.5), tor(0.09, 0.03, PI * 2, 0.28, 0.25), bar(-0.25, -0.41, -0.25, 0.41, 0.05), bar(0.28, 0.16, -0.25, -0.2, 0.05)],
  chainLink: () => [tor(0.3, 0.06, PI * 2, -0.22, 0, 0), tor(0.3, 0.06, PI * 2, 0.22, 0, 0, PI / 2)],
  apiPlug: () => [ext(circle(0.32), 0.1), tor(0.42, 0.04), bar(0.42, 0, 0.75, 0, 0.06), bar(-0.42, 0, -0.75, 0, 0.06), ball(0.06, 0.78, 0, 0, 0), ball(0.06, -0.78, 0, 0, 0)],
  queue: () => { const p = []; for (let i = 0; i < 4; i++) p.push(box(0.2, 0.42, 0.3, -0.36 + i * 0.24)); p.push(cone(0.1, 0.18, 0.6, 0, 0, 0, 0, -PI / 2, 6)); return p; },
  barChart: () => [box(1.1, 0.04, 0.3, 0, -0.45), box(0.18, 0.35, 0.2, -0.36, -0.25), box(0.18, 0.62, 0.2, -0.12, -0.12), box(0.18, 0.45, 0.2, 0.12, -0.2), box(0.18, 0.85, 0.2, 0.36, -0.0)],
  heartbeat: () => { const pts = [[-0.7, 0], [-0.3, 0], [-0.18, 0.3], [-0.05, -0.4], [0.1, 0.5], [0.22, 0], [0.7, 0]]; const p = []; for (let i = 1; i < pts.length; i++) p.push(bar(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 0.06, 0, 0.12)); return p; },
  dashboard: () => [box(1.1, 0.75, 0.05), ext((() => { const s = circle(0.2); s.holes.push(hole(0.12)); return s; })(), 0.06, -0.3, 0.1, 0.04), box(0.08, 0.2, 0.06, 0.15, -0.05, 0.04), box(0.08, 0.32, 0.06, 0.28, 0.01, 0.04), box(0.08, 0.14, 0.06, 0.41, -0.08, 0.04), box(0.9, 0.04, 0.06, 0, -0.27, 0.04)],
  // ---- security & identity ----
  padlock: () => [box(0.6, 0.48, 0.25, 0, -0.18), tor(0.2, 0.05, PI, 0, 0.06), cyl(0.05, 0.12, 0, -0.16, 0.13, PI / 2, 0, 0, 8)],
  key: () => [tor(0.18, 0.05, PI * 2, -0.45, 0), bar(-0.27, 0, 0.55, 0, 0.07, 0, 0.07), box(0.06, 0.15, 0.07, 0.4, -0.08), box(0.06, 0.1, 0.07, 0.26, -0.06)],
  shield: () => { const s = new THREE.Shape(); s.moveTo(0, 0.6); s.quadraticCurveTo(0.3, 0.45, 0.5, 0.45); s.lineTo(0.5, 0.05); s.quadraticCurveTo(0.45, -0.4, 0, -0.6); s.quadraticCurveTo(-0.45, -0.4, -0.5, 0.05); s.lineTo(-0.5, 0.45); s.quadraticCurveTo(-0.3, 0.45, 0, 0.6); return [ext(s, 0.14), bar(-0.2, 0, -0.04, -0.17, 0.07, 0.09), bar(-0.04, -0.17, 0.25, 0.2, 0.07, 0.09)]; },
  idBadge: () => [ext(rrect(0.7, 0.95, 0.08), 0.06), ext(circle(0.14), 0.08, 0, 0.18, 0.02), box(0.4, 0.05, 0.06, 0, -0.12, 0.03), box(0.3, 0.05, 0.06, 0, -0.25, 0.03), box(0.16, 0.1, 0.06, 0, 0.5)],
  // ---- files & dev ----
  document: () => [ext(poly([[-0.38, -0.5], [0.38, -0.5], [0.38, 0.3], [0.18, 0.5], [-0.38, 0.5]]), 0.06), box(0.5, 0.04, 0.07, -0.02, 0.12), box(0.5, 0.04, 0.07, -0.02, -0.02), box(0.5, 0.04, 0.07, -0.02, -0.16), box(0.3, 0.04, 0.07, -0.12, -0.3)],
  folder: () => [ext(poly([[-0.55, -0.4], [0.55, -0.4], [0.55, 0.28], [-0.05, 0.28], [-0.15, 0.4], [-0.55, 0.4]]), 0.2)],
  package: () => [box(0.7, 0.55, 0.7), box(0.72, 0.06, 0.12, 0, 0.27), box(0.12, 0.06, 0.72, 0, 0.27)],
  envelope: () => [box(1, 0.65, 0.05), bar(-0.5, 0.32, 0, -0.05, 0.045, 0.04), bar(0, -0.05, 0.5, 0.32, 0.045, 0.04)],
  bell: () => [[new THREE.LatheGeometry([new THREE.Vector2(0.05, 0.42), new THREE.Vector2(0.22, 0.35), new THREE.Vector2(0.28, 0.05), new THREE.Vector2(0.42, -0.25), new THREE.Vector2(0.42, -0.3)], 14)], ball(0.07, 0, -0.38, 0, 0)],
  magnifier: () => [tor(0.3, 0.06, PI * 2, -0.12, 0.12), bar(0.1, -0.1, 0.5, -0.5, 0.1, 0, 0.1)],
  wrench: () => [tor(0.2, 0.07, PI * 1.5, -0.42, 0.42, 0, 0, 0, -PI * 0.5), bar(-0.3, 0.3, 0.5, -0.5, 0.11, 0, 0.08)],
  toolbox: () => [box(1, 0.5, 0.45, 0, -0.1), box(1.02, 0.08, 0.47, 0, 0.12), tor(0.18, 0.04, PI, 0, 0.18)],
  // ---- abstract shapes ----
  torusKnot: () => [[new THREE.TorusKnotGeometry(0.38, 0.08, 64, 6)]],
  dodecahedron: () => [[new THREE.DodecahedronGeometry(0.55, 0)]],
  icosahedron: () => [[new THREE.IcosahedronGeometry(0.58, 0)]],
  octahedron: () => [[new THREE.OctahedronGeometry(0.6, 0)]],
  pyramid: () => [cone(0.6, 0.8, 0, 0, 0, 0, 0, 0, 4)],
  ringStack: () => [tor(0.5, 0.04, PI * 2, 0, 0.2, 0, PI / 2), tor(0.4, 0.04, PI * 2, 0, 0, 0, PI / 2), tor(0.3, 0.04, PI * 2, 0, -0.2, 0, PI / 2)]
};

// code / text tokens (need the font)
const TOKENS = ["{ }", ">_", "JS", "</>", "API", "$_", "[ ]", "=>", "fn()", "var", "{...}", "0101", "#!", "&&", "( )", "JSON", "REST", "ES5"];

/* ------------------------------------------------------------------ */
/* Colour palettes (two tones per view)                                */
/* ------------------------------------------------------------------ */

const PALETTES = [
  [[.42, .82, 1.0], [.66, .56, 1.0]],   // sky blue / violet
  [[.35, 1.0, .85], [.4, .7, 1.0]],     // mint / blue
  [[.35, 1.0, .6], [.75, 1.0, .4]],     // emerald / lime
  [[1.0, .75, .35], [1.0, .45, .6]],    // amber / rose
  [[1.0, .45, .9], [.55, .5, 1.0]],     // magenta / indigo
  [[.85, .95, 1.0], [.5, .72, 1.0]],    // ice / steel blue
  [[1.0, .55, .45], [1.0, .85, .45]],   // coral / gold
  [[.5, .9, 1.0], [1.0, .5, .75]]       // cyan / pink
];

/* ------------------------------------------------------------------ */
/* Shard attributes                                                    */
/* ------------------------------------------------------------------ */

// Which triangle edges are real outline edges (not flat-face diagonals), so only those glow.
function featureMask(pos) {
  const tri = pos.length / 9, normals = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < tri; t++) {
    a.fromArray(pos, t * 9); b.fromArray(pos, t * 9 + 3); c.fromArray(pos, t * 9 + 6);
    normals.push(new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize());
  }
  const key = (i) => `${pos[i].toFixed(4)},${pos[i + 1].toFixed(4)},${pos[i + 2].toFixed(4)}`;
  const ek = (t, e) => { const k0 = key(t * 9 + ((e + 1) % 3) * 3), k1 = key(t * 9 + ((e + 2) % 3) * 3); return k0 < k1 ? k0 + "|" + k1 : k1 + "|" + k0; };
  const edges = new Map();
  for (let t = 0; t < tri; t++) for (let e = 0; e < 3; e++) { const k = ek(t, e); if (!edges.has(k)) edges.set(k, []); edges.get(k).push(t); }
  const cos = Math.cos(THREE.MathUtils.degToRad(28));
  const mask = new Float32Array(tri * 9);
  for (let t = 0; t < tri; t++) for (let e = 0; e < 3; e++) {
    const list = edges.get(ek(t, e));
    let f = list.length < 2;
    if (!f) for (const o of list) if (o !== t && normals[o].dot(normals[t]) < cos) { f = true; break; }
    if (f) for (let k = 0; k < 3; k++) mask[t * 9 + k * 3 + e] = 1;
  }
  return mask;
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Build one object, centred and scaled to a common size.
function makeObject(id, font) {
  let g;
  if (id.startsWith("t:")) {
    g = new THREE.ExtrudeGeometry(font.generateShapes(id.slice(2), 0.5), { depth: 0.15, bevelEnabled: false, curveSegments: 6 });
  } else {
    g = merge(POOL[id]());
  }
  g = g.index ? g.toNonIndexed() : g;
  g.computeBoundingBox();
  const c = new THREE.Vector3(); g.boundingBox.getCenter(c);
  g.translate(-c.x, -c.y, -c.z);
  g.computeBoundingSphere();
  g.scale(0.62 / g.boundingSphere.radius, 0.62 / g.boundingSphere.radius, 0.62 / g.boundingSphere.radius);
  return g;
}

function buildCluster(font, count) {
  // pick a random set: mostly shapes, a few code tokens
  const shapes = shuffle(Object.keys(POOL));
  const tokens = font ? shuffle(TOKENS.slice()).map((t) => "t:" + t) : [];
  const nTok = font ? Math.min(tokens.length, 2 + Math.floor(Math.random() * 3)) : 0;
  const ids = shuffle(shapes.slice(0, count - nTok).concat(tokens.slice(0, nTok)));

  const golden = PI * (3 - Math.sqrt(5));
  const n = ids.length, R = 1.25 + n * 0.012;
  const twist = Math.random() * PI * 2;
  const placed = ids.map((id, i) => {
    const y = 1 - ((i + 0.5) / n) * 2, r = Math.sqrt(1 - y * y), t = golden * i + twist;
    const p = new THREE.Vector3(Math.cos(t) * r * R, y * R * 0.92, Math.sin(t) * r * R);
    const m = M(p.x, p.y, p.z, rand(-.3, .3), rand(-.55, .55) - p.x * .25, rand(-.25, .25), rand(.62, .82));
    return { geo: makeObject(id, font).applyMatrix4(m), centre: p, delay: i / n };
  });

  let total = 0;
  placed.forEach((o) => { total += o.geo.getAttribute("position").count; });
  const P = new Float32Array(total * 3), B = new Float32Array(total * 3), K = new Float32Array(total * 3);
  const C = new Float32Array(total * 3), O = new Float32Array(total * 3), D = new Float32Array(total * 3);
  const Rn = new Float32Array(total * 4);
  let v = 0;
  const dir = new THREE.Vector3(), jitter = new THREE.Vector3();
  placed.forEach((o, oi) => {
    const pos = o.geo.getAttribute("position").array;
    const mask = featureMask(pos);
    const objRnd = Math.random(), hue = Math.random();
    for (let t = 0; t < pos.length / 9; t++) {
      const cx = (pos[t * 9] + pos[t * 9 + 3] + pos[t * 9 + 6]) / 3;
      const cy = (pos[t * 9 + 1] + pos[t * 9 + 4] + pos[t * 9 + 7]) / 3;
      const cz = (pos[t * 9 + 2] + pos[t * 9 + 5] + pos[t * 9 + 8]) / 3;
      jitter.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(1.1);
      dir.set(cx - o.centre.x, cy - o.centre.y, cz - o.centre.z).normalize().add(jitter).add(o.centre.clone().normalize().multiplyScalar(.8)).normalize();
      const shardRnd = Math.random();
      for (let k = 0; k < 3; k++) {
        const i3 = v * 3;
        P[i3] = pos[t * 9 + k * 3]; P[i3 + 1] = pos[t * 9 + k * 3 + 1]; P[i3 + 2] = pos[t * 9 + k * 3 + 2];
        B[i3 + k] = 1;
        K[i3] = mask[t * 9 + k * 3]; K[i3 + 1] = mask[t * 9 + k * 3 + 1]; K[i3 + 2] = mask[t * 9 + k * 3 + 2];
        C[i3] = cx; C[i3 + 1] = cy; C[i3 + 2] = cz;
        O[i3] = o.centre.x; O[i3 + 1] = o.centre.y; O[i3 + 2] = o.centre.z;
        D[i3] = dir.x; D[i3 + 1] = dir.y; D[i3 + 2] = dir.z;
        Rn[v * 4] = o.delay; Rn[v * 4 + 1] = shardRnd; Rn[v * 4 + 2] = objRnd; Rn[v * 4 + 3] = hue;
        v++;
      }
    }
  });

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(P, 3));
  g.setAttribute("aBary", new THREE.BufferAttribute(B, 3));
  g.setAttribute("aMask", new THREE.BufferAttribute(K, 3));
  g.setAttribute("aCentroid", new THREE.BufferAttribute(C, 3));
  g.setAttribute("aObj", new THREE.BufferAttribute(O, 3));
  g.setAttribute("aDir", new THREE.BufferAttribute(D, 3));
  g.setAttribute("aRnd", new THREE.BufferAttribute(Rn, 4));
  return { geometry: g, radius: R + 0.62 };
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

function start(font) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  const scene = new THREE.Scene();
  const FOV = 45;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  const pal = PALETTES[Math.floor(Math.random() * PALETTES.length)];

  const uniforms = {
    uTime: { value: 0 },
    uS: { value: 0 },            // scroll progress 0..1
    uTwinkle: { value: reduced ? 0 : 1 },
    uAlpha: { value: 1 },
    uPixel: { value: renderer.getPixelRatio() },
    uColA: { value: new THREE.Vector3(...pal[0]) },
    uColB: { value: new THREE.Vector3(...pal[1]) }
  };

  const rot = /* glsl */`
    vec3 rotA(vec3 v, vec3 axis, float a){
      axis = normalize(axis); float s = sin(a), c = cos(a);
      return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1. - c);
    }`;

  const glass = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: rot + /* glsl */`
      uniform float uTime; uniform float uS;
      attribute vec3 aBary; attribute vec3 aMask; attribute vec3 aCentroid;
      attribute vec3 aObj; attribute vec3 aDir; attribute vec4 aRnd;
      varying vec3 vBary; varying vec3 vMask; varying vec3 vView;
      varying float vBreak; varying float vFade; varying float vHue; varying float vGlint;
      void main(){
        float delay = aRnd.x, sr = aRnd.y, orr = aRnd.z;
        // 1) ungroup: each object drifts out of the cluster and turns a little
        float u = smoothstep(0., .45, uS - delay * .12);
        vec3 axisO = vec3(orr - .5, 1., .3 - orr);
        vec3 p = rotA(position - aObj, axisO, u * (orr - .5) * 1.6) + aObj;
        vec3 c = rotA(aCentroid - aObj, axisO, u * (orr - .5) * 1.6) + aObj;
        vec3 shift = normalize(aObj) * u * .9;
        // 2) shatter: objects break one after another into shards
        float b = smoothstep(0., .5, uS - .14 - delay * .32);
        vec3 axisS = vec3(sr - .5, .7 - sr, sr * .8 - .2);
        vec3 local = rotA(p - c, axisS, b * (2. + sr * 5.)) * (1. - b * .45);
        vec3 fly = aDir * pow(b, 1.4) * (1.2 + sr * 2.4);
        vec4 mv = modelViewMatrix * vec4(c + shift + fly + local, 1.);
        gl_Position = projectionMatrix * mv;
        vBary = aBary; vMask = aMask; vView = mv.xyz;
        vBreak = b;
        vFade = 1. - smoothstep(.2, .8, b);
        vHue = aRnd.w;
        float g = 0.;
        if (sr > .93) { float ph = sr * 211.; g = pow(.5 + .5 * sin(uTime * (1.1 + fract(ph) * 1.6) + ph), 14.); }
        vGlint = g;
      }`,
    fragmentShader: /* glsl */`
      uniform float uAlpha; uniform float uTwinkle; uniform vec3 uColA; uniform vec3 uColB;
      varying vec3 vBary; varying vec3 vMask; varying vec3 vView;
      varying float vBreak; varying float vFade; varying float vHue; varying float vGlint;
      void main(){
        vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
        float fres = pow(1. - abs(dot(n, normalize(-vView))), 2.);
        vec3 m = max(vMask, vec3(vBreak));          // outline edges; every shard edge once broken
        vec3 e = smoothstep(vec3(0.), fwidth(vBary) * 1.6, vBary);
        float edge = 0.;
        if (m.x > .5) edge = max(edge, 1. - e.x);
        if (m.y > .5) edge = max(edge, 1. - e.y);
        if (m.z > .5) edge = max(edge, 1. - e.z);
        vec3 col = mix(uColA, uColB, vHue);
        float glassA = .035 + fres * .16;
        float glint = vGlint * uTwinkle;
        vec3 outc = col * (glassA + edge * .95) + vec3(1.) * (edge * .25 + glint * .9 * (edge + .25));
        gl_FragColor = vec4(outc, (glassA + edge * .9 + glint * .6) * vFade * uAlpha);
      }`
  });

  const COUNT = 18;
  const built = buildCluster(font, COUNT);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(built.geometry, glass));
  group.rotation.x = 0.25;
  scene.add(group);

  // sparkles around the cluster; they scatter with it
  const SP = 320;
  const sp = new Float32Array(SP * 3), srn = new Float32Array(SP);
  for (let i = 0; i < SP; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(1.2 + Math.random() * 1.5);
    sp[i * 3] = v.x; sp[i * 3 + 1] = v.y; sp[i * 3 + 2] = v.z; srn[i] = Math.random();
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  sg.setAttribute("aRnd", new THREE.BufferAttribute(srn, 1));
  group.add(new THREE.Points(sg, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uS; uniform float uTwinkle; uniform float uPixel;
      attribute float aRnd; varying float vA; varying float vT;
      void main(){
        vec3 p = position * (1. + uS * uS * (2. + aRnd * 3.));
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        float ph = aRnd * 97.;
        float tw = mix(.55, pow(.5 + .5 * sin(uTime * (.8 + fract(ph) * 1.4) + ph), 6.), uTwinkle);
        gl_PointSize = (1.5 + aRnd * 2. + tw * 3.) * uPixel * (6. / -mv.z);
        vA = (.25 + tw * .75) * (1. - smoothstep(.4, .9, uS));
        vT = aRnd;
      }`,
    fragmentShader: /* glsl */`
      uniform float uAlpha; uniform vec3 uColA; uniform vec3 uColB; varying float vA; varying float vT;
      void main(){
        float d = length(gl_PointCoord - .5); if (d > .5) discard;
        float g = smoothstep(.5, 0., d);
        gl_FragColor = vec4(mix(mix(uColA, uColB, vT), vec3(1.), g * .8), g * vA * uAlpha);
      }`
  })));

  /* ---- layout: only in the free space beside the hero text ---- */
  const hero = document.querySelector(".hero");
  const textEls = hero ? Array.prototype.slice.call(hero.querySelectorAll(".hero-title, .hero-sub, .hero-meta, .hero-cta, .hero-stats")) : [];
  let fits = true;

  function layout() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // right edge of the widest text block
    // right edge of what is actually drawn: the text glyphs, the buttons,
    // and the stats row (its top rule spans the row's full width)
    let textRight = 0;
    const range = document.createRange();
    textEls.forEach((el) => {
      if (el.classList.contains("hero-stats")) { textRight = Math.max(textRight, el.getBoundingClientRect().right); return; }
      el.querySelectorAll(".btn").forEach((b) => { textRight = Math.max(textRight, b.getBoundingClientRect().right); });
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (!n.textContent.trim()) continue;
        range.selectNodeContents(n);
        Array.prototype.forEach.call(range.getClientRects(), (r) => { textRight = Math.max(textRight, r.right); });
      }
    });
    const GAP = 56;                            // breathing room between text and cluster
    const free = w - textRight - GAP;
    const size = Math.min(free * 0.95, h * 0.78);
    fits = free >= 300 && size >= 280;
    canvas.style.display = fits ? "" : "none";
    if (!fits) return;
    // place the cluster's centre in the middle of the free area, sized to fit
    const cx = textRight + GAP + free / 2;
    const tanH = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    camera.position.z = (built.radius * 2 * h) / (2 * tanH * size);
    camera.setViewOffset(w, h, w / 2 - cx, 0, w, h);
    camera.updateProjectionMatrix();
  }
  layout();
  window.addEventListener("resize", () => { layout(); kick(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layout(); kick(); });

  /* ---- scroll & animation loop ---- */
  let target = 0;
  function progress() {
    const hh = hero ? hero.offsetHeight : window.innerHeight;
    return Math.min(Math.max(window.scrollY / (hh * .8), 0), 1);
  }

  let visible = !document.hidden, running = false, gone = false;
  function kick() { if (!running && visible && !gone && fits) requestAnimationFrame(tick); }
  window.addEventListener("scroll", () => {
    target = progress();
    if (target < 1 && gone) { gone = false; canvas.style.visibility = "visible"; }
    kick();
  }, { passive: true });
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; kick(); });

  const t0 = performance.now();
  const SPEED = .1; // radians per second: one full turn about every minute
  function tick() {
    if (!visible || !fits) { running = false; return; }
    running = true;
    const t = (performance.now() - t0) / 1000;
    uniforms.uTime.value = t;
    uniforms.uS.value += (target - uniforms.uS.value) * .1; // ease, never jump
    group.rotation.y = t * SPEED;
    renderer.render(scene, camera);
    if (target >= 1 && uniforms.uS.value > .995) {        // fully gone: stop drawing
      gone = true; running = false; canvas.style.visibility = "hidden"; return;
    }
    requestAnimationFrame(tick);
  }
  target = progress();
  uniforms.uS.value = target;
  kick();
}
