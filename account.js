/* ----------------------------------------------------------------------
   FluffyFlight — accounts, boarding-pass tickets, history & My Page.
   Talks to the SQLite-backed API in server.py. Flight/map logic is app.js.
---------------------------------------------------------------------- */

const Account = {
  token: localStorage.getItem("ff_token") || null,
  user: null,
  isAuthed() { return !!this.token && !!this.user; },
};

// ---- API helper ------------------------------------------------------
async function api(path, method, body) {
  const headers = { "Content-Type": "application/json" };
  if (Account.token) headers["Authorization"] = "Bearer " + Account.token;
  const res = await fetch("/api" + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

// Toggle a primary button into a loading (disabled + spinner) state.
function setBtnLoading(btn, on) { if (!btn) return; btn.classList.toggle("loading", on); btn.disabled = on; }

// ---- Masking (for saved tickets) -------------------------------------
function maskEmail(e) {
  const [local, domain] = String(e).split("@");
  return local.slice(0, 2) + "****" + (domain ? "@" + domain : "");
}
function maskName(n) { return (String(n)[0] || "") + "****"; }

// ---- Formatting helpers ----------------------------------------------
function fmtDurSec(s) {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}
function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return "—"; }
}
function fmtDateLong(dateStr) {
  try { return new Date(dateStr + "T00:00:00").toLocaleDateString([], { weekday: "short", year: "numeric", month: "short", day: "numeric" }); }
  catch (e) { return dateStr; }
}

// ---- Ticket builders -------------------------------------------------
function boardingPassHTML(user) {
  const since = user.created_at ? new Date(user.created_at).toLocaleDateString() : new Date().toLocaleDateString();
  return `
    <div class="ticket">
      <div class="stub-cut"></div>
      <div class="t-head"><span class="brand">✈ FLUFFYFLIGHT</span><span class="klass">BOARDING PASS</span></div>
      <div class="t-route">
        <div><div class="t-iata">YOU</div><div class="t-city">Passenger</div></div>
        <div class="t-arrow">✈</div>
        <div><div class="t-iata">FLY</div><div class="t-city">Study Class</div></div>
      </div>
      <div class="t-grid">
        <div class="t-cell"><div class="k">Passenger</div><div class="v">${user.name}</div></div>
        <div class="t-cell"><div class="k">Member ID</div><div class="v">${user.email}</div></div>
        <div class="t-cell"><div class="k">Member since</div><div class="v">${since}</div></div>
        <div class="t-cell"><div class="k">Status</div><div class="v">Checked in ✓</div></div>
      </div>
      <div class="t-foot"><div class="barcode"></div><div class="t-seat">FF · STUDY</div></div>
    </div>`;
}

function flightTicketHTML(r, klass) {
  return `
    <div class="ticket">
      <div class="stub-cut"></div>
      <div class="t-head"><span class="brand">✈ FLUFFYFLIGHT</span><span class="klass">${klass}</span></div>
      <div class="t-route">
        <div><div class="t-iata">${r.dep_iata}</div><div class="t-city">${r.dep_city}</div></div>
        <div class="t-arrow">✈</div>
        <div><div class="t-iata">${r.arr_iata}</div><div class="t-city">${r.arr_city}</div></div>
      </div>
      <div class="t-grid">
        <div class="t-cell"><div class="k">Date</div><div class="v">${fmtDateLong(r.date)}</div></div>
        <div class="t-cell"><div class="k">Studied</div><div class="v">${fmtDurSec(r.study_seconds)}</div></div>
        <div class="t-cell"><div class="k">Boarded</div><div class="v">${fmtTime(r.real_start)}</div></div>
        <div class="t-cell"><div class="k">Landed</div><div class="v">${fmtTime(r.real_end)}</div></div>
        <div class="t-cell"><div class="k">Flight time (sim)</div><div class="v">${fmtDurSec(r.flight_seconds)}</div></div>
        <div class="t-cell"><div class="k">Break time</div><div class="v">${fmtDurSec(r.bathroom_seconds)}</div></div>
      </div>
      <div class="t-foot"><div class="barcode"></div><div class="t-seat">FF · LOG</div></div>
    </div>`;
}

// ---- Auth screens ----------------------------------------------------
function showAuth(which) {
  ["landing", "login", "signup", "boarding"].forEach(id =>
    document.getElementById("auth-" + id).classList.toggle("hidden", id !== which));
  document.getElementById("login-error").textContent = "";
  document.getElementById("signup-error").textContent = "";
}

function renderSavedTicket() {
  const slot = document.getElementById("saved-ticket-slot");
  const raw = localStorage.getItem("ff_saved");
  if (!raw) { slot.innerHTML = ""; return; }
  let saved; try { saved = JSON.parse(raw); } catch (e) { slot.innerHTML = ""; return; }
  slot.innerHTML = `
    <div class="saved-ticket" onclick="tapSavedTicket()">
      <div>
        <div class="st-name">${maskName(saved.name)}</div>
        <div class="st-mail">${maskEmail(saved.email)}</div>
      </div>
      <div class="st-go">Tap to board →</div>
    </div>
    <div class="saved-forget" onclick="forgetSavedTicket()">Forget this ticket</div>`;
}
function forgetSavedTicket() { localStorage.removeItem("ff_saved"); renderSavedTicket(); }

async function tapSavedTicket() {
  const saved = JSON.parse(localStorage.getItem("ff_saved"));
  Account.token = saved.token;
  localStorage.setItem("ff_token", saved.token);
  try {
    const d = await api("/me", "GET");
    Account.user = d.user;
    enterApp();
  } catch (e) {
    Account.token = null; localStorage.removeItem("ff_token");
    forgetSavedTicket();
    document.getElementById("login-email").value = saved.email;
    showAuth("login");
    document.getElementById("login-error").textContent = "Saved ticket expired — please log in again.";
  }
}

async function doSignup() {
  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  const err = document.getElementById("signup-error");
  if (!name || !email || !password) { err.textContent = "Please fill in every field."; return; }
  const btn = document.querySelector("#auth-signup .auth-btn.primary");
  err.textContent = ""; setBtnLoading(btn, true);
  try {
    const d = await api("/signup", "POST", { name, email, password });
    Account.token = d.token; Account.user = d.user;
    localStorage.setItem("ff_token", d.token);
    document.getElementById("boarding-pass").innerHTML = boardingPassHTML(d.user);
    showAuth("boarding");
  } catch (e) { err.textContent = e.message; }
  finally { setBtnLoading(btn, false); }
}

async function doLogin() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const err = document.getElementById("login-error");
  if (!email || !password) { err.textContent = "Enter your email and password."; return; }
  const btn = document.querySelector("#auth-login .auth-btn.primary");
  err.textContent = ""; setBtnLoading(btn, true);
  try {
    const d = await api("/login", "POST", { email, password });
    Account.token = d.token; Account.user = d.user;
    localStorage.setItem("ff_token", d.token);
    if (document.getElementById("save-ticket").checked) {
      localStorage.setItem("ff_saved", JSON.stringify({ token: d.token, name: d.user.name, email: d.user.email }));
    }
    enterApp();
  } catch (e) { err.textContent = e.message; }
  finally { setBtnLoading(btn, false); }
}

function boardNow() { enterApp(); }

function enterApp() {
  document.body.classList.add("authed");
  const first = (Account.user.name || "").split(" ")[0] || "traveler";
  document.getElementById("greeting").textContent = `✈ ${first}`;
  showAuth("landing");   // reset cards for next time
}

async function logout() {
  try { await api("/logout", "POST"); } catch (e) {}
  Account.token = null; Account.user = null;
  localStorage.removeItem("ff_token");
  document.body.classList.remove("authed");
  renderSavedTicket();
  showAuth("landing");
}

// ---- Flight completion ticket ----------------------------------------
async function saveCompletedFlight(record) {
  try { if (Account.token) await api("/history", "POST", record); } catch (e) {}
  document.getElementById("completion-ticket").innerHTML = flightTicketHTML(record, "FLIGHT LOG");
  const el = document.getElementById("completion");
  el.classList.remove("hidden"); el.classList.add("show");
}
function closeCompletion() {
  const el = document.getElementById("completion");
  el.classList.add("hidden"); el.classList.remove("show");
}
function completionToMyPage() { closeCompletion(); openMyPage(); }

// ---- My Page (calendar → tickets for the chosen day) -----------------
const MP = { byDate: {}, year: 0, month: 0, selected: null };
const EMPTY_HISTORY = `<div class="empty-note">No flights yet. Finish a study flight to collect your first ticket. ✈</div>`;

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function openMyPage() {
  const list = document.getElementById("mypage-list");
  list.innerHTML = `<div class="loading-wrap"><div class="spinner"></div>Loading your boarding passes…</div>`;
  document.getElementById("mypage").classList.remove("hidden");
  let history = [];
  try { history = (await api("/history", "GET")).history; }
  catch (e) { list.innerHTML = `<div class="empty-note">${e.message}</div>`; return; }

  MP.byDate = {};
  history.forEach(r => { (MP.byDate[r.date] = MP.byDate[r.date] || []).push(r); });
  const dates = Object.keys(MP.byDate).sort();
  if (!dates.length) { MP.selected = null; list.innerHTML = EMPTY_HISTORY; return; }

  const latest = dates[dates.length - 1];          // most recent day with a ticket
  MP.selected = latest;
  const d = new Date(latest + "T00:00:00");
  MP.year = d.getFullYear(); MP.month = d.getMonth();
  renderMyPage();
}
function closeMyPage() { document.getElementById("mypage").classList.add("hidden"); }

function renderMyPage() {
  document.getElementById("mypage-list").innerHTML = `<div id="mp-cal"></div><div id="mp-day"></div>`;
  renderCalendar();
  renderSelectedDay();
}

function renderCalendar() {
  const y = MP.year, m = MP.month;
  const monthName = new Date(y, m, 1).toLocaleDateString([], { month: "long", year: "numeric" });
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayStr = ymd(new Date());

  let cells = "";
  ["S", "M", "T", "W", "T", "F", "S"].forEach(d => cells += `<div class="mp-dow">${d}</div>`);
  for (let i = 0; i < firstDow; i++) cells += `<div class="mp-cell blank"></div>`;
  for (let dd = 1; dd <= daysInMonth; dd++) {
    const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    const tickets = MP.byDate[ds];
    const isToday = ds === todayStr ? " today" : "";
    if (tickets && tickets.length) {
      const sel = ds === MP.selected ? " sel" : "";
      const badge = tickets.length > 1 ? `<span class="mp-badge">${tickets.length}</span>` : "";
      cells += `<div class="mp-cell has${sel}${isToday}" onclick="selectDate('${ds}')">${dd}${badge}</div>`;
    } else {
      cells += `<div class="mp-cell empty${isToday}">${dd}</div>`;
    }
  }

  document.getElementById("mp-cal").innerHTML = `
    <div class="mp-cal">
      <div class="mp-cal-head">
        <div class="mp-cal-title">${monthName}</div>
        <div class="mp-nav">
          <button onclick="changeMonth(-1)" title="Previous month">‹</button>
          <button onclick="changeMonth(1)" title="Next month">›</button>
        </div>
      </div>
      <div class="mp-grid">${cells}</div>
    </div>`;
}

function renderSelectedDay() {
  const panel = document.getElementById("mp-day");
  const tickets = MP.selected ? MP.byDate[MP.selected] : null;
  if (!tickets || !tickets.length) {
    panel.innerHTML = `<div class="empty-note">Pick a highlighted date to see its ticket.</div>`;
    return;
  }
  panel.innerHTML = `
    <div class="mp-day-head">${fmtDateLong(MP.selected)}</div>
    <div class="mp-day-tickets">${tickets.map(myPageTicketHTML).join("")}</div>`;
}

function changeMonth(delta) {
  let m = MP.month + delta, y = MP.year;
  if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
  MP.month = m; MP.year = y;
  renderCalendar();
}

function selectDate(ds) {
  if (!MP.byDate[ds]) return;          // only days with tickets are selectable
  MP.selected = ds;
  renderCalendar();
  renderSelectedDay();
}

// A My Page ticket = the boarding-pass ticket + a premium "delete" control.
function myPageTicketHTML(r) {
  return `
    <div class="ticket-wrap" data-id="${r.id}">
      ${flightTicketHTML(r, "FLIGHT LOG")}
      <div class="ticket-tools">
        <button class="del-ticket" onclick="deleteFlight(this, ${r.id})" title="Tear up &amp; remove this ticket">
          <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6"/><path d="M10 11v6M14 11v6"/></svg>
          Delete ticket
        </button>
      </div>
    </div>`;
}

// Tear the ticket in two along a jagged line, let the halves fall, then remove it.
async function deleteFlight(btn, id) {
  const wrap = btn.closest(".ticket-wrap");
  if (!wrap || wrap.classList.contains("tearing")) return;
  btn.disabled = true;
  tearTicket(wrap);
  try { await api("/history/" + id, "DELETE"); }
  catch (e) { /* keep the visual removal even if the row was already gone */ }
}

function tearTicket(wrap) {
  const ticket = wrap.querySelector(".ticket");
  wrap.classList.add("tearing");

  // A shared zigzag boundary: top half keeps the upper teeth, bottom half the lower.
  const topClip = "polygon(0 0,100% 0,100% 46%,92% 50%,85% 46%,77% 51%,69% 47%,61% 52%,53% 47%,45% 51%,37% 47%,29% 52%,21% 47%,13% 51%,5% 47%,0 50%)";
  const botClip = "polygon(0 50%,5% 47%,13% 51%,21% 47%,29% 52%,37% 47%,45% 51%,53% 47%,61% 52%,69% 47%,77% 51%,85% 46%,92% 50%,100% 46%,100% 100%,0 100%)";

  const top = ticket.cloneNode(true), bot = ticket.cloneNode(true);
  top.className = ticket.className + " tear-half tear-top";
  bot.className = ticket.className + " tear-half tear-bot";
  top.style.clipPath = top.style.webkitClipPath = topClip;
  bot.style.clipPath = bot.style.webkitClipPath = botClip;

  const layer = document.createElement("div");
  layer.className = "tear-layer";
  layer.style.height = ticket.offsetHeight + "px";
  layer.appendChild(top);
  layer.appendChild(bot);
  ticket.style.visibility = "hidden";
  wrap.appendChild(layer);

  // After the tear, collapse the empty card, then drop it from the DOM.
  setTimeout(() => {
    wrap.style.height = wrap.offsetHeight + "px";
    requestAnimationFrame(() => {
      wrap.classList.add("removing");
      wrap.style.height = "0";
      wrap.style.margin = "0";
    });
    setTimeout(() => afterTicketRemoved(wrap), 380);
  }, 620);
}

function afterTicketRemoved(wrap) {
  const id = Number(wrap.dataset.id);
  wrap.remove();

  // Drop it from the in-memory store for the selected day.
  const ds = MP.selected;
  if (ds && MP.byDate[ds]) {
    MP.byDate[ds] = MP.byDate[ds].filter(r => Number(r.id) !== id);
    if (!MP.byDate[ds].length) delete MP.byDate[ds];
  }

  const remaining = Object.keys(MP.byDate).sort();
  if (!remaining.length) {                       // nothing left at all
    MP.selected = null;
    document.getElementById("mypage-list").innerHTML = EMPTY_HISTORY;
    return;
  }
  if (!MP.byDate[ds]) {                           // this day is now empty → jump to the latest remaining
    MP.selected = remaining[remaining.length - 1];
    renderMyPage();
    return;
  }
  renderCalendar();                              // day still has tickets: just refresh its badge/state
}

// ---- Enter-to-submit + boot ------------------------------------------
document.getElementById("login-password").addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
document.getElementById("signup-password").addEventListener("keydown", e => { if (e.key === "Enter") doSignup(); });

// Esc closes the My Page / Completion overlays (flight overlays are handled in app.js).
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  const mp = document.getElementById("mypage"), comp = document.getElementById("completion");
  if (mp && !mp.classList.contains("hidden")) closeMyPage();
  else if (comp && comp.classList.contains("show")) closeCompletion();
});

(async function init() {
  renderSavedTicket();
  if (Account.token) {
    try { Account.user = (await api("/me", "GET")).user; enterApp(); return; }
    catch (e) { Account.token = null; localStorage.removeItem("ff_token"); }
  }
  showAuth("landing");
})();
