import { describe, expect, it } from 'vitest';
import { defaultSave } from '../state/save';
import { gymDifficulty, gymTeam, REGION_GYMS } from './modes/gyms';
import { buildBracket, duelDifficulty, duelInfo, runScale, startRun } from './modes/league';
import { seeded } from './rng';
import { scaleGym, teamScale, type PlayerScale } from './scaling';

const OUTGROWN: PlayerScale = { average: 178, max: 330 };
const kanto = REGION_GYMS.kanto;

describe('team scale', () => {
  it('reads the average and the strongest Pokémon', () => {
    expect(teamScale([330, 148, 148, 148, 148, 148])).toEqual(OUTGROWN);
    expect(teamScale([])).toEqual({ average: 0, max: 0 });
  });
});

describe('gyms against an overleveled team', () => {
  it('keeps the designed levels until the average passes them', () => {
    const brock = kanto[0];
    for (const average of [1, 10, 19]) {
      expect(gymDifficulty(defaultSave().gyms, brock, { average, max: 300 })).toEqual({ levels: [15, 19], ace: null, scaled: false });
    }
  });

  it('brings a team below the levels the very same battle as no scaling at all', () => {
    const gym = kanto[3];
    const gyms = defaultSave().gyms;
    expect(gymTeam(gyms, gym, seeded(9), { average: 20, max: 34 })).toEqual(gymTeam(gyms, gym, seeded(9)));
  });

  it('reaches a growing share of the average along the region', () => {
    const gyms = defaultSave().gyms;
    const levels = kanto.map(gym => gymDifficulty(gyms, gym, OUTGROWN).levels[0]);
    expect(levels).toEqual([116, 125, 134, 142, 151, 160, 169, 178]);
  });

  it('gives the last gym the average on the whole team and an ace at the strongest level', () => {
    const giovanni = kanto[7];
    expect(gymDifficulty(defaultSave().gyms, giovanni, OUTGROWN)).toEqual({ levels: [178, 178], ace: 330, scaled: true });
    const team = gymTeam(defaultSave().gyms, giovanni, seeded(2), OUTGROWN);
    expect(team.map(m => m.level)).toEqual([178, 178, 178, 178, 178, 330]);
  });

  it('never lowers a gym, and only says it scaled when something changed', () => {
    // Average above the gym, but its share is still below the designed levels.
    expect(scaleGym([106, 109], 3, { average: 110, max: 110 })).toEqual({ levels: [106, 109], ace: null, scaled: false });
    expect(scaleGym([106, 109], 3, { average: 200, max: 200 })).toEqual({ levels: [160, 160], ace: null, scaled: true });
  });

  it('keeps the ace from dropping below the team on a flat team', () => {
    expect(scaleGym([54, 58], 7, { average: 90, max: 90 })).toEqual({ levels: [90, 90], ace: 90, scaled: true });
  });

  it('counts the rematch bonus as part of the designed levels', () => {
    const gyms = defaultSave().gyms;
    gyms.badges.push('boulder');
    gyms.records.brock = { wins: 4, losses: 0 };
    expect(gymDifficulty(gyms, kanto[0], { average: 50, max: 50 })).toEqual({ levels: [55, 59], ace: null, scaled: false });
    expect(gymDifficulty(gyms, kanto[0], { average: 100, max: 100 }).levels).toEqual([65, 65]);
  });
});

describe('leagues against an overleveled team', () => {
  it('scales all four duels once the average passes the top level of the League', () => {
    expect([0, 1, 2, 3].map(duel => duelDifficulty(duel, 0, 'kanto', OUTGROWN))).toEqual([
      { levels: [178, 178], ace: null, scaled: true },
      { levels: [196, 196], ace: null, scaled: true },
      { levels: [214, 214], ace: null, scaled: true },
      { levels: [231, 231], ace: 330, scaled: true },
    ]);
  });

  it('keeps every duel as designed up to that level, so a semifinal never outscales the final', () => {
    const at70 = { average: 70, max: 300 };
    expect([0, 1, 2, 3].map(duel => duelDifficulty(duel, 0, 'kanto', at70).levels)).toEqual([[60, 63], [62, 66], [64, 68], [66, 70]]);
    const at71 = { average: 71, max: 71 };
    const levels = [0, 1, 2, 3].map(duel => duelDifficulty(duel, 0, 'kanto', at71).levels[0]);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it('counts the title bonus as part of the designed levels', () => {
    expect(duelDifficulty(3, 40, 'kanto', { average: 110, max: 110 })).toEqual({ levels: [106, 110], ace: null, scaled: false });
    expect(duelDifficulty(3, 40, 'kanto', { average: 111, max: 111 }).scaled).toBe(true);
  });

  it('keeps the ace from dropping below the team on a flat team', () => {
    expect(duelDifficulty(3, 0, 'kanto', { average: 100, max: 100 })).toEqual({ levels: [130, 130], ace: 130, scaled: true });
  });

  it('builds the final with the ace last, and follows the registered team', () => {
    const save = defaultSave();
    save.starter = 4;
    save.coins = 5000;
    save.gyms.badges = kanto.map(g => g.badge);
    save.deck = ['6', '9', '3', '25', '143', '94s'];
    for (const key of save.deck) save.cards[key] = { level: 148, copies: 1, obtainedAt: 0 };
    save.cards['94s'].level = 330;
    startRun(save, 5);
    const run = save.league.run!;
    expect(runScale(save, run)).toEqual(OUTGROWN);

    const bracket = buildBracket(save.ladder.seed, run.seed, save.starter, 'kanto');
    const final = duelInfo(bracket, run, 3, save.starter, 'kanto', runScale(save, run));
    expect(final.team.map(m => m.level)).toEqual([231, 231, 231, 231, 231, 330]);
    expect(final).toMatchObject({ levels: [231, 231], ace: 330, scaled: true, final: true });
    expect(duelInfo(bracket, run, 3, save.starter, 'kanto', runScale(save, run))).toEqual(final); // stable when coming back

    // Changing the current team doesn't change the run's difficulty; levels of the registered team do.
    save.deck = ['25'];
    expect(runScale(save, run)).toEqual(OUTGROWN);
    save.cards['94s'].level = 336;
    expect(runScale(save, run)).toEqual({ average: 179, max: 336 });
  });
});
