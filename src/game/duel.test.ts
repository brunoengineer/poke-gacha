import { describe, expect, it } from 'vitest';
import { toBattleCard } from './battle';
import { battleWinner, createBattle, firstStriker, fightDuel, hpFractions, playDuel, sendIn, strike, summarizeBattle } from './duel';

const card = (id: number, level: number) => toBattleCard({ id, level });

describe('strikes', () => {
  it('uses the stronger of physical and special attack', () => {
    expect(strike(card(68, 30), card(19, 30)).stat).toBe('atk'); // Machamp hits physically
    expect(strike(card(65, 30), card(19, 30)).stat).toBe('spa'); // Alakazam hits specially
  });

  it('scales damage with type advantage', () => {
    const squirtle = card(7, 20);
    const charmander = card(4, 20);
    const bulbasaur = card(1, 20);
    expect(strike(squirtle, charmander).damage).toBeGreaterThan(strike(squirtle, bulbasaur).damage);
    expect(strike(squirtle, charmander).mult).toBeGreaterThan(1);
  });

  it('lets the faster Pokémon hit first (ties go to the player)', () => {
    expect(firstStriker(card(19, 10), card(74, 10))).toBe('you'); // Rattata is faster than Geodude
    expect(firstStriker(card(74, 10), card(19, 10))).toBe('opp');
    expect(firstStriker(card(19, 10), card(19, 10))).toBe('you');
  });
});

describe('duels', () => {
  it('trade hits until one faints, the winner keeps its HP', () => {
    const you = { card: card(6, 40), hp: card(6, 40).stats.hp };
    const opp = { card: card(19, 10), hp: card(19, 10).stats.hp };
    const result = fightDuel(you, opp);
    expect(result.winner).toBe('you');
    expect(opp.hp).toBe(0);
    expect(you.hp).toBeGreaterThan(0);
    expect(result.hits.at(-1)!.ko).toBe(true);
  });

  it('makes levels matter a lot', () => {
    const strong = { card: card(19, 30), hp: card(19, 30).stats.hp };
    const weak = { card: card(19, 20), hp: card(19, 20).stats.hp };
    expect(fightDuel(weak, strong).winner).toBe('opp');
  });
});

describe('battles', () => {
  it('needs the player to choose, keeps the survivor in and ends when a side is out', () => {
    const state = createBattle([card(6, 50), card(19, 5)], [card(19, 10), card(16, 10)]);
    expect(playDuel(state)).toBeNull(); // nobody sent in yet
    expect(sendIn(state, 0)).toBe(true);
    const first = playDuel(state)!;
    expect(first.winner).toBe('you');
    expect(state.youActive).toBe(0); // Charizard stays in
    expect(state.oppActive).toBe(1);
    playDuel(state);
    expect(battleWinner(state)).toBe('you');
    expect(summarizeBattle(state)).toMatchObject({ result: 'win', perfect: true, score: { you: 2, opp: 0 } });
  });

  it('makes the player pick again after a faint, and refuses fainted Pokémon', () => {
    const state = createBattle([card(19, 2), card(6, 60)], [card(150, 60)]);
    sendIn(state, 0);
    expect(playDuel(state)!.winner).toBe('opp');
    expect(state.youActive).toBeNull();
    expect(sendIn(state, 0)).toBe(false);
    expect(sendIn(state, 1)).toBe(true);
  });

  it('starts hurt or fainted Pokémon as given (League runs) and only counts new faints against a perfect win', () => {
    const state = createBattle([card(6, 60), card(9, 60), card(3, 60)], [card(19, 5)], [0.5, 0, 1]);
    expect(state.you[0].hp).toBe(Math.round(card(6, 60).stats.hp * 0.5));
    expect(state.you[1].hp).toBe(0);
    expect(sendIn(state, 1)).toBe(false); // fainted from the start
    sendIn(state, 0);
    playDuel(state);
    expect(summarizeBattle(state)).toMatchObject({ result: 'win', perfect: true, score: { you: 1, opp: 0 } });
    const left = hpFractions(state);
    expect(left[1]).toBe(0);
    expect(left[2]).toBe(1);
    expect(left[0]).toBeGreaterThan(0);
    expect(left[0]).toBeLessThan(0.51); // rounded to whole HP
  });

  it('keeps at least 1 HP for a sliver above zero', () => {
    expect(createBattle([card(6, 60)], [card(19, 5)], [0.0001]).you[0].hp).toBe(1);
  });
});
