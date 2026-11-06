import * as THREE from "three";
import { FontLoader } from "../vendor/FontLoader.js";

// Hero: a slowly turning cluster of glass-wireframe objects from the
// automation / orchestration / cloud world (cloud, server rack, database,
// gears, a workflow, a run button, container cubes, a network mesh,
// { }, >_ and JS). As you scroll down the cluster ungroups, then each
// object shatters into glowing glass shards that drift away and fade out.
// Scrolling back up reassembles it. With reduce-motion on, the cluster
// still turns slowly but the glints stop.
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
/* Object geometries (each returns one BufferGeometry, roughly 1 unit) */
/* ------------------------------------------------------------------ */

function merge(list) {
  // list of [geometry, matrix?] -> one non-indexed geometry
  const parts = list.map(([g, m]) => {
    let x = g.index ? g.toNonIndexed() : g.clone();
    if (m) x.applyMatrix4(m);
    return x.getAttribute("position").array;
  });
  const total = parts.reduce((n, a) => n + a.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  parts.forEach((a) => { out.set(a, o); o += a.length; });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(out, 3));
  return g;
}

function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
  return m;
}

const EX = (depth) => ({ depth, bevelEnabled: false, curveSegments: 10 });

function centre(g) {
  g.computeBoundingBox();
  const c = new THREE.Vector3();
  g.boundingBox.getCenter(c);
  g.translate(-c.x, -c.y, -c.z);
  return g;
}

function cloud() {
  const s = new THREE.Shape();
  s.moveTo(-0.9, -0.3);
  s.absarc(-0.55, 0.0, 0.32, Math.PI * 1.1, Math.PI * 0.45, true);
  s.absarc(0.0, 0.18, 0.45, Math.PI * 0.9, Math.PI * 0.15, true);
  s.absarc(0.55, -0.02, 0.33, Math.PI * 0.6, -Math.PI * 0.2, true);
  s.lineTo(0.75, -0.3);
  s.lineTo(-0.9, -0.3);
  return centre(new THREE.ExtrudeGeometry(s, EX(0.32)));
}

function serverRack() {
  const parts = [[new THREE.BoxGeometry(0.62, 1.15, 0.5)]];
  for (let i = 0; i < 4; i++) parts.push([new THREE.BoxGeometry(0.48, 0.12, 0.06), M(0, 0.38 - i * 0.25, 0.27)]);
  return merge(parts);
}

function database() {
  const parts = [[new THREE.CylinderGeometry(0.42, 0.42, 0.95, 18, 1)]];
  parts.push([new THREE.CylinderGeometry(0.44, 0.44, 0.05, 18, 1), M(0, 0.16)]);
  parts.push([new THREE.CylinderGeometry(0.44, 0.44, 0.05, 18, 1), M(0, -0.16)]);
  return merge(parts);
}

function gear(teeth, r, depth) {
  const s = new THREE.Shape();
  const inner = r * 0.78, step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts = [[inner, a], [r, a + step * 0.15], [r, a + step * 0.45], [inner, a + step * 0.6]];
    pts.forEach(([rr, aa], k) => {
      const x = Math.cos(aa) * rr, y = Math.sin(aa) * rr;
      if (i === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y);
    });
    const e = a + step;
    s.lineTo(Math.cos(e) * inner, Math.sin(e) * inner);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, r * 0.3, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return centre(new THREE.ExtrudeGeometry(s, EX(depth)));
}

function workflow() {
  const node = () => new THREE.BoxGeometry(0.34, 0.24, 0.14);
  const link = (len) => new THREE.CylinderGeometry(0.025, 0.025, len, 6, 1);
  return merge([
    [node(), M(-0.55, 0.3)],
    [node(), M(0.55, 0.3)],
    [node(), M(0, -0.38)],
    [link(0.76), M(0, 0.3, 0, 0, 0, Math.PI / 2)],
    [link(0.62), M(-0.28, -0.04, 0, 0, 0, -0.75)],
    [link(0.62), M(0.28, -0.04, 0, 0, 0, 0.75)],
    [new THREE.ConeGeometry(0.06, 0.12, 6), M(0.1, -0.22, 0, 0, 0, Math.PI * 0.75)]
  ]);
}

function runButton() {
  const s = new THREE.Shape();
  s.moveTo(-0.3, -0.38); s.lineTo(0.42, 0); s.lineTo(-0.3, 0.38); s.lineTo(-0.3, -0.38);
  return centre(new THREE.ExtrudeGeometry(s, EX(0.18)));
}

function containers() {
  const c = () => new THREE.BoxGeometry(0.42, 0.42, 0.42);
  return merge([[c(), M(-0.23, -0.22, 0)], [c(), M(0.23, -0.22, 0.05)], [c(), M(0, 0.22, 0.02, 0, 0.3, 0)]]);
}

function network() {
  const ico = new THREE.IcosahedronGeometry(0.5, 0);
  const parts = [[ico]];
  const p = ico.getAttribute("position");
  const seen = new Set();
  for (let i = 0; i < p.count; i++) {
    const k = [p.getX(i), p.getY(i), p.getZ(i)].map((v) => v.toFixed(3)).join();
    if (seen.has(k)) continue;
    seen.add(k);
    parts.push([new THREE.OctahedronGeometry(0.07, 0), M(p.getX(i), p.getY(i), p.getZ(i))]);
  }
  return merge(parts);
}

function text(font, str, size) {
  const shapes = font.generateShapes(str, size);
  return centre(new THREE.ExtrudeGeometry(shapes, { depth: size * 0.3, bevelEnabled: false, curveSegments: 6 }));
}

/* ------------------------------------------------------------------ */
/* Build shard attributes                                              */
/* ------------------------------------------------------------------ */

// For one object (already placed in cluster space) work out which triangle
// edges are real outline edges (not flat-face diagonals), so only those glow.
function featureMask(pos) {
  const tri = pos.length / 9;
  const normals = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < tri; t++) {
    a.fromArray(pos, t * 9); b.fromArray(pos, t * 9 + 3); c.fromArray(pos, t * 9 + 6);
    normals.push(new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize());
  }
  const key = (i) => `${pos[i].toFixed(4)},${pos[i + 1].toFixed(4)},${pos[i + 2].toFixed(4)}`;
  const edges = new Map();
  const ek = (t, e) => {
    const i0 = t * 9 + ((e + 1) % 3) * 3, i1 = t * 9 + ((e + 2) % 3) * 3; // edge opposite vertex e
    const k0 = key(i0), k1 = key(i1);
    return k0 < k1 ? k0 + "|" + k1 : k1 + "|" + k0;
  };
  for (let t = 0; t < tri; t++) for (let e = 0; e < 3; e++) {
    const k = ek(t, e);
    if (!edges.has(k)) edges.set(k, []);
    edges.get(k).push(t);
  }
  const cos = Math.cos(THREE.MathUtils.degToRad(28));
  const mask = new Float32Array(tri * 9);
  for (let t = 0; t < tri; t++) for (let e = 0; e < 3; e++) {
    const list = edges.get(ek(t, e));
    let feature = list.length < 2;
    if (!feature) for (const o of list) if (o !== t && normals[o].dot(normals[t]) < cos) { feature = true; break; }
    const v = feature ? 1 : 0;
    for (let k = 0; k < 3; k++) mask[t * 9 + k * 3 + e] = v;
  }
  return mask;
}

function buildCluster(font) {
  const items = [
    [cloud(), 1.15],
    [serverRack(), 1],
    [database(), 0.95],
    [gear(10, 0.55, 0.18), 1],
    [gear(8, 0.36, 0.16), 1],
    [workflow(), 1.05],
    [runButton(), 0.85],
    [containers(), 1],
    [network(), 1.05]
  ];
  if (font) {
    items.push([text(font, "{ }", 0.55), 1]);
    items.push([text(font, ">_", 0.55), 1]);
    items.push([text(font, "JS", 0.55), 1]);
  }

  // Spread the objects over a sphere so they read as one cluster.
  const golden = Math.PI * (3 - Math.sqrt(5));
  const n = items.length;
  const order = items.map((_, i) => i).sort(() => Math.random() - 0.5);
  const placed = [];
  order.forEach((idx, i) => {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), t = golden * i;
    const R = 1.2;
    const p = new THREE.Vector3(Math.cos(t) * r * R, y * R * 0.95, Math.sin(t) * r * R);
    const [g, s] = items[idx];
    // mostly facing the viewer so each object is recognisable
    const m = M(p.x, p.y, p.z, (Math.random() - .5) * .5, (Math.random() - .5) * 1.1 - p.x * .25, (Math.random() - .5) * .4, s * 0.78);
    const geo = (g.index ? g.toNonIndexed() : g).applyMatrix4(m);
    placed.push({ geo, centre: p, delay: i / n });
  });

  let total = 0;
  placed.forEach((o) => { total += o.geo.getAttribute("position").count; });
  const P = new Float32Array(total * 3), B = new Float32Array(total * 3), K = new Float32Array(total * 3);
  const C = new Float32Array(total * 3), O = new Float32Array(total * 3), D = new Float32Array(total * 3);
  const R = new Float32Array(total * 4);
  let v = 0;
  const tmp = new THREE.Vector3();
  placed.forEach((o, oi) => {
    const pos = o.geo.getAttribute("position").array;
    const mask = featureMask(pos);
    const objRnd = Math.random();
    for (let t = 0; t < pos.length / 9; t++) {
      // shard centroid
      const cx = (pos[t * 9] + pos[t * 9 + 3] + pos[t * 9 + 6]) / 3;
      const cy = (pos[t * 9 + 1] + pos[t * 9 + 4] + pos[t * 9 + 7]) / 3;
      const cz = (pos[t * 9 + 2] + pos[t * 9 + 5] + pos[t * 9 + 8]) / 3;
      // fly direction: away from the object's centre, with some randomness
      tmp.set(cx - o.centre.x, cy - o.centre.y, cz - o.centre.z).normalize()
        .add(new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(1.1))
        .add(o.centre.clone().normalize().multiplyScalar(0.8)).normalize();
      const shardRnd = Math.random();
      for (let k = 0; k < 3; k++) {
        const i3 = v * 3;
        P.set([pos[t * 9 + k * 3], pos[t * 9 + k * 3 + 1], pos[t * 9 + k * 3 + 2]], i3);
        B.set([k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0], i3);
        K.set([mask[t * 9 + k * 3], mask[t * 9 + k * 3 + 1], mask[t * 9 + k * 3 + 2]], i3);
        C.set([cx, cy, cz], i3);
        O.set([o.centre.x, o.centre.y, o.centre.z], i3);
        D.set([tmp.x, tmp.y, tmp.z], i3);
        R.set([o.delay, shardRnd, objRnd, oi / (placed.length - 1)], v * 4);
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
  g.setAttribute("aRnd", new THREE.BufferAttribute(R, 4));
  return g;
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

function start(font) {
  const mobile = window.innerWidth < 760;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

  const uniforms = {
    uTime: { value: 0 },
    uS: { value: 0 },            // scroll progress 0..1
    uTwinkle: { value: reduced ? 0 : 1 },
    uAlpha: { value: mobile ? .38 : 1 },
    uPixel: { value: renderer.getPixelRatio() }
  };

  // Shared GLSL: rotate a vector around an axis.
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
        vec3 world = c + shift + fly + local;
        vec4 mv = modelViewMatrix * vec4(world, 1.);
        gl_Position = projectionMatrix * mv;
        vBary = aBary; vMask = aMask; vView = mv.xyz;
        vBreak = b;
        vFade = 1. - smoothstep(.2, .8, b);
        vHue = aRnd.w;
        // occasional glint on a few shards
        float g = 0.;
        if (sr > .93) { float ph = sr * 211.; g = pow(.5 + .5 * sin(uTime * (1.1 + fract(ph) * 1.6) + ph), 14.); }
        vGlint = g;
      }`,
    fragmentShader: /* glsl */`
      uniform float uAlpha; uniform float uTwinkle; uniform float uS;
      varying vec3 vBary; varying vec3 vMask; varying vec3 vView;
      varying float vBreak; varying float vFade; varying float vHue; varying float vGlint;
      void main(){
        vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
        float fres = pow(1. - abs(dot(n, normalize(-vView))), 2.);
        // edge glow: outline edges always, every shard edge once it breaks
        vec3 m = max(vMask, vec3(vBreak));
        vec3 d = fwidth(vBary);
        vec3 e = smoothstep(vec3(0.), d * 1.6, vBary);
        float edge = 0.;
        if (m.x > .5) edge = max(edge, 1. - e.x);
        if (m.y > .5) edge = max(edge, 1. - e.y);
        if (m.z > .5) edge = max(edge, 1. - e.z);
        vec3 blue = vec3(.42, .82, 1.), violet = vec3(.66, .56, 1.);
        vec3 col = mix(blue, violet, vHue);
        float glass = .035 + fres * .16;
        float glint = vGlint * uTwinkle;
        vec3 outc = col * (glass + edge * .95) + vec3(1.) * (edge * .25 + glint * .9 * (edge + .25));
        float a = (glass + edge * .9 + glint * .6) * vFade * uAlpha;
        gl_FragColor = vec4(outc, a);
      }`
  });

  const cluster = new THREE.Mesh(buildCluster(font), glass);
  const group = new THREE.Group();
  group.add(cluster);
  group.rotation.x = 0.25;
  scene.add(group);

  // A few sparkles hanging around the cluster; they scatter with it.
  const SP = mobile ? 160 : 320;
  const sp = new Float32Array(SP * 3), sr = new Float32Array(SP);
  for (let i = 0; i < SP; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(1.2 + Math.random() * 1.4);
    sp.set([v.x, v.y, v.z], i * 3); sr[i] = Math.random();
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  sg.setAttribute("aRnd", new THREE.BufferAttribute(sr, 1));
  const sparkMat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      uniform float uTime; uniform float uS; uniform float uTwinkle; uniform float uPixel;
      attribute float aRnd; varying float vA;
      void main(){
        vec3 p = position * (1. + uS * uS * (2. + aRnd * 3.));
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        float ph = aRnd * 97.;
        float tw = mix(.55, pow(.5 + .5 * sin(uTime * (.8 + fract(ph) * 1.4) + ph), 6.), uTwinkle);
        gl_PointSize = (1.5 + aRnd * 2. + tw * 3.) * uPixel * (6. / -mv.z);
        vA = (.25 + tw * .75) * (1. - smoothstep(.4, .9, uS));
      }`,
    fragmentShader: /* glsl */`
      uniform float uAlpha; varying float vA;
      void main(){
        float d = length(gl_PointCoord - .5); if (d > .5) discard;
        float g = smoothstep(.5, 0., d);
        gl_FragColor = vec4(mix(vec3(.6, .85, 1.), vec3(1.), g), g * vA * uAlpha);
      }`
  });
  group.add(new THREE.Points(sg, sparkMat));

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = w > 900 ? 7.6 : 12;
    camera.setViewOffset(w, h, w > 900 ? -w * .25 : 0, w > 900 ? 0 : h * .05, w, h);
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  // Scroll progress through the hero: 0 at the top, 1 once it is mostly out of view.
  const hero = document.querySelector(".hero");
  let target = 0;
  function progress() {
    const h = hero ? hero.offsetHeight : window.innerHeight;
    return Math.min(Math.max(window.scrollY / (h * .8), 0), 1);
  }

  let visible = !document.hidden, running = false, gone = false;
  function onScroll() {
    target = progress();
    if (target < 1 && gone) { gone = false; canvas.style.visibility = "visible"; }
    if (!running && visible && !gone) requestAnimationFrame(tick);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", () => {
    visible = !document.hidden;
    if (visible && !running && !gone) requestAnimationFrame(tick);
  });

  const t0 = performance.now();
  const SPEED = .1; // radians per second: one full turn about every minute
  function tick() {
    if (!visible) { running = false; return; }
    running = true;
    const t = (performance.now() - t0) / 1000;
    uniforms.uTime.value = t;
    uniforms.uS.value += (target - uniforms.uS.value) * .1; // ease, never jump
    group.rotation.y = t * SPEED;
    renderer.render(scene, camera);
    if (target >= 1 && uniforms.uS.value > .995) {   // fully gone: stop drawing
      gone = true; running = false; canvas.style.visibility = "hidden"; return;
    }
    requestAnimationFrame(tick);
  }
  target = progress();
  uniforms.uS.value = target;
  tick();
}
