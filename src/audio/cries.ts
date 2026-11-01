// Pokémon cries: the classic (8-bit style) .ogg from the PokeAPI cries repo, with the modern one as fallback.
// Decoded once and kept in a small LRU cache. Failures (offline, Safari without ogg support) are silent.

import { cryUrl, latestCryUrl } from '../data/sprites';
import { criesAllowed, duck, existingContext, readyContext } from './engine';

const MAX_CACHED = 40;
const CRY_GAIN = 0.4;
/** A cry that arrives later than this after the request would feel out of sync: skip it. */
const MAX_DELAY_MS = 2500;
const MAX_AT_ONCE = 2;

const cache = new Map<number, Promise<AudioBuffer | null>>();
const playing = new Set<number>();
const lastRequest = new Map<number, number>();

function decode(c: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer | null> {
  return new Promise(resolve => {
    try {
      const result = c.decodeAudioData(data, buffer => resolve(buffer), () => resolve(null));
      result?.catch?.(() => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

async function fetchCry(c: BaseAudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await decode(c, await res.arrayBuffer());
  } catch {
    return null;
  }
}

function load(c: BaseAudioContext, id: number): Promise<AudioBuffer | null> {
  let entry = cache.get(id);
  if (entry) {
    cache.delete(id);
    cache.set(id, entry);
    return entry;
  }
  entry = fetchCry(c, cryUrl(id)).then(buffer => buffer ?? fetchCry(c, latestCryUrl(id)));
  cache.set(id, entry);
  // Don't remember failures forever (they may be a passing network problem).
  void entry.then(buffer => {
    if (!buffer) setTimeout(() => { if (cache.get(id) === entry) cache.delete(id); }, 60_000);
  });
  while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value as number);
  return entry;
}

/** Starts downloading a cry so a later playCry(id) is instant. */
export function preloadCry(id: number): void {
  const c = existingContext();
  if (c && criesAllowed() && Number.isInteger(id) && id > 0) void load(c, id);
}

export function playCry(id: number): void {
  if (!criesAllowed() || !Number.isInteger(id) || id <= 0) return;
  const ready = readyContext();
  if (!ready) return;
  const now = performance.now();
  if (playing.has(id) || now - (lastRequest.get(id) ?? -Infinity) < 600) return;
  lastRequest.set(id, now);
  const { c, buses } = ready;
  void load(c, id).then(buffer => {
    if (!buffer || !criesAllowed() || performance.now() - now > MAX_DELAY_MS) return;
    if (playing.has(id) || playing.size >= MAX_AT_ONCE) return;
    try {
      const src = c.createBufferSource();
      src.buffer = buffer;
      const g = c.createGain();
      const t = c.currentTime + 0.01;
      const end = t + buffer.duration;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(CRY_GAIN, t + 0.01);
      g.gain.setValueAtTime(CRY_GAIN, Math.max(t + 0.01, end - 0.03));
      g.gain.linearRampToValueAtTime(0, end);
      src.connect(g).connect(buses.cries);
      playing.add(id);
      src.onended = () => {
        playing.delete(id);
        g.disconnect();
      };
      src.start(t);
      duck(0.35, buffer.duration);
    } catch {
      playing.delete(id);
    }
  });
}
