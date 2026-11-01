import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedLocation, moonLink } from '../js/moon-link.js';

test('links preserve the instant, coordinates, language and hemisphere and open Tonight', () => {
 const date = new Date('2026-11-01T20:30:00+08:00');
 const url = new URL(moonLink('https://example.com/moon/?old=1#explore', { date, location:{lat:-33.8688,lon:151.2093},southern:true,language:'en' }));
 assert.equal(+new Date(url.searchParams.get('t')), +date);
 assert.deepEqual(sharedLocation(url.search,true),{lat:-33.8688,lon:151.2093,name:'Shared location'});
 assert.equal(url.searchParams.get('hemi'),'S'); assert.equal(url.searchParams.get('lang'),'en');
 assert.equal(url.hash,'#tonight'); assert.equal(url.searchParams.has('old'),false); assert.equal(url.pathname,'/moon/');
});
test('invalid or partial coordinates cannot override a saved location', () => {
 for(const query of ['', '?lat=&lon=0','?lat=0','?lat=NaN&lon=0','?lat=91&lon=0','?lat=0&lon=-181','?lat=Infinity&lon=1']) assert.equal(sharedLocation(query),null);
 assert.equal(sharedLocation('?lat=0&lon=0&name=<script>').name,'分享的位置');
 assert.equal(sharedLocation('?lat=-90&lon=180').lat,-90);
 assert.throws(()=>moonLink('https://example.com', {date:new Date('invalid'),location:{lat:0,lon:0}}));
});
