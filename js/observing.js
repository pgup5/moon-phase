import * as Engine from '../vendor/astronomy.js';
import { moonPosition, sunPosition, moonState, norm } from './astro.js';
const rad=d=>d*Math.PI/180,deg=r=>r*180/Math.PI;
export const PLACES=[
  {id:'taipei',zh:'台北',en:'Taipei',lat:25.033,lon:121.565,tz:'Asia/Taipei'},
  {id:'tokyo',zh:'東京',en:'Tokyo',lat:35.6762,lon:139.6503,tz:'Asia/Tokyo'},
  {id:'sydney',zh:'雪梨',en:'Sydney',lat:-33.8688,lon:151.2093,tz:'Australia/Sydney'},
  {id:'newyork',zh:'紐約',en:'New York',lat:40.7128,lon:-74.006,tz:'America/New_York'},
  {id:'northpole',zh:'北極',en:'North Pole',lat:90,lon:0,tz:'UTC'},
];
export function localMoon(date,place){
  const observer=new Engine.Observer(place.lat,place.lon,0);
  const moon=Engine.Equator('Moon',date,observer,true,true),sun=Engine.Equator('Sun',date,observer,true,true);
  const m=Engine.Horizon(date,observer,moon.ra,moon.dec),s=Engine.Horizon(date,observer,sun.ra,sun.dec);
  // Project the Sun direction onto the Moon's tangent plane: up = local zenith,
  // right = increasing azimuth. The bright limb points toward the projected Sun.
  const da=rad(s.azimuth-m.azimuth);
  const x=Math.cos(rad(s.altitude))*Math.sin(da);
  const y=Math.sin(rad(s.altitude))*Math.cos(rad(m.altitude))-Math.cos(rad(s.altitude))*Math.sin(rad(m.altitude))*Math.cos(da);
  const illumination=Engine.Illumination('Moon',date).phase_fraction;
  const angle=Math.hypot(x,y)<.01||Math.abs(m.altitude)>89.9||illumination>.98||illumination<.01?null:norm(deg(Math.atan2(x,y)));
  return {...place,alt:m.altitude,az:m.azimuth,sunAlt:s.altitude,angle,illumination};
}
export function moonDiskSVG(illumination,angle,label){
  const k=1-2*illumination,rx=Math.abs(k)*39,rotation=angle===null?0:angle-90;
  return `<svg viewBox="0 0 100 100" role="img" aria-label="${label}"><text x="50" y="8" text-anchor="middle" fill="currentColor" font-size="7">↑</text><g transform="rotate(${rotation} 50 52)"><circle cx="50" cy="52" r="39" fill="#1a2035" stroke="#9ba5ca" stroke-width=".5"/><path d="M50 13 A39 39 0 0 1 50 91 A${rx} 39 0 0 ${k>0?0:1} 50 13Z" fill="#eee3c5"/></g></svg>`;
}
// Annual reference dates and peak radiant coordinates, rounded from IMO 2026.
// Recurring planning references only: no exact annual maximum or outburst forecast.
export const SHOWERS=[
  {id:'quadrantids',zh:'象限儀座流星雨',en:'Quadrantids',peak:[1,4],period:[[12,28],[1,12]],range:'1/3–1/4',ra:230,dec:49},
  {id:'lyrids',zh:'天琴座流星雨',en:'Lyrids',peak:[4,22],period:[[4,14],[4,30]],range:'4/22–4/23',ra:271,dec:34},
  {id:'eta',zh:'寶瓶座 η 流星雨',en:'Eta Aquariids',peak:[5,6],period:[[4,19],[5,28]],range:'5/5–5/6',ra:338,dec:-1},
  {id:'perseids',zh:'英仙座流星雨',en:'Perseids',peak:[8,13],period:[[7,17],[8,24]],range:'8/12–8/13',ra:48,dec:58},
  {id:'orionids',zh:'獵戶座流星雨',en:'Orionids',peak:[10,21],period:[[10,2],[11,7]],range:'10/21–10/22',ra:95,dec:16},
  {id:'leonids',zh:'獅子座流星雨',en:'Leonids',peak:[11,17],period:[[11,6],[11,30]],range:'11/17–11/18',ra:152,dec:22},
  {id:'geminids',zh:'雙子座流星雨',en:'Geminids',peak:[12,14],period:[[12,4],[12,20]],range:'12/13–12/14',ra:112,dec:33},
];
export function showerActive(shower,date){
  const key=(date.getMonth()+1)*100+date.getDate(),a=shower.period[0][0]*100+shower.period[0][1],b=shower.period[1][0]*100+shower.period[1][1];
  return a<=b?key>=a&&key<=b:key>=a||key<=b;
}
export function nextShower(date){
  const active=SHOWERS.filter(s=>showerActive(s,date));
  if(active.length)return active.reduce((a,b)=>Math.abs(referencePeak(a,date)-date)<Math.abs(referencePeak(b,date)-date)?a:b);
  return [...SHOWERS].sort((a,b)=>referencePeak(a,date)-referencePeak(b,date))[0];
}
export function referencePeak(shower,date){
  let year=date.getFullYear();
  let peak=new Date(year,shower.peak[0]-1,shower.peak[1],12);
  // Preserve a just-passed peak while its annual activity window is ongoing.
  if(peak<date&&!showerActive(shower,date))peak=new Date(year+1,shower.peak[0]-1,shower.peak[1],12);
  if(shower.period[0][0]>shower.period[1][0]&&date.getMonth()===11)peak=new Date(year+1,shower.peak[0]-1,shower.peak[1],12);
  return peak;
}
export function meteorNight(date,lat,lon,shower){
  const start=+new Date(date.getFullYear(),date.getMonth(),date.getDate(),12),end=+new Date(date.getFullYear(),date.getMonth(),date.getDate()+1,12);
  const observer=new Engine.Observer(lat,lon,0);
  const vector=Engine.VectorFromSphere(new Engine.Spherical(shower.dec,shower.ra,1),date);
  const eq=Engine.EquatorFromVector(Engine.RotateVector(Engine.Rotation_EQJ_EQD(date),vector));
  const samples=[],windows=[];let current=null;
  for(let time=start;time<end;time+=300000){
    const until=Math.min(end,time+300000),mid=new Date((time+until)/2);
    const radiant=Engine.Horizon(mid,observer,eq.ra,eq.dec).altitude;
    const sun=sunPosition(mid,lat,lon).alt,moon=moonPosition(mid,lat,lon).alt,illumination=moonState(mid).illum;
    const sample={time:+mid,radiant,sun,moon,illumination};samples.push(sample);
    const suitable=sun<=-18&&radiant>=20;
    if(suitable){const moonfree=moon<=-.833;
      if(!current||current.moonfree!==moonfree){current={start:time,end:until,moonfree,best:sample};windows.push(current);}
      else {current.end=until;if(radiant>current.best.radiant)current.best=sample;}
    }else current=null;
  }
  // Prefer a moon-free window, then the highest radiant. This is not a rate model.
  const best=[...windows].sort((a,b)=>Number(b.moonfree)-Number(a.moonfree)||b.best.radiant-a.best.radiant)[0]||null;
  return {start,end,samples,windows,best,active:showerActive(shower,date)};
}
export function tideModel(elongation){
  const angle=rad(elongation),solar=.46;
  const x=solar+Math.cos(2*angle),y=Math.sin(2*angle),amplitude=Math.hypot(x,y);
  return {relative:amplitude/(1+solar),angle:deg(Math.atan2(y,x))/2,
    kind:Math.abs(Math.cos(angle))>=Math.cos(rad(22.5))?'spring':Math.abs(Math.sin(angle))>=Math.cos(rad(22.5))?'neap':'between'};
}
export function observingChallenge(illumination,equipment='eye'){
  if(illumination<.01)return 'dark';
  if(illumination<=.35)return 'earthshine';
  if(illumination>=.85)return equipment==='binoculars'?'rays':'seas';
  return equipment==='binoculars'?'terminator':'shape';
}
