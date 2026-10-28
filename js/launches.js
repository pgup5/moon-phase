import { locale, tr } from "./i18n.js";

// Upcoming launches worldwide from The Space Devs Launch Library 2 (CORS-enabled, 15 req/h without a key).
const API = "https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=40&mode=normal";
const KEY = `moon.launches.${locale}.v2`;
const TTL = 3600000;

const STATUS = { Go: "確定發射", TBD: "時間未定", TBC: "待確認", Hold: "暫停", "In Flight": "飛行中", Success: "發射成功", Failure: "發射失敗", "Partial Failure": "部分失敗" };
const ORBIT = { LEO: "低地軌道", PO: "極地軌道", SSO: "太陽同步軌道", GTO: "地球同步轉移軌道", GEO: "地球同步軌道", MEO: "中地球軌道", Sub: "次軌道", TLI: "月球轉移軌道", HEO: "高地球軌道", "Helio-N/A": "日心軌道", "Mars": "火星", Lunar: "月球" };
const PROVIDERS = {
  SpX: "SpaceX", NASA: "NASA", CASC: "中國航天科技", CASIC: "中國航天科工", ISRO: "印度太空研究組織",
  MHI: "三菱重工", JAXA: "日本宇宙航空研究開發機構", RFSA: "俄羅斯航天局", ASA: "亞利安太空", ESA: "歐洲太空總署",
  ULA: "聯合發射聯盟", BO: "藍色起源", RL: "Rocket Lab", FA: "螢火蟲太空", KARI: "韓國航太研究院",
};
const PROVIDER_NAMES = [
  [/LandSpace/i, "藍箭航天"], [/Galactic Energy/i, "星河動力"], [/iSpace|Interstellar Glory/i, "星際榮耀"],
  [/CAS Space/i, "中科宇航"], [/Space Pioneer/i, "天兵科技"], [/Orienspace/i, "東方空間"], [/ExPace/i, "航天科工火箭"],
  [/Rocket Lab/i, "Rocket Lab"], [/Northrop/i, "諾斯洛普格魯曼"], [/Avio/i, "Avio（義大利）"],
];
const SITES = [
  [/Cape Canaveral/i, "美國佛州卡納維爾角"], [/Kennedy/i, "美國佛州甘迺迪太空中心"], [/Vandenberg/i, "美國加州范登堡"],
  [/Starbase|Boca Chica/i, "美國德州星際基地"], [/Wallops/i, "美國維吉尼亞州瓦勒普斯"], [/Kodiak/i, "美國阿拉斯加科迪亞克"],
  [/Tanegashima/i, "日本種子島"], [/Uchinoura/i, "日本內之浦"], [/Jiuquan/i, "中國酒泉"], [/Xichang/i, "中國西昌"],
  [/Taiyuan/i, "中國太原"], [/Hainan Commercial/i, "中國海南商業航天發射場"], [/Wenchang/i, "中國文昌"],
  [/Sea Launch|Yellow Sea|Oriental Spaceport/i, "中國海上發射"], [/Satish Dhawan|Sriharikota/i, "印度斯里赫里科塔"],
  [/Baikonur/i, "哈薩克拜科努爾"], [/Plesetsk/i, "俄羅斯普列謝茨克"], [/Vostochny/i, "俄羅斯東方太空發射場"],
  [/Guiana|Kourou/i, "法屬圭亞那庫魯"], [/And[øo]ya/i, "挪威安岱"], [/Esrange/i, "瑞典埃斯蘭吉"],
  [/Mahia|Onenui/i, "紐西蘭瑪希亞半島"], [/Naro/i, "韓國羅老"], [/Semnan|Shahroud/i, "伊朗"],
];
const ROCKETS = [
  [/^Falcon Heavy/i, "獵鷹重型"], [/^Falcon 9.*/i, "獵鷹9號"], [/^Starship.*/i, "星艦"], [/^New Glenn/i, "新格倫"],
  [/^Vulcan/i, "火神"], [/^Electron/i, "電子號"], [/^Long March\s*(\S+)/i, "長征$1號"], [/^Soyuz/i, "聯盟號"], [/^Ariane\s*/i, "亞利安"],
];
const EU = new Set(["GF", "SE", "NO", "DE", "IT", "FR", "GB", "ES", "PT"]);
const regionName = (() => {
  try { const dn = new Intl.DisplayNames([locale], { type: "region" }); return (c) => (c ? dn.of(c) : ""); } catch { return () => ""; }
})();

const pick = (list, s) => { const m = list.find(([re]) => re.test(s || "")); return m && (m[1].includes("$") || /^\^/.test(m[0].source) ? s.replace(m[0], m[1]).trim() : m[1]); };

// Category tags drive the filter chips; a launch can be in several (e.g. a SpaceX flight for NASA).
export const CATEGORIES = [
  ["all", "全部"], ["spacex", "SpaceX"], ["nasa", "NASA"], ["us", "美國"], ["cn", "中國"], ["jp", "日本"],
  ["in", "印度"], ["eu", "歐洲"], ["ru", "俄羅斯"], ["other", "其他"],
];

function simplify(r) {
  const lsp = r.launch_service_provider || {};
  const [rocketRaw, missionRaw] = r.name.includes(" | ") ? r.name.split(" | ") : [r.rocket?.configuration?.full_name || "", r.name];
  const cc = r.pad?.country?.alpha_2_code || r.pad?.location?.country?.alpha_2_code || "";
  const nasa = lsp.abbrev === "NASA" || (r.mission?.agencies || []).some((a) => a.abbrev === "NASA");
  const tags = [];
  if (lsp.abbrev === "SpX") tags.push("spacex");
  if (nasa) tags.push("nasa");
  const region = cc === "US" ? "us" : cc === "CN" ? "cn" : cc === "JP" ? "jp" : cc === "IN" ? "in"
    : EU.has(cc) || ["ASA", "ESA"].includes(lsp.abbrev) ? "eu" : cc === "RU" || cc === "KZ" ? "ru" : "other";
  tags.push(region);
  return {
    id: r.id,
    mission: r.mission?.name || missionRaw,
    rocket: locale === "en-US" ? rocketRaw : pick(ROCKETS, rocketRaw) || rocketRaw,
    provider: locale === "en-US" ? lsp.name || "" : PROVIDERS[lsp.abbrev] || pick(PROVIDER_NAMES, lsp.name) || lsp.name || "",
    net: r.net,
    precision: r.net_precision?.abbrev || "MIN",
    status: tr(STATUS[r.status?.abbrev] || r.status?.name || ""),
    statusAbbrev: r.status?.abbrev || "",
    site: locale === "en-US" ? r.pad?.location?.name || regionName(cc) || "" : pick(SITES, r.pad?.location?.name) || regionName(cc) || r.pad?.location?.name || "",
    orbit: tr(ORBIT[r.mission?.orbit?.abbrev] || r.mission?.orbit?.name || ""),
    live: !!r.webcast_live,
    nasa, tags,
  };
}

function readCache() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}

// Returns { launches, at, stale } or throws when there is neither network nor cache.
export async function getLaunches() {
  localStorage.removeItem("moon.spacex");
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
