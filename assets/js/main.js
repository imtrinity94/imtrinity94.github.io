(function () {
  "use strict";

  var USER = "imtrinity94";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) document.documentElement.classList.add("reduced");

  var LANG_COLORS = {
    JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5", PowerShell: "#5391fe",
    HTML: "#e34c26", CSS: "#663399", Shell: "#89e051", Go: "#00ADD8", Java: "#b07219",
    PHP: "#4F5D95", Jinja: "#a52a22", HCL: "#844FBA", Vue: "#41b883", Dockerfile: "#384d54"
  };

  var state = { config: null, repos: [], own: [], rest: [], filter: "All", q: "", sort: "pushed" };

  /* ---------- helpers ---------- */
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

  /* ---------- clock ---------- */
  function clock() {
    var c = $("#clock");
    function t() {
      try { c.textContent = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }); }
      catch (e) { c.textContent = new Date().toTimeString().slice(0, 5); }
    }
    t(); setInterval(t, 30000);
    $("#yr").textContent = new Date().getFullYear();
  }

  /* ---------- gentle reveal on scroll (one short fade, once) ---------- */
  var io = null;
  function reveal(root) {
    var els = $$(".reveal:not(.in)", root);
    if (reduced || !("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("in"); }); return; }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
      }, { rootMargin: "0px 0px -8% 0px" });
    }
    els.forEach(function (e) { io.observe(e); });
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
            stargazers_count: x.stargazers_count, pushed_at: x.pushed_at, created_at: x.created_at, fork: x.fork, archived: x.archived };
        });
        store("mg-repos", { t: Date.now(), d: slim });
        return slim;
      })
      .catch(function () {
        $("#api-note").textContent = "GitHub is rate-limiting requests right now, so this list may be out of date. Try again in a few minutes.";
        return cached ? cached.d : [];
      });
  }

  /* ---------- featured ---------- */
  function renderFeatured() {
    var byName = {};
    state.repos.forEach(function (r) { byName[r.name.toLowerCase()] = r; });
    $("#featured").innerHTML = state.config.featured.map(function (f, i) {
      var r = byName[f.repo.toLowerCase()] || { name: f.repo, html_url: "https://github.com/" + USER + "/" + f.repo };
      var link = f.link || r.homepage;
      var tags = (f.tags || []).concat(r.language ? [r.language] : []);
      return '<article class="holo reveal"><div class="holo-inner">' +
        '<div class="holo-top"><span>' + String(i + 1).padStart(2, "0") + '</span><span>' + (r.stargazers_count != null ? "★ " + r.stargazers_count : "") + '</span></div>' +
        '<h3>' + esc(f.title || prettyName(r.name)) + '</h3>' +
        '<p>' + esc(f.tagline || r.description || "") + '</p>' +
        '<div class="holo-tags">' + tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join("") + '</div>' +
        '<div class="holo-foot"><span>' + (r.pushed_at ? "Updated " + ago(r.pushed_at) : "") + '</span><span class="holo-links">' +
        (link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener">Live ↗</a>' : "") +
        '<a href="' + esc(r.html_url) + '" target="_blank" rel="noopener">Code ↗</a></span></div>' +
        '</div></article>';
    }).join("");
    reveal($("#featured"));
  }

  /* ---------- archive grid ---------- */
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
        '<div class="repo-meta">' + (r.language ? '<span><i class="dot" style="background:' + (LANG_COLORS[r.language] || "#8b90a0") + '"></i>' + esc(r.language) + '</span>' : "") +
        '<span>★ ' + r.stargazers_count + '</span><span>' + ago(r.pushed_at) + '</span></div></a>';
    }).join("") : '<p class="muted">No matching repositories.</p>';
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
    $("#stat-repos").textContent = state.own.length;
    $("#stat-stars").textContent = stars;
    $("#stat-feat").textContent = state.config.featured.length;
    $("#stat-langs").textContent = Object.keys(langs).length;
  }

  /* ---------- blog (WordPress.com public API) ---------- */
  function blog() {
    fetch("https://public-api.wordpress.com/rest/v1.1/sites/cloudblogger.co.in/posts/?number=6&fields=title,URL,date,featured_image")
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) {
        var tmp = document.createElement("div");
        $("#posts").innerHTML = (d.posts || []).map(function (p) {
          tmp.innerHTML = p.title; var title = tmp.textContent;
          var date = new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
          return '<a class="post" href="' + esc(p.URL) + '" target="_blank" rel="noopener">' +
            '<div class="post-img" style="background-image:url(\'' + esc(p.featured_image || "") + '\')"></div>' +
            '<div class="post-body"><time>' + date + '</time><h4>' + esc(title) + '</h4></div></a>';
        }).join("");
      })
      .catch(function () {
        $("#posts").innerHTML = '<a class="post" href="https://cloudblogger.co.in" target="_blank" rel="noopener"><div class="post-body"><time>cloudblogger.co.in</time><h4>Articles on VCF Orchestrator, VCF Automation and everything in between →</h4></div></a>';
      });
  }

  /* ---------- command palette ---------- */
  function kbar() {
    var dlg = $("#kbar"), inp = $("#kbar-q"), list = $("#kbar-list"), sel = 0, items = [];
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) $("#kbd").textContent = "⌘K";
    function open() { dlg.hidden = false; inp.value = ""; sel = 0; draw(); setTimeout(function () { inp.focus(); }, 10); }
    function close() { dlg.hidden = true; }
    function draw() {
      var q = inp.value.toLowerCase();
      var sections = [["Featured", "#projects"], ["Archive", "#all"], ["Stack", "#stack"], ["Blog", "#blog"], ["Contact", "#contact"]]
        .map(function (s) { return { label: "Go to " + s[0], sub: "section", href: s[1], local: true }; });
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
    dlg.addEventListener("click", function (e) { if (e.target === dlg || e.target.closest("a")) close(); });
  }

  /* ---------- curator (?curate) — asks which repos to feature ---------- */
  function curate() {
    var pane = $("#curate");
    var cfg = state.config;
    var choice = {};
    var featuredNames = cfg.featured.map(function (f) { return f.repo.toLowerCase(); });
    var hidden = (cfg.hidden || []).map(function (h) { return h.toLowerCase(); });
    var seen = load("mg-known") || [];
    var all = state.repos.filter(function (r) { return !r.fork && !r.archived; });
    var newOnes = all.filter(function (r) { var n = r.name.toLowerCase(); return featuredNames.indexOf(n) < 0 && hidden.indexOf(n) < 0 && seen.indexOf(r.name) < 0; });

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
      function find(name) { return all.filter(function (x) { return x.name.toLowerCase() === name.toLowerCase(); })[0]; }
      var featured = [];
      cfg.featured.forEach(function (f) { var r = find(f.repo); if (!r || choice[r.name] === "featured") featured.push(f); });
      all.forEach(function (r) { if (choice[r.name] === "featured" && featuredNames.indexOf(r.name.toLowerCase()) < 0) featured.push({ repo: r.name, title: prettyName(r.name), tagline: r.description || "", tags: [] }); });
      var hiddenOut = (cfg.hidden || []).filter(function (h) { var r = find(h); return !r || choice[r.name] === "hidden"; });
      all.forEach(function (r) { if (choice[r.name] === "hidden" && hiddenOut.map(function (h) { return h.toLowerCase(); }).indexOf(r.name.toLowerCase()) < 0) hiddenOut.push(r.name); });
      var out = { _readme: cfg._readme, github: USER, featured: featured, hidden: hiddenOut };
      var blob = new Blob([JSON.stringify(out, null, 2) + "\n"], { type: "application/json" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "projects.json"; a.click();
      store("mg-known", all.map(function (r) { return r.name; }));
      newOnes = []; draw();
    });

    if (new URLSearchParams(location.search).has("curate")) { pane.hidden = false; draw(); }
  }

  /* ---------- init ---------- */
  function init() {
    clock(); kbar(); wireToolbar(); reveal(document);
    Promise.all([getConfig(), getRepos()]).then(function (res) {
      state.config = res[0];
      state.config.featured = state.config.featured || [];
      var hidden = (state.config.hidden || []).map(function (h) { return h.toLowerCase(); });
      var feat = state.config.featured.map(function (f) { return f.repo.toLowerCase(); });
      state.repos = res[1];
      state.own = state.repos.filter(function (r) { return !r.fork && !r.archived && hidden.indexOf(r.name.toLowerCase()) < 0; });
      state.rest = state.own.filter(function (r) { return feat.indexOf(r.name.toLowerCase()) < 0; });
      renderFeatured(); renderChips(); renderGrid(); stats(); curate();
    });
    blog();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
