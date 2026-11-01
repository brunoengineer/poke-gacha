import { describe, expect, it } from 'vitest';
import { defaultSave } from '../state/save';
import { cardKey, cardPower, isUncapped, levelCap, MAX_LEVEL, rarity, startLevel, statsAt } from './cards';
import { getSpecies, stage } from '../data/species';
import { addCopy, candyRoom, canEvolveNow, evolutionOptions, evolve, previewEvolution, useCandies } from './progression';
import { generateTeam, evolveForLevel } from './teams';
import { resolveRound, summarize, toBattleCard, typeMultiplier } from './battle';
import { BANNERS, pull, rarityOdds, roll, safariFeatured } from './gacha';
import { seeded } from './rng';
import { applyRewards } from './rewards';

const CHARMANDER = 4;
const CHARMELEON = 5;
const CHARIZARD = 6;

describe('cards', () => {
  it('starts evolved species at half their evolution level', () => {
    expect(startLevel(CHARMANDER)).toBe(1);
    expect(startLevel(CHARMELEON)).toBe(8);
    expect(startLevel(CHARIZARD)).toBe(18);
    expect(startLevel(150)).toBe(40); // Mewtwo
  });

  it('caps evolved and non-evolving cards at 100, but not unevolved base forms or shinies', () => {
    expect(levelCap(CHARMANDER, false)).toBe(Infinity);
    expect(levelCap(CHARMELEON, false)).toBe(MAX_LEVEL);
    expect(levelCap(128, false)).toBe(MAX_LEVEL); // Tauros never evolves
    expect(isUncapped(CHARIZARD, true)).toBe(true);
  });

  it('lets a high-level Charmander outgrow a Lv. 100 Charizard', () => {
    expect(cardPower(CHARMANDER, 100)).toBeLessThan(cardPower(CHARIZARD, 100));
    expect(cardPower(CHARMANDER, 250)).toBeGreaterThan(cardPower(CHARIZARD, 100));
    expect(cardPower(CHARIZARD, 100, true)).toBeGreaterThan(cardPower(CHARIZARD, 100));
  });

  it('derives rarity from the data', () => {
    expect(rarity(19)).toBe('common');
    expect(rarity(CHARMANDER)).toBe('rare');
    expect(rarity(CHARIZARD)).toBe('epic');
    expect(rarity(150)).toBe('legendary');
    expect(rarity(151)).toBe('mythical');
  });

  it('has distinct stats even at level 1', () => {
    const a = statsAt(getSpecies(CHARMANDER), 1);
    const b = statsAt(getSpecies(16), 1);
    expect(a.atk).not.toBe(b.atk);
  });
});

describe('copies and levels', () => {
  it('creates a card, then levels it up with duplicates', () => {
    const save = defaultSave();
    expect(addCopy(save, CHARMANDER).kind).toBe('new');
    const second = addCopy(save, CHARMANDER);
    expect(second).toMatchObject({ kind: 'level', from: 1, to: 2 });
    expect(save.cards[cardKey(CHARMANDER)]).toMatchObject({ level: 2, copies: 2 });
    expect(save.caught[CHARMANDER]).toBeTruthy();
  });

  it('routes copies of an evolved-past species to the evolved card', () => {
    const save = defaultSave();
    save.cards[cardKey(CHARMELEON)] = { level: 20, copies: 1, obtainedAt: 0 };
    const result = addCopy(save, CHARMANDER);
    expect(result.key).toBe(cardKey(CHARMELEON));
    expect(save.cards[cardKey(CHARMELEON)].level).toBe(21);
    expect(save.cards[cardKey(CHARMANDER)]).toBeUndefined();
  });

  it('keeps shinies separate and never routes them', () => {
    const save = defaultSave();
    save.cards[cardKey(CHARMELEON)] = { level: 20, copies: 1, obtainedAt: 0 };
    const result = addCopy(save, CHARMANDER, true);
    expect(result).toMatchObject({ kind: 'new', key: cardKey(CHARMANDER, true) });
    expect(save.stats.shinies).toBe(1);
  });

  it('turns duplicates of a capped card into Rare Candy', () => {
    const save = defaultSave();
    save.cards[cardKey(CHARIZARD)] = { level: 100, copies: 1, obtainedAt: 0 };
    expect(addCopy(save, CHARIZARD).kind).toBe('max');
    expect(save.items['rare-candy']).toBe(1);
  });

  it('uses Rare Candy up to the cap', () => {
    const save = defaultSave();
    save.items['rare-candy'] = 10;
    save.cards[cardKey(CHARIZARD)] = { level: 97, copies: 1, obtainedAt: 0 };
    expect(candyRoom(save, cardKey(CHARIZARD))).toBe(3);
    expect(useCandies(save, cardKey(CHARIZARD), 10)).toBe(3);
    expect(save.items['rare-candy']).toBe(7);
    save.cards[cardKey(CHARMANDER)] = { level: 150, copies: 1, obtainedAt: 0 };
    expect(useCandies(save, cardKey(CHARMANDER), 7)).toBe(7);
    expect(save.cards[cardKey(CHARMANDER)].level).toBe(157);
  });
});

describe('evolution', () => {
  it('evolves by level, keeping the level and the team slot', () => {
    const save = defaultSave();
    save.cards[cardKey(CHARMANDER)] = { level: 15, copies: 15, obtainedAt: 0 };
    save.deck = [cardKey(CHARMANDER)];
    expect(canEvolveNow(save, cardKey(CHARMANDER))).toBe(false);
    save.cards[cardKey(CHARMANDER)].level = 16;
    const result = evolve(save, cardKey(CHARMANDER), CHARMELEON)!;
    expect(result).toMatchObject({ level: 16, merged: false, newSpecies: true });
    expect(save.deck).toEqual([cardKey(CHARMELEON)]);
    expect(save.cards[cardKey(CHARMANDER)]).toBeUndefined();
  });

  it('clamps an uncapped base form to the new cap', () => {
    const save = defaultSave();
    save.cards[cardKey(CHARMANDER)] = { level: 180, copies: 1, obtainedAt: 0 };
    expect(previewEvolution(save, cardKey(CHARMANDER), CHARMELEON)).toMatchObject({ level: 100, clamped: true });
  });

  it('merges into an already owned evolved card', () => {
    const save = defaultSave();
    save.cards[cardKey(CHARMELEON)] = { level: 36, copies: 3, obtainedAt: 0 };
    save.cards[cardKey(CHARIZARD)] = { level: 40, copies: 1, obtainedAt: 0 };
    save.deck = [cardKey(CHARMELEON), cardKey(CHARIZARD)];
    const result = evolve(save, cardKey(CHARMELEON), CHARIZARD)!;
    expect(result).toMatchObject({ merged: true, level: 41 });
    expect(save.cards[cardKey(CHARIZARD)].copies).toBe(4);
    expect(save.deck).toEqual([cardKey(CHARIZARD)]);
  });

  it('needs and consumes stones and the Link Cable', () => {
    const save = defaultSave();
    save.cards[cardKey(133)] = { level: 1, copies: 1, obtainedAt: 0 }; // Eevee
    const options = evolutionOptions(save, cardKey(133));
    expect(options.map(o => o.to).sort()).toEqual([134, 135, 136]);
    expect(options.every(o => o.missing.item)).toBe(true);
    save.items['fire-stone'] = 1;
    expect(evolve(save, cardKey(133), 136)).toBeTruthy();
    expect(save.items['fire-stone']).toBeUndefined();

    save.cards[cardKey(64)] = { level: 5, copies: 1, obtainedAt: 0 }; // Kadabra
    expect(evolutionOptions(save, cardKey(64))[0].missing.item).toBe('link-cable');
  });

  it('never evolves shinies', () => {
    const save = defaultSave();
    save.cards[cardKey(CHARMANDER, true)] = { level: 50, copies: 1, obtainedAt: 0 };
    expect(evolutionOptions(save, cardKey(CHARMANDER, true))).toEqual([]);
  });
});

describe('gacha', () => {
  it('charges coins or tickets and records copies', () => {
    const save = defaultSave();
    save.coins = 50;
    const results = pull(save, 'poke', 10, 'coins', seeded(1))!;
    expect(results).toHaveLength(10);
    expect(save.coins).toBe(0);
    expect(save.stats.pulls).toBe(10);
    expect(pull(save, 'poke', 1, 'coins')).toBeNull();
    expect(pull(save, 'great', 1, 'coins')).toBeNull(); // locked without badges
  });

  it('guarantees a rare-or-better within ten Great Ball captures', () => {
    const save = defaultSave();
    save.gyms.badges = ['boulder'];
    save.items['great-ball'] = 10;
    const results = pull(save, 'great', 10, 'ticket', seeded(7))!;
    expect(results.some(r => ['rare', 'epic', 'legendary', 'mythical'].includes(r.rarity))).toBe(true);
  });

  it('only gives legendaries and mythicals with the Master Ball', () => {
    const rng = seeded(3);
    for (let i = 0; i < 50; i++) {
      const s = getSpecies(roll('master', rng).id);
      expect(s.legendary || s.mythical).toBe(true);
    }
    expect(rarityOdds('master').common).toBe(0);
  });

  it('features three different base families on Safari days', () => {
    const featured = safariFeatured('2026-11-01');
    expect(featured).toHaveLength(3);
    expect(new Set(featured.map(id => getSpecies(id).family)).size).toBe(3);
    expect(featured.every(id => stage(id) === 1)).toBe(true);
    expect(BANNERS.safari.cost).toBeGreaterThan(BANNERS.poke.cost!);
  });
});

describe('battle', () => {
  it('applies type advantage', () => {
    const squirtle = toBattleCard({ id: 7, level: 10 });
    const charmander = toBattleCard({ id: CHARMANDER, level: 10 });
    const round = resolveRound(squirtle, charmander, 'atk');
    expect(round.matchup.you.mult).toBe(typeMultiplier(2));
    expect(round.matchup.opp.mult).toBe(typeMultiplier(0.5));
  });

  it('breaks score ties with value totals', () => {
    const a = toBattleCard({ id: 150, level: 50 });
    const b = toBattleCard({ id: 19, level: 2 });
    const win = resolveRound(a, b, 'spa');
    const lose = resolveRound(b, a, 'hp');
    const summary = summarize([win, lose]);
    expect(summary.score).toEqual({ you: 1, opp: 1 });
    expect(summary.tiebreak).toBe(true);
  });
});

describe('teams', () => {
  it('evolves trainer Pokémon for their level', () => {
    expect(evolveForLevel(CHARMANDER, 10)).toBe(CHARMANDER);
    expect(evolveForLevel(CHARMANDER, 20)).toBe(CHARMELEON);
    expect(evolveForLevel(CHARMANDER, 50)).toBe(CHARIZARD);
  });

  it('builds typed teams of six distinct families', () => {
    const team = generateTeam({ level: [20, 25], types: ['water'] }, seeded(5));
    expect(team).toHaveLength(6);
    expect(team.every(m => getSpecies(m.id).types.includes('water'))).toBe(true);
    expect(new Set(team.map(m => getSpecies(m.id).family)).size).toBe(6);
  });
});

describe('rewards', () => {
  it('applies coins, items, cards and badges', () => {
    const save = defaultSave();
    const coins = save.coins;
    const applied = applyRewards(save, [
      { kind: 'coins', amount: 50 },
      { kind: 'item', item: 'rare-candy', amount: 3 },
      { kind: 'card', id: 25 },
      { kind: 'badge', badge: 'boulder' },
      { kind: 'badge', badge: 'boulder' },
    ]);
    expect(save.coins).toBe(coins + 50);
    expect(save.items['rare-candy']).toBe(3);
    expect(applied[2].copy?.kind).toBe('new');
    expect(applied[3].firstBadge).toBe(true);
    expect(applied[4].firstBadge).toBe(false);
    expect(save.gyms.badges).toEqual(['boulder']);
  });
});

describe('trainer evolutions', () => {
  it('waits until Lv. 20 for stone and trade evolutions', () => {
    expect(evolveForLevel(37, 17)).toBe(37); // Vulpix stays a Vulpix
    expect(evolveForLevel(37, 20)).toBe(38);
    expect(evolveForLevel(63, 20)).toBe(64); // Abra -> Kadabra by level
    expect(evolveForLevel(63, 30)).toBe(64); // Alakazam (trade) needs more
    expect(evolveForLevel(63, 31)).toBe(65);
  });
});
