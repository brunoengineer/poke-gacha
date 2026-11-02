import { describe, expect, it } from 'vitest';
import { getSpecies, speciesList } from '../../data/species';
import enModes from '../../i18n/en/modes';
import ptModes from '../../i18n/pt/modes';
import { defaultSave, normalizeSave } from '../../state/save';
import { cardKey } from '../cards';
import type { Reward } from '../rewards';
import { teamScale } from '../scaling';
import {
  abandonRun, applyHeal, buildBracket, canEnter, championBoss, duelDifficulty, duelInfo, eliteFour, healPending, healTargets, leagueFee, leagueRecord, leagueUnlocked, MASTER_DAILY_ENTRIES,
  masterBanned, masterEntriesToday, masterKitLeft, masterShinyAvailable, placementRewards, recordDuel, runTeam, setRunHp, startRun, winRewards,
} from './league';

const TEAM = ['6', '9', '3', '25', '143', '130'];
const NOON = new Date(2026, 10, 2, 12).getTime();
const NEXT_DAY = new Date(2026, 10, 3, 12).getTime();

function masterSave() {
  const save = defaultSave();
  for (const region of ['johto', 'hoenn', 'sinnoh'] as const) save.league[region] = { runs: 1, best: 4, titles: 1 };
  save.league.titles = 1;
  save.coins = 100_000;
  for (const key of TEAM) save.cards[key] = { level: 100, copies: 1, obtainedAt: 0 };
  save.deck = [...TEAM];
  return save;
}

const enter = (save = masterSave(), now = NOON) => {
  expect(startRun(save, 7, now, 'master')).toBe(true);
  return save;
};
const win = (save: ReturnType<typeof masterSave>, now = NOON, rng?: () => number) => recordDuel(save, true, [], now, 'master', rng);
const balls = (rewards: Reward[]) => rewards.flatMap(r => (r.kind === 'item' && r.item === 'master-ball' ? [r.amount] : []));
const cards = (rewards: Reward[]) => rewards.filter(r => r.kind === 'card');

describe('master league entry', () => {
  it('opens only with a title in all four leagues', () => {
    const save = masterSave();
    expect(leagueUnlocked(save, 'master')).toBe(true);
    delete save.league.sinnoh;
    expect(leagueUnlocked(save, 'master')).toBe(false);
    expect(canEnter(save, 'master')).toBe('locked');
  });

  it('old saves load with it closed and untouched', () => {
    const old = normalizeSave({ ...defaultSave(), league: { runs: 0, best: -1, titles: 0 } });
    expect(old.league.master).toBeUndefined();
    expect(canEnter(old, 'master')).toBe('locked');
    expect(masterEntriesToday(old)).toBe(0);
    expect(masterShinyAvailable(old)).toBe(true);
  });

  it('refuses shiny, legendary and mythical cards, and names only those', () => {
    expect(masterBanned(['6', '6s', '150', '251', '10'])).toEqual(['6s', '150', '251']);
    expect(masterBanned(['99999'])).toEqual(['99999']);
    const save = masterSave();
    save.cards['150'] = { level: 100, copies: 1, obtainedAt: 0 };
    save.deck[0] = '150';
    expect(canEnter(save, 'master')).toBe('banned');
    expect(startRun(save, 7, NOON, 'master')).toBe(false);
    expect(save.coins).toBe(100_000);
  });

  it('costs the fee and needs a full team', () => {
    const save = masterSave();
    expect(leagueFee('master')).toBe(10_000);
    save.coins = 9_999;
    expect(canEnter(save, 'master')).toBe('coins');
    save.coins = 10_000;
    save.deck.pop();
    expect(canEnter(save, 'master')).toBe('team');
    save.deck = [...TEAM];
    enter(save);
    expect(save.coins).toBe(0);
    expect(canEnter(save, 'master', '2026-11-02')).toBe('running');
  });

  it('allows 3 entries a day, counted on paying even after a loss, and resets the next day', () => {
    const save = masterSave();
    for (let used = 1; used <= MASTER_DAILY_ENTRIES; used++) {
      enter(save);
      expect(masterEntriesToday(save, '2026-11-02')).toBe(used);
      if (used === 1) recordDuel(save, false, [], NOON, 'master');
      else abandonRun(save, 'master');
    }
    expect(canEnter(save, 'master', '2026-11-02')).toBe('daily');
    expect(startRun(save, 7, NOON, 'master')).toBe(false);
    expect(save.coins).toBe(100_000 - 30_000);

    expect(canEnter(save, 'master', '2026-11-03')).toBe('ok');
    enter(save, NEXT_DAY);
    expect(masterEntriesToday(save, '2026-11-03')).toBe(1);
  });

  it('keeps its record apart from the other leagues', () => {
    const save = enter();
    expect(leagueRecord(save, 'master').runs).toBe(1);
    expect(leagueRecord(save).run).toBeUndefined();
    expect(leagueRecord(save, 'sinnoh').run).toBeUndefined();
    expect(canEnter(save, 'sinnoh')).toBe('locked');
  });
});

describe('master league duels', () => {
  it('is Blue, Lance, Steven and Cynthia, with no legendaries, in a full bracket', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const bracket = buildBracket(77, seed, 4, 'master');
      expect(bracket.path.map(e => e.name)).toEqual(['Blue', 'Lance', 'Steven', 'Cynthia']);
      expect(bracket.path[3].kind).toBe('champion');
      expect(bracket.slots).toHaveLength(16);
      expect(new Set(bracket.slots.map(e => e.id)).size).toBe(16);
      expect(bracket.rounds[4][0]).toBe(0);
    }
    for (const boss of [...eliteFour('master'), championBoss(4, 'master')]) {
      expect(boss.roster, boss.id).toHaveLength(6);
      for (const id of boss.roster) {
        expect(getSpecies(id).legendary || getSpecies(id).mythical, `${boss.id}: ${id}`).toBe(false);
      }
    }
  });

  it('every opponent is Lv. 100, whatever the titles or the team', () => {
    const save = masterSave();
    save.league.master = { runs: 5, best: 4, titles: 5 };
    enter(save);
    const run = save.league.master.run!;
    expect(run.bonus).toBe(0);
    const bracket = buildBracket(77, run.seed, save.starter, 'master');
    const strong = teamScale([300, 300, 300, 300, 300, 300]);
    for (let duel = 0; duel < 4; duel++) {
      const info = duelInfo(bracket, run, duel, save.starter, 'master', strong);
      expect(info.team.map(m => m.level)).toEqual([100, 100, 100, 100, 100, 100]);
      expect(info.scaled).toBe(false);
      expect(info.ace).toBeNull();
      expect(duelDifficulty(duel, 0, 'master', strong).levels).toEqual([100, 100]);
    }
  });

  it('carries HP over, and gives 3 Revives and 4 Potions before each duel', () => {
    const save = enter();
    setRunHp(save, [0.5, 0, 0, 0, 0, 0.2], 'master');
    expect(win(save)).toMatchObject({ kind: 'advance', duel: 1 });
    const run = save.league.master!.run!;
    const hp = () => runTeam(save, run).map(m => m.hp);
    expect(hp()).toEqual([0.5, 0, 0, 0, 0, 0.2]);
    expect(healTargets(save, run, 'master').rest).toEqual([]);
    expect(applyHeal(save, 'rest', null, 'master')).toBe(false);

    for (const key of ['9', '3', '25']) expect(applyHeal(save, 'revive', key, 'master')).toBe(true);
    expect(applyHeal(save, 'revive', '143', 'master')).toBe(false); // only three
    expect(applyHeal(save, 'potion', '9', 'master')).toBe(true); // tops up one just revived
    for (const key of ['6', '3', '25']) expect(applyHeal(save, 'potion', key, 'master')).toBe(true);
    expect(applyHeal(save, 'potion', '130', 'master')).toBe(false); // only four
    expect(hp()).toEqual([1, 1, 1, 1, 0, 0.2]);
    expect(healPending(save, run, 'master')).toBe(false);
  });

  it('asks for items only while one can be used, and never carries leftovers over', () => {
    const save = enter();
    setRunHp(save, [0.5, 1, 1, 1, 1, 1], 'master');
    win(save);
    const run = save.league.master!.run!;
    expect(healPending(save, run, 'master')).toBe(true);
    applyHeal(save, 'potion', '6', 'master');
    expect(healPending(save, run, 'master')).toBe(false); // two Potions left, nobody hurt
    setRunHp(save, [0.5, 1, 1, 1, 1, 1], 'master');
    win(save);
    expect(masterKitLeft(run)).toEqual({ potions: 4, revives: 3 });
  });

  it('a run from before the items keeps going', () => {
    const save = enter();
    const run = save.league.master!.run!;
    Object.assign(run, { duel: 1, healed: 1, hp: { 6: 0.5 } });
    expect(healPending(save, run, 'master')).toBe(true);
    expect(applyHeal(save, 'potion', '6', 'master')).toBe(true);
  });

  it('the other leagues keep their one heal choice', () => {
    const save = masterSave();
    save.gyms.badges = ['boulder', 'cascade', 'thunder', 'rainbow', 'soul', 'marsh', 'volcano', 'earth'];
    startRun(save, 7, NOON);
    setRunHp(save, [0.5, 0.5, 1, 1, 1, 1]);
    recordDuel(save, true);
    expect(applyHeal(save, 'potion', '6')).toBe(true);
    expect(applyHeal(save, 'potion', '9')).toBe(false);
  });
});

describe('master league prizes', () => {
  it('pays 2, 3 and 5 Master Balls per win, then 10 for the title', () => {
    expect([0, 1, 2, 3].flatMap(duel => balls(winRewards(duel, 'master')))).toEqual([2, 3, 5, 10]);
    const save = enter();
    for (const prize of [2, 3, 5]) {
      const result = win(save);
      expect(result!.kind).toBe('advance');
      expect(balls(result!.kind === 'advance' ? result!.rewards : [])).toEqual([prize]);
    }
    const title = win(save);
    expect(title!.kind).toBe('champion');
    expect(balls(title!.kind === 'champion' ? title!.rewards : [])).toEqual([10]);
    expect(save.league.master).toMatchObject({ titles: 1, best: 4, duelsWon: 4 });
    expect(save.league.master!.run).toBeUndefined();
  });

  it('other leagues still pay nothing per win', () => {
    expect(winRewards(0)).toEqual([]);
    expect(winRewards(3, 'sinnoh')).toEqual([]);
  });

  it('losing or giving up pays nothing more', () => {
    const save = enter();
    win(save);
    expect(recordDuel(save, false, [], NOON, 'master')).toMatchObject({ kind: 'out', placement: 1, rewards: [] });
    enter(save);
    expect(abandonRun(save, 'master')).toMatchObject({ kind: 'out', placement: 0, rewards: [] });
    expect(placementRewards(3, 'master')).toEqual([]);
  });

  const champion = (save: ReturnType<typeof masterSave>, now = NOON, rng?: () => number) => {
    enter(save, now);
    for (let i = 0; i < 3; i++) win(save, now);
    const result = win(save, now, rng);
    return result!.kind === 'champion' ? result!.rewards : [];
  };

  it('the title gives a shiny legendary or mythical the player does not own', () => {
    const save = masterSave();
    const prizes = speciesList.filter(s => s.legendary || s.mythical);
    // Owns all but one, so only that one can come out.
    const missing = prizes[prizes.length - 1];
    for (const s of prizes.slice(0, -1)) save.cards[cardKey(s.id, true)] = { level: 1, copies: 1, obtainedAt: 0 };
    expect(cards(champion(save))).toEqual([{ kind: 'card', id: missing.id, shiny: true }]);
  });

  it('gives only one shiny a day, and another the next day', () => {
    const save = masterSave();
    expect(cards(champion(save))).toHaveLength(1);
    expect(masterShinyAvailable(save, '2026-11-02')).toBe(false);
    const second = champion(save);
    expect(cards(second)).toEqual([]);
    expect(balls(second)).toEqual([10]);
    expect(cards(champion(save, NEXT_DAY))).toHaveLength(1);
  });

  it('gives a duplicate once the player owns them all', () => {
    const save = masterSave();
    const prizes = speciesList.filter(s => s.legendary || s.mythical);
    for (const s of prizes) save.cards[cardKey(s.id, true)] = { level: 1, copies: 1, obtainedAt: 0 };
    const [prize] = cards(champion(save, NOON, () => 0));
    expect(prize).toEqual({ kind: 'card', id: prizes[0].id, shiny: true });
  });

  it('gives no shiny starter on the first title', () => {
    const save = masterSave();
    save.starter = 4;
    const [prize] = cards(champion(save, NOON, () => 0));
    expect(getSpecies((prize as { id: number }).id).legendary || getSpecies((prize as { id: number }).id).mythical).toBe(true);
  });
});

describe('master league texts', () => {
  it('has every text in both languages', () => {
    for (const modes of [ptModes, enModes]) {
      for (const boss of [...eliteFour('master'), championBoss(4, 'master')]) expect(modes.league.lines[boss.id]?.intro, boss.id).toBeTruthy();
      expect(modes.league.master.heroText).toBeTruthy();
      expect(modes.league.masterRules.tab).toBeTruthy();
    }
  });
});
