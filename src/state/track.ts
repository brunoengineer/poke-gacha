// Game tracks: two separate games in one app, each with its own save. Classic is the game as it has always been; Journey
// plays region by region (src/game/journey.ts).
//
// Classic's storage names below are what every released version uses. NEVER change them: both versions read and write
// these same places, so this branch and the main branch keep working side by side on one Firebase project and browser.
// The Journey never touches Classic's places (cloud writes replace the whole document, so sharing one would erase the
// other game's progress). See firestore.rules.

export type GameTrack = 'classic' | 'journey';

export interface TrackStorage {
  /** localStorage key of a save: prefix + player uid. */
  localPrefix: string;
  /** Firestore collection for saves. */
  saves: string;
  /** Firestore collection for the public online ranking. */
  leaderboard: string;
}

export const TRACK_STORAGE: Record<GameTrack, TrackStorage> = {
  classic: { localPrefix: 'pg-save-', saves: 'pokegacha_saves', leaderboard: 'pokegacha_leaderboard' },
  journey: { localPrefix: 'pg-journey-save-', saves: 'pokegacha_journey_saves', leaderboard: 'pokegacha_journey_leaderboard' },
};

/** The player's choice, per browser. */
export const TRACK_KEY = 'pg-track';
/** The game a new player gets. */
export const DEFAULT_TRACK: GameTrack = 'journey';

type ReadableStorage = Pick<Storage, 'getItem' | 'key' | 'length'>;

/** The player's choice; without one, a browser that already has a Classic save stays on Classic; else the default. */
export function resolveTrack(storage: ReadableStorage): GameTrack {
  const chosen = storage.getItem(TRACK_KEY);
  if (chosen === 'classic' || chosen === 'journey') return chosen;
  for (let i = 0; i < storage.length; i++) {
    if (storage.key(i)?.startsWith(TRACK_STORAGE.classic.localPrefix)) return 'classic';
  }
  return DEFAULT_TRACK;
}

let track: GameTrack | null = null;

function readTrack(): GameTrack {
  // Outside the browser (the rule tests) the game is Classic.
  if (typeof document === 'undefined') return 'classic';
  try {
    return resolveTrack(localStorage);
  } catch {
    return DEFAULT_TRACK; // storage blocked
  }
}

/** The game being played, decided once per page load. */
export const currentTrack = (): GameTrack => (track ??= readTrack());
export const isJourneyTrack = () => currentTrack() === 'journey';
export const trackStorage = (): TrackStorage => TRACK_STORAGE[currentTrack()];

/**
 * Remembers the player's choice for the next page load, and doesn't touch the game running now. That matters: leaving the
 * page writes the current save (store.ts), and it must still go to the current game's place, never to the new one's.
 */
export function saveTrackChoice(next: GameTrack) {
  try {
    localStorage.setItem(TRACK_KEY, next);
  } catch { /* storage blocked: the default stands */ }
}

/** Whether this browser already has a choice (made by the player, or kept from the game they entered). */
export function trackWasChosen(): boolean {
  try {
    return !!localStorage.getItem(TRACK_KEY);
  } catch {
    return false;
  }
}

/** A browser preference's key: the Journey keeps its own, so playing it never changes what Classic and older versions read. */
export const trackLocalKey = (key: string) => (isJourneyTrack() ? key.replace(/^pg-/, 'pg-journey-') : key);
