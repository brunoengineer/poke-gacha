// Shared pieces of the Capture screen: the CSS Poké Ball, cost chips, result tags, reveal sounds,
// the "can evolve now" check and the recent-captures history (kept per browser, outside the save).

import { sfx, type SfxName } from '../../audio';
import { itemSprite } from '../../data/items';
import { getSpecies } from '../../data/species';
import { cardKey, parseKey, rarityRank, type CardKey, type Rarity } from '../../game/cards';
import { BANNERS, batchCost, type BannerId, type Payment, type PullResult } from '../../game/gacha';
import { canEvolveNow } from '../../game/progression';
import { fmt, itemName, L } from '../../i18n';
import { store } from '../../state/store';
import { esc, icon } from '../../ui/dom';

/** Item sprite slug for each banner's ball. */
export const BALL_ITEM: Record<BannerId, string> = {
  poke: 'poke-ball',
  safari: 'safari-ball',
  great: 'great-ball',
  ultra: 'ultra-ball',
  master: 'master-ball',
};

export const bannerName = (id: BannerId) => L().capture.banners[id].name;

/** Drawn Poké Ball (themed per banner) whose top half can open. `size` is its width in px. */
export function ballHTML(banner: BannerId, size = 120, className = '') {
  return `
    <span class="pball ${className}" data-ball="${banner}" style="--s:${size}px" aria-hidden="true">
      <span class="pball-top">${banner === 'master' ? '<b class="pball-m">M</b>' : ''}</span>
      <span class="pball-bottom"></span>
      <span class="pball-button"></span>
    </span>`;
}

export const ballSprite = (banner: BannerId, size = 24) =>
  `<img class="ball-sprite" src="${esc(itemSprite(BALL_ITEM[banner]))}" alt="" width="${size}" height="${size}" loading="lazy">`;

/** Cost chip for a batch: coins or ball items. */
export function costHTML(banner: BannerId, count: number, payWith: Payment) {
  const cost = batchCost(banner, count, payWith);
  if (!cost) return '';
  if (cost.tickets) return `<span class="cost">${ballSprite(banner, 20)}${fmt(cost.tickets)}</span>`;
  return `<span class="cost">${icon('coin', 'i-coin')}${fmt(cost.coins)}</span>`;
}

export function costText(banner: BannerId, count: number, payWith: Payment) {
  const cost = batchCost(banner, count, payWith);
  if (!cost) return '';
  return cost.tickets ? L().capture.ballCost(cost.tickets, itemName(BANNERS[banner].ticket!)) : L().core.coins(cost.coins);
}

export const rarityName = (r: Rarity) => L().core.rarity[r];
export const isRarePlus = (r: Rarity) => rarityRank(r) >= rarityRank('rare');
export const isLegendaryPlus = (r: Rarity) => rarityRank(r) >= rarityRank('legendary');

/** True when the copy went to an evolved card of the line (pulled Charmander, leveled Charmeleon). */
export const isRouted = (r: PullResult) => r.key !== cardKey(r.id, r.shiny);

export type TagKind = 'new' | 'level' | 'route' | 'candy';

/** Short label shown under a revealed card: NEW / Lv. 4 → 5 / → Charmeleon / +1 Rare Candy. */
export function resultTag(r: PullResult): { kind: TagKind; text: string; sub?: string } {
  const t = L().capture.pull;
  if (r.kind === 'new') return { kind: 'new', text: t.tagNew };
  if (r.kind === 'max') return { kind: 'candy', text: t.tagCandy };
  if (isRouted(r)) return { kind: 'route', text: t.tagRoute(getSpecies(parseKey(r.key).id).name), sub: t.tagLevel(r.from, r.to) };
  return { kind: 'level', text: t.tagLevel(r.from, r.to) };
}

export function tagHTML(r: PullResult) {
  const tag = resultTag(r);
  const lead = tag.kind === 'candy' ? icon('sparkle') : tag.kind === 'level' ? icon('up') : '';
  return `<span class="cap-tag" data-tag="${tag.kind}">${lead}${esc(tag.text)}${tag.sub ? ` <small>${esc(tag.sub)}</small>` : ''}</span>`;
}

const REVEAL_SFX: Record<Rarity, SfxName> = {
  common: 'reveal',
  uncommon: 'reveal',
  rare: 'revealRare',
  epic: 'revealEpic',
  legendary: 'revealLegendary',
  mythical: 'revealLegendary',
};

export function revealSound(r: PullResult) {
  sfx(REVEAL_SFX[r.rarity]);
  if (r.shiny) sfx('shiny');
}

/** Rarity order for reveals: rarest (and shinies) last. */
export const revealWeight = (r: PullResult) => rarityRank(r.rarity) + (r.shiny ? 10 : 0);

export const bestResult = (results: PullResult[]) =>
  results.reduce((best, r) => (revealWeight(r) > revealWeight(best) ? r : best), results[0]);

/** Light color for a result: gold for shinies, the rarity color otherwise. */
export const SHINY_COLOR = '#ffd86b';

/** Owned cards that can evolve right now. */
export const evolvableKeys = (): Set<CardKey> =>
  new Set(Object.keys(store.save.cards).filter(key => canEvolveNow(store.save, key)));

/** Cards touched by a batch that became evolvable because of it. */
export function newlyEvolvable(results: PullResult[], before: Set<CardKey>): CardKey[] {
  return [...new Set(results.map(r => r.key))].filter(key => !before.has(key) && canEvolveNow(store.save, key));
}

export function evolveHintHTML(keys: CardKey[]) {
  if (!keys.length) return '';
  const t = L().capture.pull;
  const text = keys.length === 1 ? t.canEvolve(getSpecies(parseKey(keys[0]).id).name) : t.canEvolveMany(keys.length);
  return `
    <div class="cap-evolve" role="status">
      ${icon('up')}<span>${esc(text)}</span>
      <a class="btn btn-evolve btn-sm" href="#/collection" data-close-go>${esc(t.seeCollection)}</a>
    </div>`;
}

// --- Recent captures (local to this browser) ------------------------------------

export interface HistoryEntry {
  id: number;
  shiny: boolean;
  isNew: boolean;
}

const HISTORY_KEY = 'pg-capture-history';
const HISTORY_SIZE = 30;

const historyKey = () => `${HISTORY_KEY}-${store.player?.uid ?? 'guest'}`;

export function readHistory(): HistoryEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(historyKey()) ?? '[]');
    return Array.isArray(raw) ? raw.filter(e => e && typeof e.id === 'number').slice(0, HISTORY_SIZE) : [];
  } catch {
    return [];
  }
}

export function pushHistory(results: PullResult[]) {
  // Big batches: keep the most interesting ones (rarest first) so the row isn't 30 Rattata.
  const sorted = results.length > HISTORY_SIZE ? [...results].sort((a, b) => revealWeight(b) - revealWeight(a)) : [...results].reverse();
  const entries = sorted.map(r => ({ id: r.id, shiny: r.shiny, isNew: r.kind === 'new' }));
  const next = [...entries, ...readHistory()].slice(0, HISTORY_SIZE);
  try {
    localStorage.setItem(historyKey(), JSON.stringify(next));
  } catch { /* storage blocked: history stays empty */ }
  return next;
}
