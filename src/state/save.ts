// Save format. Everything the player owns lives in one JSON object, stored locally and (when signed in) in Firestore.
//
// Compatibility rules (players have real progress, so every release must load every older save):
//   - Never rename or remove fields or ids (card keys "<id>"/"<id>s", badge, gym and item ids).
//   - New fields get a default in defaultSave(); normalizeSave() fills them in for older saves.
//   - A change that can't be expressed as "new field with a default" is a migration: bump SAVE_VERSION and add a
//     step to MIGRATIONS. Bump SAVE_VERSION too when a release adds content older apps can't show (a new
//     generation), so an outdated app knows to reload.
//   - Every release adds its save to src/state/fixtures/; the tests load all of them.
//   - Unknown fields (written by a newer version of the app) are kept as they are, never dropped.

/** Current save format version (2 = the Johto release, 3 = Hoenn and Sinnoh). */
export const SAVE_VERSION = 3;

/** Upgrades a raw save from version `n` to `n + 1`, keyed by `n`. Steps run in order. */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  // 1 -> 2: Johto. `evolved` is new and defaults to {} (see normalizeSave); nothing to rewrite.
  1: raw => raw,
  // 2 -> 3: Hoenn and Sinnoh. Their league progress (league.hoenn / league.sinnoh) is optional; nothing to rewrite.
  2: raw => raw,
};

import type { CardKey } from '../game/cards';
import { defaultOnlineSave, type OnlineSave } from '../game/leaderboard';
import { normalizeSavedTeams, type SavedTeam } from '../game/saved-teams';
import { STARTING_COINS } from '../game/economy';
import { defaultLadderSave, type LadderSave } from '../game/modes/competition';
import { defaultGymSave, type GymSave } from '../game/modes/gyms';
import { defaultHuntSave, type HuntSave } from '../game/modes/hunt';
import { defaultLeagueSave, type LeagueSave } from '../game/modes/league';
import { defaultRaidSave, type RaidSave } from '../game/modes/raid';
import { defaultTowerSave, type TowerSave } from '../game/modes/tower';
import { defaultTrainingSave, type TrainingSave } from '../game/modes/training';

export interface CardState {
  level: number;
  /** Copies obtained so far (pulls, rewards), including the first one. */
  copies: number;
  obtainedAt: number;
}

export interface Settings {
  sound: boolean;
  music: boolean;
  cries: boolean;
  /** 0..1 */
  volume: number;
  /** 0..1 */
  musicVolume: number;
  /** Shorter animations. */
  fastFx: boolean;
}

export interface SaveData {
  /** Format version (SAVE_VERSION when written by this app; higher when written by a newer one). */
  v: number;
  coins: number;
  cards: Record<CardKey, CardState>;
  /** Pokédex: species id -> when it was first obtained (pulled, rewarded or evolved into). */
  caught: Record<string, number>;
  /**
   * Species the player evolved away (species id -> when). Only these route later copies to the evolved card;
   * pulling an Arbok first never stops you from getting an Ekans card of your own.
   */
  evolved: Record<string, number>;
  /** Team of up to DECK_SIZE card keys, in slot order. */
  deck: CardKey[];
  /** Saved teams (presets) the player can load in one click (added with Hoenn/Sinnoh; older saves have none). */
  teams: SavedTeam[];
  items: Record<string, number>;
  /** Starter species chosen in onboarding (null until chosen). */
  starter: number | null;
  training: TrainingSave;
  gyms: GymSave;
  ladder: LadderSave;
  league: LeagueSave;
  /** Infinity Tower progress (added after the Johto release; older saves start at floor 1). */
  tower: TowerSave;
  /** Online ranking: whether the player joined, and their nickname (older saves: not joined). */
  online: OnlineSave;
  /** Shiny Hunt: target species and chain (added after the Johto release; older saves start with no target). */
  hunt: HuntSave;
  /** Legendary Battle: wins, losses and the guaranteed-catch counter per region (older saves: none yet). */
  raid: RaidSave;
  stats: {
    pulls: number;
    shinies: number;
    evolutions: number;
    battles: number;
    wins: number;
    losses: number;
    coinsEarned: number;
    candiesUsed: number;
  };
  /** Daily gift: last claimed day (YYYY-MM-DD) and consecutive-day streak. */
  daily: { last: string | null; streak: number };
  /** Pulls since the last rare-or-better card, per banner (pity counter). */
  pity: Record<string, number>;
  settings: Settings;
  /** One-time hints already shown, by id. */
  seen: Record<string, boolean>;
  updatedAt: number;
}

export function defaultSave(): SaveData {
  return {
    v: SAVE_VERSION,
    coins: STARTING_COINS,
    cards: {},
    caught: {},
    evolved: {},
    deck: [],
    teams: [],
    items: {},
    starter: null,
    training: defaultTrainingSave(),
    gyms: defaultGymSave(),
    ladder: defaultLadderSave(),
    league: defaultLeagueSave(),
    tower: defaultTowerSave(),
    hunt: defaultHuntSave(),
    raid: defaultRaidSave(),
    online: defaultOnlineSave(),
    stats: { pulls: 0, shinies: 0, evolutions: 0, battles: 0, wins: 0, losses: 0, coinsEarned: 0, candiesUsed: 0 },
    daily: { last: null, streak: 0 },
    pity: {},
    settings: { sound: true, music: true, cries: true, volume: 0.7, musicVolume: 0.35, fastFx: false },
    seen: {},
    updatedAt: 0,
  };
}

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Runs the migrations a save needs, from its version up to SAVE_VERSION. */
export function migrateSave(raw: Record<string, unknown>): Record<string, unknown> {
  let save = raw;
  for (let v = Number(raw.v) || 1; v < SAVE_VERSION; v++) save = { ...MIGRATIONS[v]?.(save) ?? save, v: v + 1 };
  return save;
}

/** True when the save was written by a newer version of the app than this one. */
export const isFromNewerApp = (s: Pick<SaveData, 'v'>) => s.v > SAVE_VERSION;

/** Fills missing fields so older saves keep working as the game grows (after running their migrations). */
export function normalizeSave(raw: unknown): SaveData {
  const d = defaultSave();
  if (!isObject(raw)) return d;
  const s = migrateSave(raw) as Partial<SaveData>;
  const merge = <T extends object>(base: T, value: unknown): T => (isObject(value) ? { ...base, ...value } : base);
  return {
    // Fields this version doesn't know (from a newer app) ride along untouched, so saving here never deletes them.
    ...(s as object),
    ...d,
    coins: Number.isFinite(s.coins) ? Math.max(0, Math.floor(s.coins!)) : d.coins,
    cards: isObject(s.cards) ? (s.cards as SaveData['cards']) : {},
    caught: isObject(s.caught) ? (s.caught as SaveData['caught']) : {},
    // Older saves didn't track this: their next copy of a species they no longer own simply becomes a new card.
    evolved: isObject(s.evolved) ? (s.evolved as SaveData['evolved']) : {},
    deck: Array.isArray(s.deck) ? s.deck.filter(key => typeof key === 'string' && isObject(s.cards) && key in s.cards) : [],
    teams: normalizeSavedTeams(s.teams),
    items: isObject(s.items) ? (s.items as SaveData['items']) : {},
    starter: typeof s.starter === 'number' ? s.starter : null,
    training: merge(d.training, s.training),
    gyms: merge(d.gyms, s.gyms),
    ladder: merge(d.ladder, s.ladder),
    league: merge(d.league, s.league),
    tower: merge(d.tower, s.tower),
    hunt: merge(d.hunt, s.hunt),
    raid: merge(d.raid, s.raid),
    online: merge(d.online, s.online),
    stats: merge(d.stats, s.stats),
    daily: merge(d.daily, s.daily),
    pity: isObject(s.pity) ? (s.pity as SaveData['pity']) : {},
    settings: merge(d.settings, s.settings),
    seen: isObject(s.seen) ? (s.seen as SaveData['seen']) : {},
    updatedAt: Number.isFinite(s.updatedAt) ? s.updatedAt! : 0,
    v: Math.max(SAVE_VERSION, Number(s.v) || SAVE_VERSION),
  };
}

export const hasProgress = (s: SaveData) => s.starter != null || s.stats.pulls > 0 || s.updatedAt > 0;

export type SaveChoice = { kind: 'abort' } | { kind: 'use'; save: SaveData; fromGuest: boolean };

/**
 * Which save a signed-in account gets: the newest of its local and cloud copies; a brand-new account takes
 * this browser's guest progress (once); if the cloud is unreachable and nothing is cached, abort rather
 * than risk overwriting a real cloud save.
 */
export function chooseAccountSave(local: SaveData | null, cloud: SaveData | null, cloudOk: boolean, guest: SaveData | null): SaveChoice {
  if (!cloudOk && !local) return { kind: 'abort' };
  const newest = [local, cloud].filter((s): s is SaveData => !!s).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (newest) return { kind: 'use', save: newest, fromGuest: false };
  if (guest && hasProgress(guest)) return { kind: 'use', save: guest, fromGuest: true };
  return { kind: 'use', save: defaultSave(), fromGuest: false };
}
