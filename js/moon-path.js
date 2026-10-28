import { tr } from "./i18n.js";
import { moonPosition, sunPosition } from "./astro.js";

// Local noon to local noon matches the viewing-window section, including DST.
export function moonPath(date, lat, lon) {
  const start = +new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const end = +new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 12);
  const at = (t) => ({ t, ...moonPosition(new Date(t), lat, lon), night: sunPosition(new Date(t), lat, lon).alt <= -6 });
  const samples = [];
  for (let t = start; t < end; t += 60000) samples.push(at(t));
  samples.push(at(end));
  const crossings = [];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i];
    if ((a.alt < 0) === (b.alt < 0)) continue;
    let low = a.t, high = b.t;
    for (let j = 0; j < 16; j++) {
      const mid = (low + high) / 2;
      if ((at(mid).alt < 0) === (a.alt < 0)) low = mid; else high = mid;
    }
    crossings.push({ ...at((low + high) / 2), kind: a.alt < 0 ? tr("升起") : tr("落下") });
  }
  const peak = samples.reduce((a, b) => b.alt > a.alt ? b : a);
  return { start, end, samples, crossings, peak: peak.alt >= 0 ? peak : null };
}

function xy(p) {
  const r = (90 - Math.max(0, p.alt)) / 90 * 150;
  const angle = p.az * Math.PI / 180;
  return [200 + r * Math.sin(angle), 200 - r * Math.cos(angle)];
}
const point = (p) => xy(p).map((n) => n.toFixed(2)).join(",");

export function moonPathSVG(path) {
  const grid = [0, 30, 60].map((alt) => `<circle cx="200" cy="200" r="${(90 - alt) / 90 * 150}" class="path-grid"/><text x="205" y="${200 + (90 - alt) / 90 * 150 - 5}" class="path-alt">${alt}°</text>`).join("");
  const segments = [];
  let current = null;
  for (const p of path.samples) {
    if (p.alt < 0) { current = null; continue; }
    if (!current || current.night !== p.night) {
      const previous = current?.points.at(-1);
      current = { night: p.night, points: previous ? [previous] : [] };
      segments.push(current);
    }
    current.points.push(point(p));
  }
  const lines = segments.map((s) => `<polyline points="${s.points.join(" ")}" class="${s.night ? "path-night" : "path-day"}"/>`).join("");
  const hours = path.samples.filter((p) => p.alt >= 0 && new Date(p.t).getMinutes() === 0 && new Date(p.t).getHours() % 2 === 0)
    .map((p) => { const [x, y] = xy(p); return tr`<circle cx="${x}" cy="${y}" r="3" fill="currentColor"/><text x="${x + 7}" y="${y - 7}" class="path-hour">${new Date(p.t).getHours()}時</text>`; }).join("");
  const marks = path.crossings.map((p) => { const [x, y] = xy(p); return tr`<circle cx="${x}" cy="${y}" r="5" class="path-event"><title>${p.kind} · 方位 ${p.az.toFixed(0)}°</title></circle>`; }).join("");
  const peak = path.peak ? tr`<circle cx="${xy(path.peak)[0]}" cy="${xy(path.peak)[1]}" r="6" class="path-event"><title>最高點 · 高度 ${path.peak.alt.toFixed(0)}°</title></circle>` : "";
  return tr`<title>月亮在天空中的路徑</title><desc>北方在上、東方在右，外圈為地平線、中心為天頂。金色為夜間路徑，虛線為暮光及白天。</desc>${grid}<path d="M50 200H350M200 50V350" class="path-grid"/><g class="path-directions"><text x="200" y="30">北</text><text x="375" y="205">東</text><text x="200" y="380">南</text><text x="25" y="205">西</text></g>${lines}${hours}${marks}${peak}<g id="moonPathMarker"></g>`;
}

export function moonPathMarker(date, lat, lon) {
  const p = moonPosition(date, lat, lon);
  const [x, y] = xy(p);
  return { ...p, svg: p.alt < 0 ? "" : `<circle cx="${x}" cy="${y}" r="11" class="path-marker-halo"/><circle cx="${x}" cy="${y}" r="6" class="path-marker"/>` };
}
