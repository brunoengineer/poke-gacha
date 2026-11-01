// Saved teams: named presets of up to six cards the player can load into the team in one click.
//   - A preset stores card keys. Evolving a card (or passing its level) rewrites it in every preset (see
//     progression.ts), so a saved Charmander comes back as the Charmeleon it became.
//   - Loading resolves each key again anyway: a card that is no longer owned becomes its owned evolved form, and
//     duplicates (two saved cards that merged into one) collapse. Whatever can't be found is skipped and reported.

import { descendants } from '../data/species';
import type { SaveData } from '../state/save';
import { cardKey, parseKey, type CardKey } from './cards';
import { DECK_SIZE } from './economy';

export interface SavedTeam {
  id: string;
  name: string;
  keys: CardKey[];
}

export const MAX_SAVED_TEAMS = 8;
export const TEAM_NAME_MAX = 24;

/** The card a saved key stands for now: itself if owned, else its nearest owned evolved form (never for shinies). */
export function resolveKey(save: Pick<SaveData, 'cards'>, key: CardKey): CardKey | null {
  if (save.cards[key]) return key;
  const { id, shiny } = parseKey(key);
  if (shiny) return null;
  return descendants(id).map(d => cardKey(d)).find(k => save.cards[k]) ?? null;
}

/** A saved team as it would load now: resolved, without duplicates, and how many cards couldn't be found. */
export function resolveTeam(save: Pick<SaveData, 'cards'>, team: SavedTeam): { keys: CardKey[]; missing: number } {
  const keys: CardKey[] = [];
  for (const key of team.keys) {
    const resolved = resolveKey(save, key);
    if (resolved && !keys.includes(resolved)) keys.push(resolved);
  }
  const found = team.keys.filter(key => resolveKey(save, key)).length;
  return { keys: keys.slice(0, DECK_SIZE), missing: team.keys.length - found };
}

const newId = () => `t${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const cleanName = (name: string, fallback: string) => name.trim().slice(0, TEAM_NAME_MAX) || fallback;

/** Saves the current team as a new preset. Returns it, or null when the team is empty or the list is full. */
export function saveCurrentTeam(save: SaveData, name: string): SavedTeam | null {
  if (!save.deck.length || save.teams.length >= MAX_SAVED_TEAMS) return null;
  const team: SavedTeam = { id: newId(), name: cleanName(name, 'Team'), keys: [...save.deck] };
  save.teams.push(team);
  return team;
}

/** Overwrites a preset with the current team. */
export function updateSavedTeam(save: SaveData, id: string): boolean {
  const team = save.teams.find(t => t.id === id);
  if (!team || !save.deck.length) return false;
  team.keys = [...save.deck];
  return true;
}

export function renameSavedTeam(save: SaveData, id: string, name: string): boolean {
  const team = save.teams.find(t => t.id === id);
  if (!team) return false;
  team.name = cleanName(name, team.name);
  return true;
}

export function deleteSavedTeam(save: SaveData, id: string): boolean {
  const before = save.teams.length;
  save.teams = save.teams.filter(t => t.id !== id);
  return save.teams.length < before;
}

/**
 * Puts a preset in the team. The preset is healed to what it resolved to, so it stays accurate.
 * Returns how many saved cards couldn't be found, or null when the preset doesn't exist or has nothing left.
 */
export function loadSavedTeam(save: SaveData, id: string): { missing: number } | null {
  const team = save.teams.find(t => t.id === id);
  if (!team) return null;
  const { keys, missing } = resolveTeam(save, team);
  if (!keys.length) return null;
  save.deck = [...keys];
  team.keys = [...keys];
  return { missing };
}

/** The preset that matches the current team exactly (same cards, same order), if any. */
export function activeSavedTeam(save: Pick<SaveData, 'cards' | 'deck' | 'teams'>): SavedTeam | null {
  return save.teams.find(team => {
    const { keys } = resolveTeam(save, team);
    return keys.length === save.deck.length && keys.every((k, i) => k === save.deck[i]);
  }) ?? null;
}

/** Evolution / pass level: card `from` became `to`, so every preset that had it now has `to` (once). */
export function replaceInSavedTeams(save: Pick<SaveData, 'teams'>, from: CardKey, to: CardKey) {
  for (const team of save.teams) {
    const at = team.keys.indexOf(from);
    if (at < 0) continue;
    if (team.keys.includes(to)) team.keys.splice(at, 1);
    else team.keys[at] = to;
  }
}

/** Keeps only well-formed presets from a stored save (normalizeSave). */
export function normalizeSavedTeams(raw: unknown): SavedTeam[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is SavedTeam =>
    !!t && typeof t === 'object' && typeof t.id === 'string' && typeof t.name === 'string'
    && Array.isArray(t.keys) && t.keys.every((k: unknown) => typeof k === 'string'))
    .map(t => ({ ...t, keys: t.keys.slice(0, DECK_SIZE) }));
}
