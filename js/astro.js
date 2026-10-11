// Low/medium-precision astronomy after Jean Meeus, "Astronomical Algorithms".
export const SYNODIC = 29.530588853;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
export const norm = (d) => ((d % 360) + 360) % 360;
const sin = (d) => Math.sin(rad(d));
const cos = (d) => Math.cos(rad(d));

export const julianDay = (date) => date.getTime() / 86400000 + 2440587.5;
const fromJD = (jd) => new Date((jd - 2440587.5) * 86400000);
const centuries = (date) => (julianDay(date) - 2451545.0) / 36525;

function sunLongitude(T) {
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C = (1.914602 - 0.004817 * T) * sin(M) + (0.019993 - 0.000101 * T) * sin(2 * M) + 0.000289 * sin(3 * M);
  const omega = 125.04 - 1934.136 * T;
  return { geo: L0 + C, apparent: L0 + C - 0.00569 - 0.00478 * sin(omega), M };
}

export function moonState(date) {
  const T = centuries(date);
  const sun = sunLongitude(T);
  const M = sun.M;
  const Lp = 218.3164477 + 481267.88123421 * T;
  const D = 297.8501921 + 445267.1114034 * T;
  const Mp = 134.9633964 + 477198.8675055 * T;
  const F = 93.272095 + 483202.0175233 * T;
  const E = 1 - 0.002516 * T;
  const lon = Lp
    + 6.288774 * sin(Mp) + 1.274027 * sin(2 * D - Mp) + 0.658314 * sin(2 * D) + 0.213618 * sin(2 * Mp)
    - 0.185116 * E * sin(M) - 0.114332 * sin(2 * F) + 0.058793 * sin(2 * D - 2 * Mp) + 0.057066 * E * sin(2 * D - M - Mp)
    + 0.053322 * sin(2 * D + Mp) + 0.045758 * E * sin(2 * D - M) - 0.040923 * E * sin(M - Mp) - 0.03472 * sin(D)
    - 0.030383 * E * sin(M + Mp) + 0.015327 * sin(2 * D - 2 * F) - 0.012528 * sin(Mp + 2 * F) + 0.01098 * sin(Mp - 2 * F)
    + 0.010675 * sin(4 * D - Mp) + 0.010034 * sin(3 * Mp) + 0.008548 * sin(4 * D - 2 * Mp) - 0.007888 * E * sin(2 * D + M - Mp)
    - 0.006766 * E * sin(2 * D + M) - 0.005163 * sin(D - Mp) + 0.004987 * E * sin(D + M) + 0.004036 * E * sin(2 * D - M + Mp);
  const lat = 5.128122 * sin(F) + 0.280602 * sin(Mp + F) + 0.277693 * sin(Mp - F) + 0.173237 * sin(2 * D - F)
    + 0.055413 * sin(2 * D - Mp + F) + 0.046271 * sin(2 * D - Mp - F) + 0.032573 * sin(2 * D + F) + 0.017198 * sin(2 * Mp + F)
    + 0.009266 * sin(2 * D + Mp - F) + 0.008822 * sin(2 * Mp - F) + 0.008216 * E * sin(2 * D - M - F)
    + 0.004324 * sin(2 * D - 2 * Mp - F) + 0.0042 * sin(2 * D + Mp + F);
  const distKm = 385000.56
    - 20905.355 * cos(Mp) - 3699.111 * cos(2 * D - Mp) - 2955.968 * cos(2 * D) - 569.925 * cos(2 * Mp)
    + 48.888 * E * cos(M) - 3.149 * cos(2 * F) + 246.158 * cos(2 * D - 2 * Mp) - 152.138 * E * cos(2 * D - M - Mp)
    - 170.733 * cos(2 * D + Mp) - 204.586 * E * cos(2 * D - M) - 129.62 * E * cos(M - Mp) + 108.743 * cos(D)
    + 104.755 * E * cos(M + Mp);
  const elong = norm(lon - sun.geo);
  const i = 180 - D - 6.289 * sin(Mp) + 2.1 * sin(M) - 1.274 * sin(2 * D - Mp) - 0.658 * sin(2 * D) - 0.214 * sin(2 * Mp) - 0.11 * sin(D);
  const illum = (1 + cos(i)) / 2;
  return { elong, illum, distKm, lon: norm(lon), lat, sunLon: norm(sun.apparent), T };
}

function eclToEq(lon, lat, T) {
  const eps = 23.439291 - 0.0130042 * T;
  const ra = norm(deg(Math.atan2(sin(lon) * cos(eps) - Math.tan(rad(lat)) * sin(eps), cos(lon))));
  const dec = deg(Math.asin(sin(lat) * cos(eps) + cos(lat) * sin(eps) * sin(lon)));
  return { ra, dec };
}

function siderealDeg(date) {
  const jd = julianDay(date), T = (jd - 2451545) / 36525;
  return norm(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T);
}

function horizontal(date, latDeg, lonDeg, ra, dec) {
  const H = norm(siderealDeg(date) + lonDeg - ra);
  const alt = deg(Math.asin(sin(latDeg) * sin(dec) + cos(latDeg) * cos(dec) * cos(H)));
  const az = norm(deg(Math.atan2(sin(H), cos(H) * sin(latDeg) - Math.tan(rad(dec)) * cos(latDeg))) + 180);
  return { alt, az };
}

export function moonPosition(date, lat, lon) {
  const m = moonState(date);
  const { ra, dec } = eclToEq(m.lon, m.lat, m.T);
  const h = horizontal(date, lat, lon, ra, dec);
  h.alt -= deg(Math.asin((6378.14 / m.distKm) * cos(h.alt)));
  return h;
}

export function sunPosition(date, lat, lon) {
  const T = centuries(date);
  const { ra, dec } = eclToEq(sunLongitude(T).apparent, 0, T);
  return horizontal(date, lat, lon, ra, dec);
}

// Rise/set within the local calendar day of `date`. h0 includes refraction + semidiameter.
export function riseSet(date, lat, lon, body = "moon") {
  const pos = body === "moon" ? moonPosition : sunPosition;
  const h0 = -0.833;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const step = 10 * 60000;
  const f = (t) => pos(new Date(t), lat, lon).alt - h0;
  let rise = null, set = null, t0 = start, f0 = f(t0);
  for (let t1 = start + step; t1 <= start + 86400000; t1 += step) {
    const f1 = f(t1);
    if (f0 * f1 <= 0 && f0 !== f1) {
      let a = t0, b = t1, fa = f0;
      for (let j = 0; j < 20; j++) { const m = (a + b) / 2, fm = f(m); if (fa * fm <= 0) b = m; else { a = m; fa = fm; } }
      const t = new Date((a + b) / 2);
      if (f0 < 0 && !rise) rise = t; else if (f0 > 0 && !set) set = t;
    }
    t0 = t1; f0 = f1;
  }
  return { rise, set, alwaysUp: !rise && !set && f0 > 0, alwaysDown: !rise && !set && f0 <= 0 };
}

export const PHASES = [
  { name: "新月", alias: "朔" },
  { name: "眉月", alias: "蛾眉月" },
  { name: "上弦月", alias: "" },
  { name: "盈凸月", alias: "" },
  { name: "滿月", alias: "望" },
  { name: "虧凸月", alias: "" },
  { name: "下弦月", alias: "" },
  { name: "殘月", alias: "" },
];

export function phaseIndex(elong) {
  const w = 6.1; // ≈ ±12 h around an exact principal phase
  if (elong < w || elong >= 360 - w) return 0;
  if (Math.abs(elong - 90) < w) return 2;
  if (Math.abs(elong - 180) < w) return 4;
  if (Math.abs(elong - 270) < w) return 6;
  return elong < 90 ? 1 : elong < 180 ? 3 : elong < 270 ? 5 : 7;
}

// Generic forward search for the moment fn(t) (an angle) reaches `target`.
function nextAngle(from, target, fn, stepMs, maxSteps) {
  const diff = (t) => { const d = norm(fn(new Date(t)) - target); return d > 180 ? d - 360 : d; };
  let t0 = from.getTime(), d0 = diff(t0);
  for (let k = 0; k < maxSteps; k++) {
    const t1 = t0 + stepMs, d1 = diff(t1);
    if (d0 < 0 && d1 >= 0) {
      let a = t0, b = t1;
      for (let j = 0; j < 40; j++) { const m = (a + b) / 2; if (diff(m) < 0) a = m; else b = m; }
      return new Date((a + b) / 2);
    }
    t0 = t1; d0 = d1;
  }
  return null;
}

export const nextPhaseTime = (from, targetElong) => nextAngle(from, targetElong, (t) => moonState(t).elong, 6 * 3600000, 130);
export const prevNewMoon = (date) => {
  let t = nextPhaseTime(new Date(date.getTime() - 31 * 86400000), 0), n;
  while ((n = nextPhaseTime(new Date(t.getTime() + 86400000), 0)) && n <= date) t = n;
  return t;
};

export const SOLAR_TERMS = ["春分","清明","穀雨","立夏","小滿","芒種","夏至","小暑","大暑","立秋","處暑","白露",
  "秋分","寒露","霜降","立冬","小雪","大雪","冬至","小寒","大寒","立春","雨水","驚蟄"];

export function solarTerms(from, count = 3) {
  const out = [];
  let t = from;
  let k = Math.floor(moonState(from).sunLon / 15);
  for (let i = 0; i < count; i++) {
    k = (k + 1) % 24;
    const when = nextAngle(t, k * 15, (d) => moonState(d).sunLon, 86400000, 40);
    out.push({ name: SOLAR_TERMS[k], date: when });
    t = new Date(when.getTime() + 3600000);
  }
  return out;
}

export function currentSolarTerm(date) {
  return SOLAR_TERMS[Math.floor(moonState(date).sunLon / 15)];
}

// Eclipses (Meeus ch. 54). Returns events between `from` and `to`.
export function eclipses(from, to) {
  const out = [];
  const k0 = Math.floor((from.getFullYear() + (from.getMonth() + 0.5) / 12 - 2000) * 12.3685) - 1;
  for (let k = k0; ; k += 0.5) {
    const T = k / 1236.85;
    const lunar = k % 1 !== 0;
    let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T;
    const E = 1 - 0.002516 * T - 0.0000074 * T * T;
    const M = 2.5534 + 29.1053567 * k - 0.0000014 * T * T;
    const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T * T;
    const F = 160.7108 + 390.67050284 * k - 0.0016118 * T * T;
    const Om = 124.7746 - 1.56375588 * k + 0.0020672 * T * T;
    const F1 = F - 0.02665 * sin(Om);
    const A1 = 299.77 + 0.107408 * k - 0.009173 * T * T;
    if (fromJD(jde) > to) break;
    if (Math.abs(sin(F)) > 0.36) continue;
    jde += (lunar ? -0.4065 : -0.4075) * sin(Mp) + (lunar ? 0.1727 : 0.1721) * E * sin(M)
      + 0.0161 * sin(2 * Mp) - 0.0097 * sin(2 * F1) + 0.0073 * E * sin(Mp - M) - 0.005 * E * sin(Mp + M)
      - 0.0023 * sin(Mp - 2 * F1) + 0.0021 * E * sin(2 * M) + 0.0012 * sin(Mp + 2 * F1) + 0.0006 * E * sin(2 * Mp + M)
      - 0.0004 * sin(3 * Mp) - 0.0003 * E * sin(M + 2 * F1) + 0.0003 * sin(A1) - 0.0002 * E * sin(M - 2 * F1)
      - 0.0002 * E * sin(2 * Mp - M) - 0.0002 * sin(Om);
    const P = 0.207 * E * sin(M) + 0.0024 * E * sin(2 * M) - 0.0392 * sin(Mp) + 0.0116 * sin(2 * Mp)
      - 0.0073 * E * sin(Mp + M) + 0.0067 * E * sin(Mp - M) + 0.0118 * sin(2 * F1);
    const Q = 5.2207 - 0.0048 * E * cos(M) + 0.002 * E * cos(2 * M) - 0.3299 * cos(Mp)
      - 0.006 * E * cos(Mp + M) + 0.0041 * E * cos(Mp - M);
    const W = Math.abs(cos(F1));
    const g = (P * cos(F1) + Q * sin(F1)) * (1 - 0.0048 * W);
    const u = 0.0059 + 0.0046 * E * cos(M) - 0.0182 * cos(Mp) + 0.0004 * cos(2 * Mp) - 0.0005 * cos(M + Mp);
    const date = fromJD(jde - 69 / 86400);
    if (date < from) continue;
    const ag = Math.abs(g);
    if (lunar) {
      const umbral = (1.0128 - u - ag) / 0.545, pen = (1.5573 + u - ag) / 0.545;
      if (umbral >= 1) out.push({ type: "lunar", kind: "月全食", date });
      else if (umbral > 0) out.push({ type: "lunar", kind: "月偏食", date });
      else if (pen > 0) out.push({ type: "lunar", kind: "半影月食", date });
    } else if (ag < 0.9972) {
      const kind = u < 0 ? "日全食" : u > 0.0047 ? "日環食" : u < 0.00464 * Math.sqrt(1 - g * g) ? "全環食" : "日環食";
      out.push({ type: "solar", kind, date });
    } else if (ag < 1.5433 + u) {
      out.push({ type: "solar", kind: "日偏食", date });
    }
  }
  return out;
}

// Principal-phase-based special moons within [from, to].
export function specialMoons(from, to) {
  const out = [];
  let t = new Date(from.getTime());
  const fulls = [];
  while (true) {
    const f = nextPhaseTime(t, 180);
    if (!f || f > to) break;
    fulls.push(f);
    t = new Date(f.getTime() + 86400000);
  }
  // Include the full moon before `from` so blue moons early in the window are detected.
  const prev = nextPhaseTime(new Date(from.getTime() - 31 * 86400000), 180);
  for (const f of fulls) {
    const d = moonState(f).distKm;
    if (d < 361885) out.push({ type: "super", kind: "超級月亮", date: f, distKm: d });
    if (d > 405000) out.push({ type: "micro", kind: "微型月亮", date: f, distKm: d });
  }
  const all = prev && prev < from ? [prev, ...fulls] : fulls;
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1], b = all[i];
    if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) out.push({ type: "blue", kind: "藍月亮", date: b });
  }
  return out;
}
