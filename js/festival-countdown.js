import { locale, tr } from './i18n.js';
import { moonState } from './astro.js';
import { countdownEvent } from './moonrise-countdown.js';
import { shareOrDownload } from './card.js';

export async function buildCountdownCard({ event, greeting, moonSVG, reference }) {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, '#101630'); gradient.addColorStop(1, '#3c3157');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1080, 1350);
  for (let i = 0; i < 100; i++) {
    ctx.fillStyle = `rgba(255,236,190,${.15 + (i % 7) / 12})`;
    ctx.beginPath(); ctx.arc((i * 137.5) % 1080, (i * 83.7) % 1350, i % 3 + .6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,217,138,.4)'; ctx.lineWidth = 2; ctx.strokeRect(42, 42, 996, 1266);
  const image = new Image(); image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(moonSVG); await image.decode();
  ctx.drawImage(image, 310, 100, 460, 460);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd98a'; ctx.font = '56px "Noto Serif TC",serif';
  ctx.fillText(tr(event.name), 540, 655, 920);
  ctx.fillStyle = '#eef1ff'; ctx.font = 'bold 144px system-ui,sans-serif';
  ctx.fillText(event.days === 0 ? (locale === 'en-US' ? 'Today' : '就是今天') : String(event.days), 540, 845, 920);
  ctx.font = '38px system-ui,sans-serif';
  if (event.days) ctx.fillText(locale === 'en-US' ? 'days to go' : '天後相見', 540, 915, 920);
  ctx.fillStyle = '#bbc2e1'; ctx.font = '32px system-ui,sans-serif';
  ctx.fillText(event.date.toLocaleString(locale, event.instant ? { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false } : { year: 'numeric', month: 'long', day: 'numeric' }), 540, 1010, 920);
  ctx.fillStyle = '#ffd98a'; ctx.font = '42px "Noto Serif TC",serif'; ctx.fillText(greeting, 540, 1120, 900);
  ctx.fillStyle = '#bbc2e1'; ctx.font = '25px system-ui,sans-serif';
  ctx.fillText(`${locale === 'en-US' ? 'From' : '起算日'} ${reference.toLocaleDateString(locale)} · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`, 540, 1210, 920);
  ctx.font = '23px system-ui,sans-serif'; ctx.fillText('明月幾時有 · moon-phase-psi.vercel.app', 540, 1270, 920);
  return canvas;
}
export function initFestivalCountdown(context) {
  const $ = id => document.getElementById(id), t = (zh, en) => locale === 'en-US' ? en : zh;
  $('festivalCountdown').innerHTML = `<h2>${t('節日倒數卡片', 'Festival countdown cards')}</h2>
    <p class="when">${t('依所選日期起算，節日以曆日倒數；滿月另顯示精確時刻。', 'Counts calendar days from the selected date; full Moon also shows its exact time.')}</p>
    <label for="countdownKind">${t('期待的日子', 'Looking forward to')}</label><select id="countdownKind">${['中秋節','元宵節','春節','full'].map(name => `<option value="${name}">${name === 'full' ? t('下一次滿月', 'Next full Moon') : tr(name)}</option>`).join('')}</select>
    <p id="countdownContext" class="when"></p><p id="countdownSummary" class="countdown-summary" role="status"></p><p id="countdownDate" class="when"></p>
    <label for="countdownGreeting">${t('卡片祝福語', 'Card greeting')}</label><input id="countdownGreeting" type="text" maxlength="32" value="${t('願人長久，千里共嬋娟', 'Together under the same Moon')}">
    <div class="row"><button id="countdownBuild" type="button">${t('產生倒數卡片', 'Create countdown card')}</button><button id="countdownShare" type="button" hidden>${t('分享 / 下載 PNG', 'Share / download PNG')}</button></div>
    <p id="countdownStatus" class="when" role="status"></p><img id="countdownImage" class="countdown-image" hidden alt="${t('節日倒數分享卡片', 'Festival countdown share card')}">
    <p class="src">${t('節日依農曆 UTC+8 曆日換算，顯示同名當地日期；倒數以日曆天數計算，分享圖會標示起算日。', 'Lunar festivals use their UTC+8 calendar date, shown as the same local date. Countdown uses calendar days; the card includes its reference date.')}</p>`;
  let event = null, reference = null, key = '', revision = 0, canvas = null;
  function invalidate() { revision++; canvas = null; $('countdownImage').hidden = true; $('countdownImage').removeAttribute('src'); $('countdownShare').hidden = true; $('countdownStatus').textContent = ''; }
  $('countdownGreeting').oninput = invalidate;
  $('countdownKind').onchange = () => { key = ''; update(context.date()); };
  $('countdownBuild').onclick = async () => {
    if (!event) return;
    const token = revision; $('countdownBuild').disabled = true;
    $('countdownStatus').textContent = t('正在製作卡片…', 'Creating card…');
    try {
      const phase = moonState(event.date);
      const result = await buildCountdownCard({ event, reference, greeting: $('countdownGreeting').value.trim(), moonSVG: context.moonSVG(phase.elong, 460, false) });
      if (token !== revision) return;
      canvas = result; $('countdownImage').src = canvas.toDataURL('image/png'); $('countdownImage').hidden = false; $('countdownShare').hidden = false;
      $('countdownStatus').textContent = t('卡片已備妥。', 'Card ready.');
    } catch { if (token === revision) $('countdownStatus').textContent = t('無法產生卡片，請重試。', 'Could not create the card. Try again.'); }
    finally { $('countdownBuild').disabled = !event; }
  };
  $('countdownShare').onclick = async () => {
    if (!canvas) return;
    try { await shareOrDownload(canvas, `moon-countdown-${event.days}.png`); }
    catch { $('countdownStatus').textContent = t('無法分享，請長按圖片儲存。', 'Could not share. Save the preview image instead.'); }
  };
  function update(date) {
    const kind = $('countdownKind').value, next = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}:${kind}:${kind === 'full' ? Math.floor(+date / 60000) : ''}`;
    if (key === next) return; key = next; invalidate(); reference = new Date(date); event = countdownEvent(date, kind);
    $('countdownBuild').disabled = !event;
    $('countdownContext').textContent = `${t('起算日', 'From')} ${date.toLocaleDateString(locale)}`;
    $('countdownSummary').textContent = event ? `${tr(event.name)} · ${event.days === 0 ? t('就是今天', 'Today') : t(`倒數 ${event.days} 天`, `${event.days} days to go`)}` : t('此日期無可用的節日資料，請換一天。', 'No festival data for this date. Try another date.');
    $('countdownDate').textContent = event ? event.date.toLocaleString(locale, event.instant ? { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' } : { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }) : '';
  }
  return { update };
}
