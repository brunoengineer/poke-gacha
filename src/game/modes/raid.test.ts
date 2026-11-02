import { describe, expect, it } from 'vitest';
import enBattle from '../../i18n/en/battle';
import ptBattle from '../../i18n/pt/battle';
import { defaultSave, normalizeSave } from '../../state/save';
import { toBattleCard } from '../battle';
import { createBattle, fightDuel, strike, type Fighter } from '../duel';
import { teamScale } from '../scaling';
import {
  anyRaidUnlocked, canRaid, finishRaid, raidBossCard, raidLevel, raidPool, raidRecord, raidUnlocked, RAID_FEES, RAID_HP_MULT, RAID_MAX_HIT, RAID_PITY, startRaid,
} from './raid';

const TEAM = ['6', '9', '3', '25', '143', '130'];
const MISS_THE_ROLL = () => 0.5; // not a shiny (under 1%) and not a catch (under 11%)
const NORMAL_ROLL = () => 0.05;
const SHINY_ROLL = () => 0.005;

function raidSave() {
  const save = defaultSave();
  save.league.titles = 1;
  save.coins = 100_000;
  for (const key of TEAM) save.cards[key] = { level: 100, copies: 1, obtainedAt: 0 };
  save.deck = [...TEAM];
  return save;
}

const cards = (rewards: ReturnType<typeof finishRaid>['rewards']) => rewards.filter(r => r.kind === 'card');
const balls = (rewards: ReturnType<typeof finishRaid>['rewards']) => rewards.flatMap(r => (r.kind === 'item' && r.item === 'master-ball' ? [r.amount] : []));

describe('legendary battle entry', () => {
  it('each region needs its own League title', () => {
    const save = defaultSave();
    expect(anyRaidUnlocked(save)).toBe(false);
    expect(canRaid(save, 'kanto')).toBe('locked');
    save.league.johto = { runs: 1, best: 4, titles: 1 };
    expect(raidUnlocked(save, 'johto')).toBe(true);
    expect(raidUnlocked(save, 'kanto')).toBe(false);
    expect(anyRaidUnlocked(save)).toBe(true);
  });

  it('old saves load with nothing played', () => {
    const old = normalizeSave({ ...defaultSave(), raid: undefined });
    expect(old.raid).toEqual({});
    expect(raidRecord(old, 'sinnoh')).toEqual({ wins: 0, losses: 0, sinceCatch: 0 });
  });

  it('charges the fee and draws a boss from the region, and refuses without coins or a team', () => {
    const save = raidSave();
    const boss = startRaid(save, 'kanto', () => 0);
    expect(raidPool('kanto').map(s => s.id)).toContain(boss);
    expect(save.coins).toBe(100_000 - RAID_FEES.kanto);

    save.coins = RAID_FEES.kanto - 1;
    expect(canRaid(save, 'kanto')).toBe('coins');
    expect(startRaid(save, 'kanto')).toBeNull();
    expect(save.coins).toBe(RAID_FEES.kanto - 1);

    save.coins = 100_000;
    save.deck.pop();
    expect(canRaid(save, 'kanto')).toBe('team');
  });

  it('has the designed bosses, fees and levels', () => {
    expect(raidPool('kanto').map(s => s.name)).toEqual(['Articuno', 'Zapdos', 'Moltres', 'Mewtwo', 'Mew']);
    expect([raidPool('johto').length, raidPool('hoenn').length, raidPool('sinnoh').length]).toEqual([6, 10, 14]);
    expect(RAID_FEES).toEqual({ kanto: 3000, johto: 6000, hoenn: 10000, sinnoh: 15000 });
    expect(['kanto', 'johto', 'hoenn', 'sinnoh'].map(r => raidLevel(r as 'kanto'))).toEqual([70, 100, 120, 140]);
  });

  it('the boss matches the strongest Pokémon on the team, and never drops below the design', () => {
    expect(raidLevel('kanto', teamScale([10, 10, 10, 10, 10, 300]))).toBe(300);
    expect(raidLevel('sinnoh', teamScale([10, 10, 10, 10, 10, 10]))).toBe(140);
  });
});

describe('the boss', () => {
  const boss = () => raidBossCard(150, 100);
  const you = toBattleCard({ id: 129, level: 100, shiny: false }); // Magikarp: any hit would flatten it

  it('has the HP multiplier and normal attacks', () => {
    const plain = toBattleCard({ id: 150, level: 100, shiny: false });
    expect(boss().stats.hp).toBe(plain.stats.hp * RAID_HP_MULT);
    expect(boss().stats.atk).toBe(plain.stats.atk);
  });

  it('never takes more than the cap in one hit, even on a critical', () => {
    const cap = Math.round(you.stats.hp * RAID_MAX_HIT);
    expect(strike(boss(), you).damage).toBe(cap);
    const a: Fighter = { card: you, hp: you.stats.hp };
    const b: Fighter = { card: boss(), hp: boss().stats.hp };
    const crit = () => 0.05; // a critical every hit
    const { hits } = fightDuel(a, b, crit);
    for (const hit of hits.filter(h => h.attacker === 'opp')) expect(hit.damage).toBeLessThanOrEqual(cap);
    // At least three hits to knock a Pokémon out from full HP.
    expect(hits.filter(h => h.attacker === 'opp').length).toBeGreaterThanOrEqual(3);
  });

  it('keeps its damage from one of your Pokémon to the next', () => {
    const state = createBattle([you, you], [boss()]);
    const { stats } = state.opp[0].card;
    const a = state.you[0];
    fightDuel(a, state.opp[0], () => 1);
    const afterFirst = state.opp[0].hp;
    expect(afterFirst).toBeLessThan(stats.hp);
    fightDuel(state.you[1], state.opp[0], () => 1);
    expect(state.opp[0].hp).toBeLessThan(afterFirst);
  });

  it('caps nobody else', () => {
    const big = toBattleCard({ id: 150, level: 300, shiny: false });
    expect(strike(big, you).damage).toBeGreaterThan(Math.round(you.stats.hp * RAID_MAX_HIT));
  });
});

describe('legendary battle prizes', () => {
  it('a loss pays nothing and leaves the counter alone', () => {
    const save = raidSave();
    save.raid.kanto = { wins: 3, losses: 0, sinceCatch: 3 };
    expect(finishRaid(save, 'kanto', 150, false)).toEqual({ caught: 'none', rewards: [] });
    expect(save.raid.kanto).toEqual({ wins: 3, losses: 1, sinceCatch: 3 });
  });

  it('every win pays a quarter of the fee and Rare Candy, even when the boss gets away', () => {
    const expected: [string, number, number][] = [['kanto', 750, 10], ['johto', 1500, 20], ['hoenn', 2500, 30], ['sinnoh', 3750, 40]];
    for (const [region, coins, candy] of expected) {
      const result = finishRaid(raidSave(), region as 'kanto', 150, true, MISS_THE_ROLL);
      expect(result.caught).toBe('none');
      expect(result.rewards).toEqual([{ kind: 'coins', amount: coins }, { kind: 'item', item: 'rare-candy', amount: candy }]);
    }
  });

  it('rolls 1% shiny and 10% normal, exactly', () => {
    const at = (roll: number) => finishRaid(raidSave(), 'kanto', 150, true, () => roll).caught;
    expect(at(0)).toBe('shiny');
    expect(at(0.0099)).toBe('shiny');
    expect(at(0.01)).toBe('normal');
    expect(at(0.1099)).toBe('normal');
    expect(at(0.11)).toBe('none');
  });

  it('gives the rolled card', () => {
    expect(cards(finishRaid(raidSave(), 'kanto', 150, true, NORMAL_ROLL).rewards)).toEqual([{ kind: 'card', id: 150, shiny: false }]);
    expect(cards(finishRaid(raidSave(), 'kanto', 150, true, SHINY_ROLL).rewards)).toEqual([{ kind: 'card', id: 150, shiny: true }]);
  });

  it('guarantees the normal card on the 15th win without a catch, then starts over', () => {
    const save = raidSave();
    for (let win = 1; win < RAID_PITY; win++) expect(finishRaid(save, 'kanto', 150, true, MISS_THE_ROLL).caught).toBe('none');
    expect(save.raid.kanto!.sinceCatch).toBe(RAID_PITY - 1);
    expect(finishRaid(save, 'kanto', 150, true, MISS_THE_ROLL).caught).toBe('normal');
    expect(save.raid.kanto!.sinceCatch).toBe(0);
  });

  it('keeps a counter per region', () => {
    const save = raidSave();
    finishRaid(save, 'kanto', 150, true, MISS_THE_ROLL);
    expect(raidRecord(save, 'kanto').sinceCatch).toBe(1);
    expect(raidRecord(save, 'johto').sinceCatch).toBe(0);
  });

  it('an owned boss gives a Master Ball instead, and counts as a catch', () => {
    const save = raidSave();
    save.cards['150'] = { level: 50, copies: 1, obtainedAt: 0 };
    save.raid.kanto = { wins: 4, losses: 0, sinceCatch: 4 };
    const result = finishRaid(save, 'kanto', 150, true, NORMAL_ROLL);
    expect(result.caught).toBe('duplicate');
    expect(cards(result.rewards)).toEqual([]);
    expect(balls(result.rewards)).toEqual([1]);
    expect(save.raid.kanto!.sinceCatch).toBe(0);
  });

  it('the shiny and the normal card count separately as owned', () => {
    const save = raidSave();
    save.cards['150'] = { level: 50, copies: 1, obtainedAt: 0 };
    expect(finishRaid(save, 'kanto', 150, true, SHINY_ROLL).caught).toBe('shiny');
    const shinyOwned = raidSave();
    shinyOwned.cards['150s'] = { level: 50, copies: 1, obtainedAt: 0 };
    expect(finishRaid(shinyOwned, 'kanto', 150, true, NORMAL_ROLL).caught).toBe('normal');
    expect(finishRaid(shinyOwned, 'kanto', 150, true, SHINY_ROLL).caught).toBe('duplicate');
  });
});

describe('legendary battle texts', () => {
  it('has every result in both languages', () => {
    for (const battle of [ptBattle, enBattle]) {
      for (const kind of ['none', 'normal', 'shiny', 'duplicate'] as const) expect(battle.raid.result[kind]('Mew')).toContain('Mew');
      expect(battle.hub.modes.raid.name).toBeTruthy();
    }
  });
});

