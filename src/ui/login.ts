// Login screen: Google sign-in (cloud save) or guest mode, over a field of floating Pokémon sprites.

import { playMusic, sfx, unlockAudio } from '../audio';
import { spriteUrl } from '../data/sprites';
import { speciesList } from '../data/species';
import { getLang, L, setLang, type Lang } from '../i18n';
import { pick } from '../game/rng';
import { isFirebaseEnabled, playAsGuest, signIn, store } from '../state/store';
import { esc, icon } from './dom';

export function showLogin() {
  const root = document.getElementById('login-root')!;
  const t = L().core;
  root.hidden = false;
  document.getElementById('boot')?.remove();

  const floaters = Array.from({ length: 16 }, () => ({
    id: pick(speciesList).id,
    left: Math.random() * 100,
    delay: -Math.random() * 24,
    duration: 16 + Math.random() * 16,
    size: 56 + Math.random() * 72,
  }));

  const loading = store.phase === 'loading';
  root.innerHTML = `
    <div class="login">
      <div class="floaters" aria-hidden="true">
        ${floaters.map(f => `<img src="${esc(spriteUrl(f.id))}" alt="" style="left:${f.left}%;width:${f.size}px;animation-delay:${f.delay}s;animation-duration:${f.duration}s">`).join('')}
      </div>
      <div class="login-card">
        <svg class="i login-ball" aria-hidden="true"><use href="#i-ball-color"></use></svg>
        <h1 class="login-title">Poké <b>Gacha</b></h1>
        <p class="login-tagline">${esc(t.tagline)}</p>
        ${loading ? `<div class="spinner" aria-label="${esc(t.loading)}"></div>` : `
          <button class="btn btn-google btn-lg" type="button" data-act="google" ${isFirebaseEnabled() ? '' : 'disabled'}>${icon('google')} ${esc(t.login.signIn)}</button>
          ${isFirebaseEnabled() ? '' : `<p class="login-note">${esc(t.login.notConfigured)}</p>`}
          <button class="btn btn-ghost" type="button" data-act="guest">${esc(t.login.guest)}</button>
          <p class="login-note">${esc(t.login.guestNote)}</p>`}
        ${store.authError ? `<p class="login-error" role="alert">${esc(store.authError)}</p>` : ''}
        <div class="lang-switch" role="group" aria-label="${esc(t.account.language)}">
          ${(['pt', 'en'] as Lang[]).map(l => `<button type="button" data-lang="${l}" aria-pressed="${getLang() === l}">${l === 'pt' ? 'Português' : 'English'}</button>`).join('')}
        </div>
      </div>
    </div>`;

  root.onclick = event => {
    const target = event.target as Element;
    unlockAudio();
    const lang = target.closest<HTMLElement>('[data-lang]')?.dataset.lang as Lang | undefined;
    if (lang) return setLang(lang);
    const act = target.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act) sfx('click');
    if (act === 'google') void signIn();
    if (act === 'guest') playAsGuest();
  };
  playMusic('title');
}

export function hideLogin() {
  const root = document.getElementById('login-root')!;
  root.hidden = true;
  root.innerHTML = '';
}
