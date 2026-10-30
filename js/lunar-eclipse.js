import * as Engine from '../vendor/astronomy.js';
const MINUTE=60000;
export function eclipsePosition(time,lat,lon){
  const date=new Date(time),observer=new Engine.Observer(lat,lon,0);
  const eq=Engine.Equator('Moon',date,observer,true,true),sun=Engine.Equator('Sun',date,observer,true,true);
  const m=Engine.Horizon(date,observer,eq.ra,eq.dec),s=Engine.Horizon(date,observer,sun.ra,sun.dec);
  return {alt:m.altitude,az:m.azimuth,sunAlt:s.altitude};
}
export function eclipseContacts(eclipse){
  const peak=+eclipse.peak.date;
  const contacts=[{id:'P1',time:peak-eclipse.sd_penum*MINUTE}];
  if(eclipse.sd_partial>0)contacts.push({id:'U1',time:peak-eclipse.sd_partial*MINUTE});
  if(eclipse.sd_total>0)contacts.push({id:'U2',time:peak-eclipse.sd_total*MINUTE});
  contacts.push({id:'MAX',time:peak});
  if(eclipse.sd_total>0)contacts.push({id:'U3',time:peak+eclipse.sd_total*MINUTE});
  if(eclipse.sd_partial>0)contacts.push({id:'U4',time:peak+eclipse.sd_partial*MINUTE});
  contacts.push({id:'P4',time:peak+eclipse.sd_penum*MINUTE});
  return contacts;
}
export function visibleEclipseIntervals(start,end,lat,lon){
  if(end<=start)return [];
  const at=t=>eclipsePosition(t,lat,lon).alt;
  const intervals=[];let previous=start,alt=at(start),open=alt>0?start:null;
  for(let time=Math.min(start+MINUTE,end);;time=Math.min(time+MINUTE,end)){
    const nextAlt=at(time);
    if((alt>0)!==(nextAlt>0)){
      let lo=previous,hi=time;
      for(let i=0;i<18;i++){const mid=(lo+hi)/2;if((at(mid)>0)===(alt>0))lo=mid;else hi=mid;}
      const cross=(lo+hi)/2;
      if(nextAlt>0)open=cross;else if(open!==null){intervals.push({start:open,end:cross});open=null;}
    }
    previous=time;alt=nextAlt;if(time===end)break;
  }
  if(open!==null)intervals.push({start:open,end});
  return intervals.filter(w=>w.end-w.start>=1000);
}
const overlaps=(windows,start,end)=>windows.some(w=>Math.min(w.end,end)-Math.max(w.start,start)>1000);
export function localEclipseKind(eclipse,windows){
  const peak=+eclipse.peak.date;
  if(eclipse.sd_total&&overlaps(windows,peak-eclipse.sd_total*MINUTE,peak+eclipse.sd_total*MINUTE))return 'total';
  if(eclipse.sd_partial&&overlaps(windows,peak-eclipse.sd_partial*MINUTE,peak+eclipse.sd_partial*MINUTE))return 'partial';
  return 'penumbral';
}
export function eclipsePhase(eclipse,time){
  const distance=Math.abs(time-(+eclipse.peak.date))/MINUTE;
  if(distance>eclipse.sd_penum)return 'outside';
  if(eclipse.sd_total>0&&distance<=eclipse.sd_total)return 'total';
  if(eclipse.sd_partial>0&&distance<=eclipse.sd_partial)return 'partial';
  return 'penumbral';
}
export function nextVisibleLunarEclipse(from,lat,lon,umbralOnly=false){
  if(from.getUTCFullYear()<1900||from.getUTCFullYear()>2100)return {supported:false,event:null};
  const limit=new Date(from);limit.setUTCFullYear(Math.min(2101,from.getUTCFullYear()+10));
  const until=Math.min(+limit,Date.UTC(2101,0,1));
  let event=Engine.SearchLunarEclipse(new Date(+from-86400000));
  for(let i=0;i<40&&+event.peak.date<until;i++,event=Engine.NextLunarEclipse(event.peak)){
    const contacts=eclipseContacts(event),start=Math.max(+from,contacts[0].time),end=contacts.at(-1).time;
    if(end<=start||(umbralOnly&&!event.sd_partial))continue;
    const windows=visibleEclipseIntervals(start,end,lat,lon);
    if(!windows.length)continue;
    const kind=localEclipseKind(event,windows);
    if(umbralOnly&&kind==='penumbral')continue;
    const peak=+event.peak.date;
    const peakVisible=eclipsePosition(peak,lat,lon).alt>0;
    const semi=kind==='total'?event.sd_total:kind==='partial'?event.sd_partial:event.sd_penum;
    const strongest=windows.map(w=>({start:Math.max(w.start,peak-semi*MINUTE),end:Math.min(w.end,peak+semi*MINUTE)})).filter(w=>w.end-w.start>1000);
    const recommended=strongest.reduce((a,b)=>(b.end-b.start>a.end-a.start)?b:a);
    const suggestedTime=peak>=recommended.start&&peak<=recommended.end?peak:(recommended.start+recommended.end)/2;
    return {supported:true,until,event,contacts:contacts.map(c=>({...c,...eclipsePosition(c.time,lat,lon)})),windows,localKind:kind,peakVisible,suggestedTime};
  }
  return {supported:true,until,event:null};
}
