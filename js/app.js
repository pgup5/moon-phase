import { tr, locale, initializeLanguage } from "./i18n.js";
import * as A from "./astro.js";
import * as C from "./culture.js";
import { initSky } from "./sky.js";
import { buildCard, shareOrDownload } from "./card.js";
import { getLaunches, CATEGORIES } from "./launches.js";
import { viewingAdvice } from "./viewing-advice.js";
import { getViewingWeather, viewingScore } from "./viewing-score.js";

import { moonPath, moonPathSVG, moonPathMarker } from "./moon-path.js";

import { viewingWeek, scoreViewingWeek } from "./viewing-week.js";

import { initEclipseFeature } from "./eclipse-feature.js";
import { initObservingFeatures } from "./observing-features.js";
import { initNightFeatures } from "./night-features.js";
import { initializeMobileLayout } from "./mobile-layout.js";
import { initExplorationTools } from "./exploration-tools.js";
import { photoGuide, photoAdvice } from "./photo-guide.js";

initializeLanguage();
const LOC = locale;
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
const DIRS = [tr("北"), tr("北北東"), tr("東北"), tr("東北東"), tr("東"), tr("東南東"), tr("東南"), tr("南南東"), tr("南"), tr("南南西"), tr("西南"), tr("西南西"), tr("西"), tr("西北西"), tr("西北"), tr("北北西")];
const dirName = (az) => DIRS[Math.round(az / 22.5) % 16];
const phaseLabel = (i) => tr(A.PHASES[i].name);

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
let moonModulePromise;
const loadMoonModule = () => moonModulePromise ||= import("./moon3d.js");
function startMoon3D() {
  if (navigator.connection?.saveData) { $("moonHint").hidden = true; return; }
  loadMoonModule().then(module => module.createMoon(stage)).then(m => {
    moon3d = m;
    if (m) fallback.remove(); else $("moonHint").hidden = true;
    render(true);
  }).catch(e => { console.warn("3D moon unavailable", e); $("moonHint").hidden = true; });
}

// ---------- sky ----------
const sky = initSky($("sky"));

// ---------- main render ----------
let lastDay = "", lastMonthKey = "";
function render(force = false) {
  const now = new Date();
  const d = target();
  $("clock").textContent = tr`現在時間：${fmtFull(now)}`;
  $("tzInfo").textContent = tr`您的時區：${tzText(now)}`;
  $("tz").textContent = TZ;
  $("liveTag").textContent = state.live && !state.offsetH ? tr("即時") : tr("時光旅行中");
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

  $("phaseName").textContent = phaseLabel(idx);
  $("phaseAlias").textContent = locale === "zh-TW" && ph.alias ? `（${ph.alias}）` : "";
  $("forWhen").textContent = fmtFull(d);
  const lunar = C.lunarParts(d);
  $("lunarLine").textContent = lunar ? tr`農曆 ${C.lunarString(d, true)}` : "";
  $("illum").textContent = `${(ms.illum * 100).toFixed(1)}%`;
  $("illumBar").style.width = `${ms.illum * 100}%`;
  $("age").textContent = tr`${age.toFixed(1)} 天`;
  $("cycle").textContent = `${((ms.elong / 360) * 100).toFixed(1)}%`;
  $("dist").textContent = tr`${Math.round(ms.distKm).toLocaleString(LOC)} 公里`;
  $("term").textContent = tr(A.currentSolarTerm(d));
  const poem = C.poemFor(idx, d);
  $("poem").innerHTML = `${poem.text}<cite>${locale === "en-US" ? `— ${poem.author}, ${poem.title}` : `—— ${poem.author}《${poem.title}》`}</cite>`;

  // badges & banner (once per day)
  const dk = dayKey(d);
  if (force || dk !== lastDay) {
    const badges = eventsNear(d).map((e) => tr(e.kind));
    const fest = C.festivalOf(lunar);
    if (fest) badges.unshift(tr(fest.name));
    const term = A.solarTerms(new Date(d.getFullYear(), d.getMonth(), d.getDate()), 1)[0];
    if (term && dayKey(term.date) === dk) badges.unshift(tr(term.name));
    $("badges").innerHTML = badges.map((b) => `<span class="badge">${b}</span>`).join("");
    const banner = $("banner");
    if (fest) { banner.hidden = false; banner.textContent = tr`今天是${tr(fest.name)}：${tr(fest.desc)}`; }
    else banner.hidden = true;
    if (fest && fest.name === "中秋節") setTimeout(hopRabbit, 800);
  }

  mobileLayout?.update(d, state.loc.name, state.live && !state.offsetH);
  if (visibleFeature("landscapePlanner") || visibleFeature("moonExplorer")) explorationTools?.update();
  if (visibleFeature("darknessCard") || visibleFeature("neighborsCard")) nightFeatures?.update();
  observingFeatures?.update();
  if (visibleFeature("lunarEclipseCard")) eclipseFeature?.update();
  if (visibleFeature("photoTitle")) renderPhotoGuide(d, ms);
  renderWhere(d);
  renderViewing(d);
  renderViewingAdvice(d);
  if (visibleFeature("moonPathTitle")) renderMoonPath(d);
  if (visibleFeature("viewingWeekTitle")) renderViewingWeek(d);
  if (visibleFeature("launches") && !launchesRequested) loadLaunches();

  if (force || dk !== lastDay) {
    lastDay = dk;
    renderUpcoming(d);
    renderLists(d);
  }
  const mk = `${state.calYear ?? d.getFullYear()}-${state.calMonth ?? d.getMonth()}-${dk}-${state.southern}`;
  if (visibleFeature("calTitle") && (force || mk !== lastMonthKey)) { lastMonthKey = mk; renderCalendar(d); }
}

let raf = 0;
const scheduleRender = (force) => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => render(force)); };

// ---------- moon photography ----------
function renderPhotoGuide(d, ms) {
  const english = locale === "en-US";
  const t = (zh, en) => english ? en : zh;
  const mp = A.moonPosition(d, state.loc.lat, state.loc.lon);
  const sp = A.sunPosition(d, state.loc.lat, state.loc.lon);
  const guide = photoGuide(ms.illum, $("photoDevice").value);
  const advice = photoAdvice(guide, english);
  $("photoContext").textContent = `${fmtFull(d)} · ${tr(state.loc.name)} · ${phaseLabel(A.phaseIndex(ms.elong))} · ${(ms.illum * 100).toFixed(1)}%`;
  $("photoVisibility").textContent = mp.alt <= 0
    ? t("月亮目前在地平線下，請查看月出時間或切換日期與時間。", "The Moon is below the horizon. Check moonrise or choose another date and time.")
    : `${dirName(mp.az)} ${mp.az.toFixed(0)}° · ${t("高度", "Altitude")} ${mp.alt.toFixed(0)}° · ` + (sp.alt > 0
      ? t("目前是白天，月亮對比較低。", "Daylight reduces lunar contrast.")
      : mp.alt < 20 ? t("月亮位置偏低，先確認前方沒有建築或山稜遮擋。", "The Moon is low; check for buildings or ridges in front of you.")
      : t("可嘗試月面特寫，實際清晰度仍取決於雲量與大氣擾動。", "Try lunar close-ups; clouds and atmospheric turbulence still affect sharpness."));
  $("photoSubject").textContent = advice.subject;
  $("photoSettings").textContent = advice.settings;
  $("photoTechnique").textContent = advice.technique;
  $("photoComposition").textContent = t("地景取景：利用上方月出／月落時間與天空路徑預覽方向，提前找好前景；低空月亮適合與地標同框，高空較方便拍月面細節。", "Plan landscape framing with the moonrise/moonset times and sky-path preview above. Scout your foreground: a low Moon fits landmarks, while a higher Moon is useful for surface detail.");
}
$("photoDevice").addEventListener("change", () => scheduleRender());

// ---------- nightly moon path ----------
let pathKey = "", pathData = null, pathPreview = false;
function renderMoonPath(d) {
  const { lat, lon } = state.loc;
  const name = tr(state.loc.name);
  const key = `${dayKey(d)}:${lat}:${lon}`;
  if (key !== pathKey) {
    pathKey = key; pathPreview = false;
    pathData = moonPath(d, lat, lon);
    $("moonPathChart").innerHTML = moonPathSVG(pathData);
    $("moonPathSlider").max = Math.round((pathData.end - pathData.start) / 60000);
    const events = [...pathData.crossings];
    if (pathData.peak) events.push({ ...pathData.peak, kind: tr("最高點") });
    events.sort((a, b) => a.t - b.t);
    $("moonPathEvents").innerHTML = events.length ? events.map((p) =>
      tr`<div class="item"><span><b>${p.kind}</b><br><small>${fmtShort(new Date(p.t))}</small></span><span>${dirName(p.az)}方 ${p.az.toFixed(0)}°<br><small>高度 ${Math.max(0, p.alt).toFixed(0)}°</small></span></div>`
    ).join("") : tr('<p class="when">這段時間月亮都在地平線下。</p>');
  }
  $("moonPathTitle").textContent = dayKey(d) === dayKey(new Date()) ? tr("今晚月亮路徑") : tr("所選夜晚月亮路徑");
  $("moonPathContext").textContent = `${name} · ${fmtShort(new Date(pathData.start))} — ${fmtShort(new Date(pathData.end))}`;
  if (!pathPreview) {
    $("moonPathSlider").value = Math.max(0, Math.min(+$("moonPathSlider").max, Math.round((+d - pathData.start) / 60000)));
    updateMoonPathPosition(d);
  }
}
function updateMoonPathPosition(date) {
  const inRange = +date >= pathData.start && +date <= pathData.end;
  const p = moonPathMarker(date, state.loc.lat, state.loc.lon);
  $("moonPathMarker").innerHTML = inRange ? p.svg : "";
  $("moonPathPosition").textContent = tr`${pathPreview ? tr("預覽") : tr("所選時間")}：${fmtShort(date)} · ${dirName(p.az)}方 ${p.az.toFixed(0)}° · 高度 ${p.alt.toFixed(0)}°`
    + (!inRange ? tr("（不在這晚路徑範圍內，拖曳可預覽）") : p.alt < 0 ? tr("（地平線下）") : "");
}
$("moonPathSlider").addEventListener("input", () => {
  pathPreview = true;
  updateMoonPathPosition(new Date(pathData.start + +$("moonPathSlider").value * 60000));
});
$("moonPathReset").onclick = () => { pathPreview = false; renderMoonPath(target()); };

// ---------- best moon-viewing windows ----------
let lastViewingKey = "", adviceKey = "", adviceData = null;
function renderViewing(d) {
  const { lat, lon } = state.loc;
  const name = tr(state.loc.name);
  const key = `view${dayKey(d)}:${lat}:${lon}:${name}:${Math.floor(Date.now() / (30 * 60000))}`;
  if (key === lastViewingKey) return;
  lastViewingKey = key;
  const windows = cached(key, () => A.viewingWindows(d, lat, lon));
  adviceData = { windows, lat, lon, weather: null };
  adviceKey = "";
  $("viewingContext").textContent = tr`${fmtDate(d)}夜間 · ${name} · ${TZ}`;
  const time = (t) => `${dayKey(t) !== dayKey(d) ? tr("翌日 ") : ""}${fmtTime(t)}`;
  $("viewingWindows").innerHTML = windows.length ? windows.map((w) =>
    tr`<div class="item"><span><b>${time(w.start)} — ${time(w.end)}</b><br><small>月亮最高：${time(w.peak)} · 高度 ${w.altitude.toFixed(0)}° · ${dirName(w.azimuth)}方</small></span></div>`
  ).join("") : tr('<div class="when">這一晚沒有符合條件的賞月時段。可切換日期，或使用您的位置重新計算。</div>');
  renderViewingScore(d, windows, lat, lon, key);
}

function renderViewingAdvice(d) {
  if (!adviceData) return;
  const key = `${lastViewingKey}:${Math.floor(+d / 60000)}`;
  if (key === adviceKey) return;
  adviceKey = key;
  const english = locale === "en-US", t = (zh, en) => english ? en : zh;
  const advice = viewingAdvice(d, adviceData.windows, adviceData.lat, adviceData.lon, adviceData.weather);
  const prefix = dayKey(d) === dayKey(new Date()) ? t("今晚", "Tonight") : t("所選夜晚", "The selected night");
  if (advice.kind !== "window") {
    $("tonightAdvice").textContent = advice.kind === "ended"
      ? t("所選夜晚的賞月時段已結束，可切換日期尋找下一晚。", "The selected night's viewing windows have ended; try the next date.")
      : t("這晚沒有符合賞月條件的時段，可到「觀測」查看無月光的觀星時段。", "No viewing windows meet the lunar criteria; check moon-free stargazing times in Observe.");
    return;
  }
  const r = advice.result, p = A.moonPosition(r.date, adviceData.lat, adviceData.lon);
  const quality = r.score >= 60 ? t("適合賞月", "looks suitable for Moon viewing") : r.score >= 40 ? t("賞月條件普通", "has mixed Moon-viewing conditions") : t("賞月條件較差", "has poor Moon-viewing conditions");
  const basis = r.forecast ? t("依天文與天氣預報", "Based on astronomy and forecast") : t("僅依天文條件，未納入天氣", "Astronomy only; weather not included");
  $("tonightAdvice").textContent = english
    ? `${prefix} ${quality}: try ${fmtShort(r.date)}, facing ${dirName(p.az)} (${p.az.toFixed(0)}°), altitude ${p.alt.toFixed(0)}°. ${basis}.`
    : `${prefix}${quality}，建議 ${fmtShort(r.date)} 朝${dirName(p.az)}方（${p.az.toFixed(0)}°）、仰角約 ${p.alt.toFixed(0)}° 觀賞（${basis}）。`;
}

async function renderViewingScore(d, windows, lat, lon, key) {
  const tonight = dayKey(d) === dayKey(new Date());
  $("viewingScoreTitle").textContent = tonight ? tr("今晚賞月評分") : tr("所選夜晚賞月評分");
  const show = (result, note) => {
    if (key !== lastViewingKey) return;
    renderViewingAdvice(target());
    $("viewingScoreValue").textContent = result ? `${result.score} / 100` : "—";
    $("viewingScoreLabel").textContent = !result ? tr("沒有符合條件的時段")
      : result.score >= 80 ? tr("很適合賞月") : result.score >= 60 ? tr("適合賞月")
      : result.score >= 40 ? tr("條件普通") : tr("賞月條件較差");
    $("viewingScoreDetails").textContent = result
      ? tr`建議觀賞：${fmtShort(result.date)} · 月亮高度 ${result.altitude.toFixed(0)}° · 照明 ${(result.illumination * 100).toFixed(0)}%`
        + (result.forecast ? tr` · 雲量 ${result.forecast.cloud}% · 降雨機率 ${result.forecast.rain}%` : "") : tr("可切換日期，看看其他夜晚。");
    $("viewingScoreNote").textContent = note;
  };
  const astronomy = viewingScore(windows, lat, lon);
  if (!astronomy) { show(null, tr("無適合時段，不計分。")); return; }
  const now = Date.now();
  if (+windows[0].start < now - DAY || +windows[windows.length - 1].end > now + 15 * DAY) {
    show(astronomy, tr("僅天文評分：所選夜晚不在可用預報範圍內，未納入天氣。"));
    return;
  }
  show(astronomy, tr("正在取得天氣預報，目前顯示天文評分…"));
  try {
    const weather = await getViewingWeather(lat, lon);
    if (key === lastViewingKey) { adviceData.weather = weather; adviceKey = ""; }
    const result = viewingScore(windows, lat, lon, weather);
    show(result, result.forecast ? tr("已納入賞月時段的逐時天氣預報。") : tr("僅天文評分：預報資料未完整涵蓋賞月時段。"));
  } catch {
    show(astronomy, tr("僅天文評分：暫時無法取得天氣，請稍後重新整理。"));
  }
}

// ---------- seven-night comparison ----------
let lastWeekKey = "";
async function renderViewingWeek(d) {
  const { lat, lon } = state.loc;
  const name = tr(state.loc.name);
  const key = `${dayKey(d)}:${lat}:${lon}:${Math.floor(Date.now() / (30 * 60000))}`;
  if (key === lastWeekKey) return;
  lastWeekKey = key;
  const nights = cached(`week:${dayKey(d)}:${lat}:${lon}`, () => viewingWeek(d, lat, lon));
  $("viewingWeekTitle").textContent = dayKey(d) === dayKey(new Date()) ? tr("未來七晚賞月比較") : tr("所選日起七晚賞月比較");
  $("viewingWeekContext").textContent = `${fmtDate(nights[0].night)} — ${fmtDate(nights[6].night)} · ${name} · ${TZ}`;
  const show = (comparison, message) => {
    if (key !== lastWeekKey) return;
    $("viewingWeekStatus").textContent = message;
    const best = comparison.rows.filter(n => n.best && n.result);
    $("viewingWeekSummary").textContent = best.length
      ? (locale === "en-US" ? "Highest score: " : "最高分夜晚：") + best.map(n => `${fmtDate(n.night)} · ${n.result.score}/100`).join("；")
      : (locale === "en-US" ? "No qualifying viewing windows this week." : "這七晚沒有符合條件的賞月時段。");
    $("viewingWeekRows").innerHTML = comparison.rows.map((n) => {
      const time = (t) => `${dayKey(t) !== dayKey(n.night) ? tr("翌日 ") : ""}${fmtTime(t)}`;
      const r = n.result;
      const weather = r?.forecast;
      return tr`<tr${n.best ? ' class="week-best"' : ""}>
        <th scope="row"><button data-week-time="${+n.night}">${n.night.toLocaleDateString(LOC, { month: "numeric", day: "numeric", weekday: "short" })}</button><small>${phaseLabel(n.phase)} · 照明 ${(n.moon.illum * 100).toFixed(0)}%</small>${n.best ? tr('<span class="badge">七晚最高分</span>') : ""}</th>
        <td>${n.windows.length ? n.windows.map((w) => `${time(w.start)} — ${time(w.end)}`).join("<br>") : tr("無符合條件時段")}</td>
        <td>${r ? `${time(r.date)}<small>${weather ? tr`雲量 ${weather.cloud}% · 降雨機率 ${weather.rain}%` : tr("未納入天氣")}</small>` : "—"}</td>
        <td>${r ? `<strong>${r.score}</strong> / 100<small>${comparison.weatherIncluded ? tr("含天氣") : tr("僅天文")}</small>` : "—"}</td>
      </tr>`;
    }).join("");
  };
  const astronomy = scoreViewingWeek(nights, lat, lon);
  if (!astronomy.rows.some((n) => n.result)) {
    show(astronomy, tr("這七晚沒有符合條件的賞月時段，可切換日期或地點。"));
    return;
  }
  const now = Date.now();
  if (+nights[0].night < now - DAY || +nights[6].night > now + 14 * DAY) {
    show(astronomy, tr("僅天文比較：日期不在完整的天氣預報範圍內。"));
    return;
  }
  show(astronomy, tr("正在取得天氣預報，目前七晚皆顯示天文評分…"));
  try {
    const weather = await getViewingWeather(lat, lon);
    const comparison = scoreViewingWeek(nights, lat, lon, weather);
    show(comparison, comparison.weatherIncluded ? tr("七晚採用相同評分方式，已納入逐時天氣預報。") : tr("預報未完整涵蓋所有賞月時段，七晚統一使用天文評分。"));
  } catch {
    show(astronomy, tr("暫時無法取得天氣，七晚統一使用天文評分。"));
  }
}
$("viewingWeekRows").addEventListener("click", (event) => {
  const button = event.target.closest("[data-week-time]");
  if (!button) return;
  jumpTo(new Date(+button.dataset.weekTime));
  mobileLayout?.reveal("viewingContext");
  $("viewingContext").closest("section").scrollIntoView({ behavior: "smooth", block: "start" });
});

// ---------- where is the moon ----------
function renderWhere(d) {
  const { lat, lon } = state.loc;
  const name = tr(state.loc.name);
  const mp = A.moonPosition(d, lat, lon), sp = A.sunPosition(d, lat, lon);
  sky.setSunAltitude(sp.alt);
  $("locName").textContent = tr`位置：${name}（${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}，${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}）`;
  $("moonAz").textContent = `${dirName(mp.az)}（${mp.az.toFixed(0)}°）`;
  $("moonAlt").textContent = `${mp.alt.toFixed(1)}°${mp.alt < 0 ? tr("（地平線下）") : ""}`;
  const key = `rs${dayKey(d)}${lat}${lon}`;
  const rs = cached(key, () => A.riseSet(d, lat, lon, "moon"));
  const ss = cached("s" + key, () => A.riseSet(d, lat, lon, "sun"));
  $("moonRise").textContent = rs.alwaysUp ? tr("整天在天上") : rs.alwaysDown ? tr("今天不升起") : rs.rise ? fmtTime(rs.rise) : tr("今天不升起");
  $("moonSet").textContent = rs.alwaysUp || rs.alwaysDown ? "—" : rs.set ? fmtTime(rs.set) : tr("今天不落下");
  $("sunRS").textContent = `${fmtTime(ss.rise)} / ${fmtTime(ss.set)}`;
  let tip;
  if (mp.alt > 0) {
    tip = tr`月亮在地平線上，面向${dirName(mp.az)}方、抬頭約 ${mp.alt.toFixed(0)}° 就能看到。`;
    if (sp.alt > 0) tip += tr("現在是白天，月亮可能比較淡。");
  } else {
    let next = rs.rise && rs.rise > d ? rs.rise : null;
    if (!next) {
      const nd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12);
      next = cached(`rs${dayKey(nd)}${lat}${lon}`, () => A.riseSet(nd, lat, lon, "moon")).rise;
    }
    tip = next ? tr`月亮目前在地平線下，下次月出：${fmtShort(next)}` : tr("月亮目前在地平線下。");
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
  const labels = [[tr("北"), 0], [tr("東"), 90], [tr("南"), 180], [tr("西"), 270]].map(([t, az]) => {
    const a = (az * Math.PI) / 180;
    return `<text x="${110 + 78 * Math.sin(a)}" y="${110 - 78 * Math.cos(a) + 5}" text-anchor="middle" font-size="14" fill="${t === tr("北") ? "#ff9b8a" : "#cfd5ff"}">${t}</text>`;
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
  const items = [[90, tr("上弦月")], [180, tr("滿月（望）")], [270, tr("下弦月")], [0, tr("新月（朔）")]]
    .map(([t, n]) => ({ n, t: A.nextPhaseTime(d, t) })).sort((a, b) => a.t - b.t);
  $("upcoming").innerHTML = items.map((x) => `<div><b>${x.n}</b>${fmtFull(x.t)}<br><small>${C.lunarString(x.t)}・${relDays(x.t, d)}</small></div>`).join("");
}
function relDays(t, from) {
  const n = (t - from) / DAY;
  if (n < 1) return tr`${Math.max(1, Math.round(n * 24))} 小時後`;
  return tr`${Math.round(n)} 天後`;
}
function renderLists(d) {
  const ev = yearEvents(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
  $("events").innerHTML = ev.length ? ev.map((e) => `<div class="item ${e.cls}" data-t="${e.date.getTime()}" role="button" tabindex="0">
      <span><b>${tr(e.kind)}</b><br><small>${e.cls === "solar" || e.cls === "lunar" ? tr("能否看見依所在地而定") : tr`距離約 ${Math.round(e.distKm || A.moonState(e.date).distKm).toLocaleString(LOC)} 公里`}</small></span>
      <span style="text-align:right">${fmtShort(e.date)}<br><small>${relDays(e.date, d)}</small></span></div>`).join("") : tr('<div class="when">未來一年沒有特殊天象</div>');
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const terms = A.solarTerms(start, 4).map((t) => ({ name: t.name, desc: tr("二十四節氣"), date: t.date }));
  const fests = C.upcomingFestivals(start).slice(0, 6);
  const all = [...terms, ...fests].sort((a, b) => a.date - b.date).slice(0, 8);
  $("festivals").innerHTML = all.map((f) => `<div class="item" data-t="${f.date.getTime()}" role="button" tabindex="0">
      <span><b>${tr(f.name)}</b><br><small>${tr(f.desc)}</small></span>
      <span style="text-align:right">${fmtDate(f.date)}<br><small>${daysFrom(new Date(f.date.getFullYear(), f.date.getMonth(), f.date.getDate()), start) === 0 ? tr("今天") : relDays(f.date, d)}</small></span></div>`).join("");
}
for (const id of ["events", "festivals"]) {
  $(id).addEventListener("click", (e) => {
    const it = e.target.closest("[data-t]");
    if (!it) return;
    const t = new Date(+it.dataset.t);
    jumpTo(id === "festivals" && t.getHours() === 12 ? new Date(t.getFullYear(), t.getMonth(), t.getDate(), 20) : t);
    mobileLayout?.reveal("moonStage");
    scrollTo({ top: 0, behavior: "smooth" });
  });
}

// ---------- rocket launches ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const PRECISE = ["SEC", "MIN", "HR"];
function launchWhen(l) {
  const t = new Date(l.net);
  if (PRECISE.includes(l.precision)) return fmtShort(t) + (l.precision === "HR" ? tr(" 左右") : "");
  // Coarse NETs are UTC midnights at the end of the period; converting them would shift the date.
  const y = t.getUTCFullYear(), p = l.precision;
  if (p === "DAY") return t.toLocaleDateString(LOC, { year: "numeric", month: "long", day: "numeric", weekday: "short", timeZone: "UTC" });
  if (/^Q\d$/.test(p)) return tr`${y}年第${p[1]}季`;
  if (p === "H1" || p === "H2") return tr`${y}年${p === "H1" ? tr("上") : tr("下")}半年`;
  if (p === "Y" || p === "FY") return tr`${y}年`;
  return t.toLocaleDateString(LOC, { year: "numeric", month: "long", timeZone: "UTC" });
}
function launchCountdown(l, now) {
  if (l.live) return tr("直播中");
  if (l.statusAbbrev === "In Flight") return tr("飛行中");
  if (![...PRECISE, "DAY"].includes(l.precision)) return tr(l.status);
  const ms = new Date(l.net) - now;
  if (ms <= 0) return tr`${tr(l.status)}・即將發射`;
  const h = ms / 3600000;
  const rel = h < 1 ? tr`${Math.max(1, Math.round(h * 60))} 分鐘後` : h < 48 ? tr`${Math.round(h)} 小時後` : tr`${Math.round(h / 24)} 天後`;
  return `${tr(l.status)}・${rel}`;
}
let launchData = null, launchesRequested = false;
let launchFilter = localStorage.getItem("moon.launchFilter") || "all";
function renderLaunches() {
  if (!launchData) return;
  const now = new Date();
  const { launches, at, stale } = launchData;
  const counts = Object.fromEntries(CATEGORIES.map(([k]) => [k, k === "all" ? launches.length : launches.filter((l) => l.tags.includes(k)).length]));
  if (!counts[launchFilter]) launchFilter = "all";
  $("launchFilter").innerHTML = CATEGORIES.filter(([k]) => counts[k]).map(([k, name]) =>
    `<button data-k="${k}" aria-pressed="${k === launchFilter}">${tr(name)} <small>${counts[k]}</small></button>`).join("");
  const shown = launchFilter === "all" ? launches.slice(0, 12) : launches.filter((l) => l.tags.includes(launchFilter));
  $("launchSummary").textContent = shown.length
    ? `${locale === "en-US" ? "Next listed: " : "近期發射："}${shown[0].mission} · ${launchWhen(shown[0])}${stale ? (locale === "en-US" ? " (offline data)" : "（離線資料）") : ""}`
    : tr("目前沒有已排定的發射");
  $("launches").innerHTML = shown.length ? shown.map((l) => `<div class="item launch">
      <span><b>${esc(l.mission)}</b>${l.nasa && l.provider !== "NASA" ? ' <span class="badge">NASA</span>' : ""}<br><small>${esc([l.provider, l.rocket, l.site, l.orbit].filter(Boolean).join("・"))}</small></span>
      <span style="text-align:right">${esc(launchWhen(l))}<br><small>${esc(launchCountdown(l, now))}</small></span></div>`).join("")
    : tr('<div class="when">目前沒有已排定的發射</div>');
  $("launchSrc").dataset.updated = stale ? tr`（離線資料，更新於 ${fmtShort(new Date(at))}）` : "";
}
$("launchFilter").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-k]");
  if (!b) return;
  launchFilter = b.dataset.k;
  localStorage.setItem("moon.launchFilter", launchFilter);
  renderLaunches();
});
async function loadLaunches() {
  launchesRequested = true;
  try {
    launchData = await getLaunches();
    renderLaunches();
  } catch (e) {
    console.warn("Launch data unavailable", e);
    if (!launchData) {
      $("launches").innerHTML = tr('<div class="when">暫時無法取得發射資料，請稍後再試</div>');
      $("launchSummary").textContent = locale === "en-US" ? "Launch data is temporarily unavailable." : "暫時無法取得發射資料。";
    }
  }
}
$("languageSelect").addEventListener("change", () => {
  const selected = $("languageSelect").value;
  try { localStorage.setItem("moon.language", selected); } catch {}
  const url = new URL(location.href);
  url.searchParams.set("lang", selected);
  if (!state.live || state.offsetH) url.searchParams.set("t", target().toISOString());
  url.searchParams.set("hemi", state.southern ? "S" : "N");
  location.assign(url.href);
});
$("launchTz").textContent = tr`以您的時區顯示：${TZ}`;
setInterval(() => { if (!document.hidden && visibleFeature("launches")) renderLaunches(); }, 60000);
setInterval(() => { if (!document.hidden && visibleFeature("launches")) loadLaunches(); }, 15 * 60000);

// ---------- calendar ----------
function renderCalendar(d) {
  const y = state.calYear ?? d.getFullYear(), m = state.calMonth ?? d.getMonth();
  $("calTitle").textContent = locale === "en-US" ? new Date(y, m, 1).toLocaleDateString(LOC, { year: "numeric", month: "long" }) : `${y} 年 ${m + 1} 月`;
  const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate();
  const end = new Date(y, m + 1, 1);
  const marks = {};
  for (const [t, n] of [[0, tr("新月")], [90, tr("上弦")], [180, tr("滿月")], [270, tr("下弦")]]) {
    for (let x = A.nextPhaseTime(new Date(first.getTime() - DAY), t); x < end; x = A.nextPhaseTime(new Date(x.getTime() + DAY), t)) {
      if (x >= first) marks[x.getDate()] = `${n} ${fmtTime(x)}`;
    }
  }
  const terms = {};
  for (const t of A.solarTerms(first, 3)) if (t.date < end) terms[t.date.getDate()] = tr(t.name);
  const today = new Date();
  let html = [tr("日"), tr("一"), tr("二"), tr("三"), tr("四"), tr("五"), tr("六")].map((w) => `<div class="dow">${w}</div>`).join("");
  html += "<div></div>".repeat(first.getDay());
  for (let i = 1; i <= days; i++) {
    const day = new Date(y, m, i, 20);
    const ms = A.moonState(day);
    const l = C.lunarParts(new Date(y, m, i, 12));
    const fest = C.festivalOf(l);
    const isToday = dayKey(day) === dayKey(today), isSel = dayKey(day) === dayKey(d);
    const tag = fest ? `<span class="tag fest">${tr(fest.name)}</span>` : terms[i] ? `<span class="tag">${terms[i]}</span>` : marks[i] ? `<span class="tag">${locale === "en-US" ? marks[i].replace(/\s\d{2}:\d{2}$/, "") : marks[i].split(" ")[0]}</span>` : "";
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
  mobileLayout?.reveal("moonStage");
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
  $("offsetLabel").textContent = tr`${sign}${Math.floor(a / 24)} 天 ${Math.round(a % 24)} 小時`;
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
function stopPlay() { state.playing = false; cancelAnimationFrame(playRaf); $("playBtn").textContent = tr("▶ 播放"); $("playBtn").setAttribute("aria-label", tr("播放")); }
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
  state.playing = true; lastT = 0; $("playBtn").textContent = tr("⏸ 暫停"); $("playBtn").setAttribute("aria-label", tr("暫停"));
  playRaf = requestAnimationFrame(playStep);
};

// ---------- location & compass ----------
$("locBtn").onclick = () => {
  if (!navigator.geolocation) return toast(tr("此瀏覽器不支援定位"));
  $("locBtn").disabled = true;
  navigator.geolocation.getCurrentPosition((p) => {
    state.loc = { lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3), name: "您的位置" };
    localStorage.setItem("moon.loc", JSON.stringify(state.loc));
    $("locBtn").disabled = false; memo.clear(); scheduleRender(true); toast(tr("已更新為您的位置"));
  }, (err) => { $("locBtn").disabled = false; toast(err.code === 1 ? tr("未取得定位權限，繼續使用預設位置") : tr("無法取得位置")); }, { timeout: 10000, maximumAge: 600000 });
};
if ("DeviceOrientationEvent" in window && matchMedia("(pointer: coarse)").matches) $("compassBtn").hidden = false;
$("compassBtn").onclick = async () => {
  try {
    if (typeof DeviceOrientationEvent.requestPermission === "function" && (await DeviceOrientationEvent.requestPermission()) !== "granted") return toast(tr("未允許使用指南針"));
  } catch (e) { return toast(tr("無法啟用指南針")); }
  const onOri = (e) => {
    const h = e.webkitCompassHeading != null ? e.webkitCompassHeading : e.absolute && e.alpha != null ? 360 - e.alpha : null;
    if (h == null) return;
    state.heading = h; drawCompass(A.moonPosition(target(), state.loc.lat, state.loc.lon), A.sunPosition(target(), state.loc.lat, state.loc.lon));
  };
  addEventListener("ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation", onOri);
  $("compassBtn").hidden = true;
  toast(tr("把手機平放，上方的金色箭頭就是您面對的方向"));
};

// ---------- birthday card ----------
$("cardDate").value = `${new Date().getFullYear() - 20}-01-01`;
let lastCard = null, lastCardName = "";
$("cardBtn").onclick = async () => {
  const v = $("cardDate").value;
  if (!v) return toast(tr("請先選擇日期"));
  $("cardBtn").disabled = true; $("cardBtn").textContent = tr("產生中…");
  try {
    const d = new Date(`${v}T21:00`);
    const ms = A.moonState(d), idx = A.phaseIndex(ms.elong);
    const title = $("cardTitle").value.trim();
    const special = eventsNear(d).map((e) => tr(e.kind)).join("・");
    const moonImage = await loadMoonModule().then(module => module.renderMoonImage(ms.elong, state.southern, 900)).catch(() => null);
    lastCard = await buildCard({
      moonImage, svgFallback: moonImage ? null : moonSVG(ms.elong, 600, state.southern),
      dateText: `${title ? title + "｜" : ""}${d.toLocaleDateString(LOC, { year: "numeric", month: "long", day: "numeric" })}`,
      lunarText: tr`農曆 ${C.lunarString(d, true)}`, phaseName: phaseLabel(idx), illum: ms.illum,
      poem: C.poemFor(idx, d), special,
    });
    lastCardName = `moon-${v}.png`;
    $("cardImg").src = lastCard.toDataURL("image/png");
    $("cardOut").style.display = "block";
  } finally { $("cardBtn").disabled = false; $("cardBtn").textContent = tr("產生卡片"); }
};
$("shareBtn").onclick = async () => {
  if (!lastCard) return;
  const r = await shareOrDownload(lastCard, lastCardName);
  if (r === "downloaded") toast(tr("圖片已下載"));
};

// ---------- calendar reminders (.ics) ----------
$("icsBtn").onclick = () => {
  const start = new Date(), end = new Date(start.getTime() + 365 * DAY);
  const specials = A.specialMoons(start, end);
  const icsDate = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//moon-phase//zh-TW//", "CALSCALE:GREGORIAN", tr("X-WR-CALNAME:滿月提醒")];
  for (let t = A.nextPhaseTime(start, 180); t < end; t = A.nextPhaseTime(new Date(t.getTime() + DAY), 180)) {
    const eve = new Date(t.getFullYear(), t.getMonth(), t.getDate() - (t.getHours() < 6 ? 1 : 0));
    const tags = specials.filter((s) => Math.abs(s.date - t) < 2 * DAY && !/微型/.test(s.kind)).map((s) => tr(s.kind));
    const title = tr`今晚滿月${tags.length ? "・" + tags.join("・") : ""}`;
    lines.push("BEGIN:VEVENT", `UID:full-${t.getTime()}@moon-phase-psi.vercel.app`, `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(eve)}T190000`, `DTEND:${icsDate(eve)}T200000`, `SUMMARY:${title}`,
      tr`DESCRIPTION:滿月時刻：${fmtFull(t)}（${TZ}）\\n農曆 ${C.lunarString(t)}`,
      "BEGIN:VALARM", "TRIGGER:PT0M", "ACTION:DISPLAY", `DESCRIPTION:${title}`, "END:VALARM", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = tr("滿月提醒.ics"); a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(tr("已下載行事曆檔，開啟即可加入（每次滿月晚上 7 點提醒）"));
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
if (!standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) $("installHint").textContent = tr("iPhone / iPad：點「分享」→「加入主畫面」即可安裝");
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
  toast(tr("玉兔：嫦娥說，今晚月色真美。"));
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

function visibleFeature(id) { return !mobileLayout || mobileLayout.isVisible(id); }

// ---------- start ----------
let mobileLayout = null;
let nightFeatures = null;
let observingFeatures = null;
let eclipseFeature = null;
let explorationTools = null;
explorationTools = initExplorationTools({
  date: target,
  location: () => state.loc,
  southern: () => state.southern,
  jump: (date, location) => {
    state.loc = { ...location, name: locale === "en-US" ? "Planned camera position" : "規劃拍攝點" };
    localStorage.setItem("moon.loc", JSON.stringify(state.loc));
    memo.clear();
    jumpTo(date);
    mobileLayout?.reveal("moonStage");
    $("moonStage").scrollIntoView({ behavior: "smooth", block: "center" });
  },
});
nightFeatures = initNightFeatures({
  date: target,
  location: () => state.loc,
  jump: (date, card) => {
    jumpTo(date);
    mobileLayout?.reveal(card);
    $(card).scrollIntoView({ behavior: "smooth", block: "start" });
  },
});
observingFeatures = initObservingFeatures({
  visible: visibleFeature,
  date: target,
  location: () => state.loc,
  jump: (date, card) => {
    jumpTo(date);
    mobileLayout?.reveal(card);
    $(card).scrollIntoView({ behavior: "smooth", block: "start" });
  },
  reveal: (card) => {
    mobileLayout?.reveal(card);
    $(card).scrollIntoView({ behavior: "smooth", block: "start" });
  },
});
eclipseFeature = initEclipseFeature({
  date: target,
  location: () => state.loc,
  jump: (date) => {
    jumpTo(date);
    mobileLayout?.reveal("moonStage");
    $("moonStage").scrollIntoView({ behavior: "smooth", block: "center" });
  },
});
mobileLayout = initializeMobileLayout();
state.southern = new URLSearchParams(location.search).get("hemi") === "S";
$("hemi").value = state.southern ? "S" : "N";
updateOffsetLabel();
const qt = new URLSearchParams(location.search).get("t");
if (qt && !isNaN(new Date(qt))) jumpTo(new Date(qt));
render(true);
if ("requestIdleCallback" in window) requestIdleCallback(startMoon3D, { timeout: 1500 });
else setTimeout(startMoon3D, 0);
window.addEventListener("moon:viewchange", () => scheduleRender(false));
document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleRender(true); });
setInterval(() => { if (!state.playing && !document.hidden) render(); }, 30000);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") stopPlay(); });
