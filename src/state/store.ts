// App state: the signed-in player, their save, and sync status. Screens subscribe with on(event, fn).
// Every change to the save goes through update(), which stamps it, persists it (localStorage right away,
// Firestore debounced when signed in) and emits the listed events.
//
// Auth flow (ported from chess-rpg): Google sign-in loads the newest of the local and cloud saves; a brand-new
// account adopts this browser's guest progress once; if the cloud can't be reached and there is no local copy,
// sign-in stops instead of risking an overwrite of a real cloud save.

import { L } from '../i18n';
import { firebaseEnabled, loadCloudSave, signInWithGoogle, signOutUser, watchAuth, writeCloudSave } from './firebase';
import { chooseAccountSave, defaultSave, normalizeSave, type SaveData } from './save';

export interface Player {
  uid: string;
  name: string;
  photo?: string | null;
  guest: boolean;
}

export type Phase = 'boot' | 'login' | 'loading' | 'game';
export type Sync = 'local' | 'saving' | 'saved' | 'error';

/**
 * Events: `coins` (detail: delta), `cards` (detail: changed card keys, or undefined for "anything"),
 * `deck`, `items`, `progress` (badges, ladder, league, training), `settings`, `phase`, `player`, `sync`.
 */
export type GameEvent = 'coins' | 'cards' | 'deck' | 'items' | 'progress' | 'settings' | 'phase' | 'player' | 'sync';

export const store: {
  phase: Phase;
  player: Player | null;
  save: SaveData;
  sync: Sync;
  authError: string | null;
} = {
  phase: 'boot',
  player: null,
  save: defaultSave(),
  sync: 'local',
  authError: null,
};

/** Shortcut for the current save (read-only use; change it through update()). */
export const save = () => store.save;

// --- Events --------------------------------------------------------------

type Listener = (detail?: unknown) => void;
const listeners = new Map<GameEvent, Set<Listener>>();

export function on(event: GameEvent, fn: Listener): () => void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(fn);
  return () => listeners.get(event)!.delete(fn);
}

export function emit(event: GameEvent, detail?: unknown) {
  listeners.get(event)?.forEach(fn => {
    try {
      fn(detail);
    } catch (error) {
      console.error(`Listener for "${event}" failed`, error);
    }
  });
}

/**
 * Changes the save. `fn` mutates the save in place and may return a value, which update() returns.
 * Coin changes are detected and emitted automatically (with the delta); list the other events that apply.
 */
export function update<T>(fn: (s: SaveData) => T, events: GameEvent[] = [], detail?: Partial<Record<GameEvent, unknown>>): T {
  const s = store.save;
  const coins = s.coins;
  const result = fn(s);
  s.updatedAt = Date.now();
  persist();
  if (s.coins !== coins) emit('coins', s.coins - coins);
  for (const event of events) emit(event, detail?.[event]);
  return result;
}

function setPhase(phase: Phase) {
  store.phase = phase;
  emit('phase', phase);
}

function setSync(sync: Sync) {
  if (store.sync === sync) return;
  store.sync = sync;
  emit('sync', sync);
}

// --- Persistence ---------------------------------------------------------

const GUEST_FLAG = 'pg-guest';
const localKey = (uid: string) => `pg-save-${uid}`;

function readLocal(uid: string): SaveData | null {
  try {
    const raw = localStorage.getItem(localKey(uid));
    return raw ? normalizeSave(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeLocal(uid: string, s: SaveData) {
  try {
    localStorage.setItem(localKey(uid), JSON.stringify(s));
  } catch {
    /* storage full or blocked: cloud save still works */
  }
}

/** Renames a local save (kept as a backup, never read again by the game). */
function moveLocal(from: string, to: string) {
  try {
    const raw = localStorage.getItem(localKey(from));
    if (raw) localStorage.setItem(localKey(to), raw);
    localStorage.removeItem(localKey(from));
  } catch {
    /* storage blocked: nothing to move */
  }
}

let localTimer: ReturnType<typeof setTimeout> | null = null;
let cloudTimer: ReturnType<typeof setTimeout> | null = null;

function flushLocal() {
  if (localTimer) clearTimeout(localTimer);
  localTimer = null;
  if (store.player) writeLocal(store.player.uid, store.save);
}

async function flushCloud() {
  if (cloudTimer) clearTimeout(cloudTimer);
  cloudTimer = null;
  const { player, save: s } = store;
  if (!player || player.guest) return;
  setSync('saving');
  try {
    await writeCloudSave(player.uid, s);
    // A change made while writing is still waiting for its own write.
    setSync(cloudTimer ? 'saving' : 'saved');
  } catch (error) {
    console.error('Cloud save failed', error);
    setSync('error');
  }
}

function persist() {
  const { player } = store;
  if (!player) return;
  // Batches of captures can call update() hundreds of times: write locally on the next tick.
  if (!localTimer) localTimer = setTimeout(flushLocal, 0);
  if (player.guest) return;
  if (cloudTimer) clearTimeout(cloudTimer);
  setSync('saving');
  cloudTimer = setTimeout(() => void flushCloud(), 2000);
}

if (typeof document !== 'undefined') {
  const flushAll = () => {
    flushLocal();
    if (cloudTimer) void flushCloud();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll();
  });
  addEventListener('pagehide', flushAll);
}

// --- Auth ----------------------------------------------------------------

function enterGame(player: Player, s: SaveData) {
  store.player = player;
  store.save = s;
  emit('player', player);
  setPhase('game');
}

async function loadAccount(user: { uid: string; displayName: string | null; photoURL: string | null }) {
  store.authError = null;
  // A guest signing in from the game keeps playing (and saving) as a guest if the account can't load.
  const previous = store.phase === 'game' ? store.player : null;
  setPhase('loading');
  const player: Player = { uid: user.uid, name: user.displayName ?? 'Trainer', photo: user.photoURL, guest: false };
  const local = readLocal(user.uid);
  let cloud: SaveData | null = null;
  let cloudOk = true;
  try {
    const raw = await loadCloudSave(user.uid);
    cloud = raw ? normalizeSave(raw) : null;
  } catch (error) {
    console.error('Cloud load failed', error);
    cloudOk = false;
  }
  const choice = chooseAccountSave(local, cloud, cloudOk, readLocal('guest'));
  if (choice.kind === 'abort') {
    await signOutUser();
    store.player = previous;
    store.authError = L().core.login.cloudLoad;
    setPhase(previous ? 'game' : 'login');
    return;
  }
  // Guest progress moves into this account only once; other new accounts on this browser start fresh.
  if (choice.fromGuest) moveLocal('guest', `guest-moved-to-${user.uid}`);
  try { localStorage.removeItem(GUEST_FLAG); } catch { /* storage blocked */ }
  enterGame(player, choice.save);
  setSync(cloudOk ? 'saved' : 'error');
  if (!cloud || choice.save.updatedAt > cloud.updatedAt) {
    writeLocal(player.uid, choice.save);
    void flushCloud();
  }
}

/** Starts listening to Firebase auth (or falls back to guest/login). Call once at startup. */
export function bootAuth() {
  watchAuth(user => {
    if (user) {
      void loadAccount(user);
    } else if (localStorage.getItem(GUEST_FLAG)) {
      playAsGuest();
    } else {
      store.player = null;
      setPhase('login');
    }
  });
}

export function playAsGuest() {
  try { localStorage.setItem(GUEST_FLAG, '1'); } catch { /* storage blocked */ }
  enterGame({ uid: 'guest', name: L().core.account.guest, guest: true }, readLocal('guest') ?? defaultSave());
  setSync('local');
}

export async function signIn() {
  if (!firebaseEnabled) {
    store.authError = L().core.login.notConfigured;
    emit('phase', store.phase);
    return;
  }
  try {
    store.authError = null;
    await signInWithGoogle();
  } catch (error) {
    store.authError = (error as Error).message || L().core.login.failed;
    emit('phase', store.phase);
  }
}

export async function signOut() {
  flushLocal();
  if (cloudTimer) await flushCloud();
  try { localStorage.removeItem(GUEST_FLAG); } catch { /* storage blocked */ }
  await signOutUser();
  location.hash = '';
  location.reload();
}

export async function resetProgress() {
  const settings = store.save.settings;
  const fresh = defaultSave();
  fresh.settings = settings;
  fresh.updatedAt = Date.now();
  store.save = fresh;
  flushLocal();
  if (store.player && !store.player.guest) await flushCloud();
  location.hash = '';
  location.reload();
}

export const isFirebaseEnabled = () => firebaseEnabled;
