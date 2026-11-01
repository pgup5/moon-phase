import test from 'node:test';
import assert from 'node:assert/strict';
import { bearingDelta, rearCameraBearing, moonrisePreview, countdownEvent } from '../js/moonrise-countdown.js';
import { moonPosition } from '../js/astro.js';

test('direction uses the shortest turn across north', () => {
  assert.equal(bearingDelta(5, 355), 10);
  assert.equal(bearingDelta(355, 5), -10);
  assert.equal(bearingDelta(90, 90), 0);
});
test('rear camera heading accounts for phone tilt and rejects relative or vertical headings', () => {
  assert.equal(rearCameraBearing({ alpha: 0, beta: 90, gamma: 0, absolute: true }), 0);
  assert.equal(rearCameraBearing({ alpha: 270, beta: 90, gamma: 0, absolute: true }), 90);
  assert.equal(rearCameraBearing({ alpha: 0, beta: 0, gamma: 0, absolute: true }), null);
  assert.equal(rearCameraBearing({ alpha: 0, beta: 90, gamma: 0, absolute: false }), null);
  assert.equal(rearCameraBearing({ alpha: null, beta: 90, gamma: 0, absolute: true }), null);
});
test('moonrise marker uses rising horizon crossing, including no-rise polar dates', () => {
  const result = moonrisePreview(new Date(2026, 10, 1, 12), 25.033, 121.565);
  assert.ok(result.rise);
  assert.ok(result.azimuth >= 0 && result.azimuth < 360);
  assert.ok(moonPosition(new Date(+result.rise + 60000), 25.033, 121.565).alt > moonPosition(new Date(+result.rise - 60000), 25.033, 121.565).alt);
  const polar = moonrisePreview(new Date(2026, 10, 1, 12), 90, 0);
  assert.equal(polar.rise, null); assert.equal(polar.azimuth, null);
});
test('festival countdown includes today late at night and rolls to the next year', () => {
  const today = countdownEvent(new Date(2026, 8, 25, 23, 59), '中秋節');
  assert.equal(today.days, 0); assert.equal(today.date.getDate(), 25);
  const next = countdownEvent(new Date(2026, 8, 26), '中秋節');
  assert.equal(next.date.getFullYear(), 2027); assert.ok(next.days > 300);
});
test('calendar day countdown spans DST without fractional day errors', () => {
  const before = countdownEvent(new Date(2026, 2, 7, 23), '中秋節');
  const after = countdownEvent(new Date(2026, 2, 8, 23), '中秋節');
  assert.equal(before.days - after.days, 1);
  const full = countdownEvent(new Date(2026, 10, 1), 'full');
  assert.ok(full.date > new Date(2026, 10, 1)); assert.equal(full.instant, true);
});
