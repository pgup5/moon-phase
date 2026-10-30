import { moonPosition, sunPosition, moonState } from './astro.js';
import * as Engine from '../vendor/astronomy.js';

export function skyCategory(sunAlt, moonAlt) {
  if (sunAlt >= 0) return 'day';
  if (sunAlt > -6) return 'civil';
  if (sunAlt > -12) return 'nautical';
  if (sunAlt > -18) return 'astronomical';
  return moonAlt <= -0.833 ? 'moonless' : 'moonlit';
}
export function earthshinePhase(illumination) { return illumination >= 0.01 && illumination <= 0.35; }
export function nightConditions(date, lat, lon) {
  const start = +new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const end = +new Date(date.getFullYear(), date.getMonth(), date.getDate()+1, 12);
  const segments=[], earthshine=[];
  let earth=null;
  for(let t=start;t<end;t+=60000) {
    const until=Math.min(end,t+60000), d=new Date((t+until)/2);
    const sun=sunPosition(d,lat,lon).alt, moon=moonPosition(d,lat,lon).alt;
    const category=skyCategory(sun,moon),previous=segments.at(-1);
    if(previous?.category===category) previous.end=until;
    else segments.push({start:t,end:until,category});
    const suitable=sun<=-4 && sun>=-18 && moon>=5 && earthshinePhase(moonState(d).illum);
    if(suitable){if(!earth){earth={start:t,end:until};earthshine.push(earth);}else earth.end=until;}else earth=null;
  }
  const moonless=segments.filter(s=>s.category==='moonless');
  const night=segments.filter(s=>s.category==='moonless'||s.category==='moonlit');
  const minutes=list=>Math.round(list.reduce((sum,s)=>sum+s.end-s.start,0)/60000);
  return {start,end,segments,moonless,night,earthshine,moonlessMinutes:minutes(moonless),nightMinutes:minutes(night)};
}

// Rounded J2000 coordinates from CDS SIMBAD. Proper motion is not modeled.
const STARS=[
  ['Star1','畢宿五','Aldebaran',4.598677,16.509302],
  ['Star2','軒轅十四','Regulus',10.139531,11.967209],
  ['Star3','角宿一','Spica',13.419883,-11.161322],
  ['Star4','心宿二','Antares',16.490128,-26.431997],
  ['Star5','北河三','Pollux',7.755264,28.026199],
];
for(const [body,,,ra,dec] of STARS) Engine.DefineStar(body,ra,dec,1000);
const BODIES=[['Mercury','水星','Mercury'],['Venus','金星','Venus'],['Mars','火星','Mars'],['Jupiter','木星','Jupiter'],['Saturn','土星','Saturn'],...STARS.map(([body,zh,en])=>[body,zh,en])];
export function moonNeighbors(date,lat,lon,radius=15) {
  if(date.getUTCFullYear()<1900 || date.getUTCFullYear()>2100) return {supported:false,objects:[]};
  const observer=new Engine.Observer(lat,lon,0);
  const moon=Engine.Equator('Moon',date,observer,true,true);
  const moonH=Engine.Horizon(date,observer,moon.ra,moon.dec);
  const sun=Engine.Equator('Sun',date,observer,true,true);
  const sunH=Engine.Horizon(date,observer,sun.ra,sun.dec);
  const objects=BODIES.map(([body,zh,en])=>{
    const eq=Engine.Equator(body,date,observer,true,true);
    const h=Engine.Horizon(date,observer,eq.ra,eq.dec);
    return {body,zh,en,kind:body.startsWith('Star')?'star':'planet',separation:Engine.AngleBetween(moon.vec,eq.vec),alt:h.altitude,az:h.azimuth};
  }).filter(p=>p.separation<=radius).sort((a,b)=>a.separation-b.separation);
  return {supported:true,objects,moonAlt:moonH.altitude,sunAlt:sunH.altitude};
}
