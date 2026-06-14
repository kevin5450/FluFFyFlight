/* ----------------------------------------------------------------------
   FluffyFlight — "FluffyBook": a small draggable-window desktop that lives
   inside the in-flight laptop screen (#laptop-screen).

   Reality note: Notion, Google, YouTube, GitHub, etc. send
   X-Frame-Options / CSP frame-ancestors headers that forbid being shown
   in an <iframe>. So those open as REAL browser tabs (window.open). The
   in-laptop Browser embeds sites that allow it (Wikipedia, OpenStreetMap…)
   and falls back to "Open in new tab" for the ones that block embedding.

   Built-in apps (work fully inside the laptop): Browser, Notes & To-Do.
---------------------------------------------------------------------- */
(function () {
  "use strict";
  const screen = document.getElementById("laptop-screen");
  if (!screen) return;

  // ---- tiny inline icons ----------------------------------------------
  const svgGlobe  = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18"/></svg>`;
  const svgNotes  = `<svg viewBox="0 0 24 24" fill="none" stroke="#5b4400" stroke-width="1.8" stroke-linecap="round"><path d="M6 3h8l4 4v14H6z"/><path d="M9 10h6M9 14h6M9 18h4"/></svg>`;
  const svgPlay   = `<svg viewBox="0 0 24 24" fill="#fff"><path d="M9 7.5v9l8-4.5z"/></svg>`;
  const svgCal    = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/></svg>`;
  const svgGithub = `<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48l-.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.94.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85l-.01 2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z"/></svg>`;
  const svgGmail  = `<svg viewBox="0 0 24 24" fill="none" stroke="#EA4335" stroke-width="2"><path d="M3 6.5 12 13l9-6.5"/><rect x="3" y="5" width="18" height="14" rx="2"/></svg>`;
  const svgSpotify = `<svg viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.59 14.43a.62.62 0 0 1-.86.21c-2.35-1.44-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.21c3.82-.87 7.1-.5 9.72 1.1.3.18.39.57.21.86zm1.23-2.73a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 1 1-.45-1.49c3.63-1.1 8.15-.56 11.24 1.33.37.22.49.7.25 1.07zm.11-2.85C14.8 8.98 9.5 8.8 6.45 9.73a.93.93 0 1 1-.54-1.78c3.5-1.06 9.35-.86 13.03 1.32a.93.93 0 1 1-.95 1.6z"/></svg>`;

  // ---- app registry ----------------------------------------------------
  // Apps with `url` open as a real new tab; apps with `build` open a window.
  const APPS = {
    calendar: { name: "Calendar", tile: "#1a73e8", icon: svgCal, w: 340, h: 360 },
    notes:    { name: "Notes & To-Do", tile: "#f4b400", icon: svgNotes, w: 470, h: 410 },
    spotify:  { name: "Spotify",  tile: "#1DB954", icon: svgSpotify, w: 400, h: 580 },
    notion:   { name: "Notion",   tile: "#101010", letter: "N", url: "https://www.notion.so" },
    google:   { name: "Google",   tile: "#ffffff", letter: "G", letterColor: "#4285F4", url: "https://www.google.com" },
    gmail:    { name: "Gmail",    tile: "#ffffff", icon: svgGmail, url: "https://mail.google.com" },
    youtube:  { name: "YouTube",  tile: "#FF0000", icon: svgPlay, url: "https://www.youtube.com" },
    github:   { name: "GitHub",   tile: "#1b1f24", icon: svgGithub, url: "https://github.com" },
  };
  const BUILD = { calendar: buildCalendar, notes: buildNotes, spotify: buildSpotify };
  const DOCK = ["calendar", "notes", "spotify", "sep", "notion", "google", "gmail", "youtube", "github"];

  // ---- scaffold: menubar + desktop + dock ------------------------------
  screen.innerHTML = "";
  const menubar = el("div", "fb-menubar");
  menubar.innerHTML = `<span class="fb-brand">● FluffyBook</span><span class="fb-clock"></span>`;
  const desktop = el("div", "", "fb-desktop");
  const dock = el("div", "", "fb-dock");
  DOCK.forEach(id => {
    if (id === "sep") { dock.appendChild(el("div", "fb-dock-sep")); return; }
    const a = APPS[id];
    const item = el("button", "fb-dock-item"); item.title = a.name; item.dataset.app = id;
    const tile = el("span", "fb-tile"); tile.style.background = a.tile;
    if (a.icon) tile.innerHTML = a.icon;
    else { tile.textContent = a.letter; tile.style.color = a.letterColor || "#fff"; tile.classList.add("fb-tile-letter"); }
    item.appendChild(tile);
    item.appendChild(el("span", "fb-dot"));
    item.addEventListener("click", () => openApp(id));
    dock.appendChild(item);
  });
  screen.appendChild(menubar);
  screen.appendChild(desktop);
  desktop.appendChild(dock);

  const clock = menubar.querySelector(".fb-clock");
  const tick = () => clock.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  tick(); setInterval(tick, 15000);

  // ---- window manager --------------------------------------------------
  let zTop = 10;
  const openWins = {};

  function openApp(id) {
    const a = APPS[id];
    if (a.url) { window.open(a.url, "_blank", "noopener"); return; }   // real site → real tab
    if (openWins[id]) { focusWin(openWins[id]); return; }
    createWindow(id);
  }

  function focusWin(win) { win.style.zIndex = ++zTop; }

  function createWindow(id) {
    const a = APPS[id];
    const win = el("div", "fb-win");
    win.style.width = a.w + "px"; win.style.height = a.h + "px";
    const n = Object.keys(openWins).length;
    win.style.left = (30 + n * 26) + "px";
    win.style.top  = (20 + n * 24) + "px";
    win.innerHTML =
      `<div class="fb-titlebar">
         <div class="fb-lights"><span class="fb-light close" title="Close"></span><span class="fb-light min"></span><span class="fb-light max"></span></div>
         <div class="fb-title">${a.name}</div>
         <button class="fb-close-btn" title="Close" aria-label="Close window">✕</button>
       </div>
       <div class="fb-body"></div>`;
    desktop.appendChild(win);
    openWins[id] = win; updateDock(); focusWin(win);

    const closeWin = () => { win.remove(); delete openWins[id]; updateDock(); };
    win.querySelector(".fb-light.close").addEventListener("click", closeWin);
    win.querySelector(".fb-close-btn").addEventListener("click", closeWin);
    win.addEventListener("pointerdown", () => focusWin(win));
    makeDraggable(win, win.querySelector(".fb-titlebar"));
    BUILD[id](win.querySelector(".fb-body"), id);
    return win;
  }

  function updateDock() {
    dock.querySelectorAll(".fb-dock-item").forEach(it => it.classList.toggle("running", !!openWins[it.dataset.app]));
  }

  function makeDraggable(win, handle) {
    let sx, sy, ox, oy, drag = false;
    handle.addEventListener("pointerdown", e => {
      if (e.target.closest(".fb-light, .fb-close-btn")) return;
      drag = true; win.classList.add("dragging");
      sx = e.clientX; sy = e.clientY;
      const r = win.getBoundingClientRect(), pr = desktop.getBoundingClientRect();
      ox = r.left - pr.left; oy = r.top - pr.top;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", e => {
      if (!drag) return;
      const pr = desktop.getBoundingClientRect();
      let nx = ox + (e.clientX - sx), ny = oy + (e.clientY - sy);
      nx = Math.max(0, Math.min(nx, pr.width - 60));
      ny = Math.max(0, Math.min(ny, pr.height - 38));
      win.style.left = nx + "px"; win.style.top = ny + "px";
    });
    const stop = () => { drag = false; win.classList.remove("dragging"); };
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  // ---- Calendar app (simple month view) --------------------------------
  function buildCalendar(body) {
    const state = { view: new Date(), sel: null };
    body.innerHTML = `<div class="fb-cal"></div>`;
    const root = body.querySelector(".fb-cal");
    function render() {
      const y = state.view.getFullYear(), m = state.view.getMonth();
      const monthName = new Date(y, m, 1).toLocaleDateString([], { month: "long", year: "numeric" });
      const firstDow = new Date(y, m, 1).getDay();
      const days = new Date(y, m + 1, 0).getDate();
      const t = new Date();
      const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
      let cells = "";
      ["S", "M", "T", "W", "T", "F", "S"].forEach(w => cells += `<div class="fb-cal-dow">${w}</div>`);
      for (let i = 0; i < firstDow; i++) cells += `<div class="fb-cal-cell blank"></div>`;
      for (let dd = 1; dd <= days; dd++) {
        const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
        const cls = (ds === todayStr ? " today" : "") + (ds === state.sel ? " sel" : "");
        cells += `<div class="fb-cal-cell${cls}" data-d="${ds}">${dd}</div>`;
      }
      root.innerHTML =
        `<div class="fb-cal-head">
           <button class="fb-cal-nav" data-nav="-1" title="Previous month">‹</button>
           <div class="fb-cal-title">${monthName}</div>
           <button class="fb-cal-nav" data-nav="1" title="Next month">›</button>
         </div>
         <div class="fb-cal-grid">${cells}</div>`;
      root.querySelectorAll(".fb-cal-nav").forEach(b => b.addEventListener("click", () => {
        state.view = new Date(y, m + Number(b.dataset.nav), 1); render();
      }));
      root.querySelectorAll(".fb-cal-cell[data-d]").forEach(c => c.addEventListener("click", () => {
        state.sel = c.dataset.d; render();
      }));
    }
    render();
  }

  // ---- Spotify app (embedded web player) -------------------------------
  function buildSpotify(body) {
    const LISTS = [
      { label: "Deep Focus", id: "37i9dQZF1DWZeKCadgRdKQ" },
      { label: "Lofi Beats", id: "0vvXsWCC9xrXsKd4FyS8kM" },
      { label: "Jazz Vibes", id: "37i9dQZF1DX0SM0LYsmbMT" },
      { label: "Peaceful Piano", id: "37i9dQZF1DX4sWSpwq3LiO" },
    ];
    body.innerHTML =
      `<div class="fb-spotify">
         <div class="fb-sp-bar">
           <div class="fb-sp-marks"></div>
           <button class="fb-sp-ext" title="Open in Spotify">↗</button>
         </div>
         <iframe class="fb-sp-frame" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
       </div>`;
    const frame = body.querySelector(".fb-sp-frame");
    const marks = body.querySelector(".fb-sp-marks");
    let current = LISTS[0].id;
    function load(id) {
      current = id;
      frame.src = `https://open.spotify.com/embed/playlist/${id}?utm_source=generator&theme=0`;
      marks.querySelectorAll(".fb-sp-mark").forEach(b => b.classList.toggle("active", b.dataset.id === id));
    }
    LISTS.forEach(p => {
      const b = el("button", "fb-sp-mark"); b.textContent = p.label; b.dataset.id = p.id;
      b.addEventListener("click", () => load(p.id));
      marks.appendChild(b);
    });
    body.querySelector(".fb-sp-ext").addEventListener("click", () => window.open("https://open.spotify.com/playlist/" + current, "_blank", "noopener"));
    load(LISTS[0].id);
  }

  // ---- Notes & To-Do app (saved locally per account) -------------------
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  function buildNotes(body) {
    const who = (typeof Account !== "undefined" && Account.user && Account.user.email) || "guest";
    const NKEY = "fb_notes_" + who, TKEY = "fb_todos_" + who;
    body.innerHTML =
      `<div class="fb-notes">
         <div class="fb-tabs">
           <button class="fb-tab active" data-tab="notes">Notes</button>
           <button class="fb-tab" data-tab="todo">To-Do</button>
           <span class="fb-saved"></span>
         </div>
         <div class="fb-pane" data-pane="notes">
           <textarea class="fb-notearea" spellcheck="false" placeholder="Note — autosaved as you type."></textarea>
         </div>
         <div class="fb-pane hidden" data-pane="todo">
           <form class="fb-todo-add"><input class="fb-todo-input" placeholder="Add a task, press Enter" /></form>
           <ul class="fb-todo-list"></ul>
         </div>
       </div>`;
    body.querySelectorAll(".fb-tab").forEach(t => t.addEventListener("click", () => {
      body.querySelectorAll(".fb-tab").forEach(x => x.classList.toggle("active", x === t));
      body.querySelectorAll(".fb-pane").forEach(p => p.classList.toggle("hidden", p.dataset.pane !== t.dataset.tab));
    }));

    const area = body.querySelector(".fb-notearea");
    const saved = body.querySelector(".fb-saved");
    area.value = localStorage.getItem(NKEY) || "";
    let tmr;
    area.addEventListener("input", () => {
      clearTimeout(tmr);
      tmr = setTimeout(() => { localStorage.setItem(NKEY, area.value); flash(); }, 350);
    });
    function flash() { saved.textContent = "Saved ✓"; clearTimeout(flash._t); flash._t = setTimeout(() => saved.textContent = "", 1200); }

    let todos; try { todos = JSON.parse(localStorage.getItem(TKEY)) || []; } catch (e) { todos = []; }
    const list = body.querySelector(".fb-todo-list");
    const input = body.querySelector(".fb-todo-input");
    const saveT = () => localStorage.setItem(TKEY, JSON.stringify(todos));
    function renderT() {
      if (!todos.length) { list.innerHTML = `<li class="fb-todo-empty">No tasks yet — add one above.</li>`; return; }
      list.innerHTML = "";
      todos.forEach((t, i) => {
        const li = el("li", "fb-todo" + (t.done ? " done" : ""));
        li.innerHTML = `<label><input type="checkbox" ${t.done ? "checked" : ""}/><span>${escapeHtml(t.text)}</span></label><button class="fb-todo-del" title="Delete">✕</button>`;
        li.querySelector("input").addEventListener("change", e => { todos[i].done = e.target.checked; saveT(); renderT(); });
        li.querySelector(".fb-todo-del").addEventListener("click", () => { todos.splice(i, 1); saveT(); renderT(); });
        list.appendChild(li);
      });
    }
    body.querySelector(".fb-todo-add").addEventListener("submit", e => {
      e.preventDefault(); const v = input.value.trim(); if (!v) return;
      todos.unshift({ text: v, done: false }); input.value = ""; saveT(); renderT();
    });
    renderT();
  }

  // ---- helper ----------------------------------------------------------
  function el(tag, cls, id) { const e = document.createElement(tag); if (cls) e.className = cls; if (id) e.id = id; return e; }
})();
