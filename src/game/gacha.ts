// Captures (the gacha). Each ball is a banner with its own odds. Weights come from the species' catch rate and
// evolution stage, so commons (Rattata, Pidgey) show up constantly, evolved forms are rarer, and legendaries
// are a real event. Works for any generation without hand-tuned tables.
// In a Region Journey chapter every capture comes from that region, whatever region the screen asks for (captureRegion).

import { getSpecies, speciesList, stage, type Species } from '../data/species';
import type { SaveData } from '../state/save';
import { parseKey, rarity, rarityRank, type Rarity } from './cards';
import { DECK_SIZE, UNLOCK_BADGES } from './economy';
import { capturable, capturePool, captureRegion, isJourney, playerCanUse } from './journey';
import { addCopy, itemCount, addItem, type CopyResult } from './progression';
import { dayKey, defaultRng, hashString, seeded, shuffle, weightedPick, type Rng } from './rng';

export type BannerId = 'poke' | 'safari' | 'great' | 'ultra' | 'master';

export interface BannerDef {
  id: BannerId;
  /** Price per capture in Pokédollars (null: only with the ball item). */
  cost: number | null;
  /** Item that pays for one capture on this banner. */
  ticket?: string;
  /** Batch sizes offered. */
  counts: number[];
  shinyRate: number;
  /** Badges needed to use it. */
  badges: number;
  /** Every `every`-th capture without a card of `min` rarity or better guarantees one. */
  pity?: { every: number; min: Rarity };
  weight: (s: Species) => number;
}

const STAGE_POKE = [1, 0.25, 0.06];
const STAGE_GREAT = [1, 0.45, 0.15];
const STAGE_ULTRA = [1, 0.8, 0.45];
const stageMult = (table: number[], s: Species) => table[Math.min(stage(s.id), 3) - 1];

function special(s: Species, legendary: number, mythical: number): number | null {
  if (s.mythical) return mythical;
  if (s.legendary) return legendary;
  return null;
}

export const BANNERS: Record<BannerId, BannerDef> = {
  poke: {
    id: 'poke',
    cost: 5,
    counts: [1, 10, 100],
    shinyRate: 1 / 512,
    badges: 0,
    weight: s => special(s, 0.35, 0.1) ?? s.captureRate * stageMult(STAGE_POKE, s),
  },
  safari: {
    id: 'safari',
    cost: 15,
    counts: [1, 10, 50],
    shinyRate: 1 / 400,
    badges: 0,
    // Featured families are added on top by roll() (see SAFARI_FEATURED_CHANCE).
    weight: s => special(s, 0, 0) ?? s.captureRate * stageMult(STAGE_POKE, s),
  },
  great: {
    id: 'great',
    cost: 50,
    ticket: 'great-ball',
    counts: [1, 10],
    shinyRate: 1 / 256,
    badges: UNLOCK_BADGES.great,
    pity: { every: 10, min: 'rare' },
    weight: s => special(s, 0.6, 0.2) ?? s.captureRate ** 0.6 * stageMult(STAGE_GREAT, s),
  },
  ultra: {
    id: 'ultra',
    cost: 150,
    ticket: 'ultra-ball',
    counts: [1, 10],
    shinyRate: 1 / 128,
    badges: UNLOCK_BADGES.ultra,
    pity: { every: 10, min: 'epic' },
    weight: s => special(s, 1.5, 0.5) ?? s.captureRate ** 0.3 * stageMult(STAGE_ULTRA, s),
  },
  master: {
    id: 'master',
    cost: null,
    ticket: 'master-ball',
    counts: [1],
    shinyRate: 1 / 32,
    badges: 0,
    weight: s => special(s, 2, 1) ?? 0,
  },
};

export const BANNER_ORDER: BannerId[] = ['poke', 'safari', 'great', 'ultra', 'master'];

/** Share of Safari captures that come from today's featured families. */
export const SAFARI_FEATURED_CHANCE = 0.4;
export const SAFARI_FAMILIES = 3;

/**
 * Region filter for captures: a generation id (1 = Kanto, 2 = Johto…), or 0 for every region.
 * A species belongs to the generation that introduced it (Pikachu is Kanto, Pichu is Johto).
 */
export type Region = number;
const inRegion = (s: Species, region: Region) => !region || s.generation === region;

/** Today's featured families for the Safari banner (same for every player on the same day). Base species ids. */
export function safariFeatured(day = dayKey(), picked: Region = 0): number[] {
  const region = captureRegion(picked);
  const rng = seeded(hashString(region ? `safari:${day}:${region}` : `safari:${day}`));
  const open = new Set(capturePool().map(s => s.id));
  const bases = speciesList.filter(s => stage(s.id) === 1 && !s.legendary && !s.mythical && inRegion(s, region) && open.has(s.id));
  const out: number[] = [];
  const families = new Set<number>();
  for (const s of shuffle(bases, rng)) {
    if (families.has(s.family)) continue;
    families.add(s.family);
    out.push(s.id);
    if (out.length === SAFARI_FAMILIES) break;
  }
  return out;
}

// Keyed by the region's generation, which callers resolve first (captureRegion), so a chapter can't get another's table.
const tables = new Map<string, [number, number][]>();

function table(banner: BannerDef, region: Region = 0, filter?: (s: Species) => boolean): [number, number][] {
  const open = banner.id === 'master' ? speciesList : capturePool();
  const id = `${banner.id}:${region}:${speciesList.length}:${open.length}`;
  if (!filter && tables.has(id)) return tables.get(id)!;
  const entries = open
    .filter(s => inRegion(s, region) && (!filter || filter(s)))
    .map(s => [s.id, banner.weight(s)] as [number, number])
    .filter(([, w]) => w > 0);
  if (!filter) tables.set(id, entries);
  return entries;
}

/** Probability of each species on a banner (for the odds screen). */
export function bannerOdds(id: BannerId, region: Region = 0): { id: number; chance: number }[] {
  const entries = table(BANNERS[id], captureRegion(region));
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  return entries.map(([species, w]) => ({ id: species, chance: w / total })).sort((a, b) => b.chance - a.chance);
}

/** Chance of each rarity on a banner (ignores Safari's featured boost and pity). */
export function rarityOdds(id: BannerId, region: Region = 0): Record<Rarity, number> {
  const out = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythical: 0 } as Record<Rarity, number>;
  for (const { id: species, chance } of bannerOdds(id, region)) out[rarity(species)] += chance;
  return out;
}

export interface Roll {
  id: number;
  shiny: boolean;
}

export function roll(bannerId: BannerId, rng: Rng = defaultRng, opts: { minRarity?: Rarity; featured?: number[]; region?: Region } = {}): Roll {
  const banner = BANNERS[bannerId];
  const region = captureRegion(opts.region ?? 0);
  let entries: [number, number][];
  if (opts.minRarity) {
    const min = rarityRank(opts.minRarity);
    entries = table(banner, region, s => rarityRank(rarity(s.id)) >= min);
  } else if (bannerId === 'safari' && rng() < SAFARI_FEATURED_CHANCE) {
    const families = new Set((opts.featured ?? safariFeatured(dayKey(), region)).map(id => getSpecies(id).family));
    entries = speciesList
      .filter(s => families.has(s.family) && inRegion(s, region) && capturable(s.id))
      .map(s => [s.id, stageMult(STAGE_POKE, s)] as [number, number]);
  } else {
    entries = table(banner, region);
  }
  if (!entries.length) entries = table(banner, region);
  if (!entries.length) entries = table(banner);
  return { id: weightedPick(entries, rng), shiny: rng() < banner.shinyRate };
}

export interface PullResult extends CopyResult {
  banner: BannerId;
  rarity: Rarity;
}

export type Payment = 'coins' | 'ticket';

export function canUseBanner(save: SaveData, id: BannerId) {
  return save.gyms.badges.length >= BANNERS[id].badges;
}

/**
 * Region Journey's prices, by batch size: coins carry over between chapters, so captures have to cost real money or the
 * next region gets bought on arrival. A ×10 is a bundle, except for the Poké Ball, the one that fills a Pokédex cheapest.
 */
const JOURNEY_PRICES: Partial<Record<BannerId, Record<number, number>>> = {
  poke: { 1: 50, 10: 500 },
  safari: { 1: 100, 10: 800 },
  great: { 1: 150, 10: 1200 },
  ultra: { 1: 250, 10: 2000 },
};

/** Batch sizes a banner offers now. */
export function bannerCounts(id: BannerId): number[] {
  const prices = isJourney() ? JOURNEY_PRICES[id] : undefined;
  return prices ? Object.keys(prices).map(Number) : BANNERS[id].counts;
}

/** Cost of a batch, or null when it can't be paid that way. */
export function batchCost(id: BannerId, count: number, payWith: Payment): { coins: number; tickets: number } | null {
  const banner = BANNERS[id];
  if (payWith === 'ticket') return banner.ticket ? { coins: 0, tickets: count } : null;
  if (isJourney()) {
    const coins = JOURNEY_PRICES[id]?.[count];
    return coins == null ? null : { coins, tickets: 0 };
  }
  return banner.cost == null ? null : { coins: banner.cost * count, tickets: 0 };
}

/**
 * Battles need six cards and are the way to earn coins, so at these prices a player could spend their way out of the game.
 * Tops them up to one Poké Ball whenever they have too few cards here and can't buy one (mutates the save).
 */
export function rescueBrokePlayer(save: SaveData) {
  if (!isJourney()) return;
  const price = batchCost('poke', 1, 'coins')!.coins;
  const usable = Object.keys(save.cards).filter(key => playerCanUse(parseKey(key).id)).length;
  if (usable < DECK_SIZE && save.coins < price) save.coins = price;
}

export function canAfford(save: SaveData, id: BannerId, count: number, payWith: Payment): boolean {
  const cost = batchCost(id, count, payWith);
  if (!cost) return false;
  const banner = BANNERS[id];
  return save.coins >= cost.coins && (!cost.tickets || itemCount(save, banner.ticket!) >= cost.tickets);
}

/**
 * Pays for and performs `count` captures, applying every copy to the save.
 * Returns null when the banner is locked or the player can't pay. `region` limits captures to one region (0: all); in a
 * Journey chapter safariFeatured() and roll() replace it with the chapter's.
 */
export function pull(
  save: SaveData, id: BannerId, count: number, payWith: Payment, rng: Rng = defaultRng, now = Date.now(), region: Region = 0,
): PullResult[] | null {
  if (!canUseBanner(save, id) || !canAfford(save, id, count, payWith)) return null;
  const banner = BANNERS[id];
  const cost = batchCost(id, count, payWith)!;
  save.coins -= cost.coins;
  if (cost.tickets) addItem(save, banner.ticket!, -cost.tickets);

  const featured = id === 'safari' ? safariFeatured(dayKey(new Date(now)), region) : undefined;
  const results: PullResult[] = [];
  for (let i = 0; i < count; i++) {
    let minRarity: Rarity | undefined;
    if (banner.pity && (save.pity[id] ?? 0) + 1 >= banner.pity.every) minRarity = banner.pity.min;
    const { id: species, shiny } = roll(id, rng, { minRarity, featured, region });
    const r = rarity(species);
    if (banner.pity) save.pity[id] = rarityRank(r) >= rarityRank(banner.pity.min) ? 0 : (save.pity[id] ?? 0) + 1;
    results.push({ ...addCopy(save, species, shiny, now), banner: id, rarity: r });
  }
  save.stats.pulls += count;
  return results;
}
