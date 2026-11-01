// Pokédex grid: one tile per loaded species, plus one per owned shiny card. Tiles are created once; filters
// only hide and reorder them, and state changes re-render just the tiles involved.
//
// A species tile shows the owned (non-shiny) card at its level; a species caught before whose card evolved
// away is "registered" (species card, dimmed, with a mark); a species never caught is a locked silhouette.

import { getSpecies, speciesList, type Species } from '../../data/species';
import type { PokemonType } from '../../data/types';
import { cardKey, parseKey, rarity, rarityRank, type CardKey, type Rarity } from '../../game/cards';
import { canEvolveNow } from '../../game/progression';
import { L, locale } from '../../i18n';
import { store } from '../../state/store';
import { cardHTML } from '../../ui/card';
import { esc, icon } from '../../ui/dom';
import { keyPower } from './team';

export type Mode = 'all' | 'owned' | 'missing' | 'evolve' | 'shiny';
export type SortId = 'dex' | 'name' | 'level' | 'power' | 'rarity' | 'recent';
export type TileState = 'owned' | 'registered' | 'locked';

export interface Filters {
  mode: Mode;
  /** Generation id (0: every loaded region). */
  region: number;
  type: PokemonType | '';
  rarities: Rarity[];
  sort: SortId;
  query: string;
}

interface Tile {
  key: CardKey;
  id: number;
  shiny: boolean;
  el: HTMLElement;
  /** Signature of what the card shows, to skip needless re-renders. */
  sig: string;
}

const tiles = new Map<CardKey, Tile>();
let grid: HTMLElement;

const s = () => store.save;
export const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** State of a species in the Pokédex (ignores shiny cards). */
export function speciesState(id: number): TileState {
  if (cardKey(id) in s().cards) return 'owned';
  return s().caught[id] ? 'registered' : 'locked';
}

const tileState = (tile: Tile): TileState => (tile.shiny ? 'owned' : speciesState(tile.id));
export const canEvolveKey = (key: CardKey) => key in s().cards && canEvolveNow(s(), key);

export function mountGrid(container: HTMLElement) {
  grid = container;
  grid.innerHTML = speciesList.map(sp => tileShell(cardKey(sp.id))).join('');
  for (const el of grid.querySelectorAll<HTMLElement>('.dex-tile')) addTile(el);
  syncShinyTiles();
  tiles.forEach(updateTile);
}

function tileShell(key: CardKey) {
  const t = L().collection.tile;
  const name = getSpecies(parseKey(key).id).name;
  return `
    <div class="dex-tile" data-key="${esc(key)}" tabindex="0" role="button">
      <div class="dex-card"></div>
      <span class="dex-team" title="${esc(t.inTeam)}">${icon('check')}</span>
      <span class="dex-shiny-mark" title="${esc(t.shinyOwned)}">${icon('sparkle')}</span>
      <span class="dex-reg">${icon('check')}<span>${esc(t.registered)}</span></span>
      <button class="dex-evolve" type="button" tabindex="-1" aria-label="${esc(t.evolve(name))}" title="${esc(t.evolveShort)}">${icon('up')}</button>
    </div>`;
}

function addTile(el: HTMLElement) {
  const key = el.dataset.key!;
  const { id, shiny } = parseKey(key);
  tiles.set(key, { key, id, shiny, el, sig: '' });
}

/** Creates tiles for shiny cards obtained since the last call. */
export function syncShinyTiles() {
  for (const key of Object.keys(s().cards)) {
    if (!key.endsWith('s') || tiles.has(key)) continue;
    const el = document.createElement('template');
    el.innerHTML = tileShell(key).trim();
    const node = el.content.firstElementChild as HTMLElement;
    addTile(node);
    updateTile(tiles.get(key)!);
  }
}

function updateTile(tile: Tile) {
  const t = L().collection.tile;
  const save = s();
  const state = tileState(tile);
  const card = save.cards[tile.key];
  const level = card?.level;
  const sig = `${state}|${level ?? ''}`;
  const { el } = tile;
  if (sig !== tile.sig) {
    tile.sig = sig;
    const view = state === 'owned'
      ? { id: tile.id, shiny: tile.shiny, level }
      : state === 'registered' ? { id: tile.id } : { id: tile.id, locked: true };
    el.querySelector('.dex-card')!.innerHTML = cardHTML(view, { size: 'sm' });
  }
  const evolvable = state === 'owned' && canEvolveKey(tile.key);
  el.dataset.state = state;
  el.classList.toggle('in-team', save.deck.includes(tile.key));
  el.classList.toggle('evolvable', evolvable);
  el.classList.toggle('has-shiny', !tile.shiny && cardKey(tile.id, true) in save.cards);

  const sp = getSpecies(tile.id);
  const name = state === 'locked' ? `${L().core.card.dex(sp.id)}, ${L().core.card.notCaught}` : sp.name;
  const parts = [name];
  if (tile.shiny) parts.push(L().core.card.shiny);
  if (level != null) parts.push(L().core.card.levelFull(level));
  if (state === 'registered') parts.push(t.registered);
  if (el.classList.contains('in-team')) parts.push(t.inTeam);
  if (evolvable) parts.push(t.canEvolve);
  el.setAttribute('aria-label', parts.join(', '));
}

/** Re-renders the tiles of these card keys (and their species tiles), or all tiles. */
export function updateTiles(keys?: CardKey[]) {
  syncShinyTiles();
  if (!keys) return tiles.forEach(updateTile);
  const ids = new Set(keys.map(key => parseKey(key).id));
  for (const tile of tiles.values()) {
    if (ids.has(tile.id) || keys.includes(tile.key)) updateTile(tile);
  }
}

/** Team membership and "can evolve" depend on the team and items: cheap class updates for every tile. */
export function updateFlags() {
  const save = s();
  for (const tile of tiles.values()) {
    const owned = tile.key in save.cards;
    tile.el.classList.toggle('in-team', save.deck.includes(tile.key));
    tile.el.classList.toggle('evolvable', owned && canEvolveNow(save, tile.key));
  }
}

// --- Filtering and sorting --------------------------------------------------------

function matches(tile: Tile, f: Filters, sp: Species): boolean {
  if ((f.mode === 'shiny') !== tile.shiny) return false;
  if (f.region && sp.generation !== f.region) return false;
  const state = tileState(tile);
  if (f.mode === 'owned' && state !== 'owned') return false;
  if (f.mode === 'missing' && state !== 'locked') return false;
  if (f.mode === 'evolve' && !(state === 'owned' && canEvolveKey(tile.key))) return false;
  if (f.type && !sp.types.includes(f.type)) return false;
  if (f.rarities.length && !f.rarities.includes(rarity(tile.id))) return false;
  if (f.query) {
    const q = f.query.replace(/^#|^n[ºo°]\s*/, '');
    const byNumber = /^\d+$/.test(q) && String(sp.id).startsWith(String(Number(q)));
    if (!byNumber && !normalize(sp.name).includes(q)) return false;
  }
  return true;
}

function sortValue(tile: Tile, sort: SortId): number {
  const card = s().cards[tile.key];
  switch (sort) {
    case 'level': return card?.level ?? -1;
    case 'power': return card ? keyPower(tile.key) : -1;
    case 'rarity': return rarityRank(rarity(tile.id));
    case 'recent': return card?.obtainedAt ?? (s().caught[tile.id] && !tile.shiny ? s().caught[tile.id] / 10 : -1);
    default: return 0;
  }
}

/** Applies filters and sort. Returns the visible card keys, in order. */
export function applyFilters(f: Filters): CardKey[] {
  const collator = new Intl.Collator(locale());
  const list = [...tiles.values()]
    .filter(tile => matches(tile, f, getSpecies(tile.id)))
    .map(tile => ({ tile, value: sortValue(tile, f.sort) }));
  list.sort((a, b) => {
    if (f.sort === 'name') return collator.compare(getSpecies(a.tile.id).name, getSpecies(b.tile.id).name) || a.tile.id - b.tile.id;
    return b.value - a.value || a.tile.id - b.tile.id;
  });
  grid.replaceChildren(...list.map(({ tile }) => tile.el));
  return list.map(({ tile }) => tile.key);
}

// --- Counts -----------------------------------------------------------------------

export function counts(region: number) {
  const save = s();
  const species = speciesList.filter(sp => !region || sp.generation === region);
  const caught = species.filter(sp => save.caught[sp.id]).length;
  const shinies = Object.keys(save.cards).filter(key => key.endsWith('s') && (!region || getSpecies(parseKey(key).id).generation === region)).length;
  const evolvable = Object.keys(save.cards).filter(key => canEvolveNow(save, key)).length;
  return { total: species.length, caught, shinies, evolvable, cards: Object.keys(save.cards).length };
}
