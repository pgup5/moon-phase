import test from 'node:test';
import assert from 'node:assert/strict';
import * as Engine from '../vendor/astronomy.js';
import {eclipseContacts,eclipsePhase,eclipsePosition,visibleEclipseIntervals,nextVisibleLunarEclipse} from '../js/lunar-eclipse.js';

test('March 2026 eclipse contacts agree with NASA rounded times',()=>{
 const event=Engine.SearchLunarEclipse(new Date('2026-03-01T00:00:00Z'));
 assert.equal(event.kind,'total');
 const contacts=eclipseContacts(event);assert.equal(contacts.length,7);
 const expected={P1:'08:44',U1:'09:50',U2:'11:04',MAX:'11:33',U3:'12:03',U4:'13:17',P4:'14:23'};
 for(const c of contacts){assert.ok(Math.abs(c.time-new Date(`2026-03-03T${expected[c.id]}:00Z`))<180000,c.id);}
 assert.equal(eclipsePhase(event,+event.peak.date),'total');
 assert.equal(eclipsePhase(event,contacts[0].time-1000),'outside');
});
test('Taipei skips an invisible August 2026 eclipse and distinguishes hidden maximum',()=>{
 const result=nextVisibleLunarEclipse(new Date('2026-08-01T00:00:00Z'),25.033,121.565);
 assert.equal(result.event.peak.date.toISOString().slice(0,10),'2027-02-20');
 assert.equal(result.event.kind,'penumbral');assert.equal(result.localKind,'penumbral');assert.equal(result.peakVisible,false);
 for(const w of result.windows){assert.ok(eclipsePosition((w.start+w.end)/2,25.033,121.565).alt>0);}
 const end=result.windows.at(-1).end;assert.ok(Math.abs(eclipsePosition(end,25.033,121.565).alt)<.001);
 assert.ok(eclipsePosition(result.suggestedTime,25.033,121.565).alt>0);
});
test('an ongoing total eclipse after totality recommends the remaining partial phase',()=>{
 const from=new Date('2026-03-03T12:30:00Z'),r=nextVisibleLunarEclipse(from,35.67,139.65);
 assert.equal(r.event.kind,'total');assert.equal(r.localKind,'partial');assert.equal(r.peakVisible,true);
 assert.ok(+r.event.peak.date<+from);
 for(const w of r.windows)assert.ok(w.start>=+from);
 assert.equal(eclipsePhase(r.event,r.suggestedTime),'partial');
});
test('umbral-only search requires a locally visible umbral phase',()=>{
 const date=new Date('2026-10-30T00:00:00Z'),r=nextVisibleLunarEclipse(date,25.033,121.565,true);
 assert.ok(r.event);assert.ok(['partial','total'].includes(r.localKind));
 assert.notEqual(eclipsePhase(r.event,r.suggestedTime),'penumbral');
});
test('visibility handles below-horizon intervals and polar locations',()=>{
 assert.deepEqual(visibleEclipseIntervals(1000,1000,25,121),[]);
 const r=nextVisibleLunarEclipse(new Date('2026-03-01T00:00:00Z'),90,0);
 assert.ok(r.event);assert.ok(r.windows.length>0);
 for(const w of r.windows){assert.ok(Number.isFinite(w.start)&&Number.isFinite(w.end));assert.ok(w.end>w.start);}
});
test('unsupported dates return an explicit unsupported result',()=>{
 assert.deepEqual(nextVisibleLunarEclipse(new Date('1800-01-01T00:00:00Z'),25,121),{supported:false,event:null});
});
