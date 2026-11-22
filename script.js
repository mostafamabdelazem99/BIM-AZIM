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

// Tools section tabs
(function () {
  const tabs = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tool-panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      const target = document.getElementById(tab.dataset.panel);
      if (target) target.classList.add("active");
    });
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
