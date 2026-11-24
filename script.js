// Theme toggle (persisted per-browser; default follows system prefers-color-scheme)
(function () {
  const root = document.documentElement;
  const stored = localStorage.getItem("bimazim-theme");
  if (stored) root.setAttribute("data-theme", stored);

  const toggle = document.getElementById("theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const current = root.getAttribute("data-theme")
        || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const next = current === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("bimazim-theme", next);
    });
  }
})();

// Tools section: fetch the real, complete catalog (generated straight from server/src/tools/
// and unreal/server/src/index.js — see docs/ARCHITECTURE.md) and render every tab/panel/row from
// it, with a live search box. Nothing here is a hand-written sample.
(function () {
  const tabsEl = document.getElementById("tools-tabs");
  const panelsEl = document.getElementById("tools-panels");
  const searchInput = document.getElementById("tools-search");
  const searchCount = document.getElementById("tools-search-count");
  const totalCountEl = document.getElementById("tools-total-count");
  if (!tabsEl || !panelsEl) return;

  const ENGINE_LABELS = {
    revit: "Revit",
    navisworks: "Navisworks",
    tekla: "Tekla Structures",
    autocad: "AutoCAD",
    sketchup: "SketchUp",
    max: "3ds Max",
    unreal: "Unreal Engine",
    sap2000: "SAP2000",
    etabs: "ETABS",
    safe: "SAFE",
    robot: "Robot Structural Analysis",
    etap: "ETAP",
    epanet: "EPANET",
    iesve: "IES VE",
    archicad: "ArchiCAD",
    vectorworks: "Vectorworks",
    agi32: "AGi32",
    hammer: "Bentley HAMMER",
    bridges: "Cross-Engine Bridges",
    office: "Office",
  };
  const ENGINE_ORDER = [
    "revit", "navisworks", "tekla", "autocad", "sketchup", "max", "unreal",
    "sap2000", "etabs", "safe", "robot",
    "etap", "epanet", "iesve", "archicad", "vectorworks", "agi32", "hammer",
    "bridges", "office",
  ];

  function render(catalog) {
    if (totalCountEl) totalCountEl.textContent = catalog.length;

    const byEngine = new Map();
    for (const tool of catalog) {
      if (!byEngine.has(tool.engine)) byEngine.set(tool.engine, []);
      byEngine.get(tool.engine).push(tool);
    }

    const engines = ENGINE_ORDER.filter((e) => byEngine.has(e));
    engines.forEach((engine, i) => {
      const tools = byEngine.get(engine);
      const panelId = `panel-${engine}`;

      const tab = document.createElement("button");
      tab.className = "tab-btn" + (i === 0 ? " active" : "");
      tab.dataset.panel = panelId;
      tab.textContent = `${ENGINE_LABELS[engine] || engine} (${tools.length})`;
      tabsEl.appendChild(tab);

      const panel = document.createElement("div");
      panel.id = panelId;
      panel.className = "tool-panel" + (i === 0 ? " active" : "");
      const list = document.createElement("div");
      list.className = "tool-list";

      tools
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((tool) => {
          const row = document.createElement("div");
          row.className = "tool-row";
          row.dataset.search = (tool.name + " " + tool.description).toLowerCase();
          const nameEl = document.createElement("span");
          nameEl.className = "name";
          nameEl.textContent = tool.name;
          const descEl = document.createElement("span");
          descEl.className = "desc";
          descEl.textContent = tool.description;
          row.appendChild(nameEl);
          row.appendChild(descEl);
          list.appendChild(row);
        });

      panel.appendChild(list);
      panelsEl.appendChild(panel);
    });

    const tabs = Array.from(tabsEl.querySelectorAll(".tab-btn"));
    const panels = Array.from(panelsEl.querySelectorAll(".tool-panel"));
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        panels.forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        const target = document.getElementById(tab.dataset.panel);
        if (target) target.classList.add("active");
        updateSearchCount();
      });
    });

    function updateSearchCount() {
      if (!searchCount) return;
      const activePanel = panelsEl.querySelector(".tool-panel.active");
      if (!activePanel) return;
      const rows = Array.from(activePanel.querySelectorAll(".tool-row"));
      const visible = rows.filter((r) => !r.classList.contains("is-hidden")).length;
      searchCount.textContent = searchInput && searchInput.value.trim()
        ? `${visible} of ${rows.length} match`
        : `${rows.length} tools`;
    }

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        const term = searchInput.value.trim().toLowerCase();
        panelsEl.querySelectorAll(".tool-row").forEach((row) => {
          row.classList.toggle("is-hidden", term.length > 0 && !row.dataset.search.includes(term));
        });
        updateSearchCount();
      });
    }

    updateSearchCount();
  }

  fetch("tools-catalog.json", { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error("bad status " + res.status);
      return res.json();
    })
    .then(render)
    .catch(() => {
      panelsEl.innerHTML = '<p class="tools-empty">Couldn’t load the tool catalog right now.</p>';
    });
})();

// Stat-strip count-up (hero numbers with data-count)
(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const counters = document.querySelectorAll("[data-count]");
  if (!counters.length) return;

  function animateCount(el) {
    const target = Number(el.dataset.count);
    if (reduceMotion) { el.textContent = target; return; }
    const duration = 1200;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });
  counters.forEach((el) => observer.observe(el));
})();

// Chat simulation: tabbed, scripted conversations with staggered message reveal
(function () {
  const chat = document.getElementById("sim-chat");
  if (!chat) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tabs = Array.from(document.querySelectorAll(".sim-tab"));
  const scripts = Array.from(chat.querySelectorAll(".sim-script"));
  const replayBtn = document.getElementById("sim-replay");
  let timers = [];

  function clearTimers() {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
  }

  function play(scriptName) {
    clearTimers();
    scripts.forEach((s) => {
      s.hidden = s.dataset.script !== scriptName;
      s.querySelectorAll(".sim-msg").forEach((m) => m.classList.remove("visible"));
    });

    const active = scripts.find((s) => s.dataset.script === scriptName);
    if (!active) return;
    const messages = Array.from(active.querySelectorAll(".sim-msg"));

    if (reduceMotion) {
      messages.forEach((m) => m.classList.add("visible"));
      return;
    }

    messages.forEach((m) => {
      const delay = Number(m.dataset.at) || 0;
      timers.push(setTimeout(() => {
        m.classList.add("visible");
        chat.scrollTop = chat.scrollHeight;
      }, delay));
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      play(tab.dataset.sim);
    });
  });

  if (replayBtn) {
    replayBtn.addEventListener("click", () => {
      const activeTab = tabs.find((t) => t.classList.contains("active"));
      if (activeTab) play(activeTab.dataset.sim);
    });
  }

  // Start the first scenario once it scrolls into view, not immediately on load.
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        play("revit");
        observer.disconnect();
      }
    });
  }, { threshold: 0.3 });
  observer.observe(chat);
})();

// Showcase player: auto-advancing animated scenes, with manual controls
(function () {
  const player = document.getElementById("player");
  if (!player) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scenes = Array.from(player.querySelectorAll(".scene"));
  const dots = Array.from(player.querySelectorAll(".player-dot"));
  const toggleBtn = document.getElementById("player-toggle");
  const progressFill = document.getElementById("player-progress");
  const bigCount = player.querySelector(".big-count");

  const SCENE_MS = 5000;
  const TICK_MS = 100;
  let current = 0;
  let playing = !reduceMotion;
  let segmentStart = performance.now();
  let bigCountAnimated = false;

  function animateBigCount() {
    if (bigCountAnimated || !bigCount) return;
    bigCountAnimated = true;
    const target = Number(bigCount.dataset.target);
    if (reduceMotion) { bigCount.textContent = target; return; }
    const start = performance.now();
    const duration = 1400;
    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      bigCount.textContent = Math.round(target * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function showScene(index) {
    current = (index + scenes.length) % scenes.length;
    scenes.forEach((s, i) => s.classList.toggle("active", i === current));
    dots.forEach((d, i) => d.classList.toggle("active", i === current));
    segmentStart = performance.now();
    if (current === 1) animateBigCount();
  }

  // A plain interval (not requestAnimationFrame) on purpose: a progress bar only needs ~10
  // updates/sec to look smooth (the width change is already CSS-transitioned), and an rAF loop
  // that mutates the DOM every single frame forever can stop some tools' "page finished
  // rendering" idle-detection from ever firing.
  function tick() {
    if (!playing) return;
    const elapsed = performance.now() - segmentStart;
    const pct = Math.min(100, (elapsed / SCENE_MS) * 100);
    if (progressFill) progressFill.style.width = pct + "%";
    if (elapsed >= SCENE_MS) showScene(current + 1);
  }
  setInterval(tick, TICK_MS);

  function setPlaying(next) {
    playing = next;
    if (toggleBtn) {
      toggleBtn.innerHTML = playing ? "&#10074;&#10074;" : "&#9654;";
      toggleBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
    }
  }

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      showScene(i);
      setPlaying(true);
    });
  });

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => setPlaying(!playing));
  }

  showScene(0);
  setPlaying(!reduceMotion);
})();

// License roster: fetch the published Google Sheet (CSV) behind the license-request Google
// Form, filter to Status=Approved, and render a count + username list. Never shows email
// addresses — only usernames, and only approved ones.
(function () {
  const countEl = document.getElementById("roster-count");
  const listEl = document.getElementById("roster-list");
  if (!countEl || !listEl) return;

  // BIM-AZIM TODO: replace with the real published-CSV URL (Google Sheet > File > Share >
  // Publish to web > CSV) once the license-request Google Form exists — see docs/LICENSING.md.
  const LICENSE_CSV_URL = "REPLACE_WITH_PUBLISHED_CSV_URL";

  function parseCsv(text) {
    const rows = [];
    let row = [], field = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\n") {
        row.push(field); rows.push(row); row = []; field = "";
      } else if (c !== "\r") {
        field += c;
      }
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
  }

  async function loadRoster() {
    try {
      const res = await fetch(LICENSE_CSV_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("bad status " + res.status);
      const rows = parseCsv(await res.text()).filter((r) => r.length > 1 || r[0] !== "");
      if (rows.length < 1) throw new Error("empty sheet");

      const header = rows[0].map((h) => h.trim().toLowerCase());
      const userIdx = header.indexOf("username");
      const statusIdx = header.indexOf("status");
      if (userIdx === -1) throw new Error("no Username column");

      const approved = rows
        .slice(1)
        .filter((r) => statusIdx === -1 || (r[statusIdx] || "").trim().toLowerCase() === "approved")
        .map((r) => (r[userIdx] || "").trim())
        .filter(Boolean);

      countEl.textContent = approved.length;
      listEl.innerHTML = approved.length
        ? approved.map((u) => `<span class="roster-pill"></span>`).join("")
        : '<p class="roster-empty">No approved licenses yet — be the first to request one.</p>';
      if (approved.length) {
        // Set text via textContent per-pill to avoid any HTML injection from sheet contents.
        Array.from(listEl.children).forEach((pill, i) => { pill.textContent = approved[i]; });
      }
    } catch (err) {
      countEl.textContent = "—";
      listEl.innerHTML = '<p class="roster-empty">Can’t load the roster right now.</p>';
    }
  }

  loadRoster();
})();

// Scroll-reveal: fade/rise-in for section headers, feature cards, engine cards, and the
// architecture/install blocks as they enter the viewport. Pure CSS transition triggered by an
// IntersectionObserver adding .is-visible — see the .reveal rules in styles.css. Skips anything
// already inside the hero (visible on load) and respects prefers-reduced-motion by doing nothing
// (the CSS fallback there shows everything immediately regardless).
(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const targets = document.querySelectorAll(
    ".section-head, .grid-3 .card, .player, .sim, .arch-flow, .install-step, .tools-tabs, .tools-search-row"
  );
  if (!targets.length) return;

  if (reduceMotion) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  targets.forEach((el, i) => {
    el.classList.add("reveal");
    // Stagger siblings within the same grid so cards cascade rather than popping in unison;
    // reset every 8th so a very long list (e.g. install steps) doesn't end up with a multi-second tail.
    el.style.setProperty("--reveal-delay", `${(i % 8) * 70}ms`);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  targets.forEach((el) => observer.observe(el));
})();

// Nav bar: add a shadow + slightly denser background once the page has scrolled past the hero
// badge, so the sticky nav reads as "elevated" over content instead of flat the whole way down.
(function () {
  const nav = document.querySelector(".nav");
  if (!nav) return;
  const update = () => nav.classList.toggle("nav--scrolled", window.scrollY > 24);
  update();
  window.addEventListener("scroll", update, { passive: true });
})();

// 3D model-viewers (hero preview + the full #arvr one): <model-viewer>'s auto-rotate attribute
// isn't itself gated by prefers-reduced-motion, so drop it here for anyone who's asked for less
// motion — the model stays, just static until the viewer drags it manually.
(function () {
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.querySelectorAll("model-viewer[auto-rotate]").forEach((mv) => mv.removeAttribute("auto-rotate"));
})();
