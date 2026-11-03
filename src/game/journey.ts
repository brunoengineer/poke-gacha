// Region Journey: the game as a series of chapters, like the anime. Each region is a fresh start: a new starter, a team
// and a Pokédex of that generation only. Winning a region's League opens the next one, and the player can go back to any
// opened chapter at any time. After the last region's League comes the World: every Pokédex together, the Master League,
// the Infinity Tower and Ranked with Ash.
//
//   - CHAPTERS comes from REGION_IDS, so adding a region adds a chapter (and moves the World to after it) on its own.
//   - What is shared across chapters: coins, items, the whole card collection, stats. What is per chapter: the team, the
//     saved teams and the starter (the active chapter's live in the save's usual fields, so the rest of the game keeps
//     reading save.deck; travel() swaps them).
//   - The rule modules ask this module what the active chapter allows. Classic games have no chapter
//     (activeChapter() is null) and every question answers "everything": the Classic rules don't change at all.
//   - The active chapter is set once per page load (the store does it before the screens start), and traveling reloads
//     the page, so screens never see it change while they're on screen.

import { baseStatTotal, descendants, getSpecies, hasSpecies, speciesList, type Species } from '../data/species';
import type { SaveData } from '../state/save';
import { cardKey, parseKey, type CardKey } from './cards';
import { REGION_IDS, regionGeneration, type RegionId } from './regions';
import type { SavedTeam } from './saved-teams';

export const WORLD = 'world';
export type ChapterId = RegionId | typeof WORLD;
/** The chapters, in story order: every region, then the World. */
export const CHAPTERS: ChapterId[] = [...REGION_IDS, WORLD];

/** Team, saved teams and starter of a chapter that isn't being played. */
export interface ChapterSlot {
  starter: number | null;
  deck: CardKey[];
  teams: SavedTeam[];
}

export interface JourneySave {
  /** Chapter being played. Its team, saved teams and starter are in the save's own fields. */
  active: ChapterId;
  /** The other chapters' (absent until first visited). */
  slots: Partial<Record<ChapterId, ChapterSlot>>;
}

export const defaultJourneySave = (): JourneySave => ({ active: CHAPTERS[0], slots: {} });

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const stringList = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);

export function normalizeJourney(raw: unknown): JourneySave {
  const d = defaultJourneySave();
  if (!isObject(raw)) return d;
  const slots: JourneySave['slots'] = {};
  if (isObject(raw.slots)) {
    // A chapter this version doesn't know (from a newer app) rides along untouched, like every unknown save field.
    Object.assign(slots, raw.slots);
    for (const chapter of CHAPTERS) {
      const slot = raw.slots[chapter];
      delete slots[chapter];
      if (!isObject(slot)) continue;
      slots[chapter] = {
        starter: typeof slot.starter === 'number' ? slot.starter : null,
        deck: stringList(slot.deck),
        teams: Array.isArray(slot.teams) ? (slot.teams as SavedTeam[]) : [],
      };
    }
  }
  return { active: typeof raw.active === 'string' && raw.active ? (raw.active as ChapterId) : d.active, slots };
}

/** The chapter whose rules apply: the saved one, or the first if it's from a newer app (the save keeps it as it is). */
export const playableChapter = (journey: JourneySave): ChapterId =>
  (CHAPTERS.includes(journey.active) ? journey.active : CHAPTERS[0]);

// --- The active chapter ------------------------------------------------------------------

let chapter: ChapterId | null = null;

/** The chapter being played (null: a Classic game, nothing is restricted). */
export const activeChapter = () => chapter;
export const setActiveChapter = (next: ChapterId | null) => { chapter = next; };
export const isJourney = () => chapter != null;
/** The region being played (null: a Classic game, or the World). */
export const activeRegion = (): RegionId | null => (chapter && chapter !== WORLD ? chapter : null);
export const inWorld = () => chapter === WORLD;

/** Runs `fn` with a chapter active, for tests. */
export function withChapter<T>(next: ChapterId | null, fn: () => T): T {
  const before = chapter;
  chapter = next;
  try {
    return fn();
  } finally {
    chapter = before;
  }
}

/**
 * Whether the player can catch, field and evolve into this species now: only their region's generation in a region. A card
 * this version doesn't know (a save from a newer app) isn't usable, and must not break anything.
 */
export function playerCanUse(id: number): boolean {
  const region = activeRegion();
  return !region || (hasSpecies(id) && getSpecies(id).generation === regionGeneration(region));
}

/** Whether opponents can use this species now: up to their region's generation (Johto's Morty keeps his Gengar). */
export function opponentCanUse(id: number): boolean {
  const region = activeRegion();
  return !region || getSpecies(id).generation <= regionGeneration(region);
}

/** The Pokédex of the active chapter, in order (every species in Classic and in the World). */
export const chapterSpecies = () => (activeRegion() ? speciesList.filter(s => playerCanUse(s.id)) : speciesList);

/** The regions whose content shows now: only the active one in a region; all of them in Classic and in the World. */
export const visibleRegions = (): RegionId[] => {
  const region = activeRegion();
  return region ? [region] : REGION_IDS;
};

/** Captures always come from the active region; in Classic and in the World the player's pick stands (0: every region). */
export function captureRegion(picked: number): number {
  const region = activeRegion();
  return region ? regionGeneration(region) : picked;
}

/** The League of the active chapter (null in Classic, where all of them are on the League screen). */
export function chapterLeague(): RegionId | 'master' | null {
  if (!chapter) return null;
  return chapter === WORLD ? 'master' : chapter;
}

// --- Battle modes per chapter -------------------------------------------------------------

export type BattleModeId = 'training' | 'competition' | 'gyms' | 'hunt' | 'tower' | 'league' | 'raid';

const REGION_MODES: BattleModeId[] = ['training', 'gyms', 'hunt', 'league', 'raid'];
const WORLD_MODES: BattleModeId[] = ['training', 'competition', 'hunt', 'tower', 'league', 'raid'];

/** Whether a Battle mode exists in the active chapter (a mode's own unlock rules still apply). */
export function modeInChapter(mode: BattleModeId): boolean {
  if (!chapter) return true;
  return (chapter === WORLD ? WORLD_MODES : REGION_MODES).includes(mode);
}

// --- Difficulty ---------------------------------------------------------------------------

/**
 * Every region starts over, so all of them follow Kanto's level curve (gyms 15–58, League 60–70) plus this many levels per
 * region before it: the coins, items and Rare Candy carried over make later fresh starts faster. Staying under Lv. 100
 * keeps every region's first playthrough beatable with normal cards.
 */
export const JOURNEY_LEVEL_STEP = 5;
export const journeyLevelOffset = (region: RegionId) => REGION_IDS.indexOf(region) * JOURNEY_LEVEL_STEP;

/** Pokédollars each chapter starts with: ten Poké Balls, always enough for the team of six that battles need. */
export const CHAPTER_START_COINS = 500;

// --- What captures can bring ------------------------------------------------------------

/**
 * Money can't open a region: captures start with its weakest quarter (by base stats) and each badge opens an equal part
 * of the rest, so legendaries and the strongest forms only show up near the end. Master Balls are exempt: their pool is
 * only legendaries, and they come as gifts.
 */
export const CAPTURE_OPEN_SHARE = 0.25;

let captureProgress = 1;
/** Share of the active region's badges earned (0..1): the store keeps it current. */
export const setCaptureProgress = (share: number) => { captureProgress = share; };

const weakestFirst = new Map<number, Species[]>();

function regionByStrength(generation: number): Species[] {
  let list = weakestFirst.get(generation);
  if (!list) {
    list = speciesList.filter(s => s.generation === generation).sort((a, b) => baseStatTotal(a) - baseStatTotal(b) || a.id - b.id);
    weakestFirst.set(generation, list);
  }
  return list;
}

/** The species captures can bring now: part of the region in a chapter, every species in Classic and in the World. */
export function capturePool(): Species[] {
  const region = activeRegion();
  if (!region) return speciesList;
  const all = regionByStrength(regionGeneration(region));
  const open = Math.ceil(all.length * (CAPTURE_OPEN_SHARE + (1 - CAPTURE_OPEN_SHARE) * captureProgress));
  return all.slice(0, open).sort((a, b) => a.id - b.id);
}

export const capturable = (id: number) => !activeRegion() || capturePool().some(s => s.id === id);

// --- Progress and travel -------------------------------------------------------------------

type ProgressSave = Pick<SaveData, 'league' | 'journey'>;

/** A chapter's League progress: the region's own, or the Master League in the World. */
const chapterLeagueRecord = (save: ProgressSave, target: ChapterId) =>
  (target === WORLD ? save.league.master : target === 'kanto' ? save.league : save.league[target]);

/** A chapter is cleared by a title in its League. */
export const chapterCleared = (save: ProgressSave, target: ChapterId) => (chapterLeagueRecord(save, target)?.titles ?? 0) > 0;

/**
 * The first chapter is always open; each of the others opens by clearing the one before. Once entered it stays open:
 * a new region goes before the World, and that can't lock out a player already there.
 */
export function chapterOpen(save: ProgressSave, target: ChapterId): boolean {
  const index = CHAPTERS.indexOf(target);
  if (index === 0 || save.journey?.active === target || save.journey?.slots[target]) return true;
  return index > 0 && chapterCleared(save, CHAPTERS[index - 1]);
}

/** The chapter after this one (null for the World). */
export const nextChapter = (from: ChapterId): ChapterId | null => CHAPTERS[CHAPTERS.indexOf(from) + 1] ?? null;

/**
 * A region's League run registers its team, so it has to end before leaving: cards can change elsewhere (evolved in the
 * World), and the run would come back with a smaller team.
 */
export function leagueRunBlocksTravel(save: Pick<SaveData, 'league' | 'journey'>): boolean {
  const active = save.journey?.active;
  return !!active && active !== WORLD && !!chapterLeagueRecord(save, active)?.run;
}

/** The card a key in another chapter's team stands for here: itself, or its owned evolved form that is usable here. */
export function resolveForChapter(save: Pick<SaveData, 'cards'>, key: CardKey): CardKey | null {
  const { id, shiny } = parseKey(key);
  if (save.cards[key] && playerCanUse(id)) return key;
  if (shiny) return null;
  const evolved = descendants(id).find(d => save.cards[cardKey(d)] && playerCanUse(d));
  return evolved == null ? null : cardKey(evolved);
}

/**
 * Moves the player to another open chapter (mutates the save and sets the active chapter): stores the current team, saved
 * teams and starter, and brings in the target's. Returns false when it can't go there. The caller reloads the page.
 */
export function travel(save: SaveData, to: ChapterId): boolean {
  const journey = save.journey;
  if (!journey || to === journey.active || !chapterOpen(save, to) || leagueRunBlocksTravel(save)) return false;
  journey.slots[journey.active] = { starter: save.starter, deck: save.deck, teams: save.teams };
  const slot = journey.slots[to];
  const firstStarter = journey.slots[CHAPTERS[0]]?.starter ?? null;
  journey.active = to;
  delete journey.slots[to];
  setActiveChapter(to);
  // A region's starter is chosen on arrival; the World has none of its own and keeps the first chapter's.
  save.starter = slot?.starter ?? (to === WORLD ? firstStarter : null);
  save.teams = slot?.teams ?? [];
  // Cards can have changed while away (evolved in the World into a form this region doesn't have): keep what still fits.
  save.deck = [...new Set((slot?.deck ?? []).flatMap(key => resolveForChapter(save, key) ?? []))];
  return true;
}
