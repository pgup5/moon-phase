import { moonPosition, sunPosition } from './astro.js';
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
export const angleDifference = (a, b) => ((a - b + 540) % 360) - 180;

export function landmarkGeometry(lat, lon, targetLat, targetLon, relativeHeight = 0) {
  if (![lat, lon, targetLat, targetLon, relativeHeight].every(Number.isFinite)
    || Math.abs(lat) > 90 || Math.abs(targetLat) > 90 || Math.abs(lon) > 180 || Math.abs(targetLon) > 180) throw new Error('coordinates');
  const a = rad(lat), b = rad(targetLat), dl = rad(targetLon - lon);
  const h = Math.sin((b-a)/2)**2 + Math.cos(a)*Math.cos(b)*Math.sin(dl/2)**2;
  const distance = 6371000 * 2 * Math.atan2(Math.sqrt(Math.min(1,h)), Math.sqrt(Math.max(0,1-h)));
  if (distance < 1) throw new Error('same-point');
  return { distance, az: (deg(Math.atan2(Math.sin(dl)*Math.cos(b), Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(dl)))+360)%360,
    alt: deg(Math.atan2(relativeHeight, distance)) };
}
export function angularSeparation(a, b) {
  const cosine = Math.sin(rad(a.alt))*Math.sin(rad(b.alt)) + Math.cos(rad(a.alt))*Math.cos(rad(b.alt))*Math.cos(rad(angleDifference(a.az,b.az)));
  return deg(Math.acos(Math.max(-1,Math.min(1,cosine))));
}
export function planAlignment(date, lat, lon, geometry) {
  const start = +new Date(date.getFullYear(), date.getMonth(), date.getDate(),12);
  const end = +new Date(date.getFullYear(), date.getMonth(), date.getDate()+1,12);
  const at = t => { const moon = moonPosition(new Date(t),lat,lon); return {t,...moon,error:angularSeparation(moon,geometry)}; };
  const samples=[];
  for(let t=start;t<=end;t+=60000) samples.push(at(t));
  // Keep distinct local minima, including visible endpoints; never claim a hidden Moon aligns.
  const minima=samples.filter((p,i)=>p.alt>0 && (i===0 || samples[i-1].alt<=0 || p.error<=samples[i-1].error)
    && (i===samples.length-1 || samples[i+1].alt<=0 || p.error<=samples[i+1].error));
  const candidates=minima.map(p=>{
    let best=p;
    for(let t=Math.max(start,p.t-60000);t<=Math.min(end,p.t+60000);t+=1000){const q=at(t);if(q.alt>0 && q.error<best.error)best=q;}
    return {...best,sunAlt:sunPosition(new Date(best.t),lat,lon).alt};
  }).sort((a,b)=>a.error-b.error).filter((p,i,all)=>all.slice(0,i).every(q=>Math.abs(q.t-p.t)>300000)).slice(0,3);
  return {start,end,candidates};
}
