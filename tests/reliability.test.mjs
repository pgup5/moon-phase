import test from 'node:test';
import assert from 'node:assert/strict';
import { readStored, writeStored, savedLocation } from '../js/storage.js';
import { supportedDate } from '../js/date-range.js';
import { getViewingWeather } from '../js/viewing-score.js';

test('blocked storage and corrupt or invalid locations fall back safely', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('Blocked'); } });
    assert.equal(readStored('moon.loc'), null);
    assert.doesNotThrow(() => writeStored('moon.loc', '{}'));
    assert.equal(savedLocation(), null);
    for (const value of ['{broken', 'null', '{"lat":91,"lon":0,"name":"test"}', '{"lat":0,"lon":"0","name":"test"}', '{"lat":0,"lon":0,"name":""}']) {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => value } });
      assert.equal(savedLocation(), null);
    }
    const valid = { lat: 25.033, lon: 121.565, name: 'Taipei' };
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => JSON.stringify(valid) } });
    assert.deepEqual(savedLocation(), valid);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('invalid and unsupported dates cannot enter time travel', () => {
  for (const value of ['invalid', '1899-12-31T12:00:00Z', '2101-01-01T12:00:00Z']) assert.equal(supportedDate(new Date(value)), false);
  for (const value of ['1900-01-02T12:00:00Z', '2026-11-01T12:00:00Z', '2100-12-30T12:00:00Z']) assert.equal(supportedDate(new Date(value)), true);
});

test('weather can retry after failure and still deduplicates successful requests', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      if (calls === 1) throw Error('Offline');
      return { ok: true, json: async () => ({ hourly: { time: [1793491200], cloud_cover: [10], precipitation_probability: [0] } }) };
    };
    await assert.rejects(getViewingWeather(24.1, 120.1), /Offline/);
    const first = getViewingWeather(24.1, 120.1);
    const second = getViewingWeather(24.1, 120.1);
    assert.equal(first, second);
    assert.equal((await first)[0].cloud, 10);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});
