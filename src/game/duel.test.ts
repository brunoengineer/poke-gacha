import { describe, expect, it } from 'vitest';
import { toBattleCard } from './battle';
import { autoPick, battleWinner, createBattle, CRIT_MULT, firstStriker, fightDuel, hpFractions, NO_LUCK, playDuel, previewDuel, rollHit, sendIn, strike, summarizeBattle } from './duel';

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

describe('luck', () => {
  /** Plays these rolls in order, then every hit lands normally. */
  const rolls = (...values: number[]) => () => values.shift() ?? 1;
  const CRIT = 0.05;
  const MISS = 0.01;
  const BLOCK = 0.025;
  const fighters = () => {
    const [you, opp] = [card(6, 60), card(9, 60)];
    return { you: { card: you, hp: you.stats.hp }, opp: { card: opp, hp: opp.stats.hp } };
  };

  it('rolls 2% miss, 1% block, 10% critical and the rest normal', () => {
    const at = (roll: number) => rollHit(() => roll);
    expect([at(0), at(0.0199)]).toEqual(['miss', 'miss']);
    expect([at(0.02), at(0.0299)]).toEqual(['block', 'block']);
    expect([at(0.03), at(0.1299)]).toEqual(['crit', 'crit']);
    expect([at(0.13), at(0.5), at(0.9999)]).toEqual(['normal', 'normal', 'normal']);
  });

  it('a critical deals double damage, on either side', () => {
    const { you, opp } = fighters();
    const [first, second] = fightDuel(you, opp, rolls(CRIT, CRIT)).hits;
    expect(first.outcome).toBe('crit');
    expect(first.damage).toBe(strike(you.card, opp.card).damage * CRIT_MULT);
    expect(second.outcome).toBe('crit');
    expect(second.attacker).not.toBe(first.attacker);
  });

  it('a miss or a block deals nothing and the turn passes', () => {
    for (const [roll, outcome] of [[MISS, 'miss'], [BLOCK, 'block']] as const) {
      const { you, opp } = fighters();
      const hits = fightDuel(you, opp, rolls(roll)).hits;
      expect(hits[0].outcome).toBe(outcome);
      expect(hits[0].damage).toBe(0);
      expect(hits[0].ko).toBe(false);
      const target = hits[0].attacker === 'you' ? opp : you;
      expect(hits[0].hpLeft).toBe(target.card.stats.hp);
      expect(hits[1].attacker).not.toBe(hits[0].attacker);
    }
  });

  it('a critical can knock out one hit sooner, and HP never goes below zero', () => {
    const weak = card(19, 5);
    const you = { card: card(6, 60), hp: card(6, 60).stats.hp };
    const opp = { card: weak, hp: strike(you.card, weak).damage + 1 };
    const result = fightDuel(you, opp, rolls(CRIT));
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].ko).toBe(true);
    expect(result.hits[0].hpLeft).toBe(0);
    expect(result.winner).toBe('you');
  });

  it('battles always end, and damage totals only count what landed', () => {
    const state = createBattle([card(6, 60)], [card(9, 60)]);
    sendIn(state, 0);
    playDuel(state, rolls(MISS, BLOCK, MISS, BLOCK));
    expect(battleWinner(state)).not.toBeNull();
    const dealt = state.duels[0].hits.reduce((sum, hit) => sum + hit.damage, 0);
    const { totals } = summarizeBattle(state);
    expect(totals.you + totals.opp).toBe(dealt);
    expect(state.duels[0].hits.slice(0, 4).every(hit => hit.damage === 0)).toBe(true);
  });

  it('a preview ignores luck, and does not touch the real fighters', () => {
    const { you, opp } = fighters();
    const preview = previewDuel(you, opp);
    expect(preview.hits.every(hit => hit.outcome === 'normal')).toBe(true);
    expect(you.hp).toBe(you.card.stats.hp);
    expect(opp.hp).toBe(opp.card.stats.hp);
  });
});

describe('duels', () => {
  it('trade hits until one faints, the winner keeps its HP', () => {
    const you = { card: card(6, 40), hp: card(6, 40).stats.hp };
    const opp = { card: card(19, 10), hp: card(19, 10).stats.hp };
    const result = fightDuel(you, opp, NO_LUCK);
    expect(result.winner).toBe('you');
    expect(opp.hp).toBe(0);
    expect(you.hp).toBeGreaterThan(0);
    expect(result.hits.at(-1)!.ko).toBe(true);
  });

  it('makes levels matter a lot', () => {
    const strong = { card: card(19, 30), hp: card(19, 30).stats.hp };
    const weak = { card: card(19, 20), hp: card(19, 20).stats.hp };
    expect(fightDuel(weak, strong, NO_LUCK).winner).toBe('opp');
  });
});

describe('battles', () => {
  it('needs the player to choose, keeps the survivor in and ends when a side is out', () => {
    const state = createBattle([card(6, 50), card(19, 5)], [card(19, 10), card(16, 10)]);
    expect(playDuel(state, NO_LUCK)).toBeNull(); // nobody sent in yet
    expect(sendIn(state, 0)).toBe(true);
    const first = playDuel(state, NO_LUCK)!;
    expect(first.winner).toBe('you');
    expect(state.youActive).toBe(0); // Charizard stays in
    expect(state.oppActive).toBe(1);
    playDuel(state, NO_LUCK);
    expect(battleWinner(state)).toBe('you');
    expect(summarizeBattle(state)).toMatchObject({ result: 'win', perfect: true, score: { you: 2, opp: 0 } });
  });

  it('makes the player pick again after a faint, and refuses fainted Pokémon', () => {
    const state = createBattle([card(19, 2), card(6, 60)], [card(150, 60)]);
    sendIn(state, 0);
    expect(playDuel(state, NO_LUCK)!.winner).toBe('opp');
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
    playDuel(state, NO_LUCK);
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

  it('auto-play sends the highest level still standing, ties in team order, whatever the matchup', () => {
    // Squirtle would have the type advantage over Charmander; auto-play ignores it.
    const state = createBattle([card(9, 40), card(6, 70), card(3, 70), card(7, 90)], [card(4, 50)], [1, 1, 1, 0]);
    expect(autoPick(state)).toBe(1); // Squirtle (Lv. 90) fainted; the first of the two Lv. 70
    state.you[1].hp = 0;
    expect(autoPick(state)).toBe(2);
    state.you[2].hp = 0;
    expect(autoPick(state)).toBe(0);
  });
});
