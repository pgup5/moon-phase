import { locale, tr } from './i18n.js';

// Move existing elements rather than cloning them: IDs, listeners and state survive.
export function initializeMobileLayout() {
  const $ = id => document.getElementById(id);
  const english = locale === 'en-US';
  const text = (zh, en) => english ? en : zh;
  const mobile = matchMedia('(max-width: 760px)');
  const main = document.querySelector('main');
  const section = id => $(id).closest('section');
  const groups = {
    tonight: [document.querySelector('.hero'), section('viewingContext'), section('locName'), $('challengeCard'), section('icsBtn')],
    plan: [section('moonPathTitle'), section('photoTitle'), $('darknessCard'), $('earthshineCard'), $('landscapePlanner')],
    explore: [section('cardDate'), $('moonExplorer'), $('neighborsCard'), $('meteorCard'), $('worldMoonCard'), $('tidesCard'), section('launches')],
    calendar: [section('festivals'), section('calTitle'), section('viewingWeekTitle'), $('lunarEclipseCard'), section('upcoming'), section('events')],
  };
  const names = { tonight: text('今晚', 'Tonight'), plan: text('觀測', 'Observe'), explore: text('探索', 'Explore'), calendar: text('月曆', 'Calendar') };
  const disclosure = (label, nodes, className = '') => {
    const details = document.createElement('details');
    details.className = `mobile-disclosure ${className}`;
    details.open = !mobile.matches;
    const summary = document.createElement('summary');
    summary.textContent = label;
    details.append(summary, ...nodes);
    return details;
  };

  const status = document.createElement('div');
  status.id = 'queryStatus';
  status.className = 'query-status';
  const statusText = document.createElement('span');
  statusText.id = 'queryStatusText';
  statusText.setAttribute('role', 'status');
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.id = 'globalNowBtn';
  reset.textContent = text('回到現在', 'Back to now');
  reset.onclick = () => $('nowBtn').click();
  status.append(statusText, reset);
  document.querySelector('.hero').before(status);

  // Keep time travel in Plan; retain the original input IDs and listeners.
  const timeCard = section('dt');
  const controls = disclosure(text('時光旅行', 'Time travel'), [timeCard], 'shared-controls');
  controls.id = 'sharedControls';
  controls.querySelector('summary').id = 'mobileContext';
  groups.plan.unshift(controls);

  // Keep illumination visible and disclose secondary Moon statistics.
  const stats = document.querySelector('.hero .stats');
  const extra = document.createElement('div');
  extra.className = 'stats';
  [...stats.children].slice(2).forEach(node => extra.append(node));
  const moonDetails = disclosure(text('月亮詳細資訊', 'Moon details'), [extra]);
  stats.after(moonDetails);

  // Present viewing conditions and windows as one recommendation card.
  const windowsCard = section('viewingContext');
  const scoreCard = section('viewingScoreTitle');
  const score = document.createElement('div');
  score.className = 'combined-viewing-score';
  score.append(...scoreCard.childNodes);
  windowsCard.querySelector('h2').after(score);
  scoreCard.remove();
  const compass = $('compass');
  const compassDetails = disclosure(text('展開方位指南針', 'Show direction compass'), [compass], 'compass-details');
  document.querySelector('.where').prepend(compassDetails);

  // Long methodology notes stay available without dominating a phone screen.
  for (const note of main.querySelectorAll('section > .src, .combined-viewing-score > .src')) {
    if (note.id === 'launchSrc') continue;
    const details = disclosure(text('計算方式與資料來源', 'Method and sources'), []);
    note.before(details);
    details.append(note);
  }

  const panels = {};
  for (const [key, nodes] of Object.entries(groups)) {
    const panel = document.createElement('div');
    panel.id = `view-${key}`;
    panel.className = 'view-panel';
    panel.setAttribute('aria-label', names[key]);
    const title = document.createElement('h2');
    title.className = 'mobile-view-title';
    title.textContent = names[key];
    panel.append(title, ...nodes);
    panels[key] = panel;
    main.querySelector('footer').before(panel);
  }
  const shortcuts = document.createElement('nav');
  shortcuts.className = 'explore-shortcuts';
  shortcuts.setAttribute('aria-label', text('探索快速入口', 'Explore shortcuts'));
  const destinations = [
    [section('cardDate'), 'birthdaySection', text('生日卡片', 'Birthday')],
    [$('moonExplorer'), 'moonExplorer', text('月面', 'Lunar map')],
    [$('neighborsCard'), 'neighborsCard', text('星空', 'Nearby sky')],
    [$('meteorCard'), 'meteorCard', text('流星雨', 'Meteors')],
    [$('worldMoonCard'), 'worldMoonCard', text('各地月亮', 'Around Earth')],
    [$('tidesCard'), 'tidesCard', text('潮汐', 'Tides')],
    [section('launches'), 'launchSection', text('火箭', 'Launches')],
  ];
  for (const [target, id, label] of destinations) {
    target.id = id;
    target.style.scrollMarginTop = 'var(--query-offset, 112px)';
    const link = document.createElement('a');
    link.href = `#${id}`;
    link.textContent = label;
    link.onclick = event => {
      event.preventDefault();
      const heading = target.querySelector('h2');
      heading?.setAttribute('tabindex', '-1');
      heading?.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    };
    shortcuts.append(link);
  }
  panels.explore.querySelector('.mobile-view-title').after(shortcuts);
  if (globalThis.ResizeObserver) new ResizeObserver(() => {
    document.documentElement.style.setProperty('--query-offset', `${status.offsetHeight + 16}px`);
  }).observe(status);

  const nav = document.createElement('nav');
  nav.className = 'mobile-nav';
  nav.setAttribute('aria-label', text('主要導覽', 'Main navigation'));
  const icons = { tonight: '☾', plan: '◎', explore: '✧', calendar: '▦' };
  for (const key of ['tonight', 'plan', 'explore', 'calendar']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.view = key;
    button.setAttribute('aria-controls', `view-${key}`);
    const icon = document.createElement('span');
    icon.className = 'nav-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = icons[key];
    const label = document.createElement('span');
    label.textContent = names[key];
    button.append(icon, label);
    nav.append(button);
  }
  document.body.append(nav);
  let active = 'tonight';
  const hashView = () => {
    const hash = location.hash.replace('#', '');
    if (panels[hash]) return hash;
    return $(hash)?.closest('.view-panel')?.id.replace('view-', '') || 'tonight';
  };
  function show(key, { scroll = true, history = true } = {}) {
    if (!panels[key]) key = 'tonight';
    active = key;
    for (const [name, panel] of Object.entries(panels)) panel.classList.toggle('is-active', name === key);
    for (const button of nav.querySelectorAll('button')) {
      if (button.dataset.view === key) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    if (history && mobile.matches && hashView() !== key) window.history.pushState(null, '', `#${key}`);
    if (scroll && mobile.matches) window.scrollTo({ top: 0, behavior: 'instant' });
    // A hidden Moon canvas/map may need a fresh size when its panel appears.
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('moon:viewchange'));
  }
  nav.addEventListener('click', event => {
    const button = event.target.closest('[data-view]');
    if (button) show(button.dataset.view);
  });
  const restoreRoute = () => {
    const target = $(location.hash.replace('#', ''));
    show(hashView(), { history: false, scroll: !target });
    if (target) target.scrollIntoView({ block: 'start' });
  };
  window.addEventListener('popstate', restoreRoute);
  window.addEventListener('hashchange', restoreRoute);
  mobile.addEventListener('change', () => {
    for (const details of main.querySelectorAll('.mobile-disclosure')) details.open = !mobile.matches;
    show(active, { scroll: false, history: false });
  });
  show(hashView(), { scroll: false, history: false });
  const initialTarget = $(location.hash.replace('#', ''));
  if (initialTarget) requestAnimationFrame(() => initialTarget.scrollIntoView({ block: 'start' }));
  document.documentElement.classList.add('mobile-layout-ready');
  return {
    isVisible(id) {
      return !mobile.matches || $(id)?.closest('.view-panel')?.classList.contains('is-active');
    },
    reveal(id) {
      const panel = $(id)?.closest('.view-panel');
      if (panel && mobile.matches) show(panel.id.replace('view-', ''));
      for (let parent = $(id)?.parentElement; parent; parent = parent.parentElement) {
        if (parent.tagName === 'DETAILS') parent.open = true;
      }
    },
    update(date, locationName, live) {
      const dateLabel = date.toLocaleString(locale, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
      const label = `${live ? text('即時', 'Live') : text('所選時間', 'Selected')} · ${dateLabel} · ${tr(locationName)}`;
      if ($('mobileContext').textContent !== label) $('mobileContext').textContent = label;
      const fullDate = date.toLocaleString(locale, { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
      const statusLabel = `${live ? text('即時', 'Live') : text('正在查看', 'Viewing')}: ${fullDate} · ${tr(locationName)}`;
      if (statusText.textContent !== statusLabel) statusText.textContent = statusLabel;
      reset.hidden = live;
      status.classList.toggle('is-selected', !live);
    },
  };
}
