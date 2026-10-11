// Upcoming SpaceX launches from The Space Devs Launch Library 2 (CORS-enabled, 15 req/h without a key).
const API = "https://ll.thespacedevs.com/2.3.0/launches/upcoming/?lsp__id=121&limit=8&mode=normal";
const KEY = "moon.spacex";
const TTL = 3600000;

const STATUS = { Go: "確定發射", TBD: "時間未定", TBC: "待確認", Hold: "暫停", "In Flight": "飛行中", Success: "發射成功", Failure: "發射失敗", "Partial Failure": "部分失敗" };
const ORBIT = { LEO: "低地軌道", PO: "極地軌道", SSO: "太陽同步軌道", GTO: "地球同步轉移軌道", GEO: "地球同步軌道", MEO: "中地球軌道", Sub: "次軌道", TLI: "月球轉移軌道", HEO: "高地球軌道", "Helio-N/A": "日心軌道" };
const SITES = [
  [/Cape Canaveral/i, "美國佛州卡納維爾角"], [/Kennedy/i, "美國佛州甘迺迪太空中心"],
  [/Vandenberg/i, "美國加州范登堡"], [/Starbase|Boca Chica/i, "美國德州星際基地"],
];
const ROCKETS = [[/Falcon Heavy/i, "獵鷹重型"], [/Falcon 9/i, "獵鷹9號"], [/Starship/i, "星艦"]];

const pick = (list, s) => (list.find(([re]) => re.test(s || "")) || [])[1];

function simplify(r) {
  const [rocketRaw, missionRaw] = r.name.includes(" | ") ? r.name.split(" | ") : [r.rocket?.configuration?.full_name || "", r.name];
  return {
    id: r.id,
    mission: r.mission?.name || missionRaw,
    rocket: pick(ROCKETS, rocketRaw) || rocketRaw,
    net: r.net,
    precision: r.net_precision?.abbrev || "MIN",
    status: STATUS[r.status?.abbrev] || r.status?.name || "",
    statusAbbrev: r.status?.abbrev || "",
    site: pick(SITES, r.pad?.location?.name) || r.pad?.location?.name || "",
    orbit: ORBIT[r.mission?.orbit?.abbrev] || r.mission?.orbit?.name || "",
    live: !!r.webcast_live,
  };
}

function readCache() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}

// Returns { launches, at, stale } or throws when there is neither network nor cache.
export async function getLaunches() {
  const c = readCache();
  if (c && Date.now() - c.at < TTL) return { launches: c.launches, at: c.at, stale: false };
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const launches = (await res.json()).results.map(simplify);
    const at = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify({ at, launches })); } catch {}
    return { launches, at, stale: false };
  } catch (e) {
    if (c) return { launches: c.launches, at: c.at, stale: true };
    throw e;
  }
}
