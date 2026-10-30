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
    tonight: [document.querySelector('.hero'), section('viewingContext'), section('locName'), section('icsBtn')],
    plan: [section('photoTitle'), $('landscapePlanner'), section('moonPathTitle')],
    explore: [$('moonExplorer'), section('cardDate'), section('launches')],
    calendar: [section('festivals'), section('calTitle'), section('viewingWeekTitle'), section('upcoming'), section('events')],
  };
  const names = { tonight: text('今晚', 'Tonight'), plan: text('拍月', 'Plan'), explore: text('探索', 'Explore'), calendar: text('月曆', 'Calendar') };
  const disclosure = (label, nodes, className = '') => {
    const details = document.createElement('details');
    details.className = `mobile-disclosure ${className}`;
    details.open = !mobile.matches;
    const summary = document.createElement('summary');
    summary.textContent = label;
    details.append(summary, ...nodes);
    return details;
  };

  // Share one date/location control across views; keep the existing input IDs.
  const timeCard = section('dt');
  const controls = disclosure(text('日期與位置', 'Date and location'), [timeCard], 'shared-controls');
  controls.id = 'sharedControls';
  controls.querySelector('summary').id = 'mobileContext';
  const locationRow = document.createElement('div');
  locationRow.className = 'shared-location row';
  const locationName = document.createElement('span');
  locationName.id = 'sharedLocationName';
  locationName.className = 'when';
  locationRow.append(locationName, $('locBtn'));
  controls.append(locationRow);
  document.querySelector('.hero').before(controls);

  // Keep illumination visible and disclose secondary Moon statistics.
  const stats = document.querySelector('.hero .stats');
  const extra = document.createElement('div');
  extra.className = 'stats';
  [...stats.children].slice(2).forEach(node => extra.append(node));
  const moonDetails = disclosure(text('月亮詳細資訊與詩句', 'Moon details and poem'), [extra, $('poem')]);
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
  const hashView = () => location.hash.replace('#', '');
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
  }
  nav.addEventListener('click', event => {
    const button = event.target.closest('[data-view]');
    if (button) show(button.dataset.view);
  });
  window.addEventListener('popstate', () => show(hashView(), { history: false }));
  window.addEventListener('hashchange', () => show(hashView(), { history: false }));
  mobile.addEventListener('change', () => {
    for (const details of main.querySelectorAll('.mobile-disclosure')) details.open = !mobile.matches;
    show(active, { scroll: false, history: false });
  });
  show(hashView(), { scroll: false, history: false });
  document.documentElement.classList.add('mobile-layout-ready');
  return {
    reveal(id) {
      const panel = $(id)?.closest('.view-panel');
      if (panel && mobile.matches) show(panel.id.replace('view-', ''));
    },
    update(date, locationName, live) {
      const dateLabel = date.toLocaleString(locale, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
      const label = `${live ? text('即時', 'Live') : text('所選時間', 'Selected')} · ${dateLabel} · ${tr(locationName)}`;
      if ($('mobileContext').textContent !== label) $('mobileContext').textContent = label;
      $('sharedLocationName').textContent = tr(locationName);
    },
  };
}
