// The two games must never meet: Classic's storage names are what every released version uses, and a Journey game writing
// to them would erase Classic progress (cloud writes replace the whole document).

import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultJourneySave } from '../game/journey';
import { defaultSave, normalizeSave, SAVE_VERSION } from './save';
import { currentTrack, DEFAULT_TRACK, resolveTrack, TRACK_KEY, TRACK_STORAGE } from './track';

const fakeStorage = (entries: Record<string, string> = {}) => {
  const keys = Object.keys(entries);
  return {
    length: keys.length,
    getItem: (key: string) => entries[key] ?? null,
    key: (index: number) => keys[index] ?? null,
  };
};

const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('storage names', () => {
  it("pins Classic's names, which every released version reads and writes", () => {
    expect(TRACK_STORAGE.classic).toEqual({ localPrefix: 'pg-save-', saves: 'pokegacha_saves', leaderboard: 'pokegacha_leaderboard' });
  });

  it("keeps every Journey name apart from Classic's", () => {
    const { classic, journey } = TRACK_STORAGE;
    expect(journey.localPrefix).not.toBe(classic.localPrefix);
    expect(journey.saves).not.toBe(classic.saves);
    expect(journey.leaderboard).not.toBe(classic.leaderboard);
  });

  it("doesn't make a Journey save look like a Classic one to resolveTrack", () => {
    expect(TRACK_STORAGE.journey.localPrefix.startsWith(TRACK_STORAGE.classic.localPrefix)).toBe(false);
  });
});

describe('resolveTrack', () => {
  const classicSave = `${TRACK_STORAGE.classic.localPrefix}uid`;
  const journeySave = `${TRACK_STORAGE.journey.localPrefix}uid`;

  it("takes the player's choice first, even with a Classic save in the browser", () => {
    expect(resolveTrack(fakeStorage({ [TRACK_KEY]: 'journey', [classicSave]: '{}' }))).toBe('journey');
    expect(resolveTrack(fakeStorage({ [TRACK_KEY]: 'classic' }))).toBe('classic');
  });

  it('without a choice, keeps a browser with a Classic save on Classic', () => {
    expect(resolveTrack(fakeStorage({ other: 'x', [classicSave]: '{}' }))).toBe('classic');
  });

  it('otherwise gives the default', () => {
    expect(DEFAULT_TRACK).toBe('journey');
    expect(resolveTrack(fakeStorage())).toBe(DEFAULT_TRACK);
    expect(resolveTrack(fakeStorage({ [journeySave]: '{}' }))).toBe(DEFAULT_TRACK);
  });

  it('ignores a choice it does not know', () => {
    expect(resolveTrack(fakeStorage({ [TRACK_KEY]: 'mars', [classicSave]: '{}' }))).toBe('classic');
    expect(resolveTrack(fakeStorage({ [TRACK_KEY]: 'mars' }))).toBe(DEFAULT_TRACK);
  });

  it('plays Classic outside the browser, so the rule tests run the Classic rules', () => {
    expect(currentTrack()).toBe('classic');
  });
});

describe('firestore.rules', () => {
  const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

  it("still has Classic's two blocks, unchanged", () => {
    expect(rules).toContain(`    match /pokegacha_saves/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
`);
    expect(rules).toContain(`    match /pokegacha_leaderboard/{uid} {
      allow read: if true;
      allow delete: if request.auth != null && request.auth.uid == uid;
      allow create: if request.auth != null && request.auth.uid == uid && validPokegachaEntry();
      allow update: if request.auth != null && request.auth.uid == uid && validPokegachaEntry()
        && request.time > resource.data.updatedAt + duration.value(3, 's');
    }
`);
  });

  it("has the Journey's two blocks, under the names track.ts uses", () => {
    expect(rules).toContain(`    match /${TRACK_STORAGE.journey.saves}/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
`);
    expect(rules).toContain(`    match /${TRACK_STORAGE.journey.leaderboard}/{uid} {
      allow read: if true;
      allow delete: if request.auth != null && request.auth.uid == uid;
      allow create: if request.auth != null && request.auth.uid == uid && validPokegachaEntry();
      allow update: if request.auth != null && request.auth.uid == uid && validPokegachaEntry()
        && request.time > resource.data.updatedAt + duration.value(3, 's');
    }
`);
  });
});

describe('saves', () => {
  it('stays on save version 3: the Journey only adds an optional field', () => {
    expect(SAVE_VERSION).toBe(3);
  });

  it('never gives a Classic save a journey key', () => {
    expect('journey' in defaultSave()).toBe(false);
    expect('journey' in roundTrip(normalizeSave(roundTrip(defaultSave())))).toBe(false);
  });

  it('never gives a released save a journey key', () => {
    const dir = new URL('./fixtures/', import.meta.url);
    const files = readdirSync(dir).filter(file => file.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const raw = JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as unknown;
      expect('journey' in roundTrip(normalizeSave(raw)), file).toBe(false);
    }
  });

  it('keeps a Journey save through normalizeSave', () => {
    const journey = {
      ...defaultJourneySave(),
      active: 'johto' as const,
      slots: { kanto: { starter: 1, deck: ['1', '4'], teams: [{ id: 't', name: 'Kanto', keys: ['1'] }] } },
    };
    const save = roundTrip(normalizeSave(roundTrip({ ...defaultSave(), journey })));
    expect(save.journey).toEqual(journey);
  });

  it('a fresh Journey save stays one', () => {
    const save = roundTrip(normalizeSave(roundTrip({ ...defaultSave(), journey: defaultJourneySave() })));
    expect(save.journey).toEqual(defaultJourneySave());
  });

  it('keeps a mid-game Journey save (Kanto cleared, Johto active) through normalizeSave', () => {
    const file = new URL('./fixtures/journey/save-v3-journey.json', import.meta.url);
    const raw = JSON.parse(readFileSync(file, 'utf8')) as ReturnType<typeof defaultSave>;
    const save = roundTrip(normalizeSave(raw));
    expect(save.journey).toEqual(raw.journey);
    expect(save.journey?.active).toBe('johto');
    expect(save.journey?.slots.kanto?.deck).toHaveLength(6);
    expect(save.starter).toBe(raw.starter);
    expect(save.deck).toEqual(raw.deck);
    expect(save.teams).toEqual(raw.teams);
    expect(save.cards).toEqual(raw.cards);
    expect(save.caught).toEqual(raw.caught);
    expect(save.coins).toBe(raw.coins);
    expect(save.items).toEqual(raw.items);
    expect(save.gyms).toEqual(raw.gyms);
    expect(save.league.titles).toBe(raw.league.titles);
    expect(save.v).toBe(SAVE_VERSION);
  });
});
