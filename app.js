/* ----------------------------------------------------------------------
   FluffyFlight — study-on-a-flight focus app (flight + map logic).
   Depends on airports.js (CONTINENTS, AIRPORTS) and Leaflet.
   Auth / tickets / history / My Page live in account.js.

   Map      : realistic Esri satellite imagery. Click a continent label to
              zoom in, then pick a real departure + arrival airport + seat.
   Flight   : seat view = the PC/IFE screen attached to the seat in front.
              Left arrow → window view (day/night where the plane is).
              Right arrow → laptop workspace (schedule & to-do — coming soon).
              Break (bathroom) is its own timer button; the flight keeps going.
   Flight time = great-circle distance / 875 km/h cruise + 30 min.
---------------------------------------------------------------------- */

// ---- Map setup -------------------------------------------------------
const WORLD_BOUNDS = L.latLngBounds([[-58, -168], [80, 178]]);
const map = L.map("map", {
  minZoom: 2, maxZoom: 7, maxBoundsViscosity: 1.0,
  zoomControl: true, attributionControl: true, worldCopyJump: false,
});
// Premium, Google-Earth-style satellite imagery (free, no API key).
L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  attribution: "Imagery © Esri, Maxar, Earthstar Geographics", maxZoom: 18, noWrap: true, bounds: WORLD_BOUNDS,
}).addTo(map);
map.fitBounds(WORLD_BOUNDS);
applyMapBounds();

const mapEl = document.getElementById("map");
function applyMapBounds() { map.setMaxBounds(WORLD_BOUNDS.pad(0.02)); map.setMinZoom(map.getBoundsZoom(WORLD_BOUNDS, true)); }
function releaseMapBounds() { map.setMaxBounds(null); map.setMinZoom(1); }

// ---- Continent labels (world view) -----------------------------------
const labelLayer = L.layerGroup().addTo(map);
for (const [name, c] of Object.entries(CONTINENTS)) {
  L.marker(c.center, {
    icon: L.divIcon({ className: "", html: `<div class="continent-label">${name}</div>`, iconSize: [120, 24], iconAnchor: [60, 12] }),
  }).on("click", () => enterContinent(name)).addTo(labelLayer);
}

// ---- Airport markers -------------------------------------------------
const airportLayer = L.layerGroup().addTo(map);
const markerByIata = {};
function renderAirports(continent) {
  airportLayer.clearLayers();
  Object.keys(markerByIata).forEach(k => delete markerByIata[k]);
  AIRPORTS.filter(a => a.cont === continent).forEach(a => {
    const m = L.circleMarker([a.lat, a.lon], { radius: 7, color: "#0c2233", weight: 2, fillColor: "#fff", fillOpacity: 1 });
    m.bindTooltip(`${a.iata} · ${a.city}`, { direction: "top" });
    m.on("click", () => pickAirport(a));
    m.addTo(airportLayer);
    markerByIata[a.iata] = m;
  });
}

// ---- Navigation ------------------------------------------------------
function enterContinent(name) {
  labelLayer.remove();
  map.fitBounds(CONTINENTS[name].bounds, { padding: [20, 20] });
  renderAirports(name);
  document.getElementById("back").style.display = "block";
  document.getElementById("hint").textContent = `${name} — click an airport, then assign it to Departure or Arrival`;
}
document.getElementById("back").onclick = () => {
  airportLayer.clearLayers();
  labelLayer.addTo(map);
  map.flyToBounds(WORLD_BOUNDS);
  document.getElementById("back").style.display = "none";
  document.getElementById("hint").textContent = "Click a continent name to zoom in";
};

// ---- Selection logic -------------------------------------------------
let activeSlot = "dep";
const picks = { dep: null, arr: null };
let selectedSeat = null;

function activate(slot) {
  activeSlot = slot;
  document.getElementById("slot-dep").classList.toggle("active-dep", slot === "dep");
  document.getElementById("slot-arr").classList.toggle("active-arr", slot === "arr");
}
activate("dep");

function pickAirport(a) {
  picks[activeSlot] = a;
  refreshMarkerColors();
  updateSlots();
  if (activeSlot === "dep" && !picks.arr) activate("arr");
  showResult();
}
function refreshMarkerColors() {
  for (const m of Object.values(markerByIata)) m.setStyle({ color: "#0c2233", fillColor: "#fff" });
  if (picks.dep && markerByIata[picks.dep.iata]) markerByIata[picks.dep.iata].setStyle({ color: "#fff", fillColor: "#1e9e5a" });
  if (picks.arr && markerByIata[picks.arr.iata]) markerByIata[picks.arr.iata].setStyle({ color: "#fff", fillColor: "#e0632a" });
}
function updateSlots() {
  for (const slot of ["dep", "arr"]) {
    const a = picks[slot];
    document.getElementById(`${slot}-value`).textContent = a ? a.iata : "Select…";
    document.getElementById(`${slot}-sub`).textContent  = a ? `${a.city}, ${a.country}` : "";
  }
  document.getElementById("reset").style.display = (picks.dep || picks.arr) ? "block" : "none";
}
function chooseSeat(type) {
  selectedSeat = type;
  document.getElementById("seat-window").classList.toggle("active", type === "window");
  document.getElementById("seat-aisle").classList.toggle("active", type === "aisle");
  document.getElementById("start").style.display = "block";
}
function resetPicks() {
  picks.dep = picks.arr = null; selectedSeat = null;
  refreshMarkerColors(); updateSlots();
  document.getElementById("result").style.display = "none";
  document.getElementById("seat-choice").style.display = "none";
  document.getElementById("start").style.display = "none";
  document.getElementById("seat-window").classList.remove("active");
  document.getElementById("seat-aisle").classList.remove("active");
  activate("dep");
}

// ---- Distance + flight time ------------------------------------------
const CRUISE_KMH = 875, GROUND_MIN = 30;
function haversineKm(a, b) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function flightMinutes(a, b) { return Math.round(haversineKm(a, b) / CRUISE_KMH * 60 + GROUND_MIN); }
function fmtDur(min) { return `${Math.floor(min / 60)}h ${min % 60}m`; }
function fmtClock(totalSec) {
  totalSec = Math.max(0, Math.round(totalSec));
  const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60), s = totalSec % 60;
  const p = n => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

function showResult() {
  const el = document.getElementById("result"), choice = document.getElementById("seat-choice");
  if (!picks.dep || !picks.arr) { el.style.display = "none"; choice.style.display = "none"; document.getElementById("start").style.display = "none"; return; }
  if (picks.dep.iata === picks.arr.iata) {
    el.style.display = "block"; el.innerHTML = "Departure and arrival are the same airport.";
    choice.style.display = "none"; document.getElementById("start").style.display = "none"; return;
  }
  const km = haversineKm(picks.dep, picks.arr), min = flightMinutes(picks.dep, picks.arr);
  el.style.display = "block";
  el.innerHTML = `<b>${picks.dep.iata}</b> → <b>${picks.arr.iata}</b> &nbsp;·&nbsp; ${Math.round(km).toLocaleString()} km &nbsp;·&nbsp; ~${fmtDur(min)}`;
  choice.style.display = "flex";
  document.getElementById("start").style.display = selectedSeat ? "block" : "none";
}

// ---- Sound: ding-dong chime + cabin white noise ----------------------
let cabinNoise = null;
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = ctx.currentTime;
    const tone = (freq, start, dur) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = freq; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, t0 + start);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      o.start(t0 + start); o.stop(t0 + start + dur);
    };
    tone(1318.5, 0.00, 0.55); tone(1046.5, 0.42, 0.75);
    setTimeout(() => { try { ctx.close(); } catch (e) {} }, 1500);   // don't leak a context per ding
  } catch (e) {}
}
function startCabinNoise() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const size = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 850;
    const gain = ctx.createGain(); gain.gain.value = 0.12;
    src.connect(lp); lp.connect(gain); gain.connect(ctx.destination); src.start();
    cabinNoise = { ctx, src, gain, base: 0.12, muted: false };
  } catch (e) { cabinNoise = null; }
}
function stopCabinNoise() {
  if (!cabinNoise) return;
  try { cabinNoise.src.stop(); cabinNoise.ctx.close(); } catch (e) {}
  cabinNoise = null;
}
function toggleMute() {
  if (!cabinNoise) return;
  cabinNoise.muted = !cabinNoise.muted;
  cabinNoise.gain.gain.value = cabinNoise.muted ? 0 : cabinNoise.base;
  document.getElementById("mute-btn").textContent = cabinNoise.muted ? "🔇 Cabin sound" : "🔊 Cabin sound";
}

// ---- Cabin announcements (Web Speech) + seat-belt sign + takeoff/landing scene ----
const ANN = {
  takeoff: "Welcome aboard FluffyFlight. Cabin crew, prepare for departure. Please fasten your seat belt, switch your focus on, and enjoy your study flight.",
  landing: "Ladies and gentlemen, we have begun our descent. Cabin crew, please prepare the cabin for landing and fasten your seat belt.",
  arrival: "We have arrived at your destination. Thank you for studying with FluffyFlight. We hope to see you on board again soon.",
};
function speak(text) {
  try {
    const s = window.speechSynthesis; if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95; u.pitch = 1; u.volume = 0.9;
    s.speak(u);
  } catch (e) {}
}
function getBelt() { const s = document.getElementById("cabin-sign"); return !!s && s.classList.contains("lit"); }
function setBelt(on) { const s = document.getElementById("cabin-sign"); if (s) s.classList.toggle("lit", !!on); }

// ---- Great-circle helpers --------------------------------------------
function gcPoint(p1, p2, f) {
  const toRad = d => d * Math.PI / 180, toDeg = r => r * 180 / Math.PI;
  const lat1 = toRad(p1.lat), lon1 = toRad(p1.lon), lat2 = toRad(p2.lat), lon2 = toRad(p2.lon);
  const d = 2 * Math.asin(Math.sqrt(Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2));
  if (d === 0) return [p1.lat, p1.lon];
  const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
  const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);
  return [toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))];
}
const PLANE_SVG = '<svg width="34" height="34" viewBox="0 0 24 24"><path fill="#e0632a" stroke="#fff" stroke-width="0.8" d="M12 2c.7 0 1 1.6 1 5l8 4.7v1.8l-8-2.3v5l2.2 1.6v1.4L12 24l-3.2-.8v-1.4L11 20.2v-5l-8 2.3v-1.8L11 7c0-3.4.3-5 1-5z"/></svg>';

// Local solar time at the plane (real UTC adjusted for longitude), 0–24h.
function solarHour(lon) {
  const now = new Date();
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  return ((utcH + lon / 15) % 24 + 24) % 24;
}
function skyClass(lon) {
  const solar = solarHour(lon);
  if (solar >= 7 && solar < 17) return "sky-day";
  if (solar >= 5 && solar < 7)  return "sky-dawn";
  if (solar >= 17 && solar < 19) return "sky-dusk";
  return "sky-night";
}
// Continuous lighting "mood" from the plane's local solar time: a brightness +
// saturation nudge for the photo and a soft tint colour, interpolated between stops.
const MOOD_STOPS = [
  { h: 0,    b: .66, s: .90, c: [10, 18, 48, .42] },
  { h: 5,    b: .72, s: .95, c: [26, 32, 74, .34] },
  { h: 6.7,  b: .92, s: 1.05, c: [255, 150, 92, .20] },
  { h: 9,    b: 1.0, s: 1.00, c: [255, 250, 235, .05] },
  { h: 12,   b: 1.06, s: 1.00, c: [255, 255, 255, 0] },
  { h: 15,   b: 1.0, s: 1.00, c: [255, 244, 224, .05] },
  { h: 17.3, b: .92, s: 1.08, c: [255, 138, 78, .22] },
  { h: 19,   b: .80, s: 1.00, c: [70, 46, 96, .30] },
  { h: 21,   b: .72, s: .95, c: [16, 22, 56, .40] },
  { h: 24,   b: .66, s: .90, c: [10, 18, 48, .42] },
];
function skyMood(h) {
  let a = MOOD_STOPS[0], b = MOOD_STOPS[MOOD_STOPS.length - 1];
  for (let i = 0; i < MOOD_STOPS.length - 1; i++) {
    if (h >= MOOD_STOPS[i].h && h <= MOOD_STOPS[i + 1].h) { a = MOOD_STOPS[i]; b = MOOD_STOPS[i + 1]; break; }
  }
  const t = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h), lerp = (x, y) => x + (y - x) * t;
  const c = a.c.map((ch, i) => i < 3 ? Math.round(lerp(ch, b.c[i])) : +lerp(ch, b.c[i]).toFixed(3));
  return { bright: (+lerp(a.b, b.b)).toFixed(3), sat: (+lerp(a.s, b.s)).toFixed(3), tint: `rgba(${c[0]},${c[1]},${c[2]},${c[3]})` };
}
const SKY_LABEL = { "sky-day": "Daytime ☀", "sky-dawn": "Dawn 🌅", "sky-dusk": "Dusk 🌇", "sky-night": "Night 🌙" };

// ---- Flight simulation ------------------------------------------------
let flightMode = false, currentOverlay = null;     // currentOverlay: null | 'window' | 'laptop' | 'bathroom'
let routePts = [], planeMarker = null;
let totalMin = 0, simElapsedMin = 0, speed = 1, lastReal = 0;
let lastMoodH = null;    // throttles the real-time window-lighting updates
let phase = null, flightStartReal = 0, beltOffAt = 0, lastBeltHour = 0, arrived = false;
let bathroomStart = 0, totalBathroomMs = 0;
let flightRealStart = null;
const routeLayer = L.layerGroup().addTo(map);
const ifeScreen = document.getElementById("ife-screen");
const ifeOverlay = document.getElementById("ife-overlay");

function go() {
  if (!picks.dep || !picks.arr || picks.dep.iata === picks.arr.iata || !selectedSeat) return;
  playChime();
  startCabinNoise();
  enterFlightView();
}

// Launch a flight chosen at the reception desk (a real airport pair).
function startFlightFromReception(dep, arr, seat) {
  picks.dep = dep; picks.arr = arr;
  selectedSeat = seat || "window";
  go();
}

function enterFlightView() {
  flightMode = true; currentOverlay = null;
  document.body.classList.add("flight-mode");

  // Great-circle path (unwrap longitudes across the antimeridian).
  const N = 180; routePts = []; let prevLon = null;
  for (let i = 0; i <= N; i++) {
    let [la, lo] = gcPoint(picks.dep, picks.arr, i / N);
    if (prevLon !== null) { while (lo - prevLon > 180) lo -= 360; while (lo - prevLon < -180) lo += 360; }
    routePts.push([la, lo]); prevLon = lo;
  }

  // Move the live map into the seatback screen.
  ifeScreen.insertBefore(mapEl, ifeOverlay);
  releaseMapBounds();
  labelLayer.remove();
  airportLayer.clearLayers();
  routeLayer.clearLayers();
  L.polyline(routePts, { color: "#6fe3ff", weight: 3, dashArray: "6 8", opacity: 0.95 }).addTo(routeLayer);
  L.circleMarker(routePts[0],                 { radius: 6, color: "#fff", weight: 2, fillColor: "#1e9e5a", fillOpacity: 1 }).addTo(routeLayer);
  L.circleMarker(routePts[routePts.length-1], { radius: 6, color: "#fff", weight: 2, fillColor: "#e0632a", fillOpacity: 1 }).addTo(routeLayer);
  planeMarker = L.marker(routePts[0], {
    icon: L.divIcon({ className: "", html: `<div class="plane">${PLANE_SVG}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] }), zIndexOffset: 1000,
  }).addTo(routeLayer);

  // Seat type → enable window arrow only for a window seat.
  document.getElementById("seat-view").classList.toggle("window-seat", selectedSeat === "window");

  // HUD text.
  document.getElementById("ife-route").innerHTML = `<span class="iata">${picks.dep.iata}</span> ✈ <span class="iata">${picks.arr.iata}</span>`;
  document.getElementById("ife-cities").textContent = `${picks.dep.city} → ${picks.arr.city}`;

  // Clocks / counters.
  totalMin = flightMinutes(picks.dep, picks.arr);
  lastMoodH = null;
  simElapsedMin = 0; speed = 1; lastReal = 0; totalBathroomMs = 0;
  flightRealStart = new Date();
  document.querySelectorAll(".spd").forEach(b => b.classList.toggle("active", b.textContent.startsWith("×1")));

  // Begin the flight phases on this same Start-Flight gesture (audio/speech unlock here).
  phase = "takeoff"; arrived = false; lastBeltHour = 0;
  flightStartReal = performance.now(); beltOffAt = flightStartReal + 30000;
  setBelt(true);
  speak(ANN.takeoff);   // departure ding (playChime) already fired in go()

  setTimeout(() => { map.invalidateSize(); map.fitBounds(L.latLngBounds(routePts), { padding: [30, 30] }); }, 60);
  requestAnimationFrame(simFrame);
}

function simFrame() {
  if (!flightMode) return;
  const now = performance.now();
  if (lastReal === 0) lastReal = now;
  simElapsedMin += ((now - lastReal) / 60000) * speed;
  lastReal = now;
  if (simElapsedMin > totalMin) simElapsedMin = totalMin;

  const f = totalMin > 0 ? simElapsedMin / totalMin : 1;
  const idx = Math.min(routePts.length - 1, Math.floor(f * (routePts.length - 1)));
  const cur = routePts[idx], nxt = routePts[Math.min(routePts.length - 1, idx + 1)];

  if (planeMarker) {
    planeMarker.setLatLng(cur);
    const midLat = (cur[0] + nxt[0]) / 2 * Math.PI / 180;
    const brg = Math.atan2((nxt[1] - cur[1]) * Math.cos(midLat), nxt[0] - cur[0]) * 180 / Math.PI;
    const el = planeMarker.getElement(); if (el) el.querySelector("svg").style.transform = `rotate(${brg}deg)`;
  }

  // Window day/night based on the plane's current longitude.
  if (selectedSeat === "window") {
    const sky = document.getElementById("window-sky"), want = skyClass(cur[1]);
    if (!sky.classList.contains(want)) sky.className = want;
    const h = solarHour(cur[1]);
    if (lastMoodH === null || Math.abs(h - lastMoodH) > 0.02) {   // recompute lighting only as the sun meaningfully shifts
      const mood = skyMood(h);
      sky.style.setProperty("--win-bright", mood.bright);
      sky.style.setProperty("--win-sat", mood.sat);
      document.getElementById("window-inner").style.setProperty("--win-tint", mood.tint);
      lastMoodH = h;
    }
    document.getElementById("window-info").textContent =
      `Outside: ${SKY_LABEL[want]}  ·  ${cur[0].toFixed(0)}°, ${(((cur[1] + 180) % 360 + 360) % 360 - 180).toFixed(0)}°`;
  }

  document.getElementById("ife-remaining").textContent = fmtClock((totalMin - simElapsedMin) * 60);
  document.getElementById("ife-clock").textContent = new Date().toLocaleTimeString();
  document.getElementById("ife-progress").style.width = (f * 100).toFixed(1) + "%";

  if (etaHoverMult) {                              // keep the hover tooltip accurate while flying
    const v = document.querySelector("#speed-eta .eta-v"), txt = speedEtaText(etaHoverMult);
    if (v && txt) v.textContent = txt;
  }

  if (currentOverlay === "bathroom") updateBathroom();

  // ---- flight phases: takeoff → cruise → hourly belt check → landing ----
  const realElapsed = (now - flightStartReal) / 1000;
  const remainRealSec = (totalMin - simElapsedMin) / Math.max(speed, 0.0001) * 60;
  if (phase === "takeoff" && realElapsed >= 30) { phase = "cruise"; }   // calm cruising
  if (phase === "cruise") {
    const hr = Math.floor(simElapsedMin / 60);
    if (hr > lastBeltHour) { lastBeltHour = hr; playChime(); setBelt(true); beltOffAt = now + 30000; }  // hourly check
  }
  if (phase !== "landing" && getBelt() && now >= beltOffAt) setBelt(false);
  if ((phase === "takeoff" || phase === "cruise") && f < 1 && remainRealSec <= 30) {
    phase = "landing"; setBelt(true); beltOffAt = Infinity;
    playChime(); speak(ANN.landing);
  }

  if (f < 1) requestAnimationFrame(simFrame);
  else if (!arrived) {
    arrived = true;
    document.getElementById("ife-remaining").textContent = "00:00";
    playChime();
    endFlight();          // shows the completed state (and clears scene/belt/speech, stops noise)
    speak(ANN.arrival);   // final announcement, after cleanup
  }
}

function setSpeed(mult, btn) {
  speed = mult;
  document.querySelectorAll(".spd").forEach(b => b.classList.toggle("active", b === btn));
}

// ---- Speed hover: how soon you'd land at ×2 / ×4 ---------------------
let etaHoverMult = 0;
function speedEtaText(mult) {
  if (!flightMode || mult <= 1) return null;
  const remainRealSec = Math.max(0, (totalMin - simElapsedMin) * 60 / mult);
  const arrive = new Date(Date.now() + remainRealSec * 1000);
  const dur = fmtDur(Math.round(remainRealSec / 60));
  const clock = arrive.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${dur} · ~${clock}`;                     // e.g. "3h 20m · ~14:35"
}
function showSpeedEta(mult) {
  const box = document.getElementById("speed-eta");
  const txt = speedEtaText(mult);
  if (!txt) { hideSpeedEta(); return; }
  etaHoverMult = mult;
  box.innerHTML = `<span class="eta-k">×${mult} → lands in</span><span class="eta-v">${txt}</span>`;
  box.classList.add("show");
}
function hideSpeedEta() {
  etaHoverMult = 0;
  document.getElementById("speed-eta").classList.remove("show");
}
document.querySelectorAll('.spd[data-mult="2"], .spd[data-mult="4"]').forEach(btn => {
  const mult = Number(btn.dataset.mult);
  btn.addEventListener("mouseenter", () => showSpeedEta(mult));
  btn.addEventListener("mouseleave", hideSpeedEta);
  btn.addEventListener("focus", () => showSpeedEta(mult));
  btn.addEventListener("blur", hideSpeedEta);
});

function endFlight() {
  if (currentOverlay === "bathroom") closeBathroom();    // capture any open break
  flightMode = false; currentOverlay = null;
  setBelt(false); phase = null;
  try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}

  // Build the completed-flight record (real times + accelerated flight time).
  const realEnd = new Date();
  const totalRealSec = (realEnd - flightRealStart) / 1000;
  const bathroomSec = totalBathroomMs / 1000;
  const d = flightRealStart;
  const record = {
    dep_iata: picks.dep.iata, dep_city: picks.dep.city,
    arr_iata: picks.arr.iata, arr_city: picks.arr.city,
    real_start: flightRealStart.toISOString(), real_end: realEnd.toISOString(),
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    study_seconds: Math.max(0, Math.round(totalRealSec - bathroomSec)),
    flight_seconds: Math.round(simElapsedMin * 60),
    bathroom_seconds: Math.round(bathroomSec),
  };

  document.body.classList.remove("flight-mode", "window-open", "bathroom-open", "laptop-open");
  hideSpeedEta();
  stopCabinNoise();

  // Move the map back to the page.
  document.body.insertBefore(mapEl, document.body.firstChild);
  routeLayer.clearLayers(); planeMarker = null;
  applyMapBounds(); labelLayer.addTo(map);
  setTimeout(() => { map.invalidateSize(); map.flyToBounds(WORLD_BOUNDS); }, 60);
  document.getElementById("back").style.display = "none";
  document.getElementById("hint").textContent = "Click a continent name to zoom in";
  resetPicks();

  // Save + show the completion ticket (account.js).
  if (window.saveCompletedFlight) saveCompletedFlight(record);
}

// ---- Window view (left arrow) ----------------------------------------
function openWindowView() {
  if (!flightMode || selectedSeat !== "window" || currentOverlay) return;
  currentOverlay = "window";
  document.body.classList.add("window-open");
}
function closeWindowView() {
  if (currentOverlay !== "window") return;
  currentOverlay = null;
  document.body.classList.remove("window-open");
}

// ---- Laptop view (right arrow; any seat) -----------------------------
function openLaptopView() {
  if (!flightMode || currentOverlay) return;
  currentOverlay = "laptop";
  document.body.classList.add("laptop-open");
}
function closeLaptopView() {
  if (currentOverlay !== "laptop") return;
  currentOverlay = null;
  document.body.classList.remove("laptop-open");
}

// ---- Bathroom / rest break (right arrow) -----------------------------
function openBathroom() {
  if (!flightMode || currentOverlay) return;
  currentOverlay = "bathroom";
  bathroomStart = performance.now();
  document.body.classList.add("bathroom-open");
  updateBathroom();
}
function closeBathroom() {
  if (currentOverlay !== "bathroom") return;
  totalBathroomMs += performance.now() - bathroomStart;
  currentOverlay = null;
  document.body.classList.remove("bathroom-open");
}
function updateBathroom() {
  const restSec = (performance.now() - bathroomStart) / 1000;
  document.getElementById("rest-timer").textContent = fmtClock(restSec);
  document.getElementById("rest-note").textContent = `Flight continues — ${fmtClock((totalMin - simElapsedMin) * 60)} remaining`;
}

// ---- Keyboard: ← window | seat | laptop → (overlay-aware) ------------
window.addEventListener("keydown", e => {
  if (!flightMode) return;
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    if (currentOverlay === "laptop") closeLaptopView();   // step back from the laptop (right side)
    else if (!currentOverlay) openWindowView();           // seat → window (window seat only)
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    if (currentOverlay === "window") closeWindowView();   // step back from the window
    else if (!currentOverlay) openLaptopView();           // seat → laptop
  } else if (e.key === "Escape") {
    if (currentOverlay === "window") closeWindowView();
    else if (currentOverlay === "laptop") closeLaptopView();
    else if (currentOverlay === "bathroom") closeBathroom();
  }
});
