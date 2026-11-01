import { supportedDate } from './date-range.js';

export function sharedLocation(search, english = false) {
  const params = new URLSearchParams(search);
  const latText = params.get('lat'), lonText = params.get('lon');
  if (!latText?.trim() || !lonText?.trim()) return null;
  const lat = Number(latText), lon = Number(lonText);
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) return null;
  // Link labels are generated locally, never interpolated from untrusted URL text.
  return { lat, lon, name: english ? 'Shared location' : '分享的位置' };
}
export function moonLink(base, { date, location, southern, language }) {
  if (!supportedDate(date)) throw Error('Unsupported date');
  if (!Number.isFinite(location.lat) || Math.abs(location.lat) > 90 || !Number.isFinite(location.lon) || Math.abs(location.lon) > 180) throw Error('Invalid location');
  const url = new URL(base);
  url.search = ''; url.hash = 'tonight';
  url.searchParams.set('t', date.toISOString());
  url.searchParams.set('lat', String(location.lat));
  url.searchParams.set('lon', String(location.lon));
  url.searchParams.set('hemi', southern ? 'S' : 'N');
  url.searchParams.set('lang', language === 'en' ? 'en' : 'zh-Hant');
  return url.href;
}

export function initializeMoonSharing(snapshot) {
  const $ = id => document.getElementById(id);
  const english = snapshot().language === 'en', t = (zh, en) => english ? en : zh;
  $('shareMoon').innerHTML = `<div class="row"><button id="shareMoonButton" type="button">${t('分享這個月亮', 'Share this Moon')}</button><button id="copyMoonLink" type="button">${t('複製連結', 'Copy link')}</button></div>
    <p class="when">${t('連結包含所選時刻、經緯度與南北半球視角；對方依當地時區顯示時間。', 'The link includes the selected instant, coordinates and hemisphere view. Times display in the recipient’s local time zone.')}</p>
    <label id="moonLinkLabel" for="moonLinkValue" hidden>${t('分享連結（可手動複製）', 'Share link (copy manually)')}</label><input id="moonLinkValue" type="text" readonly hidden>
    <p id="moonShareStatus" class="when" role="status" aria-live="polite"></p>`;
  const link = () => {
    const state = snapshot(), url = moonLink(window.location.href, state);
    $('moonLinkValue').value = url;
    return { state, url };
  };
  async function copy(url) {
    try {
      if (!navigator.clipboard?.writeText) throw Error('No clipboard');
      await navigator.clipboard.writeText(url);
      $('moonShareStatus').textContent = t('連結已複製。', 'Link copied.');
      $('moonLinkLabel').hidden = $('moonLinkValue').hidden = true;
    } catch {
      $('moonLinkLabel').hidden = $('moonLinkValue').hidden = false;
      $('moonLinkValue').focus(); $('moonLinkValue').select();
      $('moonShareStatus').textContent = t('請複製上方連結。', 'Copy the link above.');
    }
  }
  $('copyMoonLink').onclick = () => copy(link().url);
  $('shareMoonButton').onclick = async () => {
    const { url, state } = link();
    if (!navigator.share) return copy(url);
    try {
      await navigator.share({ title: t('明月幾時有 · 我的月亮', 'My Moon'), text: `${state.date.toLocaleString(english ? 'en-US' : 'zh-TW')} · ${state.location.lat.toFixed(3)}, ${state.location.lon.toFixed(3)}`, url });
      $('moonShareStatus').textContent = t('已分享連結。', 'Link shared.');
    } catch (error) {
      if (error.name === 'AbortError') { $('moonShareStatus').textContent = t('已取消分享。', 'Sharing cancelled.'); return; }
      await copy(url);
    }
  };
}
