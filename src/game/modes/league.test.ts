import { describe, expect, it } from 'vitest';
import { defaultSave } from '../../state/save';
import {
  type DuelResult, abandonRun, buildBracket, canEnter, duelInfo, LEAGUE_FEE, MAX_BONUS, recordDuel, startRun, titleBonus,
} from './league';

const rewardsOf = (r: DuelResult | null) => (r && 'rewards' in r ? r.rewards : []);

function leagueSave() {
  const save = defaultSave();
  save.gyms.badges = ['boulder', 'cascade', 'thunder', 'rainbow', 'soul', 'marsh', 'volcano', 'earth'];
  save.coins = 5000;
  save.starter = 4;
  return save;
}

describe('pokémon league', () => {
  it('needs 8 badges and the entry fee', () => {
    const save = defaultSave();
    expect(canEnter(save)).toBe('locked');
    const ready = leagueSave();
    ready.coins = 999;
    expect(canEnter(ready)).toBe('coins');
    ready.coins = LEAGUE_FEE;
    expect(startRun(ready, 1)).toBe(true);
    expect(ready.coins).toBe(0);
    expect(ready.league.runs).toBe(1);
    expect(canEnter(ready)).toBe('running');
  });

  it('builds a 16-slot bracket where the path is elite trainer, two Elite Four, then Blue', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const b = buildBracket(77, seed, 1);
      expect(b.slots).toHaveLength(16);
      expect(new Set(b.slots.map(e => e.id)).size).toBe(16);
      expect(b.path.map(e => e.kind)).toEqual(['elite', 'e4', 'e4', 'champion']);
      expect(b.path[3].name).toBe('Blue');
      expect(b.rounds.map(r => r.length)).toEqual([16, 8, 4, 2, 1]);
      expect(b.rounds[4][0]).toBe(0);
    }
    expect(buildBracket(77, 5, 1)).toEqual(buildBracket(77, 5, 1));
  });

  it('scales duel levels with titles and keeps teams stable', () => {
    expect(titleBonus(3)).toBe(15);
    expect(titleBonus(20)).toBe(MAX_BONUS);
    const save = leagueSave();
    save.league.titles = 2;
    startRun(save, 10);
    const run = save.league.run!;
    const b = buildBracket(save.ladder.seed, run.seed, save.starter);
    const first = duelInfo(b, run, 0, save.starter);
    expect(first.team).toHaveLength(6);
    for (const m of first.team) expect(m.level).toBeGreaterThanOrEqual(65);
    expect(duelInfo(b, run, 0, save.starter)).toEqual(first);
    const final = duelInfo(b, run, 3, save.starter);
    expect(final.final).toBe(true);
    expect(final.team.at(-1)!.id).toBe(9); // Blastoise answers Charmander
    expect(final.team.at(-1)!.level).toBe(Math.max(...final.team.map(m => m.level)));
  });

  it('ends the run on the first loss with that round placement', () => {
    const save = leagueSave();
    startRun(save, 3);
    expect(recordDuel(save, true)).toEqual({ kind: 'advance', duel: 1 });
    const out = recordDuel(save, false);
    expect(out).toMatchObject({ kind: 'out', placement: 1 });
    expect(rewardsOf(out)).toContainEqual({ kind: 'item', item: 'great-ball', amount: 5 });
    expect(save.league.run).toBeUndefined();
    expect(save.league.best).toBe(1);
  });

  it('crowns the champion, adds the Hall of Fame entry and the shiny starter once', () => {
    const save = leagueSave();
    const team = [{ id: 6, level: 70 }];
    startRun(save, 4);
    for (let i = 0; i < 3; i++) recordDuel(save, true, team);
    const win = recordDuel(save, true, team);
    expect(win).toMatchObject({ kind: 'champion', placement: 4, firstTitle: true });
    expect(rewardsOf(win)).toContainEqual({ kind: 'card', id: 4, shiny: true });
    expect(rewardsOf(win)).toContainEqual({ kind: 'item', item: 'master-ball', amount: 1 });
    expect(save.league).toMatchObject({ titles: 1, best: 4, duelsWon: 4 });
    expect(save.league.hall![0].team).toEqual([{ id: 6, level: 70, shiny: false }]);

    save.coins = 5000;
    startRun(save, 5);
    expect(save.league.run!.bonus).toBe(5);
    for (let i = 0; i < 3; i++) recordDuel(save, true, team);
    const again = recordDuel(save, true, team);
    expect(again).toMatchObject({ firstTitle: false });
    expect(rewardsOf(again).some(r => r.kind === 'card')).toBe(false);
  });

  it('counts abandoning as losing the current duel', () => {
    const save = leagueSave();
    startRun(save, 6);
    recordDuel(save, true);
    recordDuel(save, true);
    expect(abandonRun(save)).toMatchObject({ placement: 2 });
    expect(save.league.run).toBeUndefined();
  });
});
