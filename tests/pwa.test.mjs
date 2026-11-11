import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';
import { moonLink } from '../js/moon-link.js';

const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
function worker(scope, store = new Map(), failInstall = false) {
  const handlers = {}, requests = [];
  let skipped = false, claimed = false, offline = false;
  const cache = name => {
    if (!store.has(name)) store.set(name, new Map());
    const entries = store.get(name);
    return {
      async addAll(urls) {
        if (failInstall) throw Error('precache failed');
        for (const url of urls) entries.set(url, new Response(url));
      },
      async match(key) { return entries.get(key)?.clone(); },
      async put(key, value) { entries.set(key, value); },
    };
  };
  vm.runInNewContext(source, {
    URL, Set, self: {
      registration: { scope },
      addEventListener: (type, fn) => { handlers[type] = fn; },
      skipWaiting: async () => { skipped = true; },
      clients: { claim: async () => { claimed = true; } },
    },
    caches: { open: async name => cache(name), keys: async () => [...store.keys()], delete: async name => store.delete(name) },
    fetch: async request => {
      requests.push(request.url);
      if (offline) throw Error('offline');
      return new Response('updated');
    },
  });
  return {
    store, requests, get skipped() { return skipped; }, get claimed() { return claimed; },
    set offline(value) { offline = value; },
    async lifecycle(type) {
      let promise;
      handlers[type]({ waitUntil: p => { promise = p; } });
      await promise;
    },
    fetch(url, method = 'GET') {
      let response;
      const work = [];
      handlers.fetch({ request: { url, method }, respondWith: p => { response = p; }, waitUntil: p => work.push(p) });
      return { response, done: Promise.all(work) };
    },
  };
}

for (const path of ['/', '/moon/']) {
  const scope = `https://example.test${path}`;
  test(`${path}: precache files exist, manifest and sharing stay in scope`, async () => {
    const w = worker(scope);
    await w.lifecycle('install');
    assert.equal(w.skipped, true);
    const entries = [...w.store.values()][0];
    for (const url of entries.keys()) {
      assert.ok(url.startsWith(scope));
      const relative = url.slice(scope.length) || 'index.html';
      await access(new URL(`../${relative}`, import.meta.url));
    }
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
      if (/^(?:https?:|#|data:)/.test(match[1])) continue;
      assert.ok(entries.has(new URL(match[1], scope).href), `missing HTML asset ${match[1]}`);
    }
    const cssURL = new URL('css/style.css', scope);
    const css = await readFile(new URL('../css/style.css', import.meta.url), 'utf8');
    for (const match of css.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)) {
      if (/^(?:https?:|#|data:)/.test(match[1])) continue;
      assert.ok(entries.has(new URL(match[1], cssURL).href), `missing CSS asset ${match[1]}`);
    }
    // All local module dependencies, including lazy imports, are precached.
    for (const url of entries.keys()) {
      if (!url.endsWith('.js') || url.includes('/vendor/')) continue;
      const code = await readFile(new URL(`../${url.slice(scope.length)}`, import.meta.url), 'utf8');
      for (const match of code.matchAll(/new URL\(["']([^"']+)["'], import\.meta\.url\)/g)) {
        const asset = new URL(match[1], url).href;
        assert.ok(asset === scope || asset === new URL('sw.js', scope).href || entries.has(asset), `missing module-relative asset ${asset}`);
      }
      for (const match of code.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)) {
        assert.ok(entries.has(new URL(match[1], url).href), `missing module ${match[1]}`);
      }
    }
    const manifestURL = new URL('manifest.webmanifest', scope);
    const manifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url)));
    for (const field of ['start_url', 'scope']) assert.equal(new URL(manifest[field], manifestURL).href, scope);
    for (const icon of manifest.icons) assert.ok(entries.has(new URL(icon.src, manifestURL).href));
    const link = new URL(moonLink(scope, {date:new Date('2026-11-01T12:30Z'), location:{lat:-33.8688,lon:151.2093}, southern:true, language:'en'}));
    assert.equal(link.origin + link.pathname, scope);
    w.offline = true;
    for (const url of [link.href, `${scope}index.html${link.search}`, new URL('js/moon3d.js', scope).href]) {
      const result = w.fetch(url);
      assert.ok((await result.response).ok);
      await result.done;
    }
    assert.equal(entries.size, [...entries.keys()].filter(key => !key.includes('?')).length);
  });
  test(`${path}: activation deletes only older caches for this app scope`, async () => {
    const prefix = `moon-phase:${scope}:`;
    const otherScope = path === '/' ? 'https://example.test/moon/' : 'https://example.test/';
    const store = new Map([['other-app', new Map()], ['moon-v38', new Map()], [`moon-phase:${otherScope}:v38`, new Map()], [prefix + 'v38', new Map()]]);
    const w = worker(scope, store);
    await w.lifecycle('install');
    await w.lifecycle('activate');
    assert.equal(w.claimed, true);
    assert.equal(store.has(prefix + 'v38'), false);
    assert.equal([...store.keys()].filter(key => key.startsWith(prefix)).length, 1);
    for (const key of ['other-app', 'moon-v38', `moon-phase:${otherScope}:v38`]) assert.equal(store.has(key), true);
    for (const url of ['https://external.test/file', 'https://example.test/other-app/', scope + 'unknown', scope + 'js/app.js.bak']) assert.equal(w.fetch(url).response, undefined);
    assert.equal(w.fetch(scope, 'POST').response, undefined);
  });
  test(`${path}: background refresh completes and failed installation cannot skip waiting`, async () => {
    const w = worker(scope);
    await w.lifecycle('install');
    const result = w.fetch(scope + '?lang=en');
    await result.response;
    await result.done;
    w.offline = true;
    const refreshed = w.fetch(scope);
    assert.equal(await (await refreshed.response).text(), 'updated');
    await refreshed.done;
    const failed = worker(scope, new Map(), true);
    await assert.rejects(failed.lifecycle('install'), /precache failed/);
    assert.equal(failed.skipped, false);
  });
}
