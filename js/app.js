import * as A from "./astro.js";
import * as C from "./culture.js";
import { initSky } from "./sky.js";
import { createMoon, renderMoonImage } from "./moon3d.js";
import { buildCard, shareOrDownload } from "./card.js";

const LOC = "zh-TW";
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const DAY = 86400000;
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");

const savedLoc = JSON.parse(localStorage.getItem("moon.loc") || "null");
const state = {
  live: true, base: new Date(), offsetH: 0, southern: false, playing: false, heading: null,
  loc: savedLoc || { lat: 25.033, lon: 121.565, name: "台北（預設位置）" },
  calYear: null, calMonth: null,
};
const target = () => new Date((state.live ? Date.now() : state.base.getTime()) + state.offsetH * 3600000);

// ---------- formatting ----------
const fmtFull = (d) => d.toLocaleString(LOC, { year: "numeric", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const fmtShort = (d) => d.toLocaleString(LOC, { month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const fmtDate = (d) => d.toLocaleDateString(LOC, { year: "numeric", month: "long", day: "numeric", weekday: "short" });
const fmtTime = (d) => (d ? d.toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit", hour12: false }) : "—");
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const daysFrom = (d, from) => Math.round((d - from) / DAY);
function tzText(d) {
  const off = -d.getTimezoneOffset(), sign = off >= 0 ? "+" : "-", a = Math.abs(off);
  const name = (new Intl.DateTimeFormat(LOC, { timeZoneName: "long" }).formatToParts(d).find((p) => p.type === "timeZoneName") || {}).value || "";
  return `${TZ}｜${name}｜UTC${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}
const DIRS = ["北", "北北東", "東北", "東北東", "東", "東南東", "東南", "南南東", "南", "南南西", "西南", "西南西", "西", "西北西", "西北", "北北西"];
const dirName = (az) => DIRS[Math.round(az / 22.5) % 16];
const phaseLabel = (i) => A.PHASES[i].name;

function toast(msg, ms = 3200) {
  const t = $("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("show"), ms);
}

// ---------- 2D moon (calendar icons + no-WebGL fallback) ----------
function moonSVG(elong, size, southern) {
  const r = size / 2 - 1, c = size / 2;
  const k = Math.cos((elong * Math.PI) / 180), rx = Math.abs(k) * r;
  const rightLit = elong < 180 !== southern;
  const limb = rightLit ? 1 : 0;
  const term = k > 0 ? (rightLit ? 0 : 1) : (rightLit ? 1 : 0);
  const id = "g" + Math.random().toString(36).slice(2, 8);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <defs><radialGradient id="${id}" cx="45%" cy="40%"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#d9cfae"/></radialGradient></defs>
    <circle cx="${c}" cy="${c}" r="${r}" fill="#1d2036"/>
    <path d="M${c},${c - r} A${r},${r} 0 0 ${limb} ${c},${c + r} A${rx},${r} 0 0 ${term} ${c},${c - r}Z" fill="url(#${id})"/></svg>`;
}

// ---------- caches for heavier calculations ----------
const memo = new Map();
function cached(key, fn) {
  if (!memo.has(key)) { if (memo.size > 200) memo.clear(); memo.set(key, fn()); }
  return memo.get(key);
}
const yearEvents = (from) => cached("ev" + dayKey(from), () => {
  const to = new Date(from.getTime() + 365 * DAY);
  const ecl = A.eclipses(from, to).map((e) => ({ ...e, cls: e.type }));
  const sp = A.specialMoons(from, to).filter((e) => !/微型/.test(e.kind))
    .map((e) => ({ ...e, cls: /藍/.test(e.kind) ? "blue" : "super" }));
  return [...ecl, ...sp].sort((a, b) => a.date - b.date);
});
const eventsNear = (d) => cached("near" + dayKey(d), () => {
  const from = new Date(d.getTime() - 1.5 * DAY), to = new Date(d.getTime() + 1.5 * DAY);
  return [...A.eclipses(from, to), ...A.specialMoons(from, to).filter((e) => !/微型/.test(e.kind))];
});

// ---------- 3D moon ----------
let moon3d = null;
const stage = $("moonStage");
const fallback = document.createElement("div");
fallback.className = "moon-fallback";
stage.appendChild(fallback);
createMoon(stage).then((m) => {
  moon3d = m;
  if (m) fallback.remove(); else $("moonHint").hidden = true;
  render(true);
}).catch((e) => { console.warn("3D moon unavailable", e); $("moonHint").hidden = true; render(true); });

// ---------- sky ----------
const sky = initSky($("sky"));

// ---------- main render ----------
let lastDay = "", lastMonthKey = "";
function render(force = false) {
  const now = new Date();
  const d = target();
  $("clock").textContent = `現在時間：${fmtFull(now)}`;
  $("tzInfo").textContent = `您的時區：${tzText(now)}`;
  $("tz").textContent = TZ;
  $("liveTag").textContent = state.live && !state.offsetH ? "即時" : "時光旅行中";
  $("liveTag").classList.toggle("off", !(state.live && !state.offsetH));
  if (document.activeElement !== $("dt")) $("dt").value = toLocalInput(d);

  const ms = A.moonState(d);
  const idx = A.phaseIndex(ms.elong);
  const ph = A.PHASES[idx];
  const newMoon = A.prevNewMoon(d);
  const age = (d - newMoon) / DAY;

  if (moon3d) moon3d.setPhase(ms.elong, state.southern);
  else fallback.innerHTML = moonSVG(ms.elong, 300, state.southern);
  stage.style.setProperty("--glow", (0.06 + ms.illum * 0.3).toFixed(2));

  $("phaseName").textContent = ph.name;
  $("phaseAlias").textContent = ph.alias ? `（${ph.alias}）` : "";
  $("forWhen").textContent = fmtFull(d);
  const lunar = C.lunarParts(d);
  $("lunarLine").textContent = lunar ? `農曆 ${C.lunarString(d, true)}` : "";
  $("illum").textContent = `${(ms.illum * 100).toFixed(1)}%`;
  $("illumBar").style.width = `${ms.illum * 100}%`;
  $("age").textContent = `${age.toFixed(1)} 天`;
  $("cycle").textContent = `${((ms.elong / 360) * 100).toFixed(1)}%`;
  $("dist").textContent = `${Math.round(ms.distKm).toLocaleString(LOC)} 公里`;
  $("term").textContent = A.currentSolarTerm(d);
  const poem = C.poemFor(idx, d);
  $("poem").innerHTML = `${poem.text}<cite>—— ${poem.author}《${poem.title}》</cite>`;

  // badges & banner (once per day)
  const dk = dayKey(d);
  if (force || dk !== lastDay) {
    const badges = eventsNear(d).map((e) => e.kind);
    const fest = C.festivalOf(lunar);
    if (fest) badges.unshift(fest.name);
    const term = A.solarTerms(new Date(d.getFullYear(), d.getMonth(), d.getDate()), 1)[0];
    if (term && dayKey(term.date) === dk) badges.unshift(term.name);
    $("badges").innerHTML = badges.map((b) => `<span class="badge">${b}</span>`).join("");
    const banner = $("banner");
    if (fest) { banner.hidden = false; banner.textContent = `今天是${fest.name}：${fest.desc}`; }
    else banner.hidden = true;
    if (fest && fest.name === "中秋節") setTimeout(hopRabbit, 800);
  }

  renderWhere(d);

  if (force || dk !== lastDay) {
    lastDay = dk;
    renderUpcoming(d);
    renderLists(d);
  }
  const mk = `${state.calYear ?? d.getFullYear()}-${state.calMonth ?? d.getMonth()}-${dk}-${state.southern}`;
  if (force || mk !== lastMonthKey) { lastMonthKey = mk; renderCalendar(d); }
}

let raf = 0;
const scheduleRender = (force) => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => render(force)); };

// ---------- where is the moon ----------
function renderWhere(d) {
  const { lat, lon, name } = state.loc;
  const mp = A.moonPosition(d, lat, lon), sp = A.sunPosition(d, lat, lon);
  sky.setSunAltitude(sp.alt);
  $("locName").textContent = `位置：${name}（${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}，${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}）`;
  $("moonAz").textContent = `${dirName(mp.az)}（${mp.az.toFixed(0)}°）`;
  $("moonAlt").textContent = `${mp.alt.toFixed(1)}°${mp.alt < 0 ? "（地平線下）" : ""}`;
  const key = `rs${dayKey(d)}${lat}${lon}`;
  const rs = cached(key, () => A.riseSet(d, lat, lon, "moon"));
  const ss = cached("s" + key, () => A.riseSet(d, lat, lon, "sun"));
  $("moonRise").textContent = rs.alwaysUp ? "整天在天上" : rs.alwaysDown ? "今天不升起" : rs.rise ? fmtTime(rs.rise) : "今天不升起";
  $("moonSet").textContent = rs.alwaysUp || rs.alwaysDown ? "—" : rs.set ? fmtTime(rs.set) : "今天不落下";
  $("sunRS").textContent = `${fmtTime(ss.rise)} / ${fmtTime(ss.set)}`;
  let tip;
  if (mp.alt > 0) {
    tip = `月亮在地平線上，面向${dirName(mp.az)}方、抬頭約 ${mp.alt.toFixed(0)}° 就能看到。`;
    if (sp.alt > 0) tip += "現在是白天，月亮可能比較淡。";
  } else {
    let next = rs.rise && rs.rise > d ? rs.rise : null;
    if (!next) {
      const nd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12);
      next = cached(`rs${dayKey(nd)}${lat}${lon}`, () => A.riseSet(nd, lat, lon, "moon")).rise;
    }
    tip = next ? `月亮目前在地平線下，下次月出：${fmtShort(next)}` : "月亮目前在地平線下。";
  }
  $("visTip").textContent = tip;
  drawCompass(mp, sp);
}

function plotXY(alt, az) {
  const r = (Math.max(0, 90 - Math.max(alt, 0)) / 90) * 88;
  const a = (az * Math.PI) / 180;
  return [110 + r * Math.sin(a), 110 - r * Math.cos(a)];
}
function drawCompass(mp, sp) {
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const a = (i * 5 * Math.PI) / 180, long = i % 18 === 0, r1 = long ? 92 : 97;
    return `<line x1="${110 + r1 * Math.sin(a)}" y1="${110 - r1 * Math.cos(a)}" x2="${110 + 102 * Math.sin(a)}" y2="${110 - 102 * Math.cos(a)}" stroke="rgba(200,210,255,${long ? 0.8 : 0.3})" stroke-width="${long ? 2 : 1}"/>`;
  }).join("");
  const labels = [["北", 0], ["東", 90], ["南", 180], ["西", 270]].map(([t, az]) => {
    const a = (az * Math.PI) / 180;
    return `<text x="${110 + 78 * Math.sin(a)}" y="${110 - 78 * Math.cos(a) + 5}" text-anchor="middle" font-size="14" fill="${t === "北" ? "#ff9b8a" : "#cfd5ff"}">${t}</text>`;
  }).join("");
  const [mx, my] = plotXY(mp.alt, mp.az), [sx, sy] = plotXY(sp.alt, sp.az);
  const below = mp.alt < 0;
  const rot = state.heading == null ? 0 : -state.heading;
  $("compass").innerHTML = `<g class="dial" style="transform:rotate(${rot}deg)">
    <circle cx="110" cy="110" r="104" fill="rgba(5,8,26,.6)" stroke="rgba(160,175,255,.35)"/>
    <circle cx="110" cy="110" r="59" fill="none" stroke="rgba(160,175,255,.15)" stroke-dasharray="3 4"/>
    <circle cx="110" cy="110" r="29" fill="none" stroke="rgba(160,175,255,.15)" stroke-dasharray="3 4"/>
    ${ticks}${labels}
    ${sp.alt > -6 ? `<circle cx="${sx}" cy="${sy}" r="7" fill="#ffcf6e" opacity="${sp.alt > 0 ? 1 : 0.4}"/>` : ""}
    <line x1="110" y1="110" x2="${mx}" y2="${my}" stroke="rgba(255,217,138,.5)" stroke-dasharray="${below ? "2 4" : "0"}"/>
    <circle cx="${mx}" cy="${my}" r="10" fill="${below ? "rgba(240,233,210,.35)" : "#f2e9cf"}" stroke="#fff8e0" stroke-width="${below ? 0 : 1.5}"/>
  </g>${state.heading != null ? '<path d="M110 2 l7 12 h-14z" fill="#ffd98a"/>' : ""}`;
}

// ---------- lists ----------
function renderUpcoming(d) {
  const items = [[90, "上弦月"], [180, "滿月（望）"], [270, "下弦月"], [0, "新月（朔）"]]
    .map(([t, n]) => ({ n, t: A.nextPhaseTime(d, t) })).sort((a, b) => a.t - b.t);
  $("upcoming").innerHTML = items.map((x) => `<div><b>${x.n}</b>${fmtFull(x.t)}<br><small>${C.lunarString(x.t)}・${relDays(x.t, d)}</small></div>`).join("");
}
function relDays(t, from) {
  const n = (t - from) / DAY;
  if (n < 1) return `${Math.max(1, Math.round(n * 24))} 小時後`;
  return `${Math.round(n)} 天後`;
}
function renderLists(d) {
  const ev = yearEvents(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
  $("events").innerHTML = ev.length ? ev.map((e) => `<div class="item ${e.cls}" data-t="${e.date.getTime()}" role="button" tabindex="0">
      <span><b>${e.kind}</b><br><small>${e.cls === "solar" || e.cls === "lunar" ? "能否看見依所在地而定" : `距離約 ${Math.round(e.distKm || A.moonState(e.date).distKm).toLocaleString(LOC)} 公里`}</small></span>
      <span style="text-align:right">${fmtShort(e.date)}<br><small>${relDays(e.date, d)}</small></span></div>`).join("") : '<div class="when">未來一年沒有特殊天象</div>';
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const terms = A.solarTerms(start, 4).map((t) => ({ name: t.name, desc: "二十四節氣", date: t.date }));
  const fests = C.upcomingFestivals(start).slice(0, 6);
  const all = [...terms, ...fests].sort((a, b) => a.date - b.date).slice(0, 8);
  $("festivals").innerHTML = all.map((f) => `<div class="item" data-t="${f.date.getTime()}" role="button" tabindex="0">
      <span><b>${f.name}</b><br><small>${f.desc}</small></span>
      <span style="text-align:right">${fmtDate(f.date)}<br><small>${daysFrom(new Date(f.date.getFullYear(), f.date.getMonth(), f.date.getDate()), start) === 0 ? "今天" : relDays(f.date, d)}</small></span></div>`).join("");
}
for (const id of ["events", "festivals"]) {
  $(id).addEventListener("click", (e) => {
    const it = e.target.closest("[data-t]");
    if (!it) return;
    const t = new Date(+it.dataset.t);
    jumpTo(id === "festivals" && t.getHours() === 12 ? new Date(t.getFullYear(), t.getMonth(), t.getDate(), 20) : t);
    scrollTo({ top: 0, behavior: "smooth" });
  });
}

// ---------- calendar ----------
function renderCalendar(d) {
  const y = state.calYear ?? d.getFullYear(), m = state.calMonth ?? d.getMonth();
  $("calTitle").textContent = `${y} 年 ${m + 1} 月`;
  const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
  const end = new Date(y, m + 1, 1);
  const marks = {};
  for (const [t, n] of [[0, "新月"], [90, "上弦"], [180, "滿月"], [270, "下弦"]]) {
    for (let x = A.nextPhaseTime(new Date(first.getTime() - DAY), t); x < end; x = A.nextPhaseTime(new Date(x.getTime() + DAY), t)) {
      if (x >= first) marks[x.getDate()] = `${n} ${fmtTime(x)}`;
    }
  }
  const terms = {};
  for (const t of A.solarTerms(first, 3)) if (t.date < end) terms[t.date.getDate()] = t.name;
  const today = new Date();
  let html = ["日", "一", "二", "三", "四", "五", "六"].map((w) => `<div class="dow">${w}</div>`).join("");
  html += "<div></div>".repeat(first.getDay());
  for (let i = 1; i <= days; i++) {
    const day = new Date(y, m, i, 20);
    const ms = A.moonState(day);
    const l = C.lunarParts(new Date(y, m, i, 12));
    const fest = C.festivalOf(l);
    const isToday = dayKey(day) === dayKey(today), isSel = dayKey(day) === dayKey(d);
    const tag = fest ? `<span class="tag fest">${fest.name}</span>` : terms[i] ? `<span class="tag">${terms[i]}</span>` : marks[i] ? `<span class="tag">${marks[i].split(" ")[0]}</span>` : "";
    html += `<div class="day${isToday ? " today" : ""}${isSel ? " sel" : ""}" data-d="${i}" title="${marks[i] || ""}">${i}<span class="lunar">${C.dayLabel(l)}</span>${moonSVG(ms.elong, 26, state.southern)}${tag}</div>`;
  }
  $("cal").innerHTML = html;
}
$("cal").addEventListener("click", (e) => {
  const c = e.target.closest(".day");
  if (!c) return;
  const d = target();
  const y = state.calYear ?? d.getFullYear(), m = state.calMonth ?? d.getMonth();
  jumpTo(new Date(y, m, +c.dataset.d, 21));
});
function shiftMonth(n) {
  const d = target();
  const cur = new Date(state.calYear ?? d.getFullYear(), (state.calMonth ?? d.getMonth()) + n, 1);
  state.calYear = cur.getFullYear(); state.calMonth = cur.getMonth();
  scheduleRender(true);
}
$("prevM").onclick = () => shiftMonth(-1);
$("nextM").onclick = () => shiftMonth(1);

// ---------- time travel ----------
function jumpTo(date) {
  stopPlay();
  state.live = false; state.base = date; state.offsetH = 0; $("slider").value = 0;
  state.calYear = state.calMonth = null;
  updateOffsetLabel(); scheduleRender(true);
}
function updateOffsetLabel() {
  const h = state.offsetH, sign = h > 0 ? "+" : h < 0 ? "−" : "±", a = Math.abs(h);
  $("offsetLabel").textContent = `${sign}${Math.floor(a / 24)} 天 ${Math.round(a % 24)} 小時`;
}
$("dt").addEventListener("change", () => { if ($("dt").value) jumpTo(new Date($("dt").value)); });
$("nowBtn").onclick = () => {
  stopPlay();
  state.live = true; state.offsetH = 0; $("slider").value = 0; state.calYear = state.calMonth = null;
  updateOffsetLabel(); scheduleRender(true);
};
$("hemi").onchange = () => { state.southern = $("hemi").value === "S"; scheduleRender(true); };
$("slider").addEventListener("input", () => {
  if (state.live) { state.live = false; state.base = new Date(); }
  state.offsetH = +$("slider").value; state.calYear = state.calMonth = null;
  updateOffsetLabel(); scheduleRender();
});
let playRaf = 0, lastT = 0;
function stopPlay() { state.playing = false; cancelAnimationFrame(playRaf); $("playBtn").textContent = "▶ 播放"; }
function playStep(t) {
  if (!state.playing) return;
  const dt = lastT ? Math.min(0.1, (t - lastT) / 1000) : 0; lastT = t;
  state.offsetH += dt * 24 * +$("speed").value;
  if (state.offsetH > 720) { state.base = new Date(state.base.getTime() + state.offsetH * 3600000); state.offsetH = 0; }
  $("slider").value = state.offsetH; state.calYear = state.calMonth = null;
  updateOffsetLabel(); render();
  playRaf = requestAnimationFrame(playStep);
}
$("playBtn").onclick = () => {
  if (state.playing) return stopPlay();
  if (state.live) { state.live = false; state.base = new Date(); }
  state.playing = true; lastT = 0; $("playBtn").textContent = "⏸ 暫停";
  playRaf = requestAnimationFrame(playStep);
};

// ---------- location & compass ----------
$("locBtn").onclick = () => {
  if (!navigator.geolocation) return toast("此瀏覽器不支援定位");
  $("locBtn").disabled = true;
  navigator.geolocation.getCurrentPosition((p) => {
    state.loc = { lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3), name: "您的位置" };
    localStorage.setItem("moon.loc", JSON.stringify(state.loc));
    $("locBtn").disabled = false; memo.clear(); scheduleRender(true); toast("已更新為您的位置");
  }, (err) => { $("locBtn").disabled = false; toast(err.code === 1 ? "未取得定位權限，繼續使用預設位置" : "無法取得位置"); }, { timeout: 10000, maximumAge: 600000 });
};
if ("DeviceOrientationEvent" in window && matchMedia("(pointer: coarse)").matches) $("compassBtn").hidden = false;
$("compassBtn").onclick = async () => {
  try {
    if (typeof DeviceOrientationEvent.requestPermission === "function" && (await DeviceOrientationEvent.requestPermission()) !== "granted") return toast("未允許使用指南針");
  } catch (e) { return toast("無法啟用指南針"); }
  const onOri = (e) => {
    const h = e.webkitCompassHeading != null ? e.webkitCompassHeading : e.absolute && e.alpha != null ? 360 - e.alpha : null;
    if (h == null) return;
    state.heading = h; drawCompass(A.moonPosition(target(), state.loc.lat, state.loc.lon), A.sunPosition(target(), state.loc.lat, state.loc.lon));
  };
  addEventListener("ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation", onOri);
  $("compassBtn").hidden = true;
  toast("把手機平放，上方的金色箭頭就是您面對的方向");
};

// ---------- birthday card ----------
$("cardDate").value = `${new Date().getFullYear() - 20}-01-01`;
let lastCard = null, lastCardName = "";
$("cardBtn").onclick = async () => {
  const v = $("cardDate").value;
  if (!v) return toast("請先選擇日期");
  $("cardBtn").disabled = true; $("cardBtn").textContent = "產生中…";
  try {
    const d = new Date(`${v}T21:00`);
    const ms = A.moonState(d), idx = A.phaseIndex(ms.elong);
    const title = $("cardTitle").value.trim();
    const special = eventsNear(d).map((e) => e.kind).join("・");
    const moonImage = await renderMoonImage(ms.elong, state.southern, 900).catch(() => null);
    lastCard = await buildCard({
      moonImage, svgFallback: moonImage ? null : moonSVG(ms.elong, 600, state.southern),
      dateText: `${title ? title + "｜" : ""}${d.toLocaleDateString(LOC, { year: "numeric", month: "long", day: "numeric" })}`,
      lunarText: `農曆 ${C.lunarString(d, true)}`, phaseName: phaseLabel(idx), illum: ms.illum,
      poem: C.poemFor(idx, d), special,
    });
    lastCardName = `moon-${v}.png`;
    $("cardImg").src = lastCard.toDataURL("image/png");
    $("cardOut").style.display = "block";
  } finally { $("cardBtn").disabled = false; $("cardBtn").textContent = "產生卡片"; }
};
$("shareBtn").onclick = async () => {
  if (!lastCard) return;
  const r = await shareOrDownload(lastCard, lastCardName);
  if (r === "downloaded") toast("圖片已下載");
};

// ---------- calendar reminders (.ics) ----------
$("icsBtn").onclick = () => {
  const start = new Date(), end = new Date(start.getTime() + 365 * DAY);
  const specials = A.specialMoons(start, end);
  const icsDate = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//moon-phase//zh-TW//", "CALSCALE:GREGORIAN", "X-WR-CALNAME:滿月提醒"];
  for (let t = A.nextPhaseTime(start, 180); t < end; t = A.nextPhaseTime(new Date(t.getTime() + DAY), 180)) {
    const eve = new Date(t.getFullYear(), t.getMonth(), t.getDate() - (t.getHours() < 6 ? 1 : 0));
    const tags = specials.filter((s) => Math.abs(s.date - t) < 2 * DAY && !/微型/.test(s.kind)).map((s) => s.kind);
    const title = `今晚滿月${tags.length ? "・" + tags.join("・") : ""}`;
    lines.push("BEGIN:VEVENT", `UID:full-${t.getTime()}@moon-phase-psi.vercel.app`, `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(eve)}T190000`, `DTEND:${icsDate(eve)}T200000`, `SUMMARY:${title}`,
      `DESCRIPTION:滿月時刻：${fmtFull(t)}（${TZ}）\\n農曆 ${C.lunarString(t)}`,
      "BEGIN:VALARM", "TRIGGER:PT0M", "ACTION:DISPLAY", `DESCRIPTION:${title}`, "END:VALARM", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "滿月提醒.ics"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("已下載行事曆檔，開啟即可加入（每次滿月晚上 7 點提醒）");
};

// ---------- install (PWA) ----------
let installEvt = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; $("installBtn").hidden = false; });
$("installBtn").onclick = async () => {
  if (!installEvt) return;
  installEvt.prompt();
  await installEvt.userChoice; installEvt = null; $("installBtn").hidden = true;
};
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
if (!standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) $("installHint").textContent = "iPhone / iPad：點「分享」→「加入主畫面」即可安裝";
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});

// ---------- 玉兔 easter egg ----------
const RABBIT = `<svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg"><g fill="#fff">
  <ellipse cx="52" cy="52" rx="28" ry="20"/><circle cx="80" cy="36" r="13"/>
  <ellipse cx="78" cy="14" rx="4" ry="14" transform="rotate(-12 78 14)"/><ellipse cx="87" cy="15" rx="4" ry="13" transform="rotate(10 87 15)"/>
  <circle cx="24" cy="50" r="7"/><ellipse cx="66" cy="70" rx="9" ry="5"/><ellipse cx="38" cy="70" rx="11" ry="5"/></g>
  <circle cx="84" cy="34" r="2" fill="#e07a8a"/></svg>`;
function hopRabbit() {
  if (hopRabbit.busy) return;
  hopRabbit.busy = true;
  const r = document.createElement("div");
  r.className = "rabbit"; r.innerHTML = RABBIT;
  document.body.appendChild(r);
  const W = innerWidth, y = innerHeight * 0.35;
  const frames = Array.from({ length: 9 }, (_, i) => ({
    transform: `translate(${-120 + ((W + 240) * i) / 8}px, ${y - (i % 2 ? 70 : 0)}px)`,
  }));
  const anim = r.animate(frames, { duration: 3600, easing: "linear" });
  anim.onfinish = () => { r.remove(); hopRabbit.busy = false; };
  toast("玉兔：嫦娥說，今晚月色真美。");
}
let taps = [];
stage.addEventListener("click", () => {
  const t = Date.now();
  taps = taps.filter((x) => t - x < 2500).concat(t);
  if (taps.length >= 5) { taps = []; hopRabbit(); }
});
const firstState = A.moonState(new Date());
if (A.phaseIndex(firstState.elong) === 4 && !sessionStorage.getItem("moon.rabbit")) {
  sessionStorage.setItem("moon.rabbit", "1");
  setTimeout(hopRabbit, 2500);
}

// ---------- start ----------
updateOffsetLabel();
const qt = new URLSearchParams(location.search).get("t");
if (qt && !isNaN(new Date(qt))) jumpTo(new Date(qt));
render(true);
setInterval(() => { if (!state.playing) render(); }, 1000);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") stopPlay(); });
