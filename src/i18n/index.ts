// Localization. `L()` returns the current language bundle: L().core.nav.capture, L().capture.pulled(3)…
// Each feature owns one namespace file per language (src/i18n/pt/<ns>.ts and en/<ns>.ts, same keys).
// Pokémon names are the same in both languages (the Brazilian games use the English names).

import { getItem } from '../data/items';
import { getSpecies } from '../data/species';
import enAudio from './en/audio';
import enBattle from './en/battle';
import enCapture from './en/capture';
import enCollection from './en/collection';
import enCore from './en/core';
import enJourney from './en/journey';
import enModes from './en/modes';
import ptAudio from './pt/audio';
import ptBattle from './pt/battle';
import ptCapture from './pt/capture';
import ptCollection from './pt/collection';
import ptCore from './pt/core';
import ptJourney from './pt/journey';
import ptModes from './pt/modes';

export type Lang = 'pt' | 'en';

const BUNDLES = {
  pt: { core: ptCore, collection: ptCollection, capture: ptCapture, battle: ptBattle, modes: ptModes, audio: ptAudio, journey: ptJourney },
  en: { core: enCore, collection: enCollection, capture: enCapture, battle: enBattle, modes: enModes, audio: enAudio, journey: enJourney },
};

export type Bundle = (typeof BUNDLES)['pt'];

const LANG_KEY = 'pg-lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'pt' || saved === 'en') return saved;
  } catch { /* storage blocked */ }
  return typeof navigator !== 'undefined' && !navigator.language.toLowerCase().startsWith('pt') ? 'en' : 'pt';
}

let lang: Lang = typeof window === 'undefined' ? 'pt' : detect();

export const L = (): Bundle => BUNDLES[lang];
export const getLang = () => lang;
export const locale = () => (lang === 'pt' ? 'pt-BR' : 'en-US');

/** Switches language and reloads the page (every screen re-renders in the new language). */
export function setLang(next: Lang) {
  if (next === lang) return;
  try { localStorage.setItem(LANG_KEY, next); } catch { /* storage blocked */ }
  lang = next;
  location.reload();
}

export const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString(locale()) : '∞');
export const speciesName = (id: number) => getSpecies(id).name;
export const itemName = (id: string) => getItem(id).name[lang];
export const itemDescription = (id: string) => getItem(id).description[lang];
