import test from 'node:test';
import assert from 'node:assert/strict';
import { skyCategory, earthshinePhase, nightConditions, moonNeighbors } from '../js/night-sky.js';
import { sunPosition, moonPosition, moonState } from '../js/astro.js';

test('twilight and crescent thresholds have explicit boundaries',()=>{
  for(const [sun,moon,expected] of [[1,-10,'day'],[-3,20,'civil'],[-8,20,'nautical'],[-15,20,'astronomical'],[-18,20,'moonlit'],[-20,-.833,'moonless'],[-20,-.8,'moonlit']]) assert.equal(skyCategory(sun,moon),expected);
  for(const [illum,expected] of [[0,false],[.009,false],[.01,true],[.35,true],[.351,false],[1,false]])assert.equal(earthshinePhase(illum),expected);
});
test('night timeline covers the full interval without gaps; candidate windows meet criteria',()=>{
  const lat=25.033,lon=121.565;
  for(const date of [new Date(2026,9,30),new Date(2026,10,12),new Date(2026,10,7)]){
    const n=nightConditions(date,lat,lon);
    assert.equal(n.segments[0].start,n.start);assert.equal(n.segments.at(-1).end,n.end);
    n.segments.forEach((s,i)=>{assert.ok(s.end>s.start);if(i)assert.equal(n.segments[i-1].end,s.start);});
    assert.ok(n.moonlessMinutes<=n.nightMinutes);
    for(const s of n.moonless){const mid=new Date((s.start+s.end)/2);assert.ok(sunPosition(mid,lat,lon).alt<=-18);assert.ok(moonPosition(mid,lat,lon).alt<=-.833);}
    for(const s of n.earthshine){const mid=new Date((s.start+s.end)/2),sun=sunPosition(mid,lat,lon).alt;assert.ok(sun>=-18&&sun<=-4);assert.ok(moonPosition(mid,lat,lon).alt>=5);assert.ok(earthshinePhase(moonState(mid).illum));}
  }
});
test('polar summer has no astronomical night; winter has a full night',()=>{
  assert.equal(nightConditions(new Date(2026,5,21),89,0).nightMinutes,0);
  const winter=nightConditions(new Date(2026,11,21),89,0);
  assert.equal(winter.nightMinutes,Math.round((winter.end-winter.start)/60000));
});
test('local-noon intervals follow DST clock changes',()=>{
  const saved=process.env.TZ;
  try{process.env.TZ='America/New_York';
    const spring=nightConditions(new Date(2026,2,7,12),40.7,-74);
    const autumn=nightConditions(new Date(2026,9,31,12),40.7,-74);
    assert.equal((spring.end-spring.start)/3600000,23);
    assert.equal((autumn.end-autumn.start)/3600000,25);
  }finally{if(saved===undefined)delete process.env.TZ;else process.env.TZ=saved;}
});
test('nearby bodies are sorted, bounded, and carry horizon information',()=>{
  const d=new Date('2026-10-30T12:00:00Z'),a=moonNeighbors(d,25,121,15),b=moonNeighbors(d,25,121,30);
  assert.equal(a.supported,true);
  assert.ok(b.objects.length>=a.objects.length);
  for(let i=0;i<b.objects.length;i++){const o=b.objects[i];assert.ok(o.separation>=0&&o.separation<=30);assert.ok(o.alt>=-90&&o.alt<=90);assert.ok(o.az>=0&&o.az<360);if(i)assert.ok(b.objects[i-1].separation<=o.separation);}
  assert.deepEqual(moonNeighbors(new Date('1800-01-01'),25,121),{supported:false,objects:[]});
});
test('Regulus is close to the Moon at the August 2017 solar eclipse',()=>{
  const n=moonNeighbors(new Date('2017-08-21T18:26:00Z'),37,-89,15);
  const star=n.objects.find(o=>o.en==='Regulus');assert.ok(star);assert.ok(star.separation<3);
});
