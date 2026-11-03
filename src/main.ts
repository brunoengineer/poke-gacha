// Entry point: loads the Pokédex, starts auth, then shows the login screen or the game.

import './styles/base.css';
import './styles/card.css';
import './styles/login.css';
import './styles/collection.css';
import './styles/capture.css';
import './styles/battle.css';
import './styles/modes.css';
import './styles/settings.css';
import './styles/journey.css';

import { loadGenerations } from './data/generations';
import { L } from './i18n';
import { maybeOnboard } from './screens/onboarding';
import { bootAuth, on, store } from './state/store';
import { hideLogin, showLogin } from './ui/login';
import { toast } from './ui/dom';
import { initLeaderboardSync } from './state/leaderboard';
import { startShell } from './ui/shell';

/** Player the game screens were started for (null until the game starts). */
let started: string | null = null;

async function boot() {
  try {
    await loadGenerations();
  } catch (error) {
    console.error('Could not load the Pokédex', error);
    document.getElementById('boot')!.innerHTML = `<p>${L().core.loadError}</p>`;
    return;
  }

  on('phase', () => {
    if (started) {
      // Signing in from the game menu: the login screen isn't visible, so report progress and errors here.
      if (store.phase === 'loading') toast(L().core.login.connecting, 'info', 15_000);
      if (store.authError) {
        toast(store.authError, 'error', 12_000);
        store.authError = null;
      }
    }
    if (store.phase === 'game') {
      // A guest who signs in gets another save: screens were built for the old one, so start over.
      if (started) {
        if (store.player?.uid !== started) location.reload();
        return;
      }
      started = store.player?.uid ?? 'guest';
      hideLogin();
      startShell();
      initLeaderboardSync();
      void maybeOnboard();
    } else if (!started && (store.phase === 'login' || store.phase === 'loading')) {
      showLogin();
    }
  });
  bootAuth();
  registerServiceWorker();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && import.meta.env.PROD) {
    navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Service worker not registered:', error));
  }
}

void boot();
