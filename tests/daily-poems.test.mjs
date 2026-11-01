import test from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_POEMS } from '../js/daily-poems.js';
import { poemFor } from '../js/culture.js';

test('366 distinct attributed excerpts reference the Moon and contain safe display text', () => {
  assert.equal(DAILY_POEMS.length,366);
  assert.equal(new Set(DAILY_POEMS.map(p=>p.text.replace(/[，。？！、\s]/g,''))).size,366);
  for(const p of DAILY_POEMS) {
    assert.match(p.text,/月|嬋娟/);
    assert.ok(p.author && p.title && p.source);
    assert.doesNotMatch(p.text+p.author+p.title,/[<>&\uFFFD□]/);
  }
});
test('each consecutive 366 local days is different, even over leap day and before the anchor', () => {
  for(const year of [1900,2025,2026,2028,2100]) {
    const texts=[];
    for(let day=0;day<366;day++) texts.push(poemFor(0,new Date(year,0,1+day,12)).text);
    assert.equal(new Set(texts).size,366,`year ${year}`);
  }
});
test('selection is stable all local day, independent of phase, and changes at local midnight', () => {
  const first=poemFor(0,new Date(2026,10,1,0,0));
  assert.deepEqual(poemFor(7,new Date(2026,10,1,23,59,59)),first);
  assert.notEqual(poemFor(0,new Date(2026,10,2,0,0)).text,first.text);
  assert.throws(()=>poemFor(0,new Date('invalid')),RangeError);
});
test('DST transitions and leap-day neighbors each get distinct selections', () => {
  for(const [y,m,d] of [[2026,2,7],[2026,9,31],[2028,1,28]]) {
    assert.equal(new Set([0,1,2].map(offset=>poemFor(0,new Date(y,m,d+offset,23)).text)).size,3);
  }
});
