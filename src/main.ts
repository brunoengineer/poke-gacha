// Entry point: loads the Pokédex, starts auth, then shows the login screen or the game.

import './styles/base.css';
import './styles/card.css';
import './styles/login.css';
import './styles/collection.css';
import './styles/capture.css';
import './styles/battle.css';
import './styles/modes.css';
import './styles/settings.css';

import { loadGenerations } from './data/generations';
import { L } from './i18n';
import { maybeOnboard } from './screens/onboarding';
import { bootAuth, on, store } from './state/store';
import { hideLogin, showLogin } from './ui/login';
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
    if (store.phase === 'game') {
      // A guest who signs in gets another save: screens were built for the old one, so start over.
      if (started) {
        if (store.player?.uid !== started) location.reload();
        return;
      }
      started = store.player?.uid ?? 'guest';
      hideLogin();
      startShell();
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
