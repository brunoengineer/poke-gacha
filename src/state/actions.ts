// Game actions used by the screens. Each one applies a rule from src/game/ through update(),
// so the save is persisted and the right events fire.

import { RARE_CANDY } from '../data/items';
import { getItem } from '../data/items';
import { cardKey, type CardKey } from '../game/cards';
import { DAILY_BALL, DECK_SIZE, dailyGift, STARTER_CANDY, STARTER_LEVEL, STARTERS } from '../game/economy';
import { pull as pullCards, type BannerId, type Payment, type PullResult, type Region } from '../game/gacha';
import {
  addItem, evolve as evolveCard, trainAfterBattle, transferLevel as transferCardLevel, transferMany, useCandies as applyCandies,
  type BattleTraining, type EvolveResult, type PlannedTransfer,
} from '../game/progression';
import { applyRewards, type AppliedReward, type Reward } from '../game/rewards';
import {
  deleteSavedTeam, loadSavedTeam, renameSavedTeam, saveCurrentTeam, updateSavedTeam,
} from '../game/saved-teams';
import { dayKey, previousDayKey } from '../game/rng';
import type { Settings } from './save';
import { emit, store, update } from './store';

const s = () => store.save;

// --- Collection ----------------------------------------------------------

export const owned = (key: CardKey) => key in s().cards;
export const level = (key: CardKey) => s().cards[key]?.level ?? 0;

/** Pays and performs captures, optionally from one region (0: all). Returns null when locked or unaffordable. */
export function capture(banner: BannerId, count: number, payWith: Payment = 'coins', region: Region = 0): PullResult[] | null {
  const results = update(save => pullCards(save, banner, count, payWith, undefined, undefined, region), []);
  if (results) {
    // Routed copies (a Charmander leveling Charmeleon) also register the pulled species.
    emit('cards', [...new Set(results.flatMap(r => [r.key, cardKey(r.id, r.shiny)]))]);
    emit('items');
    emit('deck');
  }
  return results;
}

export function useCandies(key: CardKey, amount: number): number {
  return update(save => applyCandies(save, key, amount), ['cards', 'items'], { cards: [key] });
}

export function evolve(key: CardKey, to: number): EvolveResult | null {
  const result = update(save => evolveCard(save, key, to), []);
  if (result) {
    emit('cards', [result.fromKey, result.toKey]);
    emit('items');
    emit('deck');
  }
  return result;
}

/** Applies a batch of level passes ("Pass levels") at once: one save, one refresh. */
export function transferLevels(plan: PlannedTransfer[]): number {
  const done = update(save => transferMany(save, plan), []);
  if (done) {
    emit('cards', plan.flatMap(t => [t.from, cardKey(t.to)]));
    emit('deck');
  }
  return done;
}

export function transferLevel(key: CardKey, to: number): EvolveResult | null {
  const result = update(save => transferCardLevel(save, key, to), []);
  if (result) {
    emit('cards', [result.fromKey, result.toKey]);
    emit('deck');
  }
  return result;
}

// --- Team (deck) -----------------------------------------------------------

export const inDeck = (key: CardKey) => s().deck.includes(key);

/**
 * Adds a card to the team. With `index` on an occupied slot, replaces that slot's card.
 * Returns 'added' | 'replaced' | 'full' | 'duplicate' | 'not-owned'.
 */
export function addToDeck(key: CardKey, index = s().deck.length): 'added' | 'replaced' | 'full' | 'duplicate' | 'not-owned' {
  if (!owned(key)) return 'not-owned';
  if (inDeck(key)) return 'duplicate';
  if (index < s().deck.length) {
    update(save => { save.deck[index] = key; }, ['deck']);
    return 'replaced';
  }
  if (s().deck.length >= DECK_SIZE) return 'full';
  update(save => { save.deck.push(key); }, ['deck']);
  return 'added';
}

export function removeFromDeck(key: CardKey) {
  const index = s().deck.indexOf(key);
  if (index >= 0) update(save => { save.deck.splice(index, 1); }, ['deck']);
}

/** Swaps two slots; an empty destination moves the card to the end. */
export function moveInDeck(from: number, to: number) {
  const deck = s().deck;
  if (from === to || from < 0 || from >= deck.length) return;
  update(save => {
    if (to >= save.deck.length) save.deck.push(...save.deck.splice(from, 1));
    else [save.deck[from], save.deck[to]] = [save.deck[to], save.deck[from]];
  }, ['deck']);
}

export function clearDeck() {
  update(save => { save.deck = []; }, ['deck']);
}

// --- Saved teams (presets; rules in game/saved-teams.ts). They emit 'deck', like every team change. ---

export const saveTeam = (name: string) => update(save => saveCurrentTeam(save, name), ['deck']);
export const overwriteTeam = (id: string) => update(save => updateSavedTeam(save, id), ['deck']);
export const renameTeam = (id: string, name: string) => update(save => renameSavedTeam(save, id, name), ['deck']);
export const deleteTeam = (id: string) => update(save => deleteSavedTeam(save, id), ['deck']);
export const loadTeam = (id: string) => update(save => loadSavedTeam(save, id), ['deck']);

/** Fills empty team slots with the strongest owned cards (used after onboarding and by "Auto team"). */
export function autoFillDeck(score: (key: CardKey) => number) {
  update(save => {
    const candidates = Object.keys(save.cards).filter(key => !save.deck.includes(key)).sort((a, b) => score(b) - score(a));
    while (save.deck.length < DECK_SIZE && candidates.length) save.deck.push(candidates.shift()!);
  }, ['deck']);
}

// --- Rewards, items, economy -------------------------------------------------

export function grant(rewards: Reward[]): AppliedReward[] {
  const applied = update(save => applyRewards(save, rewards), ['items', 'progress']);
  const cards = applied.filter(r => r.copy).flatMap(r => [r.copy!.key, cardKey(r.copy!.id, r.copy!.shiny)]);
  if (cards.length) emit('cards', cards);
  return applied;
}

export function buyItem(item: string, amount = 1): boolean {
  const price = getItem(item).price;
  if (price == null || s().coins < price * amount) return false;
  update(save => {
    save.coins -= price * amount;
    addItem(save, item, amount);
  }, ['items']);
  return true;
}

export const items = (item: string) => s().items[item] ?? 0;
export const candies = () => items(RARE_CANDY);

/** Daily gift, if not claimed today. Returns what was given, or null. */
export function claimDaily(now = new Date()): { coins: number; candy: number; balls: number; streak: number } | null {
  const today = dayKey(now);
  const { last, streak } = s().daily;
  if (last === today) return null;
  const yesterday = previousDayKey(now);
  const nextStreak = last === yesterday ? streak + 1 : 1;
  const gift = dailyGift(nextStreak);
  update(save => {
    save.daily = { last: today, streak: nextStreak };
    applyRewards(save, [
      { kind: 'coins', amount: gift.coins },
      { kind: 'item', item: RARE_CANDY, amount: gift.candy },
      ...(gift.balls ? [{ kind: 'item', item: DAILY_BALL, amount: gift.balls } as Reward] : []),
    ]);
  }, ['items']);
  return { ...gift, streak: nextStreak };
}

export const dailyAvailable = (now = new Date()) => s().daily.last !== dayKey(now);

// --- Onboarding ----------------------------------------------------------------

export function chooseStarter(id: number) {
  if (s().starter != null || !STARTERS.includes(id)) return;
  update(save => {
    const now = Date.now();
    save.starter = id;
    save.cards[cardKey(id)] = { level: STARTER_LEVEL, copies: 1, obtainedAt: now };
    save.caught[id] = now;
    save.deck = [cardKey(id)];
    addItem(save, RARE_CANDY, STARTER_CANDY);
  }, ['cards', 'deck', 'items']);
}

// --- Battles ---------------------------------------------------------------------

/**
 * A Pokémon of the team trains after a battle (not for forfeits): after a win, the one the player picked (+1 level,
 * +2 for a perfect win); after a loss, a random one (+1).
 */
export function trainTeamAfterBattle(result: 'win' | 'lose', perfect: boolean, chosen: CardKey | null = null, team?: CardKey[]): BattleTraining | null {
  const trained = update(save => trainAfterBattle(save, team ?? save.deck, result, perfect, chosen), ['items']);
  if (trained) emit('cards', [trained.key]);
  return trained;
}

/** Records a finished battle in the global stats (modes record their own progress with update()). */
export function recordBattle(result: 'win' | 'lose' | 'draw' | 'forfeit') {
  update(save => {
    save.stats.battles += 1;
    if (result === 'win') save.stats.wins += 1;
    else if (result !== 'draw') save.stats.losses += 1;
  }, ['progress']);
}

// --- Settings ----------------------------------------------------------------------

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  update(save => { save.settings[key] = value; }, ['settings']);
}

export function markSeen(id: string) {
  if (!s().seen[id]) update(save => { save.seen[id] = true; });
}
