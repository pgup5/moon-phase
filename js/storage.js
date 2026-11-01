// Storage is optional: blocked access or corrupt data must not stop the app.
export function readStored(key, area = 'localStorage') {
  try { return globalThis[area]?.getItem(key) ?? null; } catch { return null; }
}
export function writeStored(key, value, area = 'localStorage') {
  try { globalThis[area]?.setItem(key, value); } catch { /* Continue in memory. */ }
}
export function removeStored(key) {
  try { globalThis.localStorage?.removeItem(key); } catch { /* Optional cache. */ }
}
export function savedLocation() {
  try {
    const value = JSON.parse(readStored('moon.loc'));
    return value && Number.isFinite(value.lat) && Math.abs(value.lat) <= 90 &&
      Number.isFinite(value.lon) && Math.abs(value.lon) <= 180 &&
      typeof value.name === 'string' && value.name.trim() ? value : null;
  } catch { return null; }
}
