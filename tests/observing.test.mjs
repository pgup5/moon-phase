import test from 'node:test';
import assert from 'node:assert/strict';
import {PLACES,SHOWERS,localMoon,moonDiskSVG,showerActive,referencePeak,nextShower,meteorNight,tideModel,observingChallenge} from '../js/observing.js';

test('five-place lunar comparison shares one phase and handles the pole',()=>{
  const date=new Date('2026-11-12T10:00:00Z'),places=PLACES.map(p=>localMoon(date,p));
  assert.equal(places.length,5);
  for(const p of places){assert.ok(Number.isFinite(p.alt));assert.ok(p.alt>=-90&&p.alt<=90);assert.ok(p.az>=0&&p.az<360);assert.ok(p.angle===null||p.angle>=0&&p.angle<360);assert.equal(p.illumination,places[0].illumination);}
  assert.ok(Math.abs(places[0].alt-places[3].alt)>60);
  assert.ok(Math.abs(places[0].angle-places[2].angle)>10);
  assert.equal(places.at(-1).lat,90);
  assert.equal(places.at(-1).tz,'UTC');
  assert.match(moonDiskSVG(.1,45,'Moon'),/rotate\(-45/);
  for(const i of [0,.5,1])assert.ok(!moonDiskSVG(i,null,'Moon').includes('NaN'));
});
test('city time zones include DST while North Pole uses UTC',()=>{
 const date=new Date('2026-07-01T12:00:00Z');
 const hour=p=>date.toLocaleString('en-GB',{timeZone:p.tz,hour:'2-digit',hour12:false});
 assert.deepEqual(PLACES.map(hour),['20','21','22','08','12']);
});
test('annual shower windows wrap across New Year and select an upcoming shower',()=>{
 const q=SHOWERS.find(s=>s.id==='quadrantids');
 assert.equal(showerActive(q,new Date(2026,11,30)),true);
 assert.equal(showerActive(q,new Date(2027,0,5)),true);
 assert.equal(showerActive(q,new Date(2027,0,13)),false);
 assert.equal(referencePeak(q,new Date(2026,11,30)).getFullYear(),2027);
 assert.equal(referencePeak(q,new Date(2027,0,5)).getFullYear(),2027);
 assert.equal(nextShower(new Date(2026,1,1)).id,'lyrids');
 assert.equal(nextShower(new Date(2026,11,14)).id,'geminids');
});
test('meteor candidates meet darkness/radiant thresholds, prefer moon-free windows',()=>{
 const shower=SHOWERS.find(s=>s.id==='geminids');
 const n=meteorNight(new Date(2026,11,14),25.033,121.565,shower);
 assert.equal(n.active,true);assert.ok(n.samples.length>=276);assert.ok(n.best);
 for(const w of n.windows){assert.ok(w.start>=n.start&&w.end<=n.end);assert.ok(w.end>w.start);assert.ok(w.best.radiant>=20&&w.best.sun<=-18);if(w.moonfree)assert.ok(w.best.moon<=-.833);}
 if(n.windows.some(w=>w.moonfree))assert.equal(n.best.moonfree,true);
 const polar=meteorNight(new Date(2026,5,21),89,0,shower);assert.equal(polar.windows.length,0);assert.equal(polar.best,null);
 const south=meteorNight(new Date(2026,7,13),-80,0,SHOWERS.find(s=>s.id==='perseids'));assert.equal(south.windows.length,0);
});
test('tide model is symmetric with spring maxima and neap minima',()=>{
 const a=tideModel(0),b=tideModel(90),c=tideModel(180),d=tideModel(270);
 assert.equal(a.kind,'spring');assert.equal(c.kind,'spring');assert.equal(b.kind,'neap');assert.equal(d.kind,'neap');
 assert.ok(Math.abs(a.relative-1)<1e-12);assert.ok(Math.abs(a.relative-c.relative)<1e-12);assert.ok(Math.abs(b.relative-d.relative)<1e-12);assert.ok(b.relative<a.relative);
 for(let angle=0;angle<=360;angle++){const m=tideModel(angle);assert.ok(Number.isFinite(m.angle));assert.ok(m.relative>=.54/1.46-1e-12&&m.relative<=1+1e-12);}
});
test('observing challenges change with phase and equipment',()=>{
 assert.equal(observingChallenge(0),'dark');assert.equal(observingChallenge(.1),'earthshine');assert.equal(observingChallenge(.5),'shape');assert.equal(observingChallenge(.5,'binoculars'),'terminator');assert.equal(observingChallenge(.95),'seas');assert.equal(observingChallenge(.95,'binoculars'),'rays');
});
