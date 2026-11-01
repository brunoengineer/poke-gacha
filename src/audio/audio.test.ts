import { describe, expect, it } from 'vitest';
import { isMuted, playCry, playMusic, sfx, toggleMute, unlockAudio } from '.';
import { SFX_NAMES } from './sfx';

describe('audio API without Web Audio (tests, old browsers)', () => {
  it('every call is a silent no-op', () => {
    expect(() => {
      unlockAudio();
      for (const name of SFX_NAMES) sfx(name);
      playMusic('battle');
      playMusic(null);
      playCry(25);
    }).not.toThrow();
    expect(SFX_NAMES.length).toBeGreaterThan(40);
  });

  it('toggles the master mute', () => {
    const before = isMuted();
    expect(toggleMute()).toBe(!before);
    toggleMute();
    expect(isMuted()).toBe(before);
  });
});
