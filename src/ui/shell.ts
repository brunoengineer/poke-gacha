// App shell: header (tabs, Pokédollars, account menu) and hash routing between the top-level screens.
// Routes: #/collection, #/capture, #/battle[/<mode>]. Screens implement ViewModule (src/screens/types.ts).

import { isMuted, onMuteChange, playMusic, sfx, toggleMute, unlockAudio } from '../audio';
import { getLang, L, setLang, type Lang } from '../i18n';
import { battleView } from '../screens/battle';
import { captureView } from '../screens/capture';
import { collectionView } from '../screens/collection';
import type { ViewModule } from '../screens/types';
import { isFirebaseEnabled, on, resetProgress, signIn, signOut, store } from '../state/store';
import { animateNumber, confirmDialog, el, esc, icon } from './dom';
import { openSettings } from './settings';

const VIEWS: Record<string, { module: ViewModule; icon: string; label: () => string }> = {
  collection: { module: collectionView, icon: 'cards', label: () => L().core.nav.collection },
  capture: { module: captureView, icon: 'ball', label: () => L().core.nav.capture },
  battle: { module: battleView, icon: 'swords', label: () => L().core.nav.battle },
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

  initCoins();
  initMute();
  initMenu();
  document.addEventListener('pointerdown', unlockAudio, { capture: true });
  document.addEventListener('keydown', unlockAudio, { capture: true });

  route();
  addEventListener('hashchange', route);
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
    if (act === 'reset') {
      const ok = await confirmDialog({ title: t.resetTitle, message: t.resetText, confirmText: t.resetConfirm, danger: true });
      if (ok) void resetProgress();
    }
  });

  on('sync', render);
  on('player', render);
  render();
}
