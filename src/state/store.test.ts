// The two games and the cloud: a signed-in player's saves, through the real store with Firestore replaced by a map. Leaving
// a page writes the current save, so these tests fire `pagehide` on every reload, as the browser does.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cloud = vi.hoisted(() => new Map<string, string>());
const offline = vi.hoisted(() => ({ on: false }));
const auth = vi.hoisted(() => ({ cb: (_user: unknown) => {} }));

// The mock outlives each page's modules, so it asks for the current page's track on every call.
const savesOfThisPage = vi.hoisted(() => async () => (await import('./track')).trackStorage().saves);

vi.mock('./firebase', () => {
  return {
    firebaseEnabled: true,
    watchAuth: (cb: (user: unknown) => void) => { auth.cb = cb; },
    signInWithGoogle: async () => {},
    signOutUser: async () => {},
    loadCloudSave: async (uid: string, collection?: string) => {
      const json = cloud.get(`${collection ?? await savesOfThisPage()}/${uid}`);
      return json ? JSON.parse(json) : null;
    },
    writeCloudSave: async (uid: string, save: unknown) => {
      if (offline.on) return new Promise(() => {}); // offline, Firestore's write never finishes
      cloud.set(`${await savesOfThisPage()}/${uid}`, JSON.stringify(save));
    },
  };
});

const CLASSIC = 'pokegacha_saves/u1';
const JOURNEY = 'pokegacha_journey_saves/u1';
const save = (coins: number, updatedAt: number, extra = {}) =>
  ({ v: 3, coins, cards: { 1: { level: 5, copies: 1, obtainedAt: 1 } }, caught: { 1: 1 }, deck: ['1'], starter: 1, updatedAt, ...extra });
const journeySave = (coins: number, updatedAt: number) => save(coins, updatedAt, { journey: { active: 'kanto', slots: {} } });

const local = new Map<string, string>();
let reloads = 0;
let leave: (() => void)[] = [];

const storage = (map: Map<string, string>) => ({
  getItem: (key: string) => map.get(key) ?? null,
  setItem: (key: string, value: string) => void map.set(key, value),
  removeItem: (key: string) => void map.delete(key),
  key: (index: number) => [...map.keys()][index] ?? null,
  get length() { return map.size; },
});

/** Opens the app as this signed-in player, on a new page. */
async function openPage(user = { uid: 'u1', displayName: 'Ana', photoURL: null }) {
  leave = [];
  vi.resetModules();
  await import('../test/setup'); // the app loads the Pokédex at boot; a new page has a new registry
  const store = await import('./store');
  store.bootAuth();
  const before = reloads;
  auth.cb(user);
  // Done when the game opened, or when the page reloaded into the other game.
  await vi.waitFor(() => expect(store.store.phase === 'game' || reloads > before).toBe(true));
  return store;
}

beforeEach(() => {
  vi.useFakeTimers();
  cloud.clear();
  local.clear();
  reloads = 0;
  offline.on = false;
  vi.stubGlobal('localStorage', storage(local));
  vi.stubGlobal('sessionStorage', storage(new Map()));
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: () => {} });
  vi.stubGlobal('addEventListener', (name: string, fn: () => void) => { if (name === 'pagehide') leave.push(fn); });
  vi.stubGlobal('location', {
    hash: '',
    hostname: 'test',
    reload: () => {
      reloads++;
      leave.forEach(fn => fn());
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('switching games while signed in', () => {
  it("from the Journey to Classic: Classic's saves stay exactly as they were", async () => {
    const classic = JSON.stringify(save(999, 1000));
    cloud.set(CLASSIC, classic);
    local.set('pg-save-u1', classic);
    local.set('pg-track', 'journey');
    local.set('pg-journey-save-u1', JSON.stringify(journeySave(111, 2000)));

    const { store, switchTrack } = await openPage();
    expect(store.save.coins).toBe(111);
    await switchTrack('classic');
    await vi.advanceTimersByTimeAsync(5000);

    expect(reloads).toBe(1);
    expect(local.get('pg-track')).toBe('classic');
    expect(local.get('pg-save-u1')).toBe(classic);
    expect(cloud.get(CLASSIC)).toBe(classic);

    const next = await openPage();
    expect(next.store.save.coins).toBe(999);
    expect(next.store.save.journey).toBeUndefined();
    expect(JSON.parse(cloud.get(JOURNEY)!).coins).toBe(111);
  });

  it("from Classic to the Journey: the Journey's saves stay exactly as they were", async () => {
    const journey = JSON.stringify(journeySave(111, 1000));
    cloud.set(JOURNEY, journey);
    local.set('pg-journey-save-u1', journey);
    local.set('pg-track', 'classic');
    local.set('pg-save-u1', JSON.stringify(save(999, 2000)));

    const { switchTrack } = await openPage();
    await switchTrack('journey');
    await vi.advanceTimersByTimeAsync(5000);

    expect(local.get('pg-journey-save-u1')).toBe(journey);
    expect(cloud.get(JOURNEY)).toBe(journey);

    const next = await openPage();
    expect(next.store.save.coins).toBe(111);
    expect(next.store.save.journey?.active).toBe('kanto');
  });
});

describe('the track of a player who never chose', () => {
  it('a Classic save in the cloud sends them back to Classic, and nothing is written', async () => {
    const classic = JSON.stringify(save(999, 1000));
    cloud.set(CLASSIC, classic);

    await openPage();

    expect(local.get('pg-track')).toBe('classic');
    expect(reloads).toBe(1);
    expect(cloud.get(CLASSIC)).toBe(classic);
    expect(cloud.has(JOURNEY)).toBe(false);
  });

  it('with no Classic save they start the Journey, and their choice is kept', async () => {
    const { store } = await openPage();
    expect(store.save.journey?.active).toBe('kanto');
    expect(local.get('pg-track')).toBe('journey');
    expect(reloads).toBe(0);
  });

  it('a player who chose the Journey stays there, whatever Classic has', async () => {
    const classic = JSON.stringify(save(999, 1000));
    cloud.set(CLASSIC, classic);
    local.set('pg-track', 'journey');

    const { store } = await openPage();

    expect(store.save.journey?.active).toBe('kanto');
    expect(reloads).toBe(0);
    expect(cloud.get(CLASSIC)).toBe(classic);
  });
});

describe('reloading offline', () => {
  it("traveling doesn't wait forever for the cloud, and the local save has the new chapter", async () => {
    local.set('pg-track', 'journey');
    local.set('pg-journey-save-u1', JSON.stringify(journeySave(111, 2000)));
    const { store, travelTo } = await openPage();
    store.save.league.titles = 1;
    offline.on = true;

    const going = travelTo('johto');
    await vi.advanceTimersByTimeAsync(5000);

    expect(await going).toBe(true);
    expect(reloads).toBe(1);
    expect(JSON.parse(local.get('pg-journey-save-u1')!).journey.active).toBe('johto');
  });
});
