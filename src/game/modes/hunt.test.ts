import { describe, expect, it } from 'vitest';
import { defaultSave, normalizeSave } from '../../state/save';
import { seeded } from '../rng';
import {
  CHAIN_MAX, defaultHuntSave, entryFee, hordeTeam, huntBlock, huntRewards, recordHunt, setTarget, shinyChance, shinyOdds,
} from './hunt';

describe('shiny hunt', () => {
  it('only hunts caught, non-legendary species', () => {
    const caught = { 25: 1, 150: 1 };
    expect(huntBlock(25, caught)).toBeNull();
    expect(huntBlock(150, caught)).toBe('legendary'); // Mewtwo
    expect(huntBlock(151, caught)).toBe('legendary'); // Mew
    expect(huntBlock(4, caught)).toBe('not-caught');
  });

  it('charges by rarity', () => {
    expect(entryFee(19)).toBe(100); // Rattata, common
    expect(entryFee(4)).toBe(250); // Charmander, rare
    expect(entryFee(6)).toBe(400); // Charizard, epic
  });

  it('raises the shiny chance with the chain, from 1/256 up to about 1/25', () => {
    expect(shinyOdds(0)).toBe(256);
    expect(shinyOdds(10)).toBe(78);
    expect(shinyOdds(25)).toBe(38);
    expect(shinyOdds(CHAIN_MAX)).toBe(25);
    expect(shinyChance(500)).toBe(shinyChance(CHAIN_MAX));
  });

  it('sends a horde of six of the species around the team level', () => {
    const team = hordeTeam(25, 30, seeded(3));
    expect(team).toHaveLength(6);
    expect(team.every(m => m.id === 25 && m.level >= 29 && m.level <= 31)).toBe(true);
  });

  it('drops copies about 35% of the time and the shiny at the chain odds', () => {
    const rng = seeded(11);
    let copies = 0;
    let shinies = 0;
    for (let i = 0; i < 20000; i++) {
      for (const r of huntRewards(25, CHAIN_MAX, rng)) {
        if (r.kind === 'card' && r.shiny) shinies++;
        else copies++;
      }
    }
    expect(copies / 20000).toBeCloseTo(0.35, 1);
    expect(shinies / 20000).toBeGreaterThan(0.03);
    expect(shinies / 20000).toBeLessThan(0.05);
  });

  it('grows the chain on wins, breaks it on a loss and restarts it on a new target', () => {
    const hunt = defaultHuntSave();
    setTarget(hunt, 25);
    recordHunt(hunt, true, false);
    recordHunt(hunt, true, true);
    expect(hunt).toMatchObject({ target: 25, chain: 2, bestChain: 2, wins: 2, shinies: 1 });
    setTarget(hunt, 25);
    expect(hunt.chain).toBe(2);
    recordHunt(hunt, false, false);
    expect(hunt).toMatchObject({ chain: 0, bestChain: 2, losses: 1 });
    recordHunt(hunt, true, false);
    setTarget(hunt, 4);
    expect(hunt).toMatchObject({ target: 4, chain: 0, bestChain: 2 });
  });

  it('gives older saves an empty hunt', () => {
    const old = defaultSave() as unknown as Record<string, unknown>;
    delete old.hunt;
    expect(normalizeSave(old).hunt).toEqual(defaultHuntSave());
  });
});
