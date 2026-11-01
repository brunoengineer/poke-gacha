// Random helpers. Game logic takes an `Rng` so tests and generated content (ladders, daily banners) can be seeded.

export type Rng = () => number;

export const defaultRng: Rng = Math.random;

/** Small fast seeded generator (mulberry32). */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a string (for seeds like "2026-11-01"). */
export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const pick = <T>(list: readonly T[], rng: Rng = defaultRng): T => list[Math.floor(rng() * list.length)];

export const randInt = (min: number, max: number, rng: Rng = defaultRng) => min + Math.floor(rng() * (max - min + 1));

export function shuffle<T>(list: readonly T[], rng: Rng = defaultRng): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Picks one entry with probability proportional to its weight. */
export function weightedPick<T>(entries: readonly (readonly [T, number])[], rng: Rng = defaultRng): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [value, weight] of entries) {
    if (r < weight) return value;
    r -= weight;
  }
  return entries[entries.length - 1][0];
}

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The calendar day before `date` (not "24 hours ago", which skips a day after a DST change). */
export function previousDayKey(date = new Date()): string {
  const day = new Date(date);
  day.setDate(day.getDate() - 1);
  return dayKey(day);
}
