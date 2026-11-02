import { describe, expect, it } from 'vitest';
import { getSpecies, hasSpecies } from '../../data/species';
import { defaultSave, normalizeSave } from '../../state/save';
import { seeded } from '../rng';
import { ASH_COOLDOWN, ASH_ROSTER, ashTeam, ashUnlocked, ashWait, finishAshBattle, PIKACHU, startAshBattle } from './ash';
import { reputationAt } from './competition';

const SCALE = { average: 178, max: 330 };

describe('Ash', () => {
  it('brings five from his roster at his level, and Pikachu 100 above the strongest', () => {
    const team = ashTeam(SCALE, seeded(3));
    expect(team).toHaveLength(6);
    expect(team.slice(0, 5).every(m => m.level === 249 && ASH_ROSTER.includes(m.id))).toBe(true);
    expect(new Set(team.map(m => m.id)).size).toBe(6);
    expect(team[5]).toEqual({ id: PIKACHU, level: 430 });
  });

  it('changes his team between battles', () => {
    const teams = new Set([1, 2, 3, 4, 5].map(seed => ashTeam(SCALE, seeded(seed)).map(m => m.id).join()));
    expect(teams.size).toBeGreaterThan(1);
  });

  it('only uses real species, never legendary, and never Pikachu twice', () => {
    expect(ASH_ROSTER.every(hasSpecies)).toBe(true);
    expect(new Set(ASH_ROSTER).size).toBe(ASH_ROSTER.length);
    expect(ASH_ROSTER).not.toContain(PIKACHU);
    expect(ASH_ROSTER.some(id => getSpecies(id).legendary || getSpecies(id).mythical)).toBe(false);
  });

  it('opens at No. 1 and stays open after losing the crown', () => {
    const { ladder } = defaultSave();
    expect(ashUnlocked(ladder)).toBe(false);
    ladder.rating = reputationAt(2) + 1;
    expect(ashUnlocked(ladder)).toBe(false);
    ladder.rating = reputationAt(1) + 1;
    expect(ashUnlocked(ladder)).toBe(true);
    ladder.best = 1;
    ladder.rating = 0;
    expect(ashUnlocked(ladder)).toBe(true);
  });

  it('allows one battle per hour, starting when the battle starts', () => {
    const { ladder } = defaultSave();
    ladder.best = 1;
    expect(startAshBattle(ladder, 1000)).toBe(true);
    expect(startAshBattle(ladder, 1001)).toBe(false);
    expect(ashWait(ladder, 1000 + ASH_COOLDOWN - 1)).toBe(1);
    expect(ashWait(ladder, 1000 + ASH_COOLDOWN)).toBe(0);
    expect(startAshBattle(ladder, 1000 + ASH_COOLDOWN)).toBe(true);
  });

  it("can't be fought before reaching No. 1", () => {
    const { ladder } = defaultSave();
    expect(startAshBattle(ladder, 1000)).toBe(false);
    expect(ladder.ash).toBeUndefined();
  });

  it("doesn't lock him out longer than an hour when the clock moved backwards", () => {
    const { ladder } = defaultSave();
    ladder.ash = { wins: 0, losses: 0, lastAt: 10_000_000 };
    expect(ashWait(ladder, 5_000)).toBe(ASH_COOLDOWN);
  });

  it('pays five Master Balls for a win, nothing for a loss', () => {
    const { ladder } = defaultSave();
    ladder.best = 1;
    startAshBattle(ladder, 1000);
    expect(finishAshBattle(ladder, false)).toEqual([]);
    expect(finishAshBattle(ladder, true)).toEqual([{ kind: 'item', item: 'master-ball', amount: 5 }]);
    expect(ladder.ash).toMatchObject({ wins: 1, losses: 1, lastAt: 1000 });
  });

  it('survives a save round trip, and older saves have no record', () => {
    const save = defaultSave();
    save.ladder.ash = { wins: 2, losses: 3, lastAt: 5 };
    expect(normalizeSave(structuredClone(save)).ladder.ash).toEqual({ wins: 2, losses: 3, lastAt: 5 });
    expect(normalizeSave(defaultSave()).ladder.ash).toBeUndefined();
  });
});
