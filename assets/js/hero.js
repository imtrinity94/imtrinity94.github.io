import * as THREE from "three";

const canvas = document.getElementById("hero-gl");
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "high-performance" });
} catch (e) {
  canvas.remove();
}

if (renderer) {
  const mobile = window.innerWidth < 760;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0, 6);

  // --- particle sphere (fibonacci distribution) ---
  const COUNT = mobile ? 9000 : 22000;
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
    uMouse: { value: new THREE.Vector2(0, 0) },
    uScroll: { value: 0 },
    uPixel: { value: renderer.getPixelRatio() },
    uIntro: { value: 0 },
    uAlpha: { value: mobile ? .75 : 1 }
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
      uniform float uTime; uniform vec2 uMouse; uniform float uScroll; uniform float uPixel; uniform float uIntro;
      attribute float aRnd;
      varying float vN; varying float vRnd; varying float vDepth;
      void main(){
        vec3 p = position;
        float t = uTime * .18;
        float n = snoise(p * 1.4 + vec3(t, t * .7, -t));
        float n2 = snoise(p * 3.2 - vec3(t * 1.3));
        float disp = n * .38 + n2 * .09 + length(uMouse) * .25 * n;
        // explode outward on scroll, implode on intro
        float burst = uScroll * (1.2 + aRnd * 2.5);
        p *= (1.6 + disp + burst) * uIntro;
        // swirl
        float a = uScroll * 1.2 + p.y * .25 * uScroll;
        p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.2 + aRnd * 2.6) * uPixel * (5.5 / -mv.z);
        vN = n; vRnd = aRnd; vDepth = -mv.z;
      }`,
    fragmentShader: /* glsl */`
      uniform float uScroll; uniform float uAlpha;
      varying float vN; varying float vRnd; varying float vDepth;
      void main(){
        vec2 c = gl_PointCoord - .5;
        float d = length(c);
        if (d > .5) discard;
        float glow = smoothstep(.5, 0., d);
        vec3 cyan = vec3(.235, .94, 1.);
        vec3 violet = vec3(.545, .36, 1.);
        vec3 pink = vec3(1., .235, .675);
        vec3 col = mix(cyan, violet, smoothstep(-.4, .4, vN));
        col = mix(col, pink, smoothstep(.45, .9, vN) * .9);
        col += step(.985, vRnd) * .8; // sparkle
        float fade = smoothstep(9., 3.5, vDepth);
        gl_FragColor = vec4(col, glow * .85 * fade * (1. - uScroll * .6) * uAlpha);
      }`
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  // --- orbit rings ---
  const ringGroup = new THREE.Group();
  const ringMat = new THREE.LineBasicMaterial({ color: 0x3cf0ff, transparent: true, opacity: .18 });
  for (let k = 0; k < 3; k++) {
    const curve = new THREE.EllipseCurve(0, 0, 2.6 + k * .45, 2.6 + k * .45, 0, Math.PI * 2);
    const g = new THREE.BufferGeometry().setFromPoints(curve.getPoints(180));
    const ring = new THREE.LineLoop(g, ringMat.clone());
    ring.material.opacity = .16 - k * .04;
    ring.rotation.x = Math.PI / 2 + (k - 1) * .35;
    ring.rotation.y = k * .6;
    ringGroup.add(ring);
  }
  scene.add(ringGroup);

  // --- starfield ---
  const SC = mobile ? 600 : 1500;
  const sp = new Float32Array(SC * 3);
  for (let i = 0; i < SC; i++) {
    sp[i * 3] = (Math.random() - .5) * 40;
    sp[i * 3 + 1] = (Math.random() - .5) * 40;
    sp[i * 3 + 2] = -Math.random() * 30 - 2;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x9aa4ff, size: .035, transparent: true, opacity: .6, depthWrite: false }));
  scene.add(stars);

  // --- interaction ---
  const mouse = new THREE.Vector2(0, 0);
  const target = new THREE.Vector2(0, 0);
  window.addEventListener("pointermove", (e) => {
    target.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  }, { passive: true });

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep sphere on the right on wide screens, centred on mobile
    camera.position.z = w > 900 ? 6 : 7.2;
    camera.setViewOffset(w, h, w > 900 ? -w * .18 : 0, w > 900 ? 0 : h * .05, w, h);
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  let scrollP = 0;
  window.addEventListener("scroll", () => {
    scrollP = Math.min(window.scrollY / (window.innerHeight * 1.2), 1);
  }, { passive: true });

  const start = performance.now();
  let visible = true;
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; if (visible) tick(); });

  function tick() {
    if (!visible) return;
    const t = (performance.now() - start) / 1000;
    mouse.lerp(target, .05);
    uniforms.uTime.value = reduced ? 0 : t;
    uniforms.uMouse.value.copy(mouse);
    uniforms.uScroll.value += (scrollP - uniforms.uScroll.value) * .08;
    const introTarget = window.__booted ? 1 : 0.001;
    uniforms.uIntro.value += (introTarget - uniforms.uIntro.value) * .045;
    points.rotation.y = t * .06 + mouse.x * .4;
    points.rotation.x = mouse.y * .25;
    ringGroup.rotation.z = t * .05;
    ringGroup.rotation.x = mouse.y * .2;
    ringGroup.children.forEach((r, i) => { r.material.opacity = (.16 - i * .04) * (1 - uniforms.uScroll.value); });
    stars.rotation.z = t * .01;
    stars.position.x = -mouse.x * .5;
    stars.position.y = -mouse.y * .5;
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();
}
