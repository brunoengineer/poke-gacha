import { describe, expect, it } from 'vitest';
import { defaultSave } from '../state/save';
import { cardKey, cardPower, isUncapped, levelCap, MAX_LEVEL, rarity, startLevel, statsAt } from './cards';
import { getSpecies, stage } from '../data/species';
import {
  addCopy, candyRoom, canEvolveNow, evolutionOptions, evolve, previewEvolution, trainAfterBattle, transferLevel, transferTargets, useCandies,
} from './progression';
import { generateTeam, evolveForLevel } from './teams';
import { matchup, toBattleCard, typeMultiplier } from './battle';
import { BANNERS, pull, rarityOdds, roll, safariFeatured } from './gacha';
import { seeded } from './rng';
import { applyRewards } from './rewards';

const CHARMANDER = 4;
const CHARMELEON = 5;
const CHARIZARD = 6;

describe('cards', () => {
  it('starts every card at Lv. 1, evolved forms and legendaries included', () => {
    expect(startLevel(CHARMANDER)).toBe(1);
    expect(startLevel(CHARMELEON)).toBe(1);
    expect(startLevel(CHARIZARD)).toBe(1);
    expect(startLevel(150)).toBe(1); // Mewtwo
  });

  it('caps cards at 100, legendaries at 120, mythicals at 140, and never shinies', () => {
    expect(levelCap(CHARMANDER, false)).toBe(MAX_LEVEL);
    expect(levelCap(CHARMELEON, false)).toBe(MAX_LEVEL);
    expect(levelCap(128, false)).toBe(MAX_LEVEL); // Tauros never evolves
    expect(levelCap(CHARMANDER, true)).toBe(Infinity);
    expect(levelCap(384, false)).toBe(120); // Rayquaza, legendary
    expect(levelCap(386, false)).toBe(140); // Deoxys, mythical
    expect(levelCap(384, true)).toBe(Infinity);
    expect(isUncapped(CHARIZARD, true)).toBe(true);
  });

  it('lets a shiny keep growing past a Lv. 100 card', () => {
    expect(cardPower(CHARIZARD, 100, true)).toBeGreaterThan(cardPower(CHARIZARD, 100));
    expect(cardPower(CHARMANDER, 250, true)).toBeGreaterThan(cardPower(CHARIZARD, 100));
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

  it('routes copies of an evolved-away species to the evolved card', () => {
    const save = defaultSave();
    save.cards[cardKey(CHARMANDER)] = { level: 20, copies: 20, obtainedAt: 0 };
    evolve(save, cardKey(CHARMANDER), CHARMELEON);
    const result = addCopy(save, CHARMANDER);
    expect(result.key).toBe(cardKey(CHARMELEON));
    expect(save.cards[cardKey(CHARMELEON)].level).toBe(21);
    expect(save.cards[cardKey(CHARMANDER)]).toBeUndefined();
  });

  it('still gives a base card when the evolved form was obtained directly', () => {
    const save = defaultSave();
    addCopy(save, 24); // Arbok first
    const result = addCopy(save, 23); // then Ekans
    expect(result).toMatchObject({ kind: 'new', key: cardKey(23) });
    expect(save.cards[cardKey(24)].level).toBe(startLevel(24));
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
    save.cards[cardKey(CHARMANDER, true)] = { level: 150, copies: 1, obtainedAt: 0 };
    expect(useCandies(save, cardKey(CHARMANDER, true), 7)).toBe(7);
    expect(save.cards[cardKey(CHARMANDER, true)].level).toBe(157);
    // A base form past 100 from before the cap change keeps its level but can't grow.
    save.cards[cardKey(CHARMANDER)] = { level: 150, copies: 1, obtainedAt: 0 };
    expect(candyRoom(save, cardKey(CHARMANDER))).toBe(0);
    expect(useCandies(save, cardKey(CHARMANDER), 7)).toBe(0);
    expect(addCopy(save, CHARMANDER).kind).toBe('max');
    expect(save.cards[cardKey(CHARMANDER)].level).toBe(150);
    // Legendaries keep growing past 100, up to 120.
    save.cards[cardKey(150)] = { level: 100, copies: 1, obtainedAt: 0 }; // Mewtwo
    save.items['rare-candy'] = 50;
    expect(useCandies(save, cardKey(150), 50)).toBe(20);
    expect(addCopy(save, 150).kind).toBe('max');
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
    // Vaporeon/Jolteon/Flareon need stones; Espeon/Umbreon (Johto), Leafeon/Glaceon (Sinnoh) need a level here.
    expect(options.map(o => o.to).sort()).toEqual([134, 135, 136, 196, 197, 470, 471]); // + Leafeon, Glaceon (Sinnoh)
    expect(options.filter(o => o.to <= 151).every(o => o.missing.item)).toBe(true);
    expect(options.filter(o => o.to > 151).every(o => o.missing.level && !o.item)).toBe(true);
    save.items['fire-stone'] = 1;
    expect(evolve(save, cardKey(133), 136)).toBeTruthy();
    expect(save.items['fire-stone']).toBeUndefined();

    save.cards[cardKey(64)] = { level: 5, copies: 1, obtainedAt: 0 }; // Kadabra
    expect(evolutionOptions(save, cardKey(64))[0].missing.item).toBe('link-cable');
  });

  it('passes the level to an owned evolved form with no level or item needed', () => {
    const save = defaultSave();
    save.cards[cardKey(33)] = { level: 27, copies: 5, obtainedAt: 0 }; // Nidorino (Moon Stone evolution)
    save.cards[cardKey(34)] = { level: 1, copies: 1, obtainedAt: 0 }; // Nidoking
    save.deck = [cardKey(33)];
    expect(evolve(save, cardKey(33), 34)).toBeNull();
    expect(transferTargets(save, cardKey(33))).toEqual([34]);
    const result = transferLevel(save, cardKey(33), 34)!;
    expect(result).toMatchObject({ merged: true, level: 28, item: null });
    expect(save.cards[cardKey(33)]).toBeUndefined();
    expect(save.cards[cardKey(34)]).toMatchObject({ level: 28, copies: 6 });
    expect(save.deck).toEqual([cardKey(34)]);
    expect(save.stats.evolutions).toBe(0);
    // Later Nidorino copies go to Nidoking, as after evolving.
    expect(addCopy(save, 33).key).toBe(cardKey(34));
  });

  it('passes the level across stages, but only to owned forms and never from shinies', () => {
    const save = defaultSave();
    save.cards[cardKey(CHARMANDER)] = { level: 12, copies: 1, obtainedAt: 0 };
    expect(transferTargets(save, cardKey(CHARMANDER))).toEqual([]);
    expect(transferLevel(save, cardKey(CHARMANDER), CHARIZARD)).toBeNull();
    save.cards[cardKey(CHARIZARD)] = { level: 3, copies: 1, obtainedAt: 0 };
    save.cards[cardKey(CHARMANDER, true)] = { level: 50, copies: 1, obtainedAt: 0 };
    expect(transferTargets(save, cardKey(CHARMANDER, true))).toEqual([]);
    expect(transferLevel(save, cardKey(CHARMANDER), CHARIZARD)).toMatchObject({ level: 13 });
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
    const m = matchup(squirtle, charmander);
    expect(m.you.mult).toBe(typeMultiplier(2));
    expect(m.opp.mult).toBe(typeMultiplier(0.5));
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

describe('baby Pokémon (Johto)', () => {
  it('keeps the base form as stage 1, capped and starting at Lv. 1', () => {
    expect(stage(172)).toBe(1); // Pichu
    expect(stage(25)).toBe(1); // Pikachu
    expect(stage(26)).toBe(2); // Raichu
    expect(isUncapped(25, false)).toBe(false);
    expect(startLevel(25)).toBe(1);
    expect(evolveForLevel(25, 22)).toBe(26); // Lt. Surge still has his Raichu
  });

  it('feeds copies of a baby to the card it evolved into', () => {
    const save = defaultSave();
    save.cards[cardKey(172)] = { level: 25, copies: 25, obtainedAt: 0 };
    evolve(save, cardKey(172), 25);
    expect(addCopy(save, 172).key).toBe(cardKey(25));
  });

  it('gives a Pichu card to a player who only has a Pikachu', () => {
    const save = defaultSave();
    save.cards[cardKey(25)] = { level: 10, copies: 10, obtainedAt: 0 };
    expect(addCopy(save, 172)).toMatchObject({ kind: 'new', key: cardKey(172) });
  });
});

describe('regions', () => {
  it('limits captures to one region', () => {
    const save = defaultSave();
    save.coins = 1000;
    const kanto = pull(save, 'poke', 100, 'coins', seeded(11), Date.now(), 1)!;
    expect(kanto.every(r => r.id <= 151)).toBe(true);
    const johto = pull(save, 'poke', 100, 'coins', seeded(12), Date.now(), 2)!;
    expect(johto.every(r => r.id >= 152 && r.id <= 251)).toBe(true);
  });

  it('features families from the chosen region on Safari days', () => {
    const johto = safariFeatured('2026-11-01', 2);
    expect(johto.every(id => getSpecies(id).generation === 2)).toBe(true);
    expect(safariFeatured('2026-11-01')).toEqual(safariFeatured('2026-11-01', 0));
  });

  it('gives Johto legendaries with a Johto Master Ball', () => {
    const rng = seeded(4);
    for (let i = 0; i < 30; i++) expect([243, 244, 245, 249, 250, 251]).toContain(roll('master', rng, { region: 2 }).id);
    expect(rarityOdds('poke', 2).common).toBeGreaterThan(0.5);
  });
});

describe('training after battles', () => {
  it('lets the player pick after a win (+1, +2 if perfect) and picks at random after a loss', () => {
    const save = defaultSave();
    save.cards[cardKey(4)] = { level: 10, copies: 1, obtainedAt: 0 };
    save.cards[cardKey(7)] = { level: 10, copies: 1, obtainedAt: 0 };
    expect(trainAfterBattle(save, ['4', '7'], 'win', false, '7', () => 0)!).toMatchObject({ key: '7', levels: 1, from: 10, to: 11, candy: 0 });
    expect(trainAfterBattle(save, ['4', '7'], 'win', true, '4')!).toMatchObject({ key: '4', levels: 2, to: 12 });
    // A loss ignores the pick.
    expect(trainAfterBattle(save, ['4', '7'], 'lose', false, '4', () => 0.9)!).toMatchObject({ key: '7', levels: 1 });
  });

  it('turns levels past the cap into Rare Candy', () => {
    const save = defaultSave();
    save.cards[cardKey(6)] = { level: 99, copies: 1, obtainedAt: 0 };
    expect(trainAfterBattle(save, ['6'], 'win', true, '6')).toMatchObject({ from: 99, to: 100, candy: 1 });
    expect(save.items['rare-candy']).toBe(1);
    // Whole team capped: the levels become candy.
    expect(trainAfterBattle(save, ['6'], 'lose', false)).toMatchObject({ key: '6', from: 100, to: 100, candy: 1 });
  });

  it('never trains a card at its cap while another can grow', () => {
    const save = defaultSave();
    save.cards[cardKey(6)] = { level: 100, copies: 1, obtainedAt: 0 };
    save.cards[cardKey(4)] = { level: 120, copies: 1, obtainedAt: 0 }; // old uncapped base form
    save.cards[cardKey(7)] = { level: 30, copies: 1, obtainedAt: 0 };
    for (const r of [0, 0.4, 0.99]) {
      expect(trainAfterBattle(save, ['6', '4', '7'], 'lose', false, null, () => r)!.key).toBe('7');
    }
    // Picking a capped card goes to one that can grow instead (the arena doesn't let it be picked).
    expect(trainAfterBattle(save, ['6', '4', '7'], 'win', false, '6', () => 0)!.key).toBe('7');
    expect(save.cards[cardKey(4)].level).toBe(120);
  });
});
