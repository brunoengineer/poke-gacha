// App shell: header (tabs, Pokédollars, account menu), the phone's side menu and hash routing between the top-level
// screens.
// Routes: #/collection, #/capture, #/battle[/<mode>], #/ranking, and #/journey on the Region Journey track. Screens implement ViewModule (src/screens/types.ts).

import { isMuted, onMuteChange, playMusic, sfx, toggleMute, unlockAudio } from '../audio';
import { getLang, L, setLang, type Lang } from '../i18n';
import { battleView } from '../screens/battle';
import { captureView } from '../screens/capture';
import { collectionView } from '../screens/collection';
import { chapterLabel } from '../screens/battle/regions';
import { journeyView } from '../screens/journey';
import { rankingView } from '../screens/ranking';
import type { ViewModule } from '../screens/types';
import { activeChapter } from '../game/journey';
import { isFirebaseEnabled, on, resetProgress, signIn, signOut, store, switchTrack } from '../state/store';
import { currentTrack, isJourneyTrack } from '../state/track';
import { animateNumber, confirmDialog, el, esc, icon } from './dom';
import { openSettings } from './settings';

const VIEWS: Record<string, { module: ViewModule; icon: string; label: () => string }> = {
  // The Journey's map comes first; Classic has no such screen (#/journey there falls back to home).
  ...(isJourneyTrack() ? { journey: { module: journeyView, icon: 'globe', label: () => L().journey.map.nav } } : {}),
  collection: { module: collectionView, icon: 'cards', label: () => L().core.nav.collection },
  capture: { module: captureView, icon: 'ball', label: () => L().core.nav.capture },
  battle: { module: battleView, icon: 'swords', label: () => L().core.nav.battle },
  ranking: { module: rankingView, icon: 'trophy', label: () => L().core.nav.ranking },
};
export const HOME = 'collection';

const mounted = new Set<string>();
let current: string | null = null;

/** Parses the hash: "#/battle/gyms" -> ["battle", "gyms"]. */
export function parseHash(hash = location.hash): [string, string] {
  const [, name = '', arg = ''] = hash.match(/^#\/?([^/]*)\/?(.*)$/) ?? [];
  return [VIEWS[name] ? name : HOME, arg];
}

export const navigate = (path: string) => {
  location.hash = `#/${path}`;
};

function route() {
  const [name, arg] = parseHash();
  if (current && current !== name) VIEWS[current].module.hide?.();
  const changed = current !== name;
  current = name;

  document.querySelectorAll<HTMLElement>('.view').forEach(section => {
    const active = section.dataset.view === name;
    section.hidden = !active;
    if (active && !mounted.has(name)) {
      VIEWS[name].module.mount(section);
      mounted.add(name);
    }
  });
  VIEWS[name].module.show?.(arg);
  document.querySelectorAll('.tab').forEach(tab => {
    if ((tab as HTMLElement).dataset.view === name) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  syncSideNav(name);
  if (changed) {
    window.scrollTo({ top: 0 });
    // Back/Forward during a battle keeps the battle music (the arena restores the screen's music when it closes).
    if (!document.documentElement.classList.contains('arena-open')) restoreMusic();
  }
}

/** Music for the current screen (the battle arena calls this when it closes). */
export function restoreMusic() {
  playMusic(current === 'capture' ? 'capture' : 'menu');
}

export function startShell() {
  document.querySelector<HTMLElement>('.topbar')!.hidden = false;
  document.querySelector<HTMLElement>('.site-footer')!.hidden = false;
  document.getElementById('boot')?.remove();
  document.title = L().core.appName;
  document.documentElement.lang = getLang() === 'pt' ? 'pt-BR' : 'en';

  const t = L().core;
  document.querySelector('.brand')!.setAttribute('aria-label', t.nav.home);
  const tabs = document.querySelector<HTMLElement>('.tabs')!;
  tabs.setAttribute('aria-label', t.nav.main);
  tabs.innerHTML = Object.entries(VIEWS).map(([id, v]) =>
    `<a class="tab" href="#/${id}" data-view="${id}">${icon(v.icon)}<span>${esc(v.label())}</span></a>`).join('');
  tabs.addEventListener('click', event => {
    if ((event.target as Element).closest('.tab')) sfx('tab');
  });

  initSideNav();
  initChapterChip();
  initCoins();
  initMute();
  initMenu();
  document.addEventListener('pointerdown', unlockAudio, { capture: true });
  document.addEventListener('keydown', unlockAudio, { capture: true });
  // The browser's own drag isn't used anywhere (cards use ui/dnd.ts). Left on, a slip of the mouse while clicking a
  // link starts dragging it: the click is lost and the page stops responding to the mouse until the drag ends.
  document.addEventListener('dragstart', event => event.preventDefault());

  route();
  addEventListener('hashchange', route);
}

// --- Side menu (phones) ---------------------------------------------------------------------
// The top of a phone is hard to reach, so there the tabs live in a small drawer on the right edge: a handle with the
// current screen's icon that slides the screens out. It's outside .topbar because backdrop-filter would trap a
// fixed element inside it. CSS shows either this or the header tabs.

let sideNav: HTMLElement | null = null;

function setSideNav(open: boolean) {
  if (!sideNav) return;
  const t = L().core.nav;
  sideNav.classList.toggle('open', open);
  const handle = sideNav.querySelector<HTMLElement>('.side-nav-handle')!;
  handle.setAttribute('aria-expanded', String(open));
  handle.setAttribute('aria-label', open ? t.closeMenu : t.openMenu);
  // Closed, the links stay out of the keyboard and screen reader order.
  sideNav.querySelector<HTMLElement>('.side-nav-tabs')!.inert = !open;
}

function syncSideNav(view: string) {
  const current = sideNav?.querySelector('.side-nav-current');
  if (current) current.innerHTML = icon(VIEWS[view].icon);
}

function initSideNav() {
  const t = L().core.nav;
  sideNav = el(`
    <nav class="side-nav" aria-label="${esc(t.main)}">
      <button class="side-nav-handle" type="button" aria-controls="side-nav-tabs">
        <span class="side-nav-current"></span>${icon('left', 'side-nav-arrow')}
      </button>
      <div class="side-nav-tabs" id="side-nav-tabs">
        ${Object.entries(VIEWS).map(([id, v]) => `<a class="tab" href="#/${id}" data-view="${id}">${icon(v.icon)}<span>${esc(v.label())}</span></a>`).join('')}
      </div>
    </nav>`);
  document.getElementById('toasts')!.before(sideNav);
  setSideNav(false);

  sideNav.addEventListener('click', event => {
    const target = event.target as Element;
    if (target.closest('.side-nav-handle')) {
      sfx('toggle');
      setSideNav(!sideNav!.classList.contains('open'));
    } else if (target.closest('.tab')) {
      sfx('tab');
      setSideNav(false);
    }
  });
  document.addEventListener('pointerdown', event => {
    if (sideNav?.classList.contains('open') && !sideNav.contains(event.target as Node)) setSideNav(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sideNav?.classList.contains('open')) {
      setSideNav(false);
      sideNav.querySelector<HTMLElement>('.side-nav-handle')!.focus();
    }
  });
}

/** Journey: the chapter being played, as a small chip linking to the map. */
function initChapterChip() {
  const chapter = activeChapter();
  if (!chapter) return;
  const name = chapterLabel(chapter);
  const chip = el<HTMLAnchorElement>(`<a class="chapter-chip jc-${chapter}" href="#/journey" data-chapter-chip="${chapter}" aria-label="${esc(L().journey.chip(name))}">${icon('flag')}<span>${esc(name)}</span></a>`);
  chip.addEventListener('click', () => sfx('tab'));
  document.querySelector('.topbar-end')!.before(chip);
}

function initCoins() {
  const coins = document.getElementById('coins')!;
  const amount = document.getElementById('coin-amount')!;
  coins.title = L().core.currency;
  let shown = store.save.coins;
  amount.textContent = shown.toLocaleString();
  animateNumber(amount, shown, shown);

  on('coins', delta => {
    const d = Number(delta);
    animateNumber(amount, shown, store.save.coins);
    shown = store.save.coins;
    if (!d) return;
    const chip = el(`<span class="coin-delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : '−'}${Math.abs(d).toLocaleString()}</span>`);
    coins.append(chip);
    setTimeout(() => chip.remove(), 1300);
  });
}

/** Header mute button (master mute, independent of the per-channel settings). */
function initMute() {
  const t = L().core.account;
  const button = el<HTMLButtonElement>('<button class="icon-btn mute-btn" type="button"></button>');
  document.querySelector('.menu-wrap')!.before(button);
  const render = () => {
    const muted = isMuted();
    button.innerHTML = icon(muted ? 'mute' : 'volume');
    button.setAttribute('aria-label', muted ? t.unmute : t.mute);
    button.setAttribute('aria-pressed', String(muted));
    button.title = muted ? t.unmute : t.mute;
  };
  button.addEventListener('click', () => {
    toggleMute();
    if (!isMuted()) sfx('toggle');
  });
  onMuteChange(render);
  render();
}

function avatarHTML() {
  const player = store.player;
  if (player?.photo) return `<img class="avatar" src="${esc(player.photo)}" alt="" referrerpolicy="no-referrer">`;
  return icon('user');
}

const otherTrack = () => (currentTrack() === 'journey' ? 'classic' : 'journey');

function initMenu() {
  const t = L().core.account;
  const button = document.getElementById('menu-btn')!;
  const menu = document.getElementById('menu')!;
  button.setAttribute('aria-label', t.menu);

  const render = () => {
    const player = store.player;
    button.innerHTML = `${avatarHTML()}<span class="sync-dot" data-sync="${player?.guest ? 'local' : store.sync}"></span>`;
    menu.innerHTML = `
      <div class="menu-head">
        <span class="menu-avatar">${avatarHTML()}</span>
        <span class="menu-who">
          <b>${esc(player?.guest ? t.guest : player?.name ?? '')}</b>
          ${player && !player.guest ? `<small class="sync-label">${icon('google')} Google</small>` : ''}
          <small class="sync-label" data-sync="${player?.guest ? 'local' : store.sync}">${icon('cloud')} ${esc(t.sync[player?.guest ? 'local' : store.sync])}</small>
        </span>
      </div>
      ${player?.guest && isFirebaseEnabled() ? `<button class="menu-item" type="button" data-act="sign-in">${icon('google')} ${esc(t.signIn)}</button>` : ''}
      <button class="menu-item" type="button" data-act="settings">${icon('gear')} ${esc(t.settings)}</button>
      <button class="menu-item" type="button" data-act="switch-track">${icon('swords')} ${esc(L().journey.track.switchTo(L().journey.track[otherTrack()].name))}</button>
      <div class="menu-item menu-lang" role="group" aria-label="${esc(t.language)}">
        ${icon('globe')}
        <span class="lang-switch">
          ${(['pt', 'en'] as Lang[]).map(l => `<button type="button" data-lang="${l}" aria-pressed="${getLang() === l}">${l === 'pt' ? 'Português' : 'English'}</button>`).join('')}
        </span>
      </div>
      <a class="menu-item" href="https://github.com/brunoengineer" target="_blank" rel="noopener">${icon('github')} ${esc(t.github)}</a>
      <button class="menu-item danger" type="button" data-act="reset">${icon('reset')} ${esc(t.reset)}</button>
      ${player && !player.guest ? `<button class="menu-item" type="button" data-act="sign-out">${icon('logout')} ${esc(t.signOut)}</button>` : ''}`;
  };

  const setOpen = (open: boolean) => {
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) render();
  };

  button.addEventListener('click', () => {
    sfx(menu.hidden ? 'open' : 'close');
    setOpen(menu.hidden !== false);
  });
  // composedPath(): render() replaces the button's contents mid-click, so the target may be detached by now.
  const wrap = button.closest('.menu-wrap')!;
  document.addEventListener('click', event => {
    if (!menu.hidden && !event.composedPath().includes(wrap)) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      button.focus();
    }
  });

  menu.addEventListener('click', async event => {
    const target = event.target as Element;
    const lang = target.closest<HTMLElement>('[data-lang]')?.dataset.lang as Lang | undefined;
    if (lang) return setLang(lang);
    const act = target.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (!act) return;
    setOpen(false);
    if (act === 'settings') openSettings();
    if (act === 'sign-in') void signIn();
    if (act === 'sign-out') void signOut();
    if (act === 'switch-track') {
      const j = L().journey.track;
      const other = otherTrack();
      const ok = await confirmDialog({ title: j.switchTitle(j[other].name), message: j.switchText, confirmText: j.switchConfirm });
      if (ok) void switchTrack(other);
    }
    if (act === 'reset') {
      const ok = await confirmDialog({ title: t.resetTitle, message: t.resetText, confirmText: t.resetConfirm, danger: true });
      if (ok) void resetProgress();
    }
  });

  on('sync', render);
  on('player', render);
  render();
}
