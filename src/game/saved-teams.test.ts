import { describe, expect, it } from 'vitest';
import { defaultSave, normalizeSave } from '../state/save';
import { cardKey } from './cards';
import { evolve, transferLevel } from './progression';
import {
  activeSavedTeam, deleteSavedTeam, loadSavedTeam, MAX_SAVED_TEAMS, normalizeSavedTeams, renameSavedTeam, resolveKey,
  saveCurrentTeam, updateSavedTeam,
} from './saved-teams';

const card = (level: number) => ({ level, copies: 1, obtainedAt: 0 });

function withCards(...keys: string[]) {
  const save = defaultSave();
  for (const key of keys) save.cards[key] = card(20);
  return save;
}

describe('saved teams', () => {
  it('saves, loads, renames, overwrites and deletes presets', () => {
    const save = withCards('4', '7', '25', '1');
    save.deck = ['4', '7'];
    const team = saveCurrentTeam(save, '  Fire & Water  ')!;
    expect(team.name).toBe('Fire & Water');
    expect(activeSavedTeam(save)?.id).toBe(team.id);

    save.deck = ['25'];
    expect(activeSavedTeam(save)).toBeNull();
    expect(loadSavedTeam(save, team.id)).toEqual({ missing: 0 });
    expect(save.deck).toEqual(['4', '7']);

    save.deck = ['1', '25'];
    updateSavedTeam(save, team.id);
    expect(save.teams[0].keys).toEqual(['1', '25']);
    renameSavedTeam(save, team.id, '   ');
    expect(save.teams[0].name).toBe('Fire & Water'); // blank names keep the old one
    expect(deleteSavedTeam(save, team.id)).toBe(true);
    expect(save.teams).toEqual([]);
  });

  it("doesn't save an empty team or more than the limit", () => {
    const save = withCards('4');
    expect(saveCurrentTeam(save, 'Empty')).toBeNull();
    save.deck = ['4'];
    for (let i = 0; i < MAX_SAVED_TEAMS; i++) expect(saveCurrentTeam(save, `T${i}`)).not.toBeNull();
    expect(saveCurrentTeam(save, 'One too many')).toBeNull();
  });

  it('follows an evolution: the saved Charmander comes back as Charmeleon, in the same slot', () => {
    const save = withCards('4', '7', '25');
    save.cards['4'].level = 16;
    save.deck = ['25', '4', '7'];
    const team = saveCurrentTeam(save, 'Mine')!;
    save.deck = ['25'];
    evolve(save, '4', 5);
    expect(save.teams[0].keys).toEqual(['25', '5', '7']);
    loadSavedTeam(save, team.id);
    expect(save.deck).toEqual(['25', '5', '7']);
  });

  it('merges two saved cards that became one (evolving into an owned card, passing a level)', () => {
    const save = withCards('33', '34', '7');
    save.deck = ['33', '34', '7'];
    saveCurrentTeam(save, 'Nidos');
    transferLevel(save, '33', 34); // Nidorino -> owned Nidoking
    expect(save.teams[0].keys).toEqual(['34', '7']);
  });

  it('resolves keys at load time too (a preset that missed an evolution) and heals the preset', () => {
    const save = withCards('6', '7');
    // A preset that still says Charmander, though only Charizard is owned now.
    save.teams = [{ id: 'old', name: 'Old', keys: ['4', '7', '150'] }];
    expect(resolveKey(save, '4')).toBe('6');
    expect(resolveKey(save, '150')).toBeNull();
    expect(loadSavedTeam(save, 'old')).toEqual({ missing: 1 });
    expect(save.deck).toEqual(['6', '7']);
    expect(save.teams[0].keys).toEqual(['6', '7']);
  });

  it('never routes a shiny to another card, and reports a preset with nothing left', () => {
    const save = withCards('6');
    expect(resolveKey(save, cardKey(4, true))).toBeNull();
    save.teams = [{ id: 'gone', name: 'Gone', keys: [cardKey(4, true)] }];
    expect(loadSavedTeam(save, 'gone')).toBeNull();
    expect(save.deck).toEqual([]);
  });

  it('keeps well-formed presets from stored saves and drops broken ones', () => {
    expect(normalizeSavedTeams(undefined)).toEqual([]);
    expect(normalizeSavedTeams([{ id: 'a', name: 'A', keys: ['4'] }, { id: 1 }, null, { id: 'b', name: 'B', keys: [4] }]))
      .toEqual([{ id: 'a', name: 'A', keys: ['4'] }]);
    const old = defaultSave() as unknown as Record<string, unknown>;
    delete old.teams;
    expect(normalizeSave(old).teams).toEqual([]);
  });
});
