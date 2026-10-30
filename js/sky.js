// Animated sky whose colours follow the real Sun altitude.
const KEYS = [ // [sunAlt, top, bottom, starAlpha]
  [-90, [5, 6, 15], [20, 26, 58], 1],
  [-18, [5, 6, 15], [20, 26, 58], 1],
  [-12, [9, 13, 38], [34, 33, 84], 0.8],
  [-6, [15, 22, 56], [96, 63, 122], 0.45],
  [0, [27, 35, 80], [214, 120, 90], 0.15],
  [8, [36, 70, 138], [238, 170, 100], 0.04],
  [20, [30, 80, 150], [110, 160, 210], 0],
  [90, [24, 70, 140], [100, 150, 205], 0],
];
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));

export function skyColors(alt) {
  for (let i = 1; i < KEYS.length; i++) {
    if (alt <= KEYS[i][0]) {
      const [a0, t0, b0, s0] = KEYS[i - 1], [a1, t1, b1, s1] = KEYS[i];
      const t = (alt - a0) / (a1 - a0);
      return { top: mix(t0, t1, t), bottom: mix(b0, b1, t), stars: lerp(s0, s1, t) };
    }
  }
  const k = KEYS[KEYS.length - 1];
  return { top: k[1], bottom: k[2], stars: k[3] };
}

export function initSky(canvas) {
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, stars = [], meteors = [], target = skyColors(-30), cur = skyColors(-30);
  let px = 0, py = 0, tx = 0, ty = 0;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let dirty = true, lastFrame = 0;
  function resize() {
    if (W === innerWidth && H === innerHeight) return;
    dirty = true;
    const dpr = Math.min(devicePixelRatio || 1, matchMedia("(pointer: coarse)").matches ? 1.5 : 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((W * H) / 3500);
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.3 + 0.2,
      z: Math.random() * 0.8 + 0.2, tw: Math.random() * Math.PI * 2, sp: Math.random() * 0.03 + 0.005,
      hue: Math.random() < 0.15 ? (Math.random() < 0.5 ? "200,220,255" : "255,230,200") : "255,255,255",
    }));
  }
  addEventListener("resize", resize);
  addEventListener("pointermove", (e) => { tx = (e.clientX / W - 0.5) * 30; ty = (e.clientY / H - 0.5) * 20; });
  resize();

  function spawnMeteor() {
    const a = Math.PI * (0.15 + Math.random() * 0.2);
    meteors.push({ x: Math.random() * W * 0.8 + W * 0.1, y: Math.random() * H * 0.4, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, life: 1 });
  }

  function frame(timestamp) {
    requestAnimationFrame(frame);
    if (document.hidden || timestamp - lastFrame < 1000 / 30) return;
    if (reduce && !dirty) return;
    lastFrame = timestamp;
    if (reduce) { cur = { top: [...target.top], bottom: [...target.bottom], stars: target.stars }; dirty = false; }
    for (const k of ["top", "bottom"]) cur[k] = cur[k].map((v, i) => lerp(v, target[k][i], 0.05));
    cur.stars = lerp(cur.stars, target.stars, 0.05);
    px = lerp(px, tx, 0.05); py = lerp(py, ty, 0.05);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgb(${cur.top.map(Math.round)})`);
    g.addColorStop(1, `rgb(${cur.bottom.map(Math.round)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (cur.stars > 0.01) {
      for (const s of stars) {
        s.tw += s.sp;
        const a = cur.stars * (0.55 + 0.45 * Math.sin(s.tw)) * s.z;
        const x = (s.x + px * s.z + W) % W, y = (s.y + py * s.z + H) % H;
        ctx.fillStyle = `rgba(${s.hue},${a})`;
        ctx.beginPath(); ctx.arc(x, y, s.r, 0, 7); ctx.fill();
      }
      if (!reduce && Math.random() < 0.004 * cur.stars) spawnMeteor();
    }
    meteors = meteors.filter((m) => m.life > 0);
    for (const m of meteors) {
      const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 10, m.y - m.vy * 10);
      grad.addColorStop(0, `rgba(255,255,255,${m.life * cur.stars})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = grad; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 10, m.y - m.vy * 10); ctx.stroke();
      m.x += m.vx; m.y += m.vy; m.life -= 0.018;
    }
  }
  requestAnimationFrame(frame);

  return {
    setSunAltitude(alt) { const next = skyColors(alt); if (JSON.stringify(next) !== JSON.stringify(target)) dirty = true; target = next; document.documentElement.dataset.daylight = alt > 0 ? "day" : "night"; },
    shootingStar: spawnMeteor,
  };
}
