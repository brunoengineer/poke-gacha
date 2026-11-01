// Audio API used by every screen: synthesized chiptune effects, original music loops and Pokémon cries,
// all respecting the player's settings. Implementation: engine.ts (context, buses), sfx.ts, music.ts, cries.ts.

import { isMuted, onAudioChange, setMuted, toggleMute, unlockAudio as unlock } from './engine';
import { playMusic as startMusic } from './music';
import { playCry as cry } from './cries';
import { playSfx } from './sfx';
import type { MusicTrack, SfxName } from './types';

export type { MusicTrack, SfxName } from './types';
export { preloadCry } from './cries';
export { currentMusic } from './music';
/** Master mute (persisted in this browser, independent of the settings toggles); for a header button. */
export { isMuted, setMuted, toggleMute };

/** Plays a sound effect (no-op when sound is off). */
export function sfx(name: SfxName): void {
  playSfx(name);
}

/** A short blip at the exact effects volume (settings slider preview). */
export function previewSfx(): void {
  playSfx('coin', true);
}

/** Starts (or crossfades to) a music loop; null stops the music. */
export function playMusic(track: MusicTrack | null): void {
  startMusic(track);
}

/** Plays a Pokémon's cry (no-op when cries are off or the file can't load). */
export function playCry(id: number): void {
  cry(id);
}

/** Must be called from a user gesture once, so browsers allow audio. Safe to call repeatedly. */
export function unlockAudio(): void {
  unlock();
}

/** Calls `fn` whenever the mute state or audio settings change (e.g. to refresh a header mute icon). */
export function onMuteChange(fn: () => void): () => void {
  return onAudioChange(fn);
}
