// Online ranking, network side (rules in src/game/leaderboard.ts, access in firestore.rules). Only signed-in players who
// joined with a nickname publish an entry; anyone can read the boards. Publishing waits a little after a change, so a
// busy session writes at most a few times per minute, and skips writing when nothing changed.
//
// Test mode: on localhost, window.__PG_FAKE_LEADERBOARD__ (an array) replaces Firestore, and counts as signed in unless
// window.__PG_FAKE_LEADERBOARD_GUEST__ is set.

import {
  cleanNickname, readEntry, sortEntries, statsFromSave, TOP_SIZE, validNickname, type Board, type LeaderboardEntry,
} from '../game/leaderboard';
import { deleteLeaderboardEntry, fetchLeaderboardPosition, fetchLeaderboardTop, firebaseEnabled, writeLeaderboardEntry } from './firebase';
import { on, store, update } from './store';

type FakeWindow = Window & { __PG_FAKE_LEADERBOARD__?: LeaderboardEntry[]; __PG_FAKE_LEADERBOARD_GUEST__?: boolean };
const fake = () => (typeof window !== 'undefined' && location.hostname === 'localhost' ? (window as FakeWindow).__PG_FAKE_LEADERBOARD__ ?? null : null);

const SYNC_DELAY = 30_000;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastSent = '';

/** True when the online ranking can be read at all (Firebase configured). */
export const leaderboardAvailable = () => firebaseEnabled || !!fake();
/** True when this player can publish: guests can only read. */
export const canJoinLeaderboard = () => (fake() ? !(window as FakeWindow).__PG_FAKE_LEADERBOARD_GUEST__ : !!store.player && !store.player.guest);
export const hasJoinedLeaderboard = () => store.save.online.joined && !!store.save.online.nickname && canJoinLeaderboard();

const myUid = () => store.player?.uid ?? 'guest';

/** The player's entry as it would be published now (null when they haven't joined). */
export function myEntry(): LeaderboardEntry | null {
  if (!hasJoinedLeaderboard()) return null;
  return { uid: myUid(), name: store.save.online.nickname!, ...statsFromSave(store.save) };
}

/** Publishes the player's entry if it changed. Never throws: a failure just tries again on the next change. */
export async function syncLeaderboard(): Promise<boolean> {
  if (timer) clearTimeout(timer);
  timer = null;
  const entry = myEntry();
  if (!entry) return true;
  const { uid, ...data } = entry;
  const json = JSON.stringify(entry);
  if (json === lastSent) return true;
  const fakeBoard = fake();
  try {
    if (fakeBoard) {
      const at = fakeBoard.findIndex(e => e.uid === uid);
      if (at >= 0) fakeBoard[at] = entry;
      else fakeBoard.push(entry);
    } else {
      await writeLeaderboardEntry(uid, data);
    }
    lastSent = json;
    return true;
  } catch (error) {
    console.warn('Leaderboard update failed', error);
    return false;
  }
}

function schedule() {
  if (hasJoinedLeaderboard() && !timer) timer = setTimeout(() => void syncLeaderboard(), SYNC_DELAY);
}

/** Keeps the player's entry current while they play. */
export function initLeaderboardSync() {
  on('progress', schedule);
  on('cards', schedule);
  on('player', () => {
    lastSent = '';
    schedule();
  });
  schedule();
}

/** Joins the ranking, or changes the nickname. Resolves false when the nickname is invalid or publishing failed. */
export async function joinLeaderboard(rawName: string): Promise<boolean> {
  if (!validNickname(rawName) || !canJoinLeaderboard()) return false;
  const before = { ...store.save.online };
  const nickname = cleanNickname(rawName);
  update(save => { save.online = { joined: true, nickname }; }, ['progress']);
  if (await syncLeaderboard()) return true;
  update(save => { save.online = before; }, ['progress']);
  return false;
}

/** Leaves the ranking: the entry is removed from the boards. */
export async function leaveLeaderboard(): Promise<boolean> {
  const uid = myUid();
  try {
    const fakeBoard = fake();
    if (fakeBoard) {
      const at = fakeBoard.findIndex(e => e.uid === uid);
      if (at >= 0) fakeBoard.splice(at, 1);
    } else {
      await deleteLeaderboardEntry(uid);
    }
  } catch (error) {
    console.warn('Leaving the leaderboard failed', error);
    return false;
  }
  lastSent = '';
  update(save => { save.online = { ...save.online, joined: false }; }, ['progress']);
  return true;
}

/** The top of a board, without players who have no score on it. Throws when it can't be read. */
export async function fetchTop(board: Board): Promise<LeaderboardEntry[]> {
  const fakeBoard = fake();
  const rows = fakeBoard
    ? fakeBoard.map(e => ({ uid: e.uid, data: e as unknown }))
    : await fetchLeaderboardTop(board, TOP_SIZE);
  const entries = rows.flatMap(row => readEntry(row.uid, row.data) ?? []);
  return sortEntries(entries.filter(e => e[board] > 0), board).slice(0, TOP_SIZE);
}

/** A score's place on a board: players strictly ahead + 1 (players tied share a place). Throws when it can't be read. */
export async function fetchPosition(board: Board, value: number): Promise<number> {
  const fakeBoard = fake();
  if (fakeBoard) return fakeBoard.filter(e => e[board] > value).length + 1;
  return fetchLeaderboardPosition(board, value);
}
