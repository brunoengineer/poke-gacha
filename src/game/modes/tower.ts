// Infinity Tower: an endless climb. Each floor is one battle against a trainer whose whole team is 5 levels above
// the previous floor's, with no top floor: the only question is how far a player gets.
//   - Progress is kept: a loss doesn't reset the climb, the same floor waits for a retry.
//   - Each floor pays once (on its first clear), so low floors can't be farmed.
//   - Floors are fixed: floor N always brings the same team (seeded by N), so a lost floor can be studied.
//   - Every 10th floor is a boss floor (legendaries allowed) with a bonus.

import { RARE_CANDY } from '../../data/items';
import type { TeamMember } from '../battle';
import type { Reward } from '../rewards';
import { hashString, pick, seeded } from '../rng';
import { generateTeam } from '../teams';

export interface TowerSave {
  /** Highest floor cleared (0: none). The next floor to fight is `best + 1`. */
  best: number;
  wins: number;
  losses: number;
}

export const defaultTowerSave = (): TowerSave => ({ best: 0, wins: 0, losses: 0 });

/** Badges needed to enter (the tower opens after Brock, so it doesn't replace Training early on). */
export const TOWER_UNLOCK_BADGES = 1;
/** Level of the first floor, and how much each floor adds. */
export const FIRST_FLOOR_LEVEL = 15;
export const LEVELS_PER_FLOOR = 5;
export const BOSS_EVERY = 10;

/** Rewards for clearing a floor for the first time. */
export const FLOOR_CANDY = 3;
export const COINS_PER_LEVEL = 20;
export const BOSS_COINS = 2000;

export const towerUnlocked = (badges: number) => badges >= TOWER_UNLOCK_BADGES;
export const nextFloor = (tower: TowerSave) => tower.best + 1;
export const floorLevel = (floor: number) => FIRST_FLOOR_LEVEL + LEVELS_PER_FLOOR * (floor - 1);
export const isBossFloor = (floor: number) => floor % BOSS_EVERY === 0;

/** Trainer sprites the floors cycle through (Pokémon Showdown names); bosses use the veterans. */
const TRAINERS = [
  'acetrainer', 'acetrainerf', 'blackbelt', 'battlegirl', 'psychic', 'psychicf', 'pokemonranger', 'pokemonrangerf',
  'dragontamer', 'gentleman', 'lady', 'scientist', 'biker', 'beauty', 'juggler', 'supernerd',
];
const BOSSES = ['veteran', 'veteranf'];
const NAMES = [
  'Alex', 'Sam', 'Robin', 'Jordan', 'Casey', 'Morgan', 'Riley', 'Taylor', 'Quinn', 'Avery', 'Rowan', 'Sky', 'Kai',
  'Noa', 'Remy', 'Sasha', 'Jules', 'Dana', 'Ari', 'Lior',
];

export interface Floor {
  floor: number;
  level: number;
  boss: boolean;
  name: string;
  sprite: string;
  team: TeamMember[];
}

/** The trainer and team of a floor (always the same for the same floor). */
export function towerFloor(floor: number): Floor {
  const rng = seeded(hashString(`tower:${floor}`));
  const level = floorLevel(floor);
  const boss = isBossFloor(floor);
  const sprite = pick(boss ? BOSSES : TRAINERS, rng);
  const name = pick(NAMES, rng);
  return { floor, level, boss, name, sprite, team: generateTeam({ level, allowLegendary: boss }, rng) };
}

export function floorRewards(floor: number): Reward[] {
  const coins = COINS_PER_LEVEL * floorLevel(floor) + (isBossFloor(floor) ? BOSS_COINS : 0);
  return [{ kind: 'coins', amount: coins }, { kind: 'item', item: RARE_CANDY, amount: FLOOR_CANDY }];
}

/** Records a battle on the next floor (mutates the save slice). Returns true when a new floor was cleared. */
export function recordTower(tower: TowerSave, won: boolean): boolean {
  if (!won) {
    tower.losses += 1;
    return false;
  }
  tower.wins += 1;
  tower.best += 1;
  return true;
}
