import { viewingWindows, moonState, phaseIndex } from "./astro.js";
import { viewingScore } from "./viewing-score.js";

export function viewingWeek(date, lat, lon) {
  return Array.from({ length: 7 }, (_, i) => {
    const night = new Date(date.getFullYear(), date.getMonth(), date.getDate() + i, 20);
    const moon = moonState(night);
    return { night, moon, phase: phaseIndex(moon.elong), windows: viewingWindows(night, lat, lon) };
  });
}

// Compare like with like: fall back for the whole week if any eligible night
// lacks complete weather coverage. Never rank astronomy against weather scores.
export function scoreViewingWeek(nights, lat, lon, weather = null) {
  let results = nights.map((n) => viewingScore(n.windows, lat, lon, weather));
  const weatherIncluded = !!weather && results.some(Boolean) && results.every((r) => !r || r.forecast);
  if (!weatherIncluded) results = nights.map((n) => viewingScore(n.windows, lat, lon));
  const bestScore = Math.max(...results.filter(Boolean).map((r) => r.score));
  return { weatherIncluded, rows: nights.map((n, i) => ({ ...n, result: results[i], best: !!results[i] && results[i].score === bestScore })) };
}
