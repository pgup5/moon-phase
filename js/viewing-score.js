import { moonPosition, moonState } from "./astro.js";

const forecasts = new Map();
const TTL = 30 * 60000;

// Cache promises too, so moving through dates never duplicates requests.
export function getViewingWeather(lat, lon) {
  const key = `${lat},${lon}`;
  const hit = forecasts.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const query = new URLSearchParams({ latitude: lat, longitude: lon,
    hourly: "cloud_cover,precipitation_probability", forecast_days: 16, timeformat: "unixtime", timezone: "UTC" });
  const promise = fetch(`https://api.open-meteo.com/v1/forecast?${query}`, { signal: AbortSignal.timeout(12000) })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Weather HTTP ${res.status}`);
      const { hourly } = await res.json();
      if (!Array.isArray(hourly?.time)) throw new Error("Invalid weather data");
      return hourly.time.map((t, i) => ({ time: t * 1000,
        cloud: hourly.cloud_cover?.[i], rain: hourly.precipitation_probability?.[i] }));
    });
  if (forecasts.size > 20) forecasts.clear();
  forecasts.set(key, { at: Date.now(), promise });
  return promise;
}

// Site-specific enjoyment index, not a calibrated probability of visibility.
// Compare every 10 minutes and the peak of each eligible observing window.
export function viewingScore(windows, lat, lon, weather = null) {
  if (!windows.length) return null;
  const samples = [];
  for (const w of windows) {
    const times = [+w.peak];
    for (let t = +w.start + 30000; t < +w.end; t += 10 * 60000) times.push(t);
    for (const time of times) {
      const date = new Date(time);
      const altitude = moonPosition(date, lat, lon).alt;
      const illumination = moonState(date).illum;
      const astro = 0.7 * Math.min(altitude / 60, 1) + 0.3 * Math.sqrt(illumination);
      const hour = Math.floor(time / 3600000) * 3600000;
      const forecast = weather?.find((x) => x.time === hour);
      const complete = forecast && [forecast.cloud, forecast.rain].every((v) =>
        typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100);
      const score = Math.round(100 * (complete
        ? astro * (1 - 0.8 * forecast.cloud / 100) * (1 - 0.8 * forecast.rain / 100) : astro));
      samples.push({ date, altitude, illumination, score, forecast: complete ? forecast : null });
    }
  }
  // Only present a weather-aware score when every candidate has weather coverage.
  if (weather && samples.some((s) => !s.forecast)) return viewingScore(windows, lat, lon);
  return samples.reduce((best, s) => s.score > best.score ? s : best);
}
