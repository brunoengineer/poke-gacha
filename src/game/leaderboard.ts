// Online ranking rules: what a player publishes and how it is read back. Pure functions; the network side is in
// src/state/leaderboard.ts. Joining is opt-in and shows only a chosen nickname, never the Google account's name.

import { hasSpecies } from '../data/species';
import type { SaveData } from '../state/save';
import { cardPower, parseKey } from './cards';
import { DECK_SIZE } from './economy';

export type Board = 'tower' | 'power' | 'caught';
export const BOARDS: Board[] = ['tower', 'power', 'caught'];
export const TOP_SIZE = 50;

export interface LeaderboardStats {
  /** Best Infinity Tower floor. */
  tower: number;
  /** Combined Combat Power of the six strongest cards owned. */
  power: number;
  /** Species in the Pokédex plus shiny cards owned, so a complete Pokédex can still be told apart. */
  caught: number;
}

export interface LeaderboardEntry extends LeaderboardStats {
  uid: string;
  name: string;
}

/** The player's ranking settings, kept in the save (older saves: not joined). */
export interface OnlineSave {
  joined: boolean;
  nickname: string | null;
}

export const defaultOnlineSave = (): OnlineSave => ({ joined: false, nickname: null });

/** Same limits as firestore.rules: letters of any language, numbers, spaces, _ . - */
const NICKNAME = /^[\p{L}\p{N} _.-]{3,16}$/u;

export const cleanNickname = (raw: string) => raw.trim().replace(/\s+/g, ' ');
export const validNickname = (raw: string) => NICKNAME.test(cleanNickname(raw));

export function statsFromSave(save: Pick<SaveData, 'cards' | 'caught' | 'tower'>): LeaderboardStats {
  // A card from a newer release (species not loaded in this tab) just doesn't count yet.
  const powers = Object.entries(save.cards).flatMap(([key, card]) => {
    const { id, shiny } = parseKey(key);
    return hasSpecies(id) ? [cardPower(id, card.level, shiny)] : [];
  }).sort((a, b) => b - a);
  const shinies = Object.keys(save.cards).filter(key => {
    const { id, shiny } = parseKey(key);
    return shiny && hasSpecies(id);
  }).length;
  return {
    tower: save.tower.best,
    power: powers.slice(0, DECK_SIZE).reduce((sum, power) => sum + power, 0),
    caught: Object.keys(save.caught).length + shinies,
  };
}

const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

/** Reads an entry written by another player: anything can be in there, so only well-formed values get through. */
export function readEntry(uid: string, raw: unknown): LeaderboardEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.name !== 'string' || !validNickname(data.name)) return null;
  return { uid, name: cleanNickname(data.name), tower: count(data.tower), power: count(data.power), caught: count(data.caught) };
}

/** Order for a board: highest first, ties in a stable order. */
export const sortEntries = (entries: LeaderboardEntry[], board: Board) =>
  [...entries].sort((a, b) => b[board] - a[board] || a.uid.localeCompare(b.uid));
