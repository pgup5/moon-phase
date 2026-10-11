// Builds a 1080×1350 share image for a given night.
export async function buildCard({ moonImage, svgFallback, dateText, lunarText, phaseName, illum, poem, special }) {
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  if (document.fonts && document.fonts.ready) await document.fonts.ready;

  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#04050d"); g.addColorStop(0.6, "#121838"); g.addColorStop(1, "#2a1f4a");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 380; i++) {
    x.fillStyle = `rgba(255,255,255,${rnd() * 0.8 + 0.1})`;
    x.beginPath(); x.arc(rnd() * W, rnd() * H, rnd() * 1.6 + 0.3, 0, 7); x.fill();
  }

  const cx = W / 2, cy = 470, R = 300;
  const glow = x.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 1.8);
  glow.addColorStop(0, `rgba(255,236,190,${0.12 + illum * 0.25})`); glow.addColorStop(1, "rgba(255,236,190,0)");
  x.fillStyle = glow; x.fillRect(0, 0, W, H);
  if (moonImage) {
    // The sphere fills ~93.5% of the 3D render (camera fov 28°, distance 4.4).
    const D = (R * 2) / 0.935;
    x.save(); x.beginPath(); x.arc(cx, cy, R + 2, 0, 7); x.clip();
    x.drawImage(moonImage, cx - D / 2, cy - D / 2, D, D);
    x.restore();
  } else if (svgFallback) {
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgFallback);
    await img.decode();
    x.drawImage(img, cx - R, cy - R, R * 2, R * 2);
  }

  x.textAlign = "center";
  x.fillStyle = "#e8ecff";
  x.font = '600 58px "Noto Serif TC","Songti TC","PMingLiU",serif';
  x.fillText(dateText, cx, 880);
  x.fillStyle = "#9aa3c7";
  x.font = '36px "Noto Sans TC","PingFang TC",sans-serif';
  x.fillText(lunarText, cx, 935);
  x.fillStyle = "#ffd98a";
  x.font = '600 64px "Noto Serif TC","Songti TC",serif';
  x.fillText(`${phaseName} · ${(illum * 100).toFixed(0)}%`, cx, 1025);
  if (special) {
    x.fillStyle = "#ffb3c7";
    x.font = '34px "Noto Sans TC","PingFang TC",sans-serif';
    x.fillText(special, cx, 1075);
  }
  x.fillStyle = "#e8ecff";
  x.font = '40px "Noto Serif TC","Songti TC",serif';
  const lines = poem.text.split(/(?<=[，。？！])/).reduce((acc, part) => {
    const last = acc[acc.length - 1];
    if (last && (last + part).length <= 14) acc[acc.length - 1] = last + part; else acc.push(part);
    return acc;
  }, []);
  const top = special ? 1145 : 1125;
  lines.slice(0, 3).forEach((l, i) => x.fillText(l, cx, top + i * 56));
  x.fillStyle = "#9aa3c7";
  x.font = '30px "Noto Sans TC","PingFang TC",sans-serif';
  x.fillText(`—— ${poem.author}《${poem.title}》`, cx, top + Math.min(lines.length, 3) * 56 + 8);
  x.fillStyle = "rgba(255,255,255,.45)";
  x.font = '24px "Noto Sans TC",sans-serif';
  x.fillText("月相查詢 · moon-phase-psi.vercel.app", cx, H - 36);
  return c;
}

export async function shareOrDownload(canvas, filename) {
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "我的月亮" }); return "shared"; } catch (e) { if (e.name === "AbortError") return "cancelled"; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "downloaded";
}
