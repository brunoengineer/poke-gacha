import { describe, expect, it } from 'vitest';
import enModes from '../../i18n/en/modes';
import ptModes from '../../i18n/pt/modes';
import { defaultSave, normalizeSave } from '../../state/save';
import { JOHTO_BADGES } from './gyms';
import {
  type DuelResult, abandonRun, buildBracket, canEnter, championBoss, duelInfo, firstTitleStarter, JOHTO_CHAMPION, JOHTO_ELITE_FOUR,
  JOHTO_LEAGUE_FEE, LEAGUE_FEE, leagueRecord, MAX_BONUS, placementRewards, recordDuel, startRun, titleBonus,
  applyHeal, healPending, healTargets, kitLeft, runTeam, setRunHp,
} from './league';

const TEAM = ['6', '9', '3', '25', '143', '130'];

const rewardsOf = (r: DuelResult | null) => (r && 'rewards' in r ? r.rewards : []);

function leagueSave() {
  const save = defaultSave();
  save.gyms.badges = ['boulder', 'cascade', 'thunder', 'rainbow', 'soul', 'marsh', 'volcano', 'earth'];
  save.coins = 5000;
  save.starter = 4;
  // A full team (the run registers it).
  for (const key of TEAM) save.cards[key] = { level: 70, copies: 1, obtainedAt: 0 };
  save.deck = [...TEAM];
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
    expect(recordDuel(save, true)).toEqual({ kind: 'advance', duel: 1, rewards: [] });
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

function johtoSave(starter = 4) {
  const save = leagueSave();
  save.gyms.badges.push(...JOHTO_BADGES);
  save.coins = 20000;
  save.starter = starter;
  return save;
}

describe('johto league', () => {
  it('needs the 8 Johto badges and its own fee, and runs apart from Kanto', () => {
    const save = leagueSave();
    save.gyms.badges.push(...JOHTO_BADGES.slice(0, 7));
    expect(canEnter(save, 'johto')).toBe('locked');
    save.gyms.badges.push(JOHTO_BADGES[7]);
    save.coins = JOHTO_LEAGUE_FEE - 1;
    expect(canEnter(save, 'johto')).toBe('coins');
    save.coins = JOHTO_LEAGUE_FEE + LEAGUE_FEE;
    expect(startRun(save, 1, 0, 'johto')).toBe(true);
    expect(save.coins).toBe(LEAGUE_FEE);
    expect(save.league.johto).toMatchObject({ runs: 1, run: { duel: 0, bonus: 0 } });
    expect(save.league).toMatchObject({ runs: 0, titles: 0 });
    expect(save.league.run).toBeUndefined();
    expect(canEnter(save, 'johto')).toBe('running');
    expect(canEnter(save)).toBe('ok');
  });

  it('meets an elite trainer, two of Will, Koga, Bruno and Karen in order, then Lance at Lv. 80-90', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const b = buildBracket(77, seed, 4, 'johto');
      expect(new Set(b.slots.map(e => e.id)).size).toBe(16);
      expect(b.path.map(e => e.kind)).toEqual(['elite', 'e4', 'e4', 'champion']);
      const order = b.path.slice(1, 3).map(e => JOHTO_ELITE_FOUR.findIndex(m => m.id === e.id));
      expect(order[0]).toBeGreaterThanOrEqual(0);
      expect(order[0]).toBeLessThan(order[1]);
      expect(b.path[3].id).toBe(JOHTO_CHAMPION.id);
    }
    const save = johtoSave();
    startRun(save, 8, 0, 'johto');
    const run = save.league.johto!.run!;
    const b = buildBracket(save.ladder.seed, run.seed, save.starter, 'johto');
    const first = duelInfo(b, run, 0, save.starter, 'johto');
    for (const m of first.team) expect(m.level).toBeGreaterThanOrEqual(80);
    const final = duelInfo(b, run, 3, save.starter, 'johto');
    expect(final.levels).toEqual([94, 98]);
    expect(final.team.at(-1)!.id).toBe(149);
  });

  it('pays double the Kanto table, with its own Champion prize', () => {
    expect(placementRewards(0, 'johto')).toEqual([{ kind: 'coins', amount: 500 }, { kind: 'item', item: 'rare-candy', amount: 10 }]);
    expect(placementRewards(2, 'johto')).toEqual([
      { kind: 'coins', amount: 3000 }, { kind: 'item', item: 'ultra-ball', amount: 6 }, { kind: 'item', item: 'rare-candy', amount: 40 },
    ]);
    expect(placementRewards(4, 'johto')).toEqual([
      { kind: 'coins', amount: 10000 }, { kind: 'item', item: 'master-ball', amount: 1 }, { kind: 'item', item: 'rare-candy', amount: 80 },
    ]);
  });

  it('gives the shiny counterpart starter on the first Johto title only', () => {
    const johto = (id: number) => firstTitleStarter(id, 'johto');
    expect([1, 4, 7, 152, 155, 158].map(johto)).toEqual([152, 155, 158, 1, 4, 7]);
    expect(firstTitleStarter(null, 'johto')).toBeNull();
    expect(firstTitleStarter(4, 'kanto')).toBe(4);
    // Hoenn and Sinnoh: their starter of your type; your own (a Hoenn starter in Hoenn) becomes Kanto's.
    expect([1, 4, 7, 255].map(id => firstTitleStarter(id, 'hoenn'))).toEqual([252, 255, 258, 4]);
    expect([152, 255, 390].map(id => firstTitleStarter(id, 'sinnoh'))).toEqual([387, 390, 4]);
    for (const [starter, prize] of [[1, 152], [4, 155], [7, 158], [152, 1], [155, 4], [158, 7]]) {
      const save = johtoSave(starter);
      const team = [{ id: 249, level: 90 }];
      startRun(save, 4, 0, 'johto');
      for (let i = 0; i < 3; i++) recordDuel(save, true, team, 0, 'johto');
      const win = recordDuel(save, true, team, 0, 'johto');
      expect(win).toMatchObject({ kind: 'champion', firstTitle: true });
      expect(rewardsOf(win)).toContainEqual({ kind: 'card', id: prize, shiny: true });
      expect(rewardsOf(win)).toContainEqual({ kind: 'coins', amount: 10000 });
      expect(save.league.johto).toMatchObject({ titles: 1, best: 4, duelsWon: 4 });
      expect(save.league.johto!.hall![0].team).toEqual([{ id: 249, level: 90, shiny: false }]);
      expect(save.league).toMatchObject({ titles: 0, best: -1 });
    }
    const save = johtoSave();
    save.league.johto = { runs: 1, best: 4, titles: 1 };
    startRun(save, 5, 0, 'johto');
    expect(save.league.johto.run!.bonus).toBe(5);
    for (let i = 0; i < 3; i++) recordDuel(save, true, [], 0, 'johto');
    expect(rewardsOf(recordDuel(save, true, [], 0, 'johto')).some(r => r.kind === 'card')).toBe(false);
    startRun(save, 6, 0, 'johto');
    recordDuel(save, true, [], 0, 'johto');
    expect(abandonRun(save, 'johto')).toMatchObject({ placement: 1 });
    expect(save.league.johto.run).toBeUndefined();
  });

  it('keeps old saves without Johto data working', () => {
    const old = normalizeSave({ league: { runs: 3, best: 2, titles: 0 }, gyms: { badges: ['boulder'], records: {} } });
    expect(old.league.johto).toBeUndefined();
    expect(leagueRecord(old, 'johto')).toEqual({ runs: 0, best: -1, titles: 0 });
    expect(canEnter(old, 'johto')).toBe('locked');
    expect(leagueRecord(old)).toMatchObject({ runs: 3, best: 2 });
  });

  it('has Blue answer a Johto starter by type, and lines for every Johto boss', () => {
    expect(championBoss(152).roster.at(-1)).toBe(6);
    expect(championBoss(155).roster.at(-1)).toBe(9);
    expect(championBoss(158).roster.at(-1)).toBe(3);
    expect(championBoss(1, 'johto')).toBe(JOHTO_CHAMPION);
    for (const bundle of [ptModes, enModes]) {
      for (const boss of [...JOHTO_ELITE_FOUR, JOHTO_CHAMPION]) expect(bundle.league.lines[boss.id]?.intro).toBeTruthy();
    }
  });
});

describe('league attrition', () => {
  const started = () => {
    const save = leagueSave();
    startRun(save, 7);
    return save;
  };

  it('registers the team at entry and needs a full one', () => {
    const save = leagueSave();
    save.deck = TEAM.slice(0, 5);
    expect(canEnter(save)).toBe('team');
    const ok = started();
    expect(ok.league.run!.team).toEqual(TEAM);
    ok.deck = ['6']; // changing the team afterwards doesn't change the run's
    expect(runTeam(ok, ok.league.run!).map(m => m.key)).toEqual(TEAM);
  });

  it('carries HP and faints over between duels', () => {
    const save = started();
    setRunHp(save, [1, 0.4, 0, 1, 1, 0.9]);
    recordDuel(save, true);
    expect(runTeam(save, save.league.run!).map(m => m.hp)).toEqual([1, 0.4, 0, 1, 1, 0.9]);
    expect(healPending(save, save.league.run!)).toBe(true);
  });

  it('gives 2 Revives and 4 Potions before each duel, and what is not used is lost', () => {
    const save = started();
    const key = (i: number) => TEAM[i];
    setRunHp(save, [0, 0, 0, 0.4, 0.3, 0.2]);
    recordDuel(save, true);
    const run = save.league.run!;
    const hp = () => runTeam(save, run).map(m => m.hp);
    expect(kitLeft(run)).toEqual({ potions: 4, revives: 2 });
    expect(healTargets(save, run)).toEqual({ potion: [key(3), key(4), key(5)], revive: [key(0), key(1), key(2)] });
    expect(applyHeal(save, 'potion', key(0))).toBe(false); // a fainted one needs a Revive
    expect(applyHeal(save, 'revive', key(3))).toBe(false); // and a Revive, a fainted one
    expect(applyHeal(save, 'revive', key(0))).toBe(true);
    expect(applyHeal(save, 'revive', key(1))).toBe(true);
    expect(applyHeal(save, 'revive', key(2))).toBe(false); // only two
    expect(applyHeal(save, 'potion', key(0))).toBe(true); // tops up one just revived
    expect(healPending(save, run)).toBe(true);
    for (const i of [3, 4, 5]) expect(applyHeal(save, 'potion', key(i))).toBe(true);
    expect(applyHeal(save, 'potion', key(1))).toBe(false); // only four
    expect(hp()).toEqual([1, 0.5, 0, 1, 1, 1]);
    expect(kitLeft(run)).toEqual({ potions: 0, revives: 0 });
    expect(healPending(save, run)).toBe(false);
    // The next duel gives a new set.
    setRunHp(save, hp());
    recordDuel(save, true);
    expect(kitLeft(run)).toEqual({ potions: 4, revives: 2 });
    expect(healPending(save, run)).toBe(true);
    // Nobody to use the rest on: the duel doesn't wait.
    setRunHp(save, [1, 1, 1, 1, 1, 0.5]);
    expect(applyHeal(save, 'potion', key(5))).toBe(true);
    expect(healPending(save, run)).toBe(false);
  });

  it('a run from before the items gets them too, even after its one heal choice', () => {
    const save = started();
    setRunHp(save, [0, 1, 1, 1, 1, 1]);
    recordDuel(save, true);
    const run = save.league.run!;
    run.healed = run.duel;
    expect(healPending(save, run)).toBe(true);
    expect(applyHeal(save, 'revive', TEAM[0])).toBe(true);
  });

  it('asks for nothing when nobody is hurt', () => {
    const save = started();
    setRunHp(save, [1, 1, 1, 1, 1, 1]);
    recordDuel(save, true);
    expect(healPending(save, save.league.run!)).toBe(false);
  });

  it('follows a registered card that evolves during the run, keeping its HP', () => {
    const save = started();
    save.cards['133'] = { level: 70, copies: 1, obtainedAt: 0 }; // an Eevee instead of Snorlax
    save.league.run!.team = ['6', '9', '3', '25', '133', '130'];
    setRunHp(save, [1, 1, 1, 1, 0.3, 1]);
    delete save.cards['133'];
    save.cards['136'] = { level: 70, copies: 1, obtainedAt: 0 }; // it became Flareon
    const team = runTeam(save, save.league.run!);
    expect(team[4]).toMatchObject({ registered: '133', key: '136', hp: 0.3 });
  });

  it('lets runs from before the update use the current team at full HP', () => {
    const save = started();
    const run = save.league.run!;
    delete run.team;
    delete run.hp;
    expect(runTeam(save, run).map(m => [m.key, m.hp])).toEqual(TEAM.map(k => [k, 1]));
  });
});

