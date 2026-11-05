(function () {
  "use strict";

  var USER = "imtrinity94";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGsap = typeof window.gsap !== "undefined";
  if (hasGsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  if (!hasGsap || reduced) document.documentElement.classList.add("reduced");

  var LANG_COLORS = {
    JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5", PowerShell: "#012456",
    HTML: "#e34c26", CSS: "#563d7c", Shell: "#89e051", Go: "#00ADD8", Java: "#b07219",
    PHP: "#4F5D95", Jinja: "#a52a22", HCL: "#844FBA", Vue: "#41b883", Dockerfile: "#384d54"
  };
  var ORBS = ["#3cf0ff", "#8b5cff", "#ff3cac", "#c6ff3c"];

  var state = { config: null, repos: [], rest: [], filter: "All", q: "", sort: "pushed" };

  /* ---------- storage helpers (never throw) ---------- */
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function load(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function prettyName(n) { return n.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim(); }
  function ago(iso) {
    var d = (Date.now() - new Date(iso).getTime()) / 864e5;
    if (d < 1) return "today";
    if (d < 30) return Math.floor(d) + "d ago";
    if (d < 365) return Math.floor(d / 30) + "mo ago";
    return Math.floor(d / 365) + "y ago";
  }

  /* ---------- boot sequence ---------- */
  function boot() {
    var log = $("#boot-log"), bar = $(".boot-bar span"), el = $("#boot");
    document.body.classList.add("booting");
    var seen = load("mg-booted");
    var lines = [
      '<span class="dim">[0.000]</span> vco-kernel 9.1.0 — initialising orchestrator runtime',
      '<span class="dim">[0.112]</span> mounting /workflows /actions /config-elements … <span class="ok">ok</span>',
      '<span class="dim">[0.238]</span> handshake api.github.com/' + USER + ' … <span class="ok">ok</span>',
      '<span class="dim">[0.341]</span> System.log("hello, world"); <span class="ok">ok</span>',
      '<span class="dim">[0.420]</span> rendering particle field … <span class="ok">ready</span>'
    ];
    var step = seen || reduced ? 0 : 230;
    var i = 0;
    function next() {
      if (i < lines.length) {
        log.innerHTML += lines[i] + "\n";
        bar.style.width = ((i + 1) / lines.length * 100) + "%";
        i++;
        setTimeout(next, step);
      } else {
        setTimeout(done, step ? 280 : 0);
      }
    }
    function done() {
      store("mg-booted", 1);
      window.__booted = true;
      document.body.classList.remove("booting");
      if (hasGsap && !reduced) {
        gsap.to(el, { yPercent: -100, duration: 1, ease: "expo.inOut", onComplete: function () { el.remove(); } });
        intro();
      } else { el.remove(); }
    }
    next();
  }

  function intro() {
    gsap.from(".hero-title .word", { yPercent: 110, duration: 1.4, ease: "expo.out", stagger: .12, delay: .35 });
    gsap.to(".hero .reveal", { opacity: 1, y: 0, duration: 1.1, ease: "expo.out", stagger: .1, delay: .7 });
    gsap.from(".nav", { y: -80, opacity: 0, duration: 1, ease: "expo.out", delay: .6 });
    setTimeout(glitchLoop, 1800);
    setTimeout(countUp, 1000);
  }

  function glitchLoop() {
    var words = $$(".word[data-glitch]");
    function fire() {
      var w = words[Math.floor(Math.random() * words.length)];
      w.classList.add("glitching");
      setTimeout(function () { w.classList.remove("glitching"); }, 720);
      setTimeout(fire, 2500 + Math.random() * 3500);
    }
    if (!reduced) fire();
  }

  /* ---------- clock + typer ---------- */
  function clock() {
    var c = $("#clock");
    function t() {
      try { c.textContent = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour12: false }); }
      catch (e) { c.textContent = new Date().toTimeString().slice(0, 8); }
    }
    t(); setInterval(t, 1000);
    $("#yr").textContent = new Date().getFullYear();
  }

  function typer() {
    var el = $("#typer");
    var words = ["MCP servers for VCF.", "vRO developer tools.", "open-source books.", "AI-driven automation.", "things that ship."];
    if (reduced) { el.textContent = words[0]; return; }
    var w = 0, c = 0, del = false;
    function tick() {
      var word = words[w];
      el.textContent = word.slice(0, c);
      if (!del && c < word.length) { c++; setTimeout(tick, 55); }
      else if (!del) { del = true; setTimeout(tick, 1600); }
      else if (c > 0) { c--; setTimeout(tick, 28); }
      else { del = false; w = (w + 1) % words.length; setTimeout(tick, 300); }
    }
    tick();
  }

  /* ---------- text scramble on nav hover ---------- */
  function scramble() {
    var chars = "!<>-_\\/[]{}—=+*^?#01";
    $$("[data-scramble]").forEach(function (a) {
      var orig = a.textContent, running = false;
      a.addEventListener("mouseenter", function () {
        if (running || reduced) return;
        running = true;
        var f = 0;
        var iv = setInterval(function () {
          a.textContent = orig.split("").map(function (ch, i) { return i < f / 2 ? orig[i] : chars[Math.floor(Math.random() * chars.length)]; }).join("");
          f++;
          if (f / 2 > orig.length) { clearInterval(iv); a.textContent = orig; running = false; }
        }, 30);
      });
    });
  }

  /* ---------- cursor + magnetic ---------- */
  function cursor() {
    var c = $("#cursor");
    if (!c || window.matchMedia("(pointer: coarse)").matches) return;
    var x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    addEventListener("pointermove", function (e) { x = e.clientX; y = e.clientY; }, { passive: true });
    (function loop() { cx += (x - cx) * .2; cy += (y - cy) * .2; c.style.transform = "translate(" + cx + "px," + cy + "px)"; requestAnimationFrame(loop); })();
    document.addEventListener("pointerover", function (e) { if (e.target.closest("a,button,input,.holo,.repo")) c.classList.add("hover"); });
    document.addEventListener("pointerout", function (e) { if (e.target.closest("a,button,input,.holo,.repo")) c.classList.remove("hover"); });
  }

  function magnetic(root) {
    if (reduced || !hasGsap || window.matchMedia("(pointer: coarse)").matches) return;
    $$("[data-magnetic]", root).forEach(function (el) {
      if (el.__mag) return; el.__mag = 1;
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * .3, y: (e.clientY - r.top - r.height / 2) * .4, duration: .5, ease: "power3.out" });
      });
      el.addEventListener("pointerleave", function () { gsap.to(el, { x: 0, y: 0, duration: .8, ease: "elastic.out(1,.4)" }); });
    });
  }

  function tilt(root) {
    if (reduced || window.matchMedia("(pointer: coarse)").matches) return;
    $$(".holo,[data-tilt]", root).forEach(function (el) {
      if (el.__tilt) return; el.__tilt = 1;
      var inner = el.querySelector(".holo-inner") || el;
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.transform = "perspective(1000px) rotateY(" + ((px - .5) * 10) + "deg) rotateX(" + ((.5 - py) * 10) + "deg)";
        inner.style.setProperty("--mx", px * 100 + "%");
        inner.style.setProperty("--my", py * 100 + "%");
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  }

  /* ---------- scroll reveals ---------- */
  function reveals() {
    if (!hasGsap || reduced || !window.ScrollTrigger) {
      $$(".reveal").forEach(function (e) { e.style.opacity = 1; e.style.transform = "none"; });
      $$(".stack-card").forEach(function (e) { e.classList.add("in"); });
      return;
    }
    $$(".section .reveal, .contact .reveal").forEach(function (el) {
      gsap.to(el, { opacity: 1, y: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%", onEnter: function () { el.classList.add("in"); } } });
    });
    gsap.to(".marquee-track", { xPercent: -8, ease: "none", scrollTrigger: { trigger: ".marquee", scrub: true } });
    gsap.to(".hero-title", { yPercent: -30, opacity: .2, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
  }

  function staggerIn(sel) {
    if (!hasGsap || reduced || !window.ScrollTrigger) return;
    ScrollTrigger.batch(sel, {
      start: "top 92%",
      onEnter: function (b) { gsap.fromTo(b, { opacity: 0, y: 50, rotateX: -12 }, { opacity: 1, y: 0, rotateX: 0, duration: 1, ease: "expo.out", stagger: .07, overwrite: true }); }
    });
  }

  /* ---------- data ---------- */
  function getConfig() {
    return fetch("projects.json", { cache: "no-cache" }).then(function (r) { return r.json(); })
      .catch(function () { return { featured: [], hidden: [] }; });
  }

  function getRepos() {
    var cached = load("mg-repos");
    if (cached && Date.now() - cached.t < 15 * 60 * 1000) return Promise.resolve(cached.d);
    return fetch("https://api.github.com/users/" + USER + "/repos?per_page=100&sort=pushed", { headers: { Accept: "application/vnd.github+json" } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        var slim = d.map(function (x) {
          return { name: x.name, description: x.description, html_url: x.html_url, homepage: x.homepage, language: x.language,
            stargazers_count: x.stargazers_count, forks_count: x.forks_count, pushed_at: x.pushed_at, created_at: x.created_at,
            fork: x.fork, archived: x.archived, topics: x.topics || [] };
        });
        store("mg-repos", { t: Date.now(), d: slim });
        return slim;
      })
      .catch(function () {
        $("#api-note").textContent = "// GitHub API rate-limited — showing cached data. Refresh in a few minutes.";
        return cached ? cached.d : [];
      });
  }

  /* ---------- render featured ---------- */
  function renderFeatured() {
    var wrap = $("#featured");
    var byName = {};
    state.repos.forEach(function (r) { byName[r.name.toLowerCase()] = r; });
    var html = state.config.featured.map(function (f, i) {
      var r = byName[f.repo.toLowerCase()] || { name: f.repo, html_url: "https://github.com/" + USER + "/" + f.repo };
      var link = f.link || r.homepage;
      var tags = (f.tags || []).concat(r.language ? [r.language] : []);
      return '<article class="holo" style="--orb:' + ORBS[i % ORBS.length] + '">' +
        '<div class="holo-inner"><div class="holo-orb"></div>' +
        '<div class="holo-top"><span class="holo-idx">P/' + String(i + 1).padStart(2, "0") + '</span><span>' + (r.stargazers_count != null ? "★ " + r.stargazers_count : "") + '</span></div>' +
        '<h3>' + esc(f.title || prettyName(r.name)) + '</h3>' +
        '<p>' + esc(f.tagline || r.description || "") + '</p>' +
        '<div class="holo-tags">' + tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join("") + '</div>' +
        '<div class="holo-foot"><span>' + (r.pushed_at ? "updated " + ago(r.pushed_at) : "") + '</span><span class="holo-links">' +
        (link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener">Live ↗</a>' : "") +
        '<a href="' + esc(r.html_url) + '" target="_blank" rel="noopener">Code ↗</a></span></div>' +
        '</div></article>';
    }).join("");
    wrap.innerHTML = html;
    tilt(wrap);
    staggerIn("#featured .holo");
  }

  /* ---------- render grid ---------- */
  function renderChips() {
    var langs = {};
    state.rest.forEach(function (r) { if (r.language) langs[r.language] = (langs[r.language] || 0) + 1; });
    var list = ["All"].concat(Object.keys(langs).sort(function (a, b) { return langs[b] - langs[a]; }).slice(0, 6));
    $("#chips").innerHTML = list.map(function (l) { return '<button class="chip' + (l === state.filter ? " on" : "") + '" data-l="' + esc(l) + '">' + esc(l) + '</button>'; }).join("");
  }

  function renderGrid() {
    var q = state.q.toLowerCase();
    var list = state.rest.filter(function (r) {
      if (state.filter !== "All" && r.language !== state.filter) return false;
      if (q && (r.name + " " + (r.description || "")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    list.sort(function (a, b) {
      if (state.sort === "stars") return b.stargazers_count - a.stargazers_count;
      if (state.sort === "name") return a.name.localeCompare(b.name);
      return new Date(b.pushed_at) - new Date(a.pushed_at);
    });
    $("#grid").innerHTML = list.length ? list.map(function (r) {
      var fresh = (Date.now() - new Date(r.created_at).getTime()) < 45 * 864e5;
      return '<a class="repo" href="' + esc(r.homepage || r.html_url) + '" target="_blank" rel="noopener">' +
        (fresh ? '<span class="new-badge">NEW</span>' : "") +
        '<h4>' + esc(r.name) + '</h4><p>' + esc(r.description || "No description yet.") + '</p>' +
        '<div class="repo-meta">' + (r.language ? '<span><i class="dot" style="background:' + (LANG_COLORS[r.language] || "#8a90b2") + '"></i>' + esc(r.language) + '</span>' : "") +
        '<span>★ ' + r.stargazers_count + '</span><span>' + ago(r.pushed_at) + '</span></div></a>';
    }).join("") : '<p class="muted mono">// no matches</p>';
    staggerIn("#grid .repo");
  }

  function wireToolbar() {
    $("#chips").addEventListener("click", function (e) {
      var b = e.target.closest(".chip"); if (!b) return;
      state.filter = b.getAttribute("data-l"); renderChips(); renderGrid();
    });
    $("#filter-q").addEventListener("input", function (e) { state.q = e.target.value; renderGrid(); });
    $$(".sort button").forEach(function (b) {
      b.addEventListener("click", function () {
        $$(".sort button").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on"); state.sort = b.getAttribute("data-sort"); renderGrid();
      });
    });
  }

  function stats() {
    var stars = 0, langs = {};
    state.own.forEach(function (r) { stars += r.stargazers_count; if (r.language) langs[r.language] = 1; });
    $("#stat-repos").setAttribute("data-count", state.own.length);
    $("#stat-stars").setAttribute("data-count", stars);
    $("#stat-langs").setAttribute("data-count", Object.keys(langs).length);
    $("#stat-feat").setAttribute("data-count", state.config.featured.length);
    if (window.__booted) countUp();
  }

  function countUp() {
    $$("[data-count]").forEach(function (el) {
      var to = +el.getAttribute("data-count");
      if (!hasGsap || reduced) { el.textContent = to; return; }
      var o = { v: +el.textContent || 0 };
      gsap.to(o, { v: to, duration: 2, ease: "expo.out", onUpdate: function () { el.textContent = Math.round(o.v); } });
    });
  }

  /* ---------- blog (WordPress.com public API, CORS-enabled) ---------- */
  function blog() {
    fetch("https://public-api.wordpress.com/rest/v1.1/sites/cloudblogger.co.in/posts/?number=6&fields=title,URL,date,featured_image,excerpt")
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) {
        var tmp = document.createElement("div");
        $("#posts").innerHTML = (d.posts || []).map(function (p) {
          tmp.innerHTML = p.title; var title = tmp.textContent;
          var date = new Date(p.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
          return '<a class="post" href="' + esc(p.URL) + '" target="_blank" rel="noopener">' +
            '<div class="post-img" style="background-image:url(\'' + esc(p.featured_image || "") + '\')"></div>' +
            '<div class="post-body"><time>' + date + '</time><h4>' + esc(title) + '</h4></div></a>';
        }).join("");
        staggerIn("#posts .post");
      })
      .catch(function () {
        $("#posts").innerHTML = '<a class="post" href="https://cloudblogger.co.in" target="_blank" rel="noopener"><div class="post-body"><time>CLOUDBLOGGER.CO.IN</time><h4>Deep dives on VCF Orchestrator, VCF Automation and everything in between →</h4></div></a>';
      });
  }

  /* ---------- command palette ---------- */
  function kbar() {
    var dlg = $("#kbar"), inp = $("#kbar-q"), list = $("#kbar-list"), sel = 0, items = [];
    function open() { dlg.hidden = false; inp.value = ""; draw(); setTimeout(function () { inp.focus(); }, 10); }
    function close() { dlg.hidden = true; }
    function draw() {
      var q = inp.value.toLowerCase();
      var sections = [{ name: "Featured", href: "#projects" }, { name: "Archive", href: "#all" }, { name: "Stack", href: "#stack" }, { name: "Blog", href: "#blog" }, { name: "Contact", href: "#contact" }]
        .map(function (s) { return { label: "Go to " + s.name, sub: "section", href: s.href, local: true }; });
      var repos = state.own.map(function (r) { return { label: r.name, sub: r.language || "repo", href: r.homepage || r.html_url }; });
      items = sections.concat(repos).filter(function (i) { return !q || i.label.toLowerCase().indexOf(q) >= 0; }).slice(0, 40);
      sel = Math.min(sel, Math.max(items.length - 1, 0));
      list.innerHTML = items.map(function (i, k) {
        return '<li class="' + (k === sel ? "sel" : "") + '"><a href="' + esc(i.href) + '"' + (i.local ? "" : ' target="_blank" rel="noopener"') + '><span>' + esc(i.label) + '</span><small>' + esc(i.sub) + '</small></a></li>';
      }).join("");
    }
    $("#kbar-open").addEventListener("click", open);
    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); dlg.hidden ? open() : close(); }
      else if (e.key === "/" && dlg.hidden && document.activeElement.tagName !== "INPUT") { e.preventDefault(); open(); }
      else if (!dlg.hidden) {
        if (e.key === "Escape") close();
        if (e.key === "ArrowDown") { sel = Math.min(sel + 1, items.length - 1); draw(); e.preventDefault(); }
        if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
        if (e.key === "Enter") { var a = list.querySelector(".sel a"); if (a) { a.click(); close(); } }
      }
    });
    inp.addEventListener("input", function () { sel = 0; draw(); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) close(); if (e.target.closest("a")) close(); });
  }

  /* ---------- curator (?curate) — asks which repos to feature ---------- */
  function curate() {
    var params = new URLSearchParams(location.search);
    var pane = $("#curate");
    var choice = {};
    var cfg = state.config;
    var featuredNames = cfg.featured.map(function (f) { return f.repo.toLowerCase(); });
    var hidden = (cfg.hidden || []).map(function (h) { return h.toLowerCase(); });
    var seen = load("mg-known") || [];
    var all = state.repos.filter(function (r) { return !r.fork && !r.archived; });
    var newOnes = all.filter(function (r) { return featuredNames.indexOf(r.name.toLowerCase()) < 0 && hidden.indexOf(r.name.toLowerCase()) < 0 && seen.indexOf(r.name) < 0; });

    all.forEach(function (r) {
      var n = r.name.toLowerCase();
      choice[r.name] = featuredNames.indexOf(n) >= 0 ? "featured" : hidden.indexOf(n) >= 0 ? "hidden" : "auto";
    });

    function draw() {
      $("#curate-new").textContent = newOnes.length
        ? newOnes.length + " repo" + (newOnes.length > 1 ? "s" : "") + " you haven't reviewed yet are marked NEW. Pick ★ to feature them."
        : "Everything has been reviewed. Change any row, then download.";
      var sorted = all.slice().sort(function (a, b) {
        var na = newOnes.indexOf(a) >= 0 ? 0 : 1, nb = newOnes.indexOf(b) >= 0 ? 0 : 1;
        return na - nb || new Date(b.pushed_at) - new Date(a.pushed_at);
      });
      $("#curate-list").innerHTML = sorted.map(function (r) {
        var v = choice[r.name];
        return '<div class="c-row" data-n="' + esc(r.name) + '"><div><b>' + esc(r.name) + '</b>' + (newOnes.indexOf(r) >= 0 ? '<span class="new-badge">NEW</span>' : "") +
          '<small>' + esc(r.description || "—") + '</small></div><div class="c-seg">' +
          ["featured", "auto", "hidden"].map(function (k) { return '<button data-v="' + k + '" class="' + (v === k ? "on" : "") + '" title="' + k + '">' + { featured: "★", auto: "◌", hidden: "✕" }[k] + '</button>'; }).join("") +
          '</div></div>';
      }).join("");
    }

    $("#curate-list").addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      choice[b.closest(".c-row").getAttribute("data-n")] = b.getAttribute("data-v"); draw();
    });
    $("#curate-close").addEventListener("click", function () { pane.hidden = true; history.replaceState(null, "", location.pathname); });
    $("#curate-save").addEventListener("click", function () {
      var keep = {};
      cfg.featured.forEach(function (f) { keep[f.repo.toLowerCase()] = f; });
      var featured = [];
      // keep existing order first, then append newly featured
      cfg.featured.forEach(function (f) { var r = all.filter(function (x) { return x.name.toLowerCase() === f.repo.toLowerCase(); })[0]; if (!r || choice[r.name] === "featured") featured.push(f); });
      all.forEach(function (r) { if (choice[r.name] === "featured" && !keep[r.name.toLowerCase()]) featured.push({ repo: r.name, tagline: r.description || "", tags: [] }); });
      var hiddenOut = (cfg.hidden || []).filter(function (h) { var r = all.filter(function (x) { return x.name.toLowerCase() === h.toLowerCase(); })[0]; return !r || choice[r.name] === "hidden"; });
      all.forEach(function (r) { if (choice[r.name] === "hidden" && hiddenOut.map(function (h) { return h.toLowerCase(); }).indexOf(r.name.toLowerCase()) < 0) hiddenOut.push(r.name); });
      var out = { _readme: cfg._readme, github: USER, featured: featured, hidden: hiddenOut };
      var blob = new Blob([JSON.stringify(out, null, 2) + "\n"], { type: "application/json" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "projects.json"; a.click();
      store("mg-known", all.map(function (r) { return r.name; }));
      newOnes = []; draw();
    });

    // a small nudge on the page itself when there are unreviewed repos
    if (params.has("curate")) { pane.hidden = false; draw(); }
  }

  /* ---------- init ---------- */
  function init() {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) $("#kbd").textContent = "⌘K";
    clock(); typer(); scramble(); cursor(); boot(); kbar(); wireToolbar(); reveals(); magnetic(document);
    Promise.all([getConfig(), getRepos()]).then(function (res) {
      state.config = res[0];
      state.config.featured = state.config.featured || [];
      var hidden = (state.config.hidden || []).map(function (h) { return h.toLowerCase(); });
      var feat = state.config.featured.map(function (f) { return f.repo.toLowerCase(); });
      state.repos = res[1];
      state.own = state.repos.filter(function (r) { return !r.fork && !r.archived && hidden.indexOf(r.name.toLowerCase()) < 0; });
      state.rest = state.own.filter(function (r) { return feat.indexOf(r.name.toLowerCase()) < 0; });
      renderFeatured(); renderChips(); renderGrid(); stats(); curate();
      if (window.ScrollTrigger) setTimeout(function () { ScrollTrigger.refresh(); }, 300);
    });
    blog();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
