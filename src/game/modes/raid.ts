// Legendary Battle: pay a high fee to fight a random legendary or mythical Pokémon of the chosen region. The boss is one
// Pokémon with huge HP that keeps its damage as the player's six fight it in turn, and hits normally, but one hit can
// never take more than RAID_MAX_HIT of a Pokémon's max HP (critical hits included), so it never knocks one out at once.
//   - Each region opens with that region's League title. Levels are fixed per region until the team's average passes them.
//   - The fee pays for the attempt: a loss, a forfeit or leaving mid-battle keeps nothing (battles aren't saved).
//   - Each win pays coins and Rare Candy, then rolls for the boss: 1% shiny, 10% the normal card. RAID_PITY wins in a row
//     in a region with neither guarantee the normal card. A boss the player already owns gives a Master Ball instead.

import { getSpecies, speciesList } from '../../data/species';
import type { SaveData } from '../../state/save';
import { toBattleCard, type BattleCard } from '../battle';
import { cardKey } from '../cards';
import { DECK_SIZE } from '../economy';
import { REGION_IDS, regionGeneration, type RegionId } from '../regions';
import type { Reward } from '../rewards';
import { defaultRng, pick, type Rng } from '../rng';
import type { PlayerScale } from '../scaling';
import { leagueRecord } from './league';

export interface RaidRecord {
  wins: number;
  losses: number;
  /** Wins since the last catch (duplicates count as a catch). */
  sinceCatch: number;
}

/** Progress per region (optional: absent until the region's first battle). */
export type RaidSave = Partial<Record<RegionId, RaidRecord>>;

export const defaultRaidSave = (): RaidSave => ({});

export const RAID_FEES: Record<RegionId, number> = { kanto: 3000, johto: 6000, hoenn: 10000, sinnoh: 15000 };
const RAID_LEVELS: Record<RegionId, number> = { kanto: 70, johto: 100, hoenn: 120, sinnoh: 140 };
/** Boss HP, times a normal Pokémon's of its species and level. */
export const RAID_HP_MULT = 6;
/** The most one boss hit can take, as a share of the target's max HP. */
export const RAID_MAX_HIT = 0.4;
export const RAID_CATCH_CHANCE = 0.1;
export const RAID_SHINY_CHANCE = 0.01;
export const RAID_PITY = 15;
const WIN_CANDY: Record<RegionId, number> = { kanto: 10, johto: 20, hoenn: 30, sinnoh: 40 };
/** Share of the fee a win gives back. */
const WIN_REFUND = 0.25;

/** A region's progress, read-only. */
export const raidRecord = (save: Pick<SaveData, 'raid'>, region: RegionId): RaidRecord =>
  ({ wins: 0, losses: 0, sinceCatch: 0, ...save.raid[region] });

/** The bosses a region can send: all its legendaries and mythicals. */
export const raidPool = (region: RegionId) =>
  speciesList.filter(s => s.generation === regionGeneration(region) && (s.legendary || s.mythical));

export const raidUnlocked = (save: Pick<SaveData, 'league'>, region: RegionId) => leagueRecord(save, region).titles > 0;
export const anyRaidUnlocked = (save: Pick<SaveData, 'league'>) => REGION_IDS.some(region => raidUnlocked(save, region));

/** The boss's level against this team: as designed, until the team's average passes it. */
export const raidLevel = (region: RegionId, scale?: PlayerScale) => Math.max(RAID_LEVELS[region], scale?.average ?? 0);

/** The boss as a battle card: huge HP, and hits capped so it can't knock out a Pokémon at once. */
export function raidBossCard(id: number, level: number): BattleCard {
  const card = toBattleCard({ id, level, shiny: false });
  return { ...card, stats: { ...card.stats, hp: card.stats.hp * RAID_HP_MULT }, maxHit: RAID_MAX_HIT };
}

export type RaidCheck = 'ok' | 'locked' | 'coins' | 'team';

export function canRaid(save: Pick<SaveData, 'league' | 'coins' | 'deck'>, region: RegionId): RaidCheck {
  if (!raidUnlocked(save, region)) return 'locked';
  if (save.coins < RAID_FEES[region]) return 'coins';
  if (save.deck.length < DECK_SIZE) return 'team';
  return 'ok';
}

/** Pays the fee and draws the boss (mutates the save). Returns its species id, or null when not allowed. */
export function startRaid(save: SaveData, region: RegionId, rng: Rng = defaultRng): number | null {
  if (canRaid(save, region) !== 'ok') return null;
  save.coins -= RAID_FEES[region];
  return pick(raidPool(region), rng).id;
}

const item = (id: string, amount: number): Reward => ({ kind: 'item', item: id, amount });

/** What every win pays, before the roll for the boss. */
export const raidWinRewards = (region: RegionId): Reward[] =>
  [{ kind: 'coins', amount: Math.round(RAID_FEES[region] * WIN_REFUND) }, item('rare-candy', WIN_CANDY[region])];

export type RaidCatch = 'none' | 'normal' | 'shiny' | 'duplicate';

export interface RaidResult {
  caught: RaidCatch;
  rewards: Reward[];
}

/** Records a finished battle and rolls the prizes of a win (mutates the save; the caller grants the rewards). */
export function finishRaid(save: SaveData, region: RegionId, boss: number, won: boolean, rng: Rng = defaultRng): RaidResult {
  const record = raidRecord(save, region);
  save.raid[region] = record;
  if (!won) {
    record.losses++;
    return { caught: 'none', rewards: [] };
  }
  record.wins++;
  record.sinceCatch++;
  const rewards = raidWinRewards(region);

  // One roll, so the shiny's 1% and the normal card's 10% are exact and never come together.
  const roll = rng();
  const shiny = roll < RAID_SHINY_CHANCE;
  if (!shiny && roll >= RAID_SHINY_CHANCE + RAID_CATCH_CHANCE && record.sinceCatch < RAID_PITY) return { caught: 'none', rewards };
  record.sinceCatch = 0;
  if (cardKey(boss, shiny) in save.cards) return { caught: 'duplicate', rewards: [...rewards, item('master-ball', 1)] };
  return { caught: shiny ? 'shiny' : 'normal', rewards: [...rewards, { kind: 'card', id: boss, shiny }] };
}

/** The boss's title: "Legendary" or "Mythical" (for the texts). */
export const raidBossKind = (id: number) => (getSpecies(id).mythical ? 'mythical' : 'legendary');
