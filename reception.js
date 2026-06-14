/* ----------------------------------------------------------------------
   FluffyFlight — Reception desk.

   The user enters how long they want to study; we recommend a few REAL
   flights (real airports for both departure and arrival, from airports.js)
   whose great-circle flight time is nearest that length — not only exact
   matches. Departure is the current real time; arrival is departure + the
   real flight duration. Selecting one launches that real flight through the
   normal engine (startFlightFromReception in app.js), so it keeps the seat /
   window / laptop experience and is saved to My Page.
---------------------------------------------------------------------- */
(function () {
  "use strict";

  let PAIRS = null;   // cached list of every airport pair + its flight time

  const pad = n => String(n).padStart(2, "0");
  const fmtTime = d => pad(d.getHours()) + ":" + pad(d.getMinutes());
  function fmtDur(m) { const h = Math.floor(m / 60), mm = m % 60; return h > 0 ? `${h}h ${pad(mm)}m` : `${mm}m`; }
  function chipLabel(m) { const h = Math.floor(m / 60), mm = m % 60; return h ? (mm ? `${h}h ${mm}m` : `${h}h`) : `${mm}m`; }
  function dots(level) { return "●".repeat(level) + "○".repeat(5 - level); }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  // Focus level + a study-framed description, by real flight length.
  function focusFor(m) {
    if (m < 45)  return { level: 2, label: "Light focus",    desc: "A short hop to warm up and clear one quick task." };
    if (m < 75)  return { level: 3, label: "Steady focus",   desc: "A steady session for focused, reliable progress." };
    if (m < 120) return { level: 4, label: "Deep focus",     desc: "Settle in for distraction-free deep work." };
    if (m < 200) return { level: 4, label: "Long focus",     desc: "A long cruise for a big chunk of study." };
    return { level: 5, label: "Marathon focus", desc: "A long-haul session for your biggest goals." };
  }

  function buildPairs() {
    if (PAIRS) return PAIRS;
    PAIRS = [];
    for (let i = 0; i < AIRPORTS.length; i++) {
      for (let j = i + 1; j < AIRPORTS.length; j++) {
        PAIRS.push({ dep: AIRPORTS[i], arr: AIRPORTS[j], min: flightMinutes(AIRPORTS[i], AIRPORTS[j]) });
      }
    }
    return PAIRS;
  }

  // Three real flights nearest the wish, with distinct durations & airports.
  function recommend(D) {
    const sorted = buildPairs().slice().sort((a, b) => Math.abs(a.min - D) - Math.abs(b.min - D));
    const out = [];
    for (const p of sorted) {
      if (out.length >= 3) break;
      if (out.some(q => Math.abs(q.min - p.min) < 4)) continue;            // spread the durations a little
      if (out.some(q => q.dep.iata === p.dep.iata || q.arr.iata === p.arr.iata)) continue;  // vary the airports
      out.push(p);
    }
    for (const p of sorted) { if (out.length >= 3) break; if (!out.includes(p)) out.push(p); }  // safety fill
    return out.sort((a, b) => a.min - b.min).map(p => {
      const dep = new Date(), arr = new Date(dep.getTime() + p.min * 60000);
      return { dep: p.dep, arr: p.arr, minutes: p.min, depTime: fmtTime(dep), arrTime: fmtTime(arr),
               dur: fmtDur(p.min), focus: focusFor(p.min), flight: `FF ${100 + p.min}` };
    });
  }

  // ---- overlay ---------------------------------------------------------
  function openReception() { document.getElementById("reception").classList.remove("hidden"); renderSearch(); }
  function closeReception() { document.getElementById("reception").classList.add("hidden"); }

  function renderSearch() {
    const body = document.getElementById("reception-body");
    body.innerHTML =
      `<div class="rec-search">
         <div class="rec-q">How long do you want to study?</div>
         <div class="rec-input-row">
           <input id="rec-mins" type="number" min="10" max="900" inputmode="numeric" placeholder="e.g. 60 minutes" />
           <button class="rec-find" id="rec-find">Find study flights ✈</button>
         </div>
         <div class="rec-chips">
           ${[45, 60, 90, 120, 180, 300].map(v => `<button class="rec-chip" data-min="${v}">${chipLabel(v)}</button>`).join("")}
         </div>
       </div>
       <div id="rec-results"><div class="rec-hint">Enter a study length to see real flights near it.</div></div>`;

    const input = body.querySelector("#rec-mins");
    body.querySelector("#rec-find").addEventListener("click", () => search(input.value));
    input.addEventListener("keydown", e => { if (e.key === "Enter") search(input.value); });
    body.querySelectorAll(".rec-chip").forEach(c => c.addEventListener("click", () => { input.value = c.dataset.min; search(c.dataset.min); }));
    input.focus();
  }

  function search(raw) {
    const D = Math.round(Number(raw));
    const results = document.getElementById("rec-results");
    if (!D || D < 10 || D > 900) {
      results.innerHTML = `<div class="rec-hint warn">Please enter a study length between 10 and 900 minutes.</div>`;
      return;
    }
    const recs = recommend(D);
    results.innerHTML =
      `<div class="rec-resulthead">Real flights nearest <b>${fmtDur(D)}</b></div>
       <div class="rec-list">${recs.map(cardHTML).join("")}</div>`;
    results.querySelectorAll(".rec-select").forEach((btn, i) => btn.addEventListener("click", () => choose(recs[i])));
  }

  function cardHTML(r) {
    return `
      <div class="rec-card">
        <div class="rec-top">
          <div class="rec-flight"><span class="rec-carrier">FLUFFYAIR</span>${r.flight}</div>
          <div class="rec-focus"><span class="rec-dots">${dots(r.focus.level)}</span> ${r.focus.label}</div>
        </div>
        <div class="rec-route">
          <div class="rec-end">
            <div class="rec-time">${r.depTime}</div>
            <div class="rec-code">${r.dep.iata}</div>
            <div class="rec-place">${esc(r.dep.city)}, ${esc(r.dep.country)}</div>
          </div>
          <div class="rec-mid">
            <div class="rec-dur">${r.dur}</div>
            <div class="rec-line"><span class="rec-plane">✈</span></div>
            <div class="rec-midlabel">non-stop</div>
          </div>
          <div class="rec-end right">
            <div class="rec-time">${r.arrTime}</div>
            <div class="rec-code">${r.arr.iata}</div>
            <div class="rec-place">${esc(r.arr.city)}, ${esc(r.arr.country)}</div>
          </div>
        </div>
        <div class="rec-desc">${r.focus.desc}</div>
        <button class="rec-select">Select this flight ✈</button>
      </div>`;
  }

  function choose(r) {
    closeReception();
    if (typeof startFlightFromReception === "function") startFlightFromReception(r.dep, r.arr, "window");
  }

  // Esc closes the reception overlay (flight overlays handled in app.js).
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    const ov = document.getElementById("reception");
    if (ov && !ov.classList.contains("hidden")) closeReception();
  });

  // expose for the inline onclick handlers in index.html
  window.openReception = openReception;
  window.closeReception = closeReception;
})();
