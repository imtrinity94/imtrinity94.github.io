import * as THREE from "three";

// Calm background: a slowly breathing particle sphere. No scroll effects,
// barely any mouse response, and fully static when reduced motion is on.
const canvas = document.getElementById("hero-gl");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "low-power" });
} catch (e) {
  canvas.remove();
}

if (renderer) {
  const mobile = window.innerWidth < 760;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);

  const COUNT = mobile ? 5000 : 12000;
  const pos = new Float32Array(COUNT * 3);
  const rnd = new Float32Array(COUNT);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < COUNT; i++) {
    const y = 1 - (i / (COUNT - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const t = golden * i;
    pos[i * 3] = Math.cos(t) * r;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = Math.sin(t) * r;
    rnd[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aRnd", new THREE.BufferAttribute(rnd, 1));

  const uniforms = {
    uTime: { value: 0 },
    uPixel: { value: renderer.getPixelRatio() },
    uAlpha: { value: mobile ? .35 : .7 }
  };

  const noise = /* glsl */`
    vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
    vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
    vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
    float snoise(vec3 v){
      const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
      vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
      vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
      vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
      i=mod289(i);
      vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
      float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
      vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
      vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
      vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
      vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
      vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
      vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
      return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }`;

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: noise + /* glsl */`
      uniform float uTime; uniform float uPixel;
      attribute float aRnd;
      varying float vN; varying float vDepth;
      void main(){
        vec3 p = position;
        float n = snoise(p * 1.2 + vec3(uTime * .04));
        p *= 1.7 + n * .12;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.6 + aRnd * 1.6) * uPixel * (5.5 / -mv.z);
        vN = n; vDepth = -mv.z;
      }`,
    fragmentShader: /* glsl */`
      uniform float uAlpha;
      varying float vN; varying float vDepth;
      void main(){
        float d = length(gl_PointCoord - .5);
        if (d > .5) discard;
        float glow = smoothstep(.5, 0., d);
        vec3 a = vec3(.45, .78, 1.);   // soft blue
        vec3 b = vec3(.55, .52, .95);  // soft indigo
        vec3 col = mix(a, b, smoothstep(-.5, .5, vN));
        float fade = smoothstep(9., 3.8, vDepth);
        gl_FragColor = vec4(col, glow * .55 * fade * uAlpha);
      }`
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = w > 900 ? 6 : 7.5;
    camera.setViewOffset(w, h, w > 900 ? -w * .2 : 0, w > 900 ? 0 : h * .05, w, h);
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  // Fade the globe to nothing as the hero scrolls away (opacity only, no motion).
  // Once it is fully faded, rendering pauses so nothing sits behind the content.
  const hero = document.querySelector(".hero");
  let faded = false;
  function onScroll() {
    const h = hero ? hero.offsetHeight : window.innerHeight;
    const p = Math.min(Math.max(window.scrollY / (h * .6), 0), 1);
    const o = 1 - p * p * (3 - 2 * p); // smoothstep: eases in and out
    canvas.style.opacity = o.toFixed(3);
    canvas.style.visibility = o <= 0.001 ? "hidden" : "visible";
    const wasFaded = faded;
    faded = o <= 0.001;
    if (wasFaded && !faded && !reduced && !running) requestAnimationFrame(tick);
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  let visible = !document.hidden;
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; if (visible && !faded && !reduced && !running) requestAnimationFrame(tick); });

  // Subtle rotation: one full turn about every 100 seconds, on a slight tilt.
  points.rotation.x = 0.35;
  points.rotation.z = -0.12;
  const start = performance.now();
  let running = false;
  function tick() {
    if (!visible || faded) { running = false; return; }
    running = true;
    const t = (performance.now() - start) / 1000;
    uniforms.uTime.value = t;
    points.rotation.y = t * .063;
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  onScroll();
  if (reduced) renderer.render(scene, camera); else if (!running) tick();
}
