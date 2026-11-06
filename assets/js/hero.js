import * as THREE from "three";

// Hero globe: a bright, gently twinkling particle sphere that turns slowly
// on a slight tilt. Scrolling down makes it expand outward and dissolve into
// nothing; scrolling back up gathers it again. No mouse response.
// With reduce-motion on, the rotation stays but twinkle and breathing stop.
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

  // Points spread evenly over a sphere (fibonacci lattice).
  const COUNT = mobile ? 6000 : 14000;
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
    uTwinkle: { value: reduced ? 0 : 1 },
    uExpand: { value: 0 },
    uPixel: { value: renderer.getPixelRatio() },
    uAlpha: { value: mobile ? .6 : 1 }
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
      uniform float uTime; uniform float uTwinkle; uniform float uExpand; uniform float uPixel;
      attribute float aRnd;
      varying float vN; varying float vDepth; varying float vSpark; varying float vExpand;
      void main(){
        vec3 p = position;
        float n = snoise(p * 1.2 + vec3(uTime * .05));
        // Expand on scroll: each point drifts outward at its own pace,
        // so the globe opens up and thins out rather than just growing.
        float e = uExpand * uExpand;
        p *= (1.7 + n * .12) * (1. + e * (2.2 + aRnd * 3.5));

        // Twinkle: roughly 1 in 5 points glints now and then, each on its own slow cycle.
        float spark = 0.;
        if (aRnd > .8) {
          float ph = aRnd * 157.;
          float s = .5 + .5 * sin(uTime * (1.2 + fract(ph) * 1.8) + ph);
          spark = pow(s, 10.) * uTwinkle;
        }

        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min((2. + aRnd * 2. + spark * 5.) * uPixel * (5.5 / -mv.z), 7. * uPixel);
        vN = n; vDepth = -mv.z; vSpark = spark; vExpand = uExpand;
      }`,
    fragmentShader: /* glsl */`
      uniform float uAlpha;
      varying float vN; varying float vDepth; varying float vSpark; varying float vExpand;
      void main(){
        float d = length(gl_PointCoord - .5);
        if (d > .5) discard;
        float core = smoothstep(.5, 0., d);
        float glint = smoothstep(.22, 0., d);           // bright centre for sparkles
        vec3 a = vec3(.42, .82, 1.);                    // bright sky blue
        vec3 b = vec3(.62, .55, 1.);                    // soft violet
        vec3 col = mix(a, b, smoothstep(-.5, .5, vN));
        col = mix(col, vec3(1.), vSpark * .85);          // sparkles flash near-white
        float fade = smoothstep(10., 3.6, vDepth);
        float alpha = (core * .9 + glint * vSpark * 1.5) * fade * uAlpha;
        alpha *= 1. - smoothstep(.2, .85, vExpand);     // dissolve to nothing as it expands
        gl_FragColor = vec4(col, alpha);
      }`
  });
  const points = new THREE.Points(geo, mat);
  // Slight tilt so the rotation reads as a globe turning.
  points.rotation.x = 0.35;
  points.rotation.z = -0.12;
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

  // Scroll progress through the hero: 0 at the top, 1 once it is mostly out of view.
  const hero = document.querySelector(".hero");
  let target = 0;
  function progress() {
    const h = hero ? hero.offsetHeight : window.innerHeight;
    return Math.min(Math.max(window.scrollY / (h * .75), 0), 1);
  }

  let visible = !document.hidden;
  let running = false;
  let gone = false;

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

  const start = performance.now();
  const SPEED = .1; // radians per second: one full turn about every minute
  function tick() {
    if (!visible) { running = false; return; }
    running = true;
    const t = (performance.now() - start) / 1000;
    if (!reduced) uniforms.uTime.value = t;
    // Ease the expansion towards the scroll position so it never jumps.
    uniforms.uExpand.value += (target - uniforms.uExpand.value) * .12;
    points.rotation.y = t * SPEED;
    renderer.render(scene, camera);
    // Fully dissolved: stop drawing until the user scrolls back up.
    if (target >= 1 && uniforms.uExpand.value > .995) {
      gone = true; running = false; canvas.style.visibility = "hidden"; return;
    }
    requestAnimationFrame(tick);
  }
  target = progress();
  uniforms.uExpand.value = target;
  tick();
}
