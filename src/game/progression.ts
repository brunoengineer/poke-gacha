// Card progression rules, as pure functions over SaveData (they mutate the save they are given).
//
//   - New species -> new card at Lv. 1 (evolved forms and legendaries too).
//   - Duplicate -> +1 level. If the player evolved this species away (their Charmander became a Charmeleon), later
//     copies go to that evolved card instead, so evolving never stalls a line. Owning an evolved form obtained directly
//     (a pulled Arbok) doesn't count: the next Ekans becomes an Ekans card of its own.
//   - Duplicate of a capped card -> Rare Candy.
//   - Evolving is optional; it keeps the level (clamped to the new form's cap) and consumes any required item.
//   - When an evolved form is already owned, the card can pass its level to it instead (no level or item needed):
//     both merge into the evolved card and the old species stays registered.

import { RARE_CANDY } from '../data/items';
import { descendants, evolutionsOf, getSpecies, type Evolution } from '../data/species';
import type { SaveData } from '../state/save';
import { cardKey, levelCap, parseKey, requiredItem, requiredLevel, startLevel, type CardKey } from './cards';
import { OVERFLOW_CANDY } from './economy';

export interface CopyResult {
  /** Species and shininess that was obtained. */
  id: number;
  shiny: boolean;
  /** Card that received the copy (differs from the obtained species when routed up the line). */
  key: CardKey;
  kind: 'new' | 'level' | 'max';
  /** Level before / after (before is 0 for new cards). */
  from: number;
  to: number;
  /** True when this species entered the Pokédex for the first time. */
  newSpecies: boolean;
}

export const owns = (save: SaveData, key: CardKey) => key in save.cards;
export const levelOf = (save: SaveData, key: CardKey) => save.cards[key]?.level ?? 0;

export function addItem(save: SaveData, item: string, amount = 1) {
  const value = (save.items[item] ?? 0) + amount;
  if (value > 0) save.items[item] = value;
  else delete save.items[item];
}

export const itemCount = (save: SaveData, item: string) => save.items[item] ?? 0;

function registerCaught(save: SaveData, id: number, now: number): boolean {
  if (save.caught[id]) return false;
  save.caught[id] = now;
  return true;
}

/** Applies one obtained copy of a species (from a pull or a reward). */
export function addCopy(save: SaveData, id: number, shiny = false, now = Date.now()): CopyResult {
  const newSpecies = registerCaught(save, id, now);
  if (shiny) save.stats.shinies += 1;

  let key = cardKey(id, shiny);
  if (!owns(save, key) && !shiny && save.evolved[id]) {
    const evolved = descendants(id).map(d => cardKey(d)).find(k => owns(save, k));
    if (evolved) key = evolved;
  }

  const card = save.cards[key];
  if (!card) {
    const level = startLevel(id);
    save.cards[key] = { level, copies: 1, obtainedAt: now };
    return { id, shiny, key, kind: 'new', from: 0, to: level, newSpecies };
  }

  card.copies += 1;
  const cap = levelCap(parseKey(key).id, shiny);
  if (card.level >= cap) {
    addItem(save, RARE_CANDY, OVERFLOW_CANDY);
    return { id, shiny, key, kind: 'max', from: card.level, to: card.level, newSpecies };
  }
  card.level += 1;
  return { id, shiny, key, kind: 'level', from: card.level - 1, to: card.level, newSpecies };
}

/** How many Rare Candies can still be used on a card (Infinity for uncapped cards). */
export function candyRoom(save: SaveData, key: CardKey): number {
  const card = save.cards[key];
  if (!card) return 0;
  const { id, shiny } = parseKey(key);
  return Math.max(0, levelCap(id, shiny) - card.level);
}

/** Raises a card by up to `levels`; levels past its cap become Rare Candy. */
export function addLevels(save: SaveData, key: CardKey, levels: number): { from: number; to: number; candy: number } {
  const card = save.cards[key];
  const from = card.level;
  const gained = Math.min(levels, candyRoom(save, key));
  card.level += gained;
  const candy = levels - gained;
  if (candy) addItem(save, RARE_CANDY, candy);
  return { from, to: card.level, candy };
}

/** Levels a random team member gets after a battle (forfeits get nothing). */
export const BATTLE_LEVELS = { win: 1, perfect: 2, lose: 1 } as const;

export interface BattleTraining {
  key: CardKey;
  levels: number;
  from: number;
  to: number;
  /** Levels that turned into Rare Candy because the card was at its cap. */
  candy: number;
}

/**
 * After a battle, one Pokémon of the team trains: after a win the player picks it (`chosen`) and it gets +1 level
 * (+2 for a perfect win); after a loss a random one gets +1.
 */
export function trainAfterBattle(
  save: SaveData, team: CardKey[], result: 'win' | 'lose', perfect: boolean, chosen: CardKey | null = null, rng: () => number = Math.random,
): BattleTraining | null {
  const keys = team.filter(key => save.cards[key]);
  if (!keys.length) return null;
  const key = result === 'win' && chosen && keys.includes(chosen) ? chosen : keys[Math.floor(rng() * keys.length)];
  const levels = result === 'win' ? (perfect ? BATTLE_LEVELS.perfect : BATTLE_LEVELS.win) : BATTLE_LEVELS.lose;
  return { key, levels, ...addLevels(save, key, levels) };
}

/** Uses up to `amount` Rare Candies on a card. Returns how many were used. */
export function useCandies(save: SaveData, key: CardKey, amount: number): number {
  const used = Math.max(0, Math.min(Math.floor(amount), itemCount(save, RARE_CANDY), candyRoom(save, key)));
  if (!used) return 0;
  save.cards[key].level += used;
  addItem(save, RARE_CANDY, -used);
  save.stats.candiesUsed += used;
  return used;
}

export interface EvolutionOption {
  evolution: Evolution;
  to: number;
  /** Level needed (null when the evolution is item-based). */
  level: number | null;
  /** Item consumed (stone, Link Cable…), or null. */
  item: string | null;
  ready: boolean;
  /** Why it isn't ready yet. */
  missing: { level?: number; item?: string };
}

/** Evolutions available to a card. Shiny cards never evolve. */
export function evolutionOptions(save: SaveData, key: CardKey): EvolutionOption[] {
  const card = save.cards[key];
  const { id, shiny } = parseKey(key);
  if (!card || shiny) return [];
  return evolutionsOf(id).map(evolution => {
    const level = requiredLevel(evolution);
    const item = requiredItem(evolution);
    const missing: EvolutionOption['missing'] = {};
    if (level != null && card.level < level) missing.level = level;
    if (item && itemCount(save, item) < 1) missing.item = item;
    return { evolution, to: evolution.to, level, item, ready: !missing.level && !missing.item, missing };
  });
}

export const canEvolveNow = (save: SaveData, key: CardKey) => evolutionOptions(save, key).some(o => o.ready);

export interface EvolveResult {
  from: number;
  to: number;
  fromKey: CardKey;
  toKey: CardKey;
  /** Level before evolving, and after (clamped to the new cap, +1 when merged into an owned card). */
  levelBefore: number;
  level: number;
  /** The evolved species was already owned: both cards merged into one. */
  merged: boolean;
  item: string | null;
  newSpecies: boolean;
}

/** Level the card would have after evolving (for confirmation dialogs). */
export function previewEvolution(save: SaveData, key: CardKey, to: number): { level: number; merged: boolean; clamped: boolean } {
  const card = save.cards[key];
  const target = save.cards[cardKey(to)];
  const cap = levelCap(to, false);
  const raw = target ? Math.max(card.level, target.level) + 1 : card.level;
  return { level: Math.min(cap, raw), merged: !!target, clamped: raw > cap };
}

export function evolve(save: SaveData, key: CardKey, to: number, now = Date.now()): EvolveResult | null {
  const option = evolutionOptions(save, key).find(o => o.to === to);
  if (!option?.ready) return null;
  if (option.item) addItem(save, option.item, -1);
  save.stats.evolutions += 1;
  return { ...replaceCard(save, key, to, now), item: option.item };
}

/** Owned evolved forms (any stage) a card can pass its level to, with no level or item needed. Never for shinies. */
export function transferTargets(save: SaveData, key: CardKey): number[] {
  const { id, shiny } = parseKey(key);
  if (!save.cards[key] || shiny) return [];
  return descendants(id).filter(d => owns(save, cardKey(d)));
}

/**
 * Optional alternative to evolving when the evolved card is already owned (a Lv. 27 Nidorino and a Lv. 1 Nidoking):
 * the cards merge into the evolved one, as if evolved, and the old one stays registered in the Pokédex.
 */
export function transferLevel(save: SaveData, key: CardKey, to: number, now = Date.now()): EvolveResult | null {
  if (!transferTargets(save, key).includes(to)) return null;
  return { ...replaceCard(save, key, to, now), item: null };
}

/** Turns card `key` into species `to`, merging into its card when owned. Shared by evolve() and transferLevel(). */
function replaceCard(save: SaveData, key: CardKey, to: number, now: number): Omit<EvolveResult, 'item'> {
  const card = save.cards[key];
  const { id } = parseKey(key);
  const toKey = cardKey(to);
  const { level, merged } = previewEvolution(save, key, to);

  const target = save.cards[toKey];
  save.cards[toKey] = {
    level,
    copies: card.copies + (target?.copies ?? 0),
    obtainedAt: target?.obtainedAt ?? now,
  };
  delete save.cards[key];

  // The team keeps the evolved card in the same slot (and drops the duplicate slot when merging).
  const slot = save.deck.indexOf(key);
  if (slot >= 0) {
    if (save.deck.includes(toKey)) save.deck.splice(slot, 1);
    else save.deck[slot] = toKey;
  }

  const newSpecies = registerCaught(save, to, now);
  save.evolved[id] = now;
  return { from: id, to, fromKey: key, toKey, levelBefore: card.level, level, merged, newSpecies };
}

/** Name helper for logs and tests. */
export const describeKey = (key: CardKey) => {
  const { id, shiny } = parseKey(key);
  return `${getSpecies(id).name}${shiny ? ' ★' : ''}`;
};
