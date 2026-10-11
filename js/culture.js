export const POEMS = [
  [ // 新月
    { text: "月黑雁飛高，單于夜遁逃。", author: "盧綸", title: "塞下曲" },
    { text: "今人不見古時月，今月曾經照古人。", author: "李白", title: "把酒問月" },
  ],
  [ // 眉月
    { text: "可憐九月初三夜，露似真珠月似弓。", author: "白居易", title: "暮江吟" },
    { text: "無言獨上西樓，月如鉤。", author: "李煜", title: "相見歡" },
  ],
  [ // 上弦月
    { text: "月落烏啼霜滿天，江楓漁火對愁眠。", author: "張繼", title: "楓橋夜泊" },
    { text: "明月松間照，清泉石上流。", author: "王維", title: "山居秋暝" },
  ],
  [ // 盈凸月
    { text: "床前明月光，疑是地上霜。舉頭望明月，低頭思故鄉。", author: "李白", title: "靜夜思" },
    { text: "露從今夜白，月是故鄉明。", author: "杜甫", title: "月夜憶舍弟" },
  ],
  [ // 滿月
    { text: "但願人長久，千里共嬋娟。", author: "蘇軾", title: "水調歌頭" },
    { text: "海上生明月，天涯共此時。", author: "張九齡", title: "望月懷遠" },
    { text: "舉杯邀明月，對影成三人。", author: "李白", title: "月下獨酌" },
  ],
  [ // 虧凸月
    { text: "人有悲歡離合，月有陰晴圓缺，此事古難全。", author: "蘇軾", title: "水調歌頭" },
    { text: "江畔何人初見月？江月何年初照人？", author: "張若虛", title: "春江花月夜" },
  ],
  [ // 下弦月
    { text: "今宵酒醒何處？楊柳岸，曉風殘月。", author: "柳永", title: "雨霖鈴" },
    { text: "春風又綠江南岸，明月何時照我還？", author: "王安石", title: "泊船瓜洲" },
  ],
  [ // 殘月
    { text: "秦時明月漢時關，萬里長征人未還。", author: "王昌齡", title: "出塞" },
    { text: "雞聲茅店月，人跡板橋霜。", author: "溫庭筠", title: "商山早行" },
  ],
];

export function poemFor(phaseIdx, date) {
  const list = POEMS[phaseIdx];
  const day = Math.floor(date.getTime() / 86400000);
  return list[day % list.length];
}

const DAY_NAMES = ["初一","初二","初三","初四","初五","初六","初七","初八","初九","初十",
  "十一","十二","十三","十四","十五","十六","十七","十八","十九","二十",
  "廿一","廿二","廿三","廿四","廿五","廿六","廿七","廿八","廿九","三十"];
const MONTH_NAMES = ["正","二","三","四","五","六","七","八","九","十","冬","臘"];
const STEMS = "甲乙丙丁戊己庚辛壬癸";
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥";
const ANIMALS = "鼠牛虎兔龍蛇馬羊猴雞狗豬";

import { nextPhaseTime } from "./astro.js";

let fmtNum;
try {
  fmtNum = new Intl.DateTimeFormat("en-u-ca-chinese", { year: "numeric", month: "numeric", day: "numeric", timeZone: "Asia/Shanghai" });
} catch (e) { fmtNum = null; }

// The Chinese calendar counts days in UTC+8. ICU's own new-moon times can be off by a day near
// midnight, so the day number comes from our new-moon search and only month/leap/year from Intl.
const H8 = 8 * 3600000;
const chinaDay = (t) => Math.floor((t + H8) / 86400000);

function newMoonOnOrBefore(date) {
  const endOfChinaDay = (chinaDay(date.getTime()) + 1) * 86400000 - H8 - 1;
  let t = nextPhaseTime(new Date(endOfChinaDay - 31 * 86400000), 0), n;
  while ((n = nextPhaseTime(new Date(t.getTime() + 86400000), 0)) && n.getTime() <= endOfChinaDay) t = n;
  return t;
}

function partsFor(date, newMoon) {
  const mid = new Date(newMoon.getTime() + 15 * 86400000);
  const p = Object.fromEntries(fmtNum.formatToParts(mid).map((x) => [x.type, x.value]));
  const month = parseInt(p.month, 10);
  // Browsers may give yearName romanized ("bing-wu"), so derive 干支 from the Gregorian year.
  const gMonth = new Date(mid.getTime() + H8).getUTCMonth() + 1;
  const year = parseInt(p.relatedYear, 10) || new Date(mid.getTime() + H8).getUTCFullYear() - (month > gMonth ? 1 : 0);
  const cyc = (((year - 4) % 60) + 60) % 60;
  return {
    month, leap: /\D/.test(p.month),
    day: chinaDay(date.getTime()) - chinaDay(newMoon.getTime()) + 1,
    yearName: STEMS[cyc % 10] + BRANCHES[cyc % 12], animal: ANIMALS[cyc % 12],
  };
}

export function lunarParts(date) {
  if (!fmtNum) return null;
  return partsFor(date, newMoonOnOrBefore(date));
}

export function lunarString(date, withYear = false) {
  const l = lunarParts(date);
  if (!l) return "";
  const md = `${l.leap ? "閏" : ""}${MONTH_NAMES[l.month - 1]}月${DAY_NAMES[l.day - 1]}`;
  return withYear && l.yearName ? `${l.yearName}${l.animal}年 ${md}` : md;
}

const FESTIVALS = [
  { m: 1, d: 1, name: "春節", desc: "農曆新年，闔家團圓" },
  { m: 1, d: 15, name: "元宵節", desc: "一年中第一個滿月，賞燈猜燈謎" },
  { m: 5, d: 5, name: "端午節", desc: "划龍舟、吃粽子" },
  { m: 7, d: 7, name: "七夕", desc: "牛郎織女鵲橋相會" },
  { m: 7, d: 15, name: "中元節", desc: "普渡祭祀" },
  { m: 8, d: 15, name: "中秋節", desc: "月圓人團圓，賞月吃月餅" },
  { m: 9, d: 9, name: "重陽節", desc: "登高敬老" },
];

let festCache = { key: "", list: [] };
export function upcomingFestivals(from, days = 400) {
  const key = from.toDateString();
  if (festCache.key === key || !fmtNum) return festCache.list;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
  const end = new Date(start.getTime() + days * 86400000);
  const moons = [newMoonOnOrBefore(start)];
  for (let n; (n = nextPhaseTime(new Date(moons[moons.length - 1].getTime() + 86400000), 0)) && n < end;) moons.push(n);
  const list = [];
  for (let i = 0; i < moons.length; i++) {
    const nm = moons[i];
    const first = new Date((chinaDay(nm.getTime()) * 86400000) - H8 + 12 * 3600000);
    const info = partsFor(first, nm);
    if (info.leap) continue;
    for (const f of FESTIVALS.filter((x) => x.m === info.month)) {
      const d = new Date(first.getTime() + (f.d - 1) * 86400000);
      if (d >= start && d <= end) list.push({ ...f, date: d });
    }
    if (info.month === 1) {
      const eve = new Date(first.getTime() - 86400000);
      if (eve >= start) list.push({ name: "除夕", desc: "年夜飯、守歲", date: eve });
    }
  }
  list.sort((a, b) => a.date - b.date);
  festCache = { key, list };
  return list;
}

export function festivalOf(l) {
  if (!l || l.leap) return null;
  return FESTIVALS.find((x) => x.m === l.month && x.d === l.day) || null;
}

export function dayLabel(l) {
  if (!l) return "";
  return l.day === 1 ? `${l.leap ? "閏" : ""}${MONTH_NAMES[l.month - 1]}月` : DAY_NAMES[l.day - 1];
}
