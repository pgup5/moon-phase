import { moonPosition, riseSet, nextPhaseTime, norm } from './astro.js';
import { upcomingFestivals } from './culture.js';

export const bearingDelta = (target, facing) => ((target - facing + 540) % 360) - 180;
// Rear camera looks along device -Z; project it onto the horizontal ENU plane.
export function rearCameraBearing({ alpha, beta, gamma, absolute }) {
  if (!absolute || ![alpha, beta, gamma].every(Number.isFinite)) return null;
  const [a, b, g] = [alpha, beta, gamma].map(v => v * Math.PI / 180);
  const east = -Math.cos(a) * Math.sin(g) - Math.sin(a) * Math.sin(b) * Math.cos(g);
  const north = -Math.sin(a) * Math.sin(g) + Math.cos(a) * Math.sin(b) * Math.cos(g);
  return Math.hypot(east, north) < .2 ? null : norm(Math.atan2(east, north) * 180 / Math.PI);
}
export function moonrisePreview(date, lat, lon) {
  const result = riseSet(date, lat, lon);
  return { ...result, azimuth: result.rise ? moonPosition(result.rise, lat, lon).az : null };
}
const calendarDay = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
export function countdownEvent(from, kind) {
  if (kind === 'full') {
    const date = nextPhaseTime(from, 180);
    return { name: '滿月', date, days: Math.max(0, Math.round((calendarDay(date) - calendarDay(from)) / 86400000)), instant: true };
  }
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const search = new Date(start); search.setDate(search.getDate() - 2);
  const event = upcomingFestivals(search).filter(f => f.name === kind).map(f => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(f.date);
    const part = type => Number(parts.find(p => p.type === type).value);
    return { ...f, date: new Date(part('year'), part('month') - 1, part('day'), 12) };
  }).find(f => calendarDay(f.date) >= calendarDay(from));
  if (!event) return null;
  // Festival dates are calendar dates, not a noon event deadline.
  return { ...event, days: Math.max(0, Math.round((calendarDay(event.date) - calendarDay(from)) / 86400000)), instant: false };
}
