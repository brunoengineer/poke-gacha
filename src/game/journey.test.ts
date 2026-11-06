// Region Journey: the rules each chapter changes, and proof that Classic (no chapter) doesn't change at all.
// Everything runs inside withChapter, so no chapter leaks into other tests. Tables enumerate REGION_IDS: a new region is
// checked here as soon as it exists (and a typed table refuses to compile until it has a row).

import { describe, expect, it } from 'vitest';
import { getSpecies, speciesList } from '../data/species';
import { defaultSave, type SaveData } from '../state/save';
import type { TeamMember } from './battle';
import { cardKey, MAX_LEVEL, rarity, rarityRank } from './cards';
import { STARTERS } from './economy';
import {
  BANNER_ORDER, BANNERS, bannerCounts, bannerOdds, batchCost, canAfford, pull, rarityOdds, rescueBrokePlayer, roll, SAFARI_FAMILIES, safariFeatured, type BannerId,
} from './gacha';
import {
  activeChapter, activeRegion, capturable, CAPTURE_OPEN_SHARE, capturePool, CHAPTER_START_COINS, setCaptureProgress, chapterCleared, chapterLeague, chapterOpen, CHAPTERS, chapterSpecies, captureRegion, defaultJourneySave,
  inWorld, isJourney, journeyLevelOffset, leagueRunBlocksTravel, modeInChapter, nextChapter, normalizeJourney, opponentCanUse, playableChapter, playerCanUse, travel, visibleRegions, withChapter, WORLD,
  type BattleModeId, type ChapterId,
} from './journey';
import { ashUnlocked } from './modes/ash';
import { generateLadder, isElite, trainerTeam, TRAINER_CLASSES, reputationAt } from './modes/competition';
import {
  ALL_GYMS, currentGymRegion, gymRewards, defaultGymSave, designedGymLevels, GYMS, gymDifficulty, gymLevels, gymStatus, gymTeam, REGION_GYMS, regionGymsOpen, type GymSave,
} from './modes/gyms';
import { defaultHuntSave, hordeTeam, huntBlock, huntTargetHere } from './modes/hunt';
import {
  ALL_LEAGUES, placementRewards, bossRoster, buildBracket, canEnter, championBoss, defaultLeagueSave, duelDifficulty, duelInfo, duelLevels, eliteFour, firstTitleStarter, LEAGUE_DUELS,
  leagueFee, leagueTitles, leagueUnlocked, recordDuel, runTeam, startRun,
} from './modes/league';
import { anyRaidUnlocked, canRaid, RAID_FEES, raidFee, raidWinRewards, raidLevel, raidPool, raidUnlocked } from './modes/raid';
import { towerFloor, towerUnlocked } from './modes/tower';
import { friendSpecies, FRIENDS, rivalStarter, trainingTeam } from './modes/training';
import { addCopy, canEvolveNow, evolutionOptions, evolve, planTransfers, transferLevel, transferTargets } from './progression';
import { REGION_IDS, regionGeneration, type RegionId } from './regions';
import { hashString, seeded } from './rng';
import { loadSavedTeam, resolveKey, resolveTeam } from './saved-teams';
import { evolveForLevel, generateTeam, usableForm } from './teams';

const ZUBAT = 41;
const GOLBAT = 42;
const CROBAT = 169;
const EEVEE = 133;
const ESPEON = 196;
const FLAREON = 136;
const CHARMANDER = 4;
const CHARMELEON = 5;
const MAGNEMITE = 81;
const MAGNETON = 82;
const MAGNEZONE = 462;

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

const give = (save: SaveData, id: number, level = 10, shiny = false) => {
  save.cards[cardKey(id, shiny)] = { level, copies: 1, obtainedAt: 1 };
};

const journeySave = (starter: number | null = 1) => {
  const save = defaultSave();
  save.journey = defaultJourneySave();
  save.starter = starter;
  return save;
};

/** A title in each of these chapters' Leagues. */
const winTitles = (save: Pick<SaveData, 'league'>, ...chapters: ChapterId[]) => {
  for (const chapter of chapters) {
    if (chapter === 'kanto') save.league.titles = 1;
    else if (chapter === WORLD) save.league.master = { ...defaultLeagueSave(), titles: 1 };
    else save.league[chapter] = { ...defaultLeagueSave(), titles: 1 };
  }
};

const regionBadgeIds = (region: RegionId) => REGION_GYMS[region].map(g => g.badge);
const generations = (team: TeamMember[]) => team.map(m => getSpecies(m.id).generation);
const regionStarters = (region: RegionId) => STARTERS.slice(REGION_IDS.indexOf(region) * 3, REGION_IDS.indexOf(region) * 3 + 3);

describe('chapters', () => {
  it('come from REGION_IDS, with the World last', () => {
    expect(CHAPTERS).toEqual([...REGION_IDS, WORLD]);
    expect(CHAPTERS.at(-1)).toBe(WORLD);
    expect(defaultJourneySave()).toEqual({ active: REGION_IDS[0], slots: {} });
  });

  it('open one by one: only a title in the chapter before opens the next', () => {
    const save = defaultSave();
    expect(CHAPTERS.map(c => chapterOpen(save, c))).toEqual(CHAPTERS.map(c => c === CHAPTERS[0]));
    CHAPTERS.slice(0, -1).forEach((chapter, i) => {
      expect(chapterCleared(save, chapter)).toBe(false);
      expect(chapterOpen(save, CHAPTERS[i + 1])).toBe(false);
      winTitles(save, chapter);
      expect(chapterCleared(save, chapter)).toBe(true);
      expect(chapterOpen(save, CHAPTERS[i + 1])).toBe(true);
      expect(nextChapter(chapter)).toBe(CHAPTERS[i + 1]);
    });
    expect(nextChapter(WORLD)).toBeNull();
    expect(CHAPTERS.every(c => chapterOpen(save, c))).toBe(true);
  });

  it('a title in a later League alone opens only what comes right after it', () => {
    const save = defaultSave();
    winTitles(save, 'johto');
    expect(chapterOpen(save, 'johto')).toBe(false);
    expect(chapterOpen(save, 'hoenn')).toBe(true);
    expect(chapterOpen(save, 'sinnoh')).toBe(false);
  });

  it('the World is cleared by the Master League', () => {
    const save = defaultSave();
    expect(chapterCleared(save, WORLD)).toBe(false);
    winTitles(save, WORLD);
    expect(chapterCleared(save, WORLD)).toBe(true);
  });

  it('answers what the active chapter is', () => {
    withChapter(null, () => {
      expect([activeChapter(), activeRegion(), isJourney(), inWorld(), chapterLeague()]).toEqual([null, null, false, false, null]);
      expect(visibleRegions()).toEqual(REGION_IDS);
      expect(chapterSpecies()).toEqual(speciesList);
    });
    withChapter(WORLD, () => {
      expect([activeChapter(), activeRegion(), isJourney(), inWorld(), chapterLeague()]).toEqual([WORLD, null, true, true, 'master']);
      expect(visibleRegions()).toEqual(REGION_IDS);
      expect(chapterSpecies()).toEqual(speciesList);
    });
    for (const region of REGION_IDS) {
      withChapter(region, () => {
        expect([activeChapter(), activeRegion(), isJourney(), inWorld(), chapterLeague()]).toEqual([region, region, true, false, region]);
        expect(visibleRegions()).toEqual([region]);
        expect(chapterSpecies().length).toBeGreaterThan(0);
        expect(new Set(chapterSpecies().map(s => s.generation))).toEqual(new Set([regionGeneration(region)]));
      });
    }
  });

  it('restores the chapter after withChapter, even when it throws', () => {
    expect(() => withChapter('kanto', () => { throw new Error('boom'); })).toThrow('boom');
    expect(activeChapter()).toBeNull();
  });

  it('lets players use their region only, and opponents up to it', () => {
    withChapter('johto', () => {
      expect([playerCanUse(25), playerCanUse(152), playerCanUse(252)]).toEqual([false, true, false]);
      expect([opponentCanUse(25), opponentCanUse(152), opponentCanUse(252)]).toEqual([true, true, false]);
    });
    for (const chapter of [null, WORLD] as const) {
      withChapter(chapter, () => {
        expect(speciesList.every(s => playerCanUse(s.id) && opponentCanUse(s.id))).toBe(true);
      });
    }
  });
});

describe('modeInChapter', () => {
  const TABLE: Record<BattleModeId, [regions: boolean, world: boolean]> = {
    training: [true, true],
    competition: [false, true],
    gyms: [true, false],
    hunt: [true, true],
    tower: [false, true],
    league: [true, true],
    raid: [true, true],
  };

  for (const [mode, [regions, world]] of Object.entries(TABLE) as [BattleModeId, [boolean, boolean]][]) {
    it(mode, () => {
      for (const region of REGION_IDS) expect(withChapter(region, () => modeInChapter(mode))).toBe(regions);
      expect(withChapter(WORLD, () => modeInChapter(mode))).toBe(world);
      expect(withChapter(null, () => modeInChapter(mode))).toBe(true);
    });
  }
});

describe('travel', () => {
  it('needs a Journey save and an open chapter other than the current one', () => {
    withChapter(null, () => {
      const classic = defaultSave();
      winTitles(classic, 'kanto');
      expect(travel(classic, 'johto')).toBe(false);
      expect(activeChapter()).toBeNull();
    });
    withChapter('kanto', () => {
      const save = journeySave();
      save.deck = ['1'];
      expect(travel(save, 'kanto')).toBe(false);
      expect(travel(save, 'johto')).toBe(false);
      expect(travel(save, WORLD)).toBe(false);
      expect(save.journey!.active).toBe('kanto');
      expect(save.deck).toEqual(['1']);
      expect(save.starter).toBe(1);
      expect(activeChapter()).toBe('kanto');
    });
  });

  it("swaps the team, saved teams and starter, and restores them on return", () => {
    withChapter('kanto', () => {
      const save = journeySave(4);
      give(save, CHARMANDER);
      give(save, 152);
      save.deck = [cardKey(CHARMANDER)];
      save.teams = [{ id: 'k', name: 'Kanto', keys: [cardKey(CHARMANDER)] }];
      winTitles(save, 'kanto');

      expect(travel(save, 'johto')).toBe(true);
      expect(activeChapter()).toBe('johto');
      expect(save.journey!.active).toBe('johto');
      expect([save.starter, save.deck, save.teams]).toEqual([null, [], []]);

      save.starter = 152;
      save.deck = [cardKey(152)];
      save.teams = [{ id: 'j', name: 'Johto', keys: [cardKey(152)] }];
      expect(travel(save, 'kanto')).toBe(true);
      expect(activeChapter()).toBe('kanto');
      expect(save.starter).toBe(4);
      expect(save.deck).toEqual([cardKey(CHARMANDER)]);
      expect(save.teams.map(t => t.id)).toEqual(['k']);
      expect(save.journey!.slots.kanto).toBeUndefined();
      expect(save.journey!.slots.johto).toMatchObject({ starter: 152, deck: [cardKey(152)] });

      expect(travel(save, 'johto')).toBe(true);
      expect(save.starter).toBe(152);
      expect(save.deck).toEqual([cardKey(152)]);
      expect(save.teams.map(t => t.id)).toEqual(['j']);
    });
  });

  it('keeps what is global: coins, items, cards', () => {
    withChapter('kanto', () => {
      const save = journeySave();
      give(save, 1);
      save.coins = 777;
      save.items['rare-candy'] = 3;
      winTitles(save, 'kanto');
      travel(save, 'johto');
      expect(save.coins).toBe(777);
      expect(save.items['rare-candy']).toBe(3);
      expect(save.cards[cardKey(1)]).toBeDefined();
    });
  });

  it('brings a team back without what evolved out of the region, keeping what evolved within it', () => {
    withChapter(WORLD, () => {
      const save = journeySave(4);
      winTitles(save, ...REGION_IDS);
      save.journey!.active = WORLD;
      // Left behind in Kanto: Charmander and Eevee. In the World they became Charmeleon and Espeon.
      save.journey!.slots.kanto = { starter: 4, deck: ['4', '133', '25', '25s'], teams: [] };
      give(save, CHARMELEON);
      give(save, ESPEON);
      give(save, 25);
      expect(travel(save, 'kanto')).toBe(true);
      expect(save.deck).toEqual([cardKey(CHARMELEON), cardKey(25)]);
    });
  });

  it('collapses two old cards that became one', () => {
    withChapter(WORLD, () => {
      const save = journeySave();
      winTitles(save, ...REGION_IDS);
      save.journey!.active = WORLD;
      save.journey!.slots.kanto = { starter: 1, deck: ['4', '5'], teams: [] };
      give(save, CHARMELEON);
      travel(save, 'kanto');
      expect(save.deck).toEqual([cardKey(CHARMELEON)]);
    });
  });

  it("gives the World the first chapter's starter, and each region its own to choose", () => {
    withChapter('sinnoh', () => {
      const save = journeySave(387);
      winTitles(save, ...REGION_IDS);
      save.journey!.active = 'sinnoh';
      save.journey!.slots.kanto = { starter: 7, deck: [], teams: [] };
      expect(travel(save, WORLD)).toBe(true);
      expect(save.starter).toBe(7);
      expect(inWorld()).toBe(true);
    });
    withChapter('kanto', () => {
      const save = journeySave(1);
      winTitles(save, ...REGION_IDS);
      expect(travel(save, WORLD)).toBe(true); // straight from the first chapter
      expect(save.starter).toBe(1);
      expect(travel(save, 'johto')).toBe(true);
      expect(save.starter).toBeNull();
    });
  });

  it('keeps the World its own starter on later visits', () => {
    withChapter('kanto', () => {
      const save = journeySave(1);
      winTitles(save, ...REGION_IDS);
      save.journey!.slots[WORLD] = { starter: 4, deck: [], teams: [] };
      travel(save, WORLD);
      expect(save.starter).toBe(4);
    });
  });
});

describe('normalizeJourney', () => {
  it('gives a fresh journey for garbage', () => {
    for (const raw of [null, undefined, 0, 'kanto', true, [], ['kanto']]) expect(normalizeJourney(raw)).toEqual(defaultJourneySave());
  });

  it('keeps a chapter from a newer app, and plays the first one until the app catches up', () => {
    const journey = normalizeJourney({ active: 'mars' });
    expect(journey.active).toBe('mars');
    expect(playableChapter(journey)).toBe(CHAPTERS[0]);
    expect(playableChapter(normalizeJourney({ active: WORLD }))).toBe(WORLD);
    expect(normalizeJourney({ active: 3, slots: 'x' })).toEqual(defaultJourneySave());
    expect(normalizeJourney({ active: WORLD }).active).toBe(WORLD);
  });

  it('keeps well-formed slots, cleans the odd ones and keeps unknown chapters as they are', () => {
    const team = { id: 't', name: 'T', keys: ['1'] };
    const journey = normalizeJourney({
      active: 'johto',
      slots: {
        kanto: { starter: 1, deck: ['1', 5, null, '4'], teams: [team] },
        johto: { starter: 'x', deck: 'nope', teams: {} },
        hoenn: 'garbage',
        sinnoh: null,
        mars: { starter: 1, deck: [], teams: [] },
      },
    });
    expect(journey).toEqual({
      active: 'johto',
      slots: {
        kanto: { starter: 1, deck: ['1', '4'], teams: [team] }, johto: { starter: null, deck: [], teams: [] }, mars: { starter: 1, deck: [], teams: [] },
      },
    });
  });
});

describe('captures', () => {
  const OTHER_PICKS = [0, 1, 2, 3, 4];

  const payingSave = () => {
    const save = defaultSave();
    save.coins = 1e7;
    save.gyms.badges = ['a', 'b', 'c'];
    for (const banner of BANNER_ORDER) if (BANNERS[banner].ticket) save.items[BANNERS[banner].ticket!] = 1000;
    return save;
  };

  for (const region of REGION_IDS) {
    const generation = regionGeneration(region);

    describe(region, () => {
      for (const banner of BANNER_ORDER) {
        it(`${banner}: rolls only its generation, whatever region is asked for`, () => {
          withChapter(region, () => {
            for (const picked of OTHER_PICKS) {
              const rng = seeded(picked + banner.length);
              const rolled = Array.from({ length: 150 }, () => getSpecies(roll(banner, rng, { region: picked }).id).generation);
              expect(new Set(rolled)).toEqual(new Set([generation]));
            }
            const rng = seeded(9);
            expect(new Set(Array.from({ length: 50 }, () => getSpecies(roll(banner, rng).id).generation))).toEqual(new Set([generation]));
          });
        });

        it(`${banner}: pulls only its generation`, () => {
          withChapter(region, () => {
            for (const picked of [0, generation === 1 ? 2 : 1]) {
              const save = payingSave();
              const pay = BANNERS[banner].cost == null ? 'ticket' : 'coins';
              const rng = seeded(picked + 3);
              const size = Math.max(...bannerCounts(banner));
              const results = Array.from({ length: 40 / size }, () => pull(save, banner, size, pay, rng, 1e12, picked)!).flat();
              expect(results).toHaveLength(40);
              expect(new Set(results.map(r => getSpecies(r.id).generation))).toEqual(new Set([generation]));
            }
          });
        });

        it(`${banner}: its odds only list its generation`, () => {
          withChapter(region, () => {
            for (const picked of OTHER_PICKS) {
              const odds = bannerOdds(banner, picked);
              expect(odds.length).toBeGreaterThan(0);
              expect(odds.every(o => getSpecies(o.id).generation === generation)).toBe(true);
              expect(odds.reduce((sum, o) => sum + o.chance, 0)).toBeCloseTo(1, 6);
            }
            const shares = Object.values(rarityOdds(banner, 0));
            expect(shares.reduce((sum, share) => sum + share, 0)).toBeCloseTo(1, 6);
            expect(rarityOdds(banner, 0)).toEqual(rarityOdds(banner, generation));
          });
        });
      }

      it('the Master Ball pool is exactly its legendaries and mythicals', () => {
        withChapter(region, () => {
          expect(bannerOdds('master', 0).map(o => o.id).sort((a, b) => a - b)).toEqual(raidPool(region).map(s => s.id));
        });
      });

      it('the guaranteed rarity stays in its generation', () => {
        withChapter(region, () => {
          for (const banner of ['great', 'ultra'] as const) {
            const save = payingSave();
            save.pity[banner] = BANNERS[banner].pity!.every - 1;
            const [result] = pull(save, banner, 1, 'coins', seeded(21), 1e12, 0)!;
            expect(getSpecies(result.id).generation).toBe(generation);
            expect(rarityRank(result.rarity)).toBeGreaterThanOrEqual(rarityRank(BANNERS[banner].pity!.min));
            expect(rarity(result.id)).toBe(result.rarity);
          }
        });
      });

      it("features its own families on the Safari, and another region's can't leak in", () => {
        withChapter(region, () => {
          for (const picked of OTHER_PICKS) {
            const featured = safariFeatured('2026-03-01', picked);
            expect(featured).toHaveLength(SAFARI_FAMILIES);
            expect(featured.every(id => getSpecies(id).generation === generation)).toBe(true);
            expect(featured).toEqual(safariFeatured('2026-03-01', 0));
          }
          const elsewhere = STARTERS[((generation % REGION_IDS.length)) * 3];
          const rng = seeded(4);
          const rolled = Array.from({ length: 100 }, () => getSpecies(roll('safari', rng, { featured: [elsewhere], region: 0 }).id).generation);
          expect(new Set(rolled)).toEqual(new Set([generation]));
        });
      });
    });
  }

  it("the odds tables don't leak between Classic and the chapters, in any order", () => {
    const classicAll = bannerOdds('poke', 0);
    const classicJohto = bannerOdds('poke', 2);
    withChapter('kanto', () => {
      expect(bannerOdds('poke', 0).every(o => getSpecies(o.id).generation === 1)).toBe(true);
      expect(bannerOdds('poke', 2).every(o => getSpecies(o.id).generation === 1)).toBe(true);
    });
    withChapter('johto', () => {
      expect(bannerOdds('poke', 2)).toEqual(classicJohto);
      expect(bannerOdds('poke', 1).every(o => getSpecies(o.id).generation === 2)).toBe(true);
    });
    expect(bannerOdds('poke', 0)).toEqual(classicAll);
    expect(bannerOdds('poke', 2)).toEqual(classicJohto);
    expect(new Set(classicAll.map(o => getSpecies(o.id).generation)).size).toBe(REGION_IDS.length);
  });

  it('the World honours the region picked, and every region at 0', () => {
    withChapter(WORLD, () => {
      expect(captureRegion(3)).toBe(3);
      expect(captureRegion(0)).toBe(0);
      expect(bannerOdds('poke', 3).every(o => getSpecies(o.id).generation === 3)).toBe(true);
      expect(new Set(bannerOdds('poke', 0).map(o => getSpecies(o.id).generation)).size).toBe(REGION_IDS.length);
      expect(safariFeatured('2026-03-01', 3).every(id => getSpecies(id).generation === 3)).toBe(true);
      const rng = seeded(3);
      expect(new Set(Array.from({ length: 100 }, () => getSpecies(roll('poke', rng, { region: 4 }).id).generation))).toEqual(new Set([4]));
    });
  });
});

describe('evolving', () => {
  const golbatSave = () => {
    const save = defaultSave();
    give(save, GOLBAT, 60);
    return save;
  };

  it("Golbat can't become Crobat in Kanto or Johto (it isn't a Johto Pokémon), can in the World", () => {
    withChapter('kanto', () => {
      const save = golbatSave();
      expect(evolutionOptions(save, cardKey(GOLBAT))).toEqual([]);
      expect(canEvolveNow(save, cardKey(GOLBAT))).toBe(false);
      expect(evolve(save, cardKey(GOLBAT), CROBAT)).toBeNull();
      expect(save.cards[cardKey(GOLBAT)]).toBeDefined();
    });
    expect(withChapter('johto', () => evolutionOptions(golbatSave(), cardKey(GOLBAT)))).toEqual([]);
    for (const chapter of [WORLD, null] as const) {
      withChapter(chapter, () => {
        const save = golbatSave();
        expect(evolutionOptions(save, cardKey(GOLBAT)).map(o => o.to)).toEqual([CROBAT]);
        expect(canEvolveNow(save, cardKey(GOLBAT))).toBe(true);
        expect(evolve(save, cardKey(GOLBAT), CROBAT)).toMatchObject({ to: CROBAT });
      });
    }
  });

  it("keeps the evolutions the chapter has (Eevee: the first three in Kanto, none in Johto, where it doesn't belong)", () => {
    const save = defaultSave();
    give(save, EEVEE, 40);
    expect(withChapter('kanto', () => evolutionOptions(save, cardKey(EEVEE)).map(o => o.to).sort((a, b) => a - b))).toEqual([134, 135, 136]);
    expect(withChapter('johto', () => evolutionOptions(save, cardKey(EEVEE)).map(o => o.to).sort((a, b) => a - b))).toEqual([]);
    expect(withChapter(WORLD, () => evolutionOptions(save, cardKey(EEVEE)).length)).toBe(evolutionOptions(save, cardKey(EEVEE)).length);
  });

  it("a level pass can't reach a card from another region", () => {
    const save = defaultSave();
    give(save, ZUBAT, 30);
    give(save, GOLBAT, 5);
    give(save, CROBAT, 1);
    withChapter('kanto', () => {
      expect(transferTargets(save, cardKey(ZUBAT))).toEqual([GOLBAT]);
      expect(transferTargets(save, cardKey(GOLBAT))).toEqual([]);
      expect(transferLevel(structuredClone(save), cardKey(GOLBAT), CROBAT)).toBeNull();
      expect(planTransfers(save).map(t => [t.from, t.to])).toEqual([[cardKey(ZUBAT), GOLBAT]]);
    });
    withChapter(WORLD, () => {
      expect(transferTargets(save, cardKey(ZUBAT))).toEqual([GOLBAT, CROBAT]);
      expect(planTransfers(save).map(t => t.to)).toEqual([CROBAT, CROBAT]);
    });
  });

  it("'Pass levels' leaves the cards of other regions alone", () => {
    const save = defaultSave();
    give(save, GOLBAT, 60);
    give(save, CROBAT, 1);
    give(save, MAGNEMITE, 40);
    give(save, MAGNETON, 1);
    // Crobat is a Johto species, but a Kanto Golbat stays out of Johto's pass.
    expect(withChapter('johto', () => planTransfers(save))).toEqual([]);
    expect(withChapter('kanto', () => planTransfers(save).map(t => t.from))).toEqual([cardKey(MAGNEMITE)]);
  });
});

describe('addCopy routing', () => {
  const evolvedEevee = () => {
    const save = defaultSave();
    give(save, ESPEON, 30);
    save.evolved[EEVEE] = 1;
    return save;
  };

  it('in the World a copy goes to the evolved card, as in Classic', () => {
    for (const chapter of [WORLD, null, 'johto'] as const) {
      withChapter(chapter, () => {
        const save = evolvedEevee();
        expect(addCopy(save, EEVEE, false, 5)).toMatchObject({ key: cardKey(ESPEON), kind: 'level', from: 30, to: 31 });
        expect(save.cards[cardKey(EEVEE)]).toBeUndefined();
      });
    }
  });

  it('back in Kanto, an Eevee evolved into Espeon in the World becomes a card of its own', () => {
    withChapter('kanto', () => {
      const save = evolvedEevee();
      expect(addCopy(save, EEVEE, false, 5)).toMatchObject({ key: cardKey(EEVEE), kind: 'new', to: 1 });
      expect(save.cards[cardKey(ESPEON)].level).toBe(30);
      expect(addCopy(save, EEVEE, false, 6)).toMatchObject({ key: cardKey(EEVEE), kind: 'level', from: 1, to: 2 });
    });
  });

  it('in Kanto, an evolved form Kanto has still takes the copy', () => {
    withChapter('kanto', () => {
      const save = evolvedEevee();
      give(save, FLAREON, 12);
      expect(addCopy(save, EEVEE, false, 5)).toMatchObject({ key: cardKey(FLAREON), from: 12, to: 13 });
    });
  });
});

describe('saved teams', () => {
  const save = () => {
    const s = defaultSave();
    give(s, CHARMELEON);
    give(s, ESPEON);
    give(s, 25);
    give(s, 25, 10, true);
    give(s, 152);
    return s;
  };

  it("never resolve to a card the chapter can't use", () => {
    const s = save();
    withChapter('kanto', () => {
      expect(resolveKey(s, cardKey(CHARMANDER))).toBe(cardKey(CHARMELEON));
      expect(resolveKey(s, cardKey(CHARMELEON))).toBe(cardKey(CHARMELEON));
      expect(resolveKey(s, cardKey(EEVEE))).toBeNull();
      expect(resolveKey(s, cardKey(ESPEON))).toBeNull();
      expect(resolveKey(s, cardKey(152))).toBeNull();
      expect(resolveKey(s, cardKey(25, true))).toBe(cardKey(25, true));
    });
    withChapter('johto', () => {
      expect(resolveKey(s, cardKey(EEVEE))).toBe(cardKey(ESPEON));
      expect(resolveKey(s, cardKey(25))).toBeNull();
      expect(resolveKey(s, cardKey(25, true))).toBeNull();
    });
    withChapter(WORLD, () => {
      expect(resolveKey(s, cardKey(EEVEE))).toBe(cardKey(ESPEON));
      expect(resolveKey(s, cardKey(25))).toBe(cardKey(25));
    });
  });

  it('count those cards as missing, and heal the preset when loaded', () => {
    const s = save();
    s.teams = [{ id: 't', name: 'T', keys: [cardKey(CHARMANDER), cardKey(EEVEE), cardKey(152), cardKey(25)] }];
    withChapter('kanto', () => {
      expect(resolveTeam(s, s.teams[0])).toEqual({ keys: [cardKey(CHARMELEON), cardKey(25)], missing: 2 });
      expect(loadSavedTeam(s, 't')).toEqual({ missing: 2 });
      expect(s.deck).toEqual([cardKey(CHARMELEON), cardKey(25)]);
    });
  });

  it("a registered League run resolves in its own chapter, and follows evolutions there", () => {
    withChapter('kanto', () => {
      const s = defaultSave();
      for (const id of [CHARMANDER, 1, 7, 16, 19, 25]) give(s, id, 50);
      s.deck = [CHARMANDER, 1, 7, 16, 19, 25].map(id => cardKey(id));
      s.coins = 100000;
      s.gyms.badges = regionBadgeIds('kanto');
      expect(startRun(s, 42, 1e12, 'kanto')).toBe(true);
      const run = s.league.run!;
      expect(runTeam(s, run).map(m => m.key)).toEqual(s.deck);
      expect(evolve(s, cardKey(CHARMANDER), CHARMELEON)).not.toBeNull();
      expect(runTeam(s, run)[0]).toMatchObject({ registered: cardKey(CHARMANDER), key: cardKey(CHARMELEON) });
    });
  });
});

describe('opponents', () => {
  const noNewer = (team: TeamMember[], region: RegionId, what: string) => {
    expect(Math.max(0, ...generations(team)), what).toBeLessThanOrEqual(regionGeneration(region));
  };

  it("don't evolve past their chapter", () => {
    const top = (id: number, chapter: ChapterId | null) => withChapter(chapter, () => evolveForLevel(id, 100, () => 0));
    expect([top(ZUBAT, 'kanto'), top(ZUBAT, 'johto'), top(ZUBAT, WORLD), top(ZUBAT, null)]).toEqual([GOLBAT, CROBAT, CROBAT, CROBAT]);
    expect([top(MAGNEMITE, 'kanto'), top(MAGNEMITE, 'johto'), top(MAGNEMITE, 'hoenn'), top(MAGNEMITE, 'sinnoh')]).toEqual([MAGNETON, MAGNETON, MAGNETON, MAGNEZONE]);
  });

  it('keep their older species: Johto still has Gengar', () => {
    const morty = REGION_GYMS.johto.find(g => g.id === 'morty')!;
    const team = withChapter('johto', () => gymTeam(defaultGymSave(), morty, seeded(1)));
    expect(team.map(m => m.id)).toContain(94);
  });

  for (const region of REGION_IDS) {
    describe(region, () => {
      it('gym leaders stay within the chapter, with full teams', () => {
        withChapter(region, () => {
          for (const seed of SEEDS) {
            for (const gym of REGION_GYMS[region]) {
              const team = gymTeam(defaultGymSave(), gym, seeded(seed));
              noNewer(team, region, gym.id);
              expect(team).toHaveLength(6);
            }
          }
        });
      });

      it('every League duel stays within the chapter, elite ladder trainers included', () => {
        withChapter(region, () => {
          for (const seed of SEEDS) {
            for (const starter of regionStarters(region)) {
              const bracket = buildBracket(seed, seed * 31, starter, region);
              expect(bracket.path[0].kind).toBe('elite');
              const run = { seed: seed * 7, duel: 0, bonus: 0, startedAt: 0 };
              for (let duel = 0; duel < LEAGUE_DUELS; duel++) {
                const { team, opponent } = duelInfo(bracket, run, duel, starter, region);
                noNewer(team, region, opponent.id);
                expect(team.length, opponent.id).toBeGreaterThanOrEqual(5);
              }
            }
          }
        });
      });

      it("every elite ladder trainer's team stays within the chapter, whatever types they like", () => {
        withChapter(region, () => {
          for (const seed of SEEDS) {
            for (const cls of TRAINER_CLASSES) {
              for (const rank of [1, 2, 10, 11]) {
                const team = trainerTeam({ rank, types: cls.types }, [70, 72], seeded(seed + rank));
                noNewer(team, region, `${cls.id} #${rank}`);
                expect(team).toHaveLength(6);
              }
            }
          }
        });
      });

      it('the whole ladder stays within the chapter', () => {
        withChapter(region, () => {
          for (const seed of SEEDS.slice(0, 3)) {
            for (const trainer of generateLadder(seed)) {
              noNewer(trainer.team, region, trainer.id);
              expect(trainer.team).toHaveLength(6);
            }
          }
        });
      });

      it('the #1 trainer still brings a legendary, and the elites a rare Pokémon', () => {
        withChapter(region, () => {
          const [top, second] = generateLadder(101);
          expect(isElite(top.rank)).toBe(true);
          expect(getSpecies(top.team.at(-1)!.id).legendary).toBe(true);
          expect(isElite(second.rank)).toBe(true);
          expect(getSpecies(second.team.at(-1)!.id)).toMatchObject({ legendary: false, mythical: false });
          expect(getSpecies(second.team.at(-1)!.id).captureRate).toBeLessThanOrEqual(45);
        });
      });

      it('every friend stays within the chapter, on every difficulty', () => {
        withChapter(region, () => {
          for (const seed of SEEDS) {
            for (const friend of FRIENDS) {
              for (const difficulty of ['easy', 'normal', 'hard'] as const) {
                for (const starter of [null, ...regionStarters(region)]) {
                  noNewer(trainingTeam(friend, 80, difficulty, seeded(seed), starter), region, friend.id);
                }
              }
            }
          }
        });
      });

      it("the region's friends bring full teams", () => {
        withChapter(region, () => {
          for (const seed of SEEDS) {
            for (const friend of FRIENDS.filter(f => f.region === region)) {
              expect(trainingTeam(friend, 40, 'normal', seeded(seed)), friend.id).toHaveLength(6);
            }
          }
        });
      });

      it("the rival brings the region's starter that beats the player's", () => {
        const rival = FRIENDS.find(f => f.region === region && f.rival)!;
        withChapter(region, () => {
          regionStarters(region).forEach((starter, i) => {
            const counter = regionStarters(region)[(i + 1) % 3];
            expect(rivalStarter(starter, region)).toBe(counter);
            expect(friendSpecies(rival, seeded(i), starter)).toContain(counter);
            expect(getSpecies(counter).generation).toBe(regionGeneration(region));
          });
          expect(rivalStarter(null, region)).toBe(regionStarters(region)[1]);
        });
      });

      it('a hunted horde is its species, as in Classic', () => {
        withChapter(region, () => {
          const [id] = regionStarters(region);
          expect(hordeTeam(id, 30, seeded(1)).map(m => m.id)).toEqual(Array(6).fill(id));
        });
      });
    });
  }

  it('every rival keeps working in the World', () => {
    withChapter(WORLD, () => {
      for (const region of REGION_IDS) {
        const rival = FRIENDS.find(f => f.region === region && f.rival)!;
        // The World's starter is the first chapter's: Kanto's Charmander meets each region's water starter.
        const counter = regionStarters(region)[2];
        expect(rivalStarter(4, region)).toBe(counter);
        expect(friendSpecies(rival, seeded(1), 4)).toContain(counter);
      }
    });
  });

  it('the Tower in the World draws from every generation', () => {
    withChapter(WORLD, () => {
      const seen = new Set(Array.from({ length: 40 }, (_, i) => towerFloor(i + 1).team.flatMap(m => getSpecies(m.id).generation)).flat());
      expect(seen.size).toBeGreaterThan(1);
    });
  });
});

describe('fixed rosters', () => {
  /** Every fixed roster of a region, by whose it is. */
  const rosters = (region: RegionId): [string, number[]][] => [
    ...REGION_GYMS[region].map((g): [string, number[]] => [g.id, g.roster]),
    ...eliteFour(region).map((b): [string, number[]] => [b.id, bossRoster(b)]),
    ...regionStarters(region).map((s): [string, number[]] => [`champion:${s}`, championBoss(s, region).roster]),
    ...FRIENDS.filter(f => f.region === region).map((f): [string, number[]] => [
      f.id, [...f.pool, ...(f.signature ?? []), ...regionStarters(region).map(s => rivalStarter(s, region))],
    ]),
  ];

  // What the chapters change: older games' rosters that have species from later generations. Null means left out (the
  // whole line is newer). Written out so a new roster that needs walking back shows up in review.
  const WALKED_BACK: Record<RegionId, Record<string, Record<number, number | null>>> = {
    kanto: {},
    johto: {},
    hoenn: {},
    sinnoh: {},
  };

  for (const region of REGION_IDS) {
    it(`${region}: only the rosters listed here need walking back`, () => {
      withChapter(region, () => {
        const found: Record<string, Record<number, number | null>> = {};
        for (const [who, roster] of rosters(region)) {
          for (const id of roster) {
            if (!opponentCanUse(id)) (found[who] ??= {})[id] = usableForm(id);
          }
        }
        expect(found).toEqual(WALKED_BACK[region]);
      });
    });

    it(`${region}: every roster is legal in its chapter, as written and evolved`, () => {
      withChapter(region, () => {
        for (const [who, roster] of rosters(region)) {
          for (const exact of [true, false]) {
            for (const level of [15, 45, 100]) {
              const team = generateTeam({ level, species: roster, exact, size: roster.length }, seeded(level));
              expect(Math.max(0, ...generations(team)), who).toBeLessThanOrEqual(regionGeneration(region));
              const dropped = roster.filter(id => usableForm(id) == null).length;
              expect(team, who).toHaveLength(roster.length - dropped);
            }
          }
        }
      });
    });
  }

  it("keeps Classic's rosters whole (no chapter walks nothing back)", () => {
    withChapter(null, () => {
      for (const region of REGION_IDS) {
        for (const [who, roster] of rosters(region)) {
          const team = generateTeam({ level: 100, species: roster, exact: true, size: roster.length }, seeded(1));
          expect(team.map(m => m.id), who).toEqual(roster);
        }
      }
    });
  });

  it('keeps the World\'s rosters whole, too', () => {
    withChapter(WORLD, () => {
      for (const boss of [...eliteFour('master'), championBoss(null, 'master')]) {
        const team = generateTeam({ level: 100, species: boss.roster, exact: true }, seeded(1));
        expect(team.map(m => m.id), boss.id).toEqual(boss.roster);
      }
    });
  });
});

describe('the ladder cache', () => {
  it("doesn't leak teams between chapters", () => {
    const seed = 424242;
    const classic = generateLadder(seed);
    const kanto = withChapter('kanto', () => generateLadder(seed));
    const world = withChapter(WORLD, () => generateLadder(seed));
    expect(classic.some(t => generations(t.team).some(g => g > 1))).toBe(true);
    expect(kanto.every(t => generations(t.team).every(g => g === 1))).toBe(true);
    // The same people, whatever they bring.
    expect(kanto.map(t => t.name)).toEqual(classic.map(t => t.name));
    expect(world.map(t => t.team)).toEqual(classic.map(t => t.team));
    expect(generateLadder(seed)).toBe(classic);
    expect(withChapter('kanto', () => generateLadder(seed))).toBe(kanto);
  });
});

describe('Journey levels', () => {
  // Kanto's curve plus 5 levels per region before it: written out on purpose (see difficulty-baseline.test.ts).
  const GYM_LEVELS: Record<RegionId, [number, number][]> = {
    kanto: [[15, 19], [18, 22], [24, 28], [30, 34], [36, 40], [42, 46], [48, 52], [54, 58]],
    johto: [[20, 24], [23, 27], [29, 33], [35, 39], [41, 45], [47, 51], [53, 57], [59, 63]],
    hoenn: [[25, 29], [28, 32], [34, 38], [40, 44], [46, 50], [52, 56], [58, 62], [64, 68]],
    sinnoh: [[30, 34], [33, 37], [39, 43], [45, 49], [51, 55], [57, 61], [63, 67], [69, 73]],
  };
  const DUEL_LEVELS: Record<RegionId, [number, number][]> = {
    kanto: [[60, 63], [62, 66], [64, 68], [66, 70]],
    johto: [[65, 68], [67, 71], [69, 73], [71, 75]],
    hoenn: [[70, 73], [72, 76], [74, 78], [76, 80]],
    sinnoh: [[75, 78], [77, 81], [79, 83], [81, 85]],
  };
  const RAID_LEVELS: Record<RegionId, number> = { kanto: 70, johto: 75, hoenn: 80, sinnoh: 85 };

  for (const region of REGION_IDS) {
    it(`${region}: gyms`, () => {
      withChapter(region, () => {
        const gyms = REGION_GYMS[region];
        expect(gyms.map(designedGymLevels)).toEqual(GYM_LEVELS[region]);
        expect(gyms.map(g => gymLevels(defaultGymSave(), g))).toEqual(GYM_LEVELS[region]);
        expect(gyms.map(g => gymDifficulty(defaultGymSave(), g).levels)).toEqual(GYM_LEVELS[region]);
      });
    });

    it(`${region}: a first battle stays inside the gym's levels`, () => {
      withChapter(region, () => {
        REGION_GYMS[region].forEach((gym, i) => {
          for (const member of gymTeam(defaultGymSave(), gym, seeded(i + 1))) {
            expect(member.level).toBeGreaterThanOrEqual(GYM_LEVELS[region][i][0]);
            expect(member.level).toBeLessThanOrEqual(GYM_LEVELS[region][i][1]);
          }
        });
      });
    });

    it(`${region}: rematches add their bonus on top, the designed levels don't`, () => {
      withChapter(region, () => {
        const [gym] = REGION_GYMS[region];
        const gyms: GymSave = { badges: [gym.badge], records: { [gym.id]: { wins: 1, losses: 0 } } };
        const [min, max] = GYM_LEVELS[region][0];
        expect(gymLevels(gyms, gym)).toEqual([min + 10, max + 10]);
        expect(designedGymLevels(gym)).toEqual([min, max]);
      });
    });

    it(`${region}: League duels`, () => {
      withChapter(region, () => {
        expect([0, 1, 2, 3].map(d => duelLevels(d, 0, region))).toEqual(DUEL_LEVELS[region]);
        expect(duelLevels(3, 5, region)).toEqual(DUEL_LEVELS[region][3].map(l => l + 5));
        expect([0, 1, 2, 3].map(d => duelDifficulty(d, 0, region).levels)).toEqual(DUEL_LEVELS[region]);
      });
    });

    it(`${region}: a team above the League makes it train up, as ever`, () => {
      withChapter(region, () => {
        const top = DUEL_LEVELS[region][3][1];
        expect(duelDifficulty(0, 0, region, { average: top, max: top }).scaled).toBe(false);
        expect(duelDifficulty(0, 0, region, { average: top + 1, max: top + 1 })).toMatchObject({ scaled: true, levels: [top + 1, top + 1] });
      });
    });

    it(`${region}: Legendary Battle`, () => {
      withChapter(region, () => {
        expect(raidLevel(region)).toBe(RAID_LEVELS[region]);
        expect(raidLevel(region, { average: 10, max: 20 })).toBe(RAID_LEVELS[region]);
        expect(raidLevel(region, { average: 99, max: 100 })).toBe(100);
      });
    });

    it(`${region}: normal cards can win the first playthrough`, () => {
      expect(journeyLevelOffset(region)).toBe(REGION_IDS.indexOf(region) * 5);
      const highest = Math.max(...GYM_LEVELS[region].flat(), ...DUEL_LEVELS[region].flat(), RAID_LEVELS[region]);
      expect(highest).toBeLessThanOrEqual(MAX_LEVEL);
    });
  }

  it("the Journey's levels follow the region in the World too, and the Master League stays at Lv. 100", () => {
    withChapter(WORLD, () => {
      for (const region of REGION_IDS) expect(raidLevel(region)).toBe(RAID_LEVELS[region]);
      for (let duel = 0; duel < LEAGUE_DUELS; duel++) expect(duelLevels(duel, 0, 'master')).toEqual([100, 100]);
      expect(duelDifficulty(0, 0, 'master', { average: 200, max: 250 }).levels).toEqual([100, 100]);
    });
  });
});

describe('Journey gyms', () => {
  it('only the active region is open, and none in the World', () => {
    const gyms = defaultGymSave();
    for (const region of REGION_IDS) {
      withChapter(region, () => {
        expect(REGION_IDS.map(r => regionGymsOpen(gyms, r))).toEqual(REGION_IDS.map(r => r === region));
        expect(gymStatus(gyms, 0, region)).toBe('open');
        expect(gymStatus(gyms, 1, region)).toBe('locked');
        expect(currentGymRegion(gyms)).toBe(region);
      });
    }
    withChapter(WORLD, () => {
      expect(REGION_IDS.map(r => regionGymsOpen(gyms, r))).toEqual(REGION_IDS.map(() => false));
      expect(REGION_IDS.map(r => gymStatus(gyms, 0, r))).toEqual(REGION_IDS.map(() => 'locked'));
    });
  });

  it("a later region's gyms don't need the earlier ones' badges", () => {
    withChapter('sinnoh', () => {
      expect(gymStatus(defaultGymSave(), 0, 'sinnoh')).toBe('open');
    });
  });

  it('the active region stays current even when all its badges are earned', () => {
    withChapter('kanto', () => {
      expect(currentGymRegion({ badges: regionBadgeIds('kanto') })).toBe('kanto');
    });
  });
});

describe('Journey League', () => {
  const allBadges = () => REGION_IDS.flatMap(regionBadgeIds);

  const saveWith = (badges: string[], ...titles: ChapterId[]) => {
    const save = defaultSave();
    save.gyms.badges = badges;
    winTitles(save, ...titles);
    return save;
  };

  it("a region's League needs its chapter and its 8 badges", () => {
    for (const region of REGION_IDS) {
      withChapter(region, () => {
        expect(leagueUnlocked(saveWith([]), region)).toBe(false);
        expect(leagueUnlocked(saveWith(regionBadgeIds(region).slice(0, 7)), region)).toBe(false);
        expect(leagueUnlocked(saveWith(regionBadgeIds(region)), region)).toBe(true);
        for (const other of REGION_IDS.filter(r => r !== region)) expect(leagueUnlocked(saveWith(allBadges()), other)).toBe(false);
      });
    }
  });

  it('the Master League needs the World and every title', () => {
    const everything = saveWith(allBadges(), ...REGION_IDS);
    for (const region of REGION_IDS) expect(withChapter(region, () => leagueUnlocked(everything, 'master'))).toBe(false);
    withChapter(WORLD, () => {
      expect(leagueUnlocked(everything, 'master')).toBe(true);
      expect(leagueUnlocked(saveWith(allBadges(), ...REGION_IDS.slice(1)), 'master')).toBe(false);
      for (const region of REGION_IDS) expect(leagueUnlocked(everything, region)).toBe(false);
    });
  });

  it('leagueTitles reads every chapter, whichever is active', () => {
    const save = saveWith([], 'kanto', 'johto');
    for (const chapter of [...CHAPTERS, null]) expect(withChapter(chapter, () => leagueTitles(save))).toBe(2);
  });

  it('canEnter and startRun follow it', () => {
    const save = saveWith(allBadges());
    save.coins = 1e6;
    for (const id of [1, 2, 3, 4, 5, 6]) give(save, id, 60);
    save.deck = [1, 2, 3, 4, 5, 6].map(id => cardKey(id));
    withChapter('kanto', () => {
      expect(canEnter(save, 'johto')).toBe('locked');
      expect(canEnter(save, 'kanto')).toBe('ok');
      expect(startRun(save, 1, 1e12, 'johto')).toBe(false);
      expect(startRun(save, 1, 1e12, 'kanto')).toBe(true);
    });
  });

  it("the first title's shiny starter is the chapter's own", () => {
    for (const region of REGION_IDS) {
      withChapter(region, () => {
        for (const starter of regionStarters(region)) {
          expect(firstTitleStarter(starter, region)).toBe(starter);
          expect(getSpecies(firstTitleStarter(starter, region)!).generation).toBe(regionGeneration(region));
        }
        expect(firstTitleStarter(null, region)).toBeNull();
      });
    }
  });

  it('winning the final pays that starter, and opens the next chapter', () => {
    withChapter('johto', () => {
      const save = saveWith(regionBadgeIds('johto'), 'kanto');
      save.starter = 155;
      save.coins = 1e6;
      for (const id of [152, 155, 158, 161, 163, 165]) give(save, id, 60);
      save.deck = [152, 155, 158, 161, 163, 165].map(id => cardKey(id));
      expect(chapterOpen(save, 'hoenn')).toBe(false);
      expect(startRun(save, 1, 1e12, 'johto')).toBe(true);
      let result = recordDuel(save, true, [], 1e12, 'johto');
      for (let duel = 1; duel < LEAGUE_DUELS; duel++) result = recordDuel(save, true, [], 1e12, 'johto');
      expect(result).toMatchObject({ kind: 'champion', firstTitle: true });
      expect(result!.rewards).toContainEqual({ kind: 'card', id: 155, shiny: true });
      expect(chapterOpen(save, 'hoenn')).toBe(true);
    });
  });
});

describe('Journey Legendary Battle', () => {
  it('opens with its title, only where it shows', () => {
    const save = defaultSave();
    winTitles(save, 'kanto', 'johto');
    expect(withChapter('kanto', () => REGION_IDS.map(r => raidUnlocked(save, r)))).toEqual([true, false, false, false]);
    expect(withChapter('johto', () => REGION_IDS.map(r => raidUnlocked(save, r)))).toEqual([false, true, false, false]);
    expect(withChapter('hoenn', () => REGION_IDS.map(r => raidUnlocked(save, r)))).toEqual([false, false, false, false]);
    expect(withChapter('hoenn', () => anyRaidUnlocked(save))).toBe(false);
    expect(withChapter(WORLD, () => REGION_IDS.map(r => raidUnlocked(save, r)))).toEqual([true, true, false, false]);
    expect(withChapter('hoenn', () => canRaid({ ...save, coins: 1e6, deck: [] }, 'kanto'))).toBe('locked');
  });
});

describe('Journey hunts', () => {
  const caught = { 25: 1, 150: 1, 152: 1, 251: 1 };

  it("blocks another region's species, after legendaries and before not-caught", () => {
    withChapter('kanto', () => {
      expect(huntBlock(25, caught)).toBeNull();
      expect(huntBlock(150, caught)).toBe('legendary');
      expect(huntBlock(16, caught)).toBe('not-caught');
      expect(huntBlock(152, caught)).toBe('other-region');
      expect(huntBlock(161, caught)).toBe('other-region'); // never caught, and not from here
      expect(huntBlock(251, caught)).toBe('legendary');
    });
    withChapter(WORLD, () => {
      expect(huntBlock(152, caught)).toBeNull();
      expect(huntBlock(161, caught)).toBe('not-caught');
    });
  });

  it('a Classic game can never get it', () => {
    withChapter(null, () => {
      for (const s of speciesList) {
        expect(huntBlock(s.id, {})).not.toBe('other-region');
        expect(huntBlock(s.id, { [s.id]: 1 })).not.toBe('other-region');
      }
    });
  });

  it('a target from elsewhere waits in the save, chain included', () => {
    const hunt = { ...defaultHuntSave(), target: 152, chain: 12 };
    expect(withChapter('kanto', () => huntTargetHere(hunt))).toBeNull();
    expect(withChapter('johto', () => huntTargetHere(hunt))).toBe(152);
    expect(withChapter(WORLD, () => huntTargetHere(hunt))).toBe(152);
    expect(withChapter(null, () => huntTargetHere(hunt))).toBe(152);
    expect(hunt).toMatchObject({ target: 152, chain: 12 });
    expect(withChapter('kanto', () => huntTargetHere({ target: null }))).toBeNull();
  });
});

describe('Journey Tower and Ranked', () => {
  it('the Tower is only in the World', () => {
    for (const region of REGION_IDS) expect(withChapter(region, () => towerUnlocked(8))).toBe(false);
    expect(withChapter(WORLD, () => towerUnlocked(8))).toBe(true);
    expect(withChapter(WORLD, () => towerUnlocked(0))).toBe(false);
    expect(withChapter(null, () => towerUnlocked(1))).toBe(true);
  });

  it('Ash keeps working in the World', () => {
    const ladder = { ...defaultSave().ladder, rating: reputationAt(1) + 1 };
    expect(withChapter(WORLD, () => ashUnlocked(ladder))).toBe(true);
  });
});

describe('every region has what a chapter needs', () => {
  for (const region of REGION_IDS) {
    describe(region, () => {
      const generation = regionGeneration(region);

      it('8 gyms', () => {
        expect(REGION_GYMS[region]).toHaveLength(8);
        expect(new Set(regionBadgeIds(region)).size).toBe(8);
        expect(REGION_GYMS[region].every(g => g.roster.length >= 6)).toBe(true);
      });

      it('3 starters of its generation', () => {
        expect(regionStarters(region)).toHaveLength(3);
        expect(regionStarters(region).every(id => getSpecies(id).generation === generation)).toBe(true);
      });

      it('an Elite Four and a Champion', () => {
        expect(eliteFour(region)).toHaveLength(4);
        for (const starter of regionStarters(region)) expect(championBoss(starter, region).roster.length).toBeGreaterThan(0);
        expect(leagueFee(region)).toBeGreaterThan(0);
      });

      it('friends, one of them a rival', () => {
        const friends = FRIENDS.filter(f => f.region === region);
        expect(friends.length).toBeGreaterThan(0);
        expect(friends.filter(f => f.rival)).toHaveLength(1);
      });

      it('a raid pool', () => {
        expect(raidPool(region).length).toBeGreaterThan(0);
        expect(RAID_FEES[region]).toBeGreaterThan(0);
      });

      it('something on every banner', () => {
        withChapter(region, () => {
          for (const banner of BANNER_ORDER) expect(bannerOdds(banner).length, banner).toBeGreaterThan(0);
        });
      });

      it('a chapter of its own', () => {
        expect(CHAPTERS).toContain(region);
      });
    });
  }

  it('the gyms cover every region', () => {
    expect(ALL_GYMS).toHaveLength(REGION_IDS.length * 8);
    expect(GYMS).toBe(REGION_GYMS.kanto);
  });
});

// --- Classic -------------------------------------------------------------------------------

// Hashes taken from the rules as they were before the Journey existed: a Classic game must get these exact results, RNG
// draws included. If this fails, a Journey change reached Classic (a design change to Classic goes in its own tests).
const CLASSIC_BASELINE = {
  teams: 414367567,
  ladder: 3058191187,
  trainers: 1810386993,
  gacha: 3704692241,
  safari: 2058107245,
  pulled: 3974791639,
  cards: 3556757426,
  gyms: 4152392113,
  league: 1895463679,
  raids: 3569066101,
  misc: 1491100524,
};

function classicSample(): Record<string, unknown> {
  const rngTeams = () => [
    [evolveForLevel(41, 60, seeded(1)), evolveForLevel(81, 60, seeded(1)), evolveForLevel(133, 40, seeded(2)), evolveForLevel(95, 60, seeded(3))],
    generateTeam({ level: [30, 35], types: ['fire'] }, seeded(7)),
    generateTeam({ level: 50 }, seeded(8)),
    generateTeam({ level: 80, allowLegendary: true }, seeded(9)),
    generateTeam({ level: [40, 45], species: [133, 41, 81, 95, 1, 7] }, seeded(10)),
    generateTeam({ level: 70, species: [426, 429, 477, 460, 471, 478], exact: true }, seeded(11)),
  ];
  const ladder = () => generateLadder(12345).map(t => [t.name, t.classId, t.types, t.team]);
  const trainers = () => [1, 5, 10, 11].map(rank => trainerTeam({ rank, types: ['water', 'ice'] }, [60, 62], seeded(rank)));
  const gacha = () => BANNER_ORDER.flatMap(banner => [0, 1, 2, 3, 4].map(region => {
    const rng = seeded(banner.length * 100 + region);
    return [
      Array.from({ length: 40 }, () => roll(banner, rng, { region, featured: banner === 'safari' ? [16, 19, 21] : undefined })),
      bannerOdds(banner, region).slice(0, 5),
      rarityOdds(banner, region),
    ];
  }));
  const safari = () => [0, 1, 2, 3, 4].map(region => safariFeatured('2026-01-01', region));
  const pulled = () => [0, 2].map(region => {
    const save = defaultSave();
    save.coins = 100000;
    save.gyms.badges = ['a', 'b', 'c'];
    return [
      pull(save, 'poke', 10, 'coins', seeded(5), 1e12, region),
      pull(save, 'safari', 10, 'coins', seeded(6), 1e12, region),
      pull(save, 'ultra', 10, 'coins', seeded(7), 1e12, region),
      save.coins, save.pity,
    ];
  });
  const cards = () => {
    const save = defaultSave();
    for (const [id, level] of [[41, 30], [42, 50], [169, 10], [133, 40], [196, 12], [81, 30], [462, 5]]) save.cards[id] = { level, copies: 1, obtainedAt: 1 };
    save.items['thunder-stone'] = 1;
    save.deck = ['41', '133'];
    save.teams = [{ id: 't', name: 'T', keys: ['41', '42', '999s', '35', '133'] }];
    const out: unknown[] = [
      Object.keys(save.cards).map(key => evolutionOptions(save, key)),
      Object.keys(save.cards).map(key => transferTargets(save, key)),
      planTransfers(save),
      ['41', '42', '35', '29', '169s'].map(key => resolveKey(save, key)),
      resolveTeam(save, save.teams[0]),
    ];
    save.evolved[133] = 1;
    delete save.cards[133];
    out.push(addCopy(save, 133, false, 5), addCopy(save, 133, false, 6), addCopy(save, 16, false, 7), save.cards);
    return out;
  };
  const gyms = () => {
    const none = defaultGymSave();
    const kanto: GymSave = { badges: GYMS.map(g => g.badge), records: { brock: { wins: 2, losses: 0 } } };
    return [
      [none, kanto].map(g => [REGION_IDS.map(r => regionGymsOpen(g, r)), currentGymRegion(g), REGION_IDS.map(r => gymStatus(g, 0, r))]),
      ALL_GYMS.map(g => [gymLevels(none, g), gymLevels(kanto, g), gymDifficulty(none, g, { average: 90, max: 95 })]),
      ALL_GYMS.map((g, i) => gymTeam(none, g, seeded(i))),
      ALL_GYMS.map((g, i) => gymTeam(kanto, g, seeded(i), { average: 90, max: 95 })),
    ];
  };
  const league = () => {
    const save = defaultSave();
    save.gyms.badges = GYMS.map(g => g.badge);
    const regions = ALL_LEAGUES;
    const out: unknown[] = [
      regions.map(r => [0, 1, 2, 3].map(d => [duelLevels(d, 0, r), duelLevels(d, 10, r), duelDifficulty(d, 5, r, { average: 110, max: 120 })])),
      regions.map(r => [leagueUnlocked(save, r), canEnter(save, r, '2026-01-01')]),
      STARTERS.map(s => REGION_IDS.map(r => firstTitleStarter(s, r))),
      firstTitleStarter(null, 'johto'),
      regions.map((r, i) => {
        const bracket = buildBracket(77, 100 + i, 4, r);
        const run = { seed: 500 + i, duel: 0, bonus: 0, startedAt: 0 };
        return [bracket.path.map(e => e.id), [0, 1, 2, 3].map(d => duelInfo(bracket, run, d, 4, r).team)];
      }),
    ];
    return out;
  };
  const raids = () => {
    const save = defaultSave();
    save.league.titles = 1;
    return [
      REGION_IDS.map(r => [raidUnlocked(save, r), raidLevel(r), raidLevel(r, { average: 100, max: 130 })]),
      anyRaidUnlocked(save),
    ];
  };
  const misc = () => {
    const caught = { 25: 1, 150: 1, 152: 1, 387: 1 };
    const hunt = { target: 200, chain: 3 };
    return [
      [25, 150, 16, 152, 387, 388].map(id => huntBlock(id, caught)),
      huntTargetHere(hunt),
      [0, 1, 2].map(towerUnlocked),
      towerFloor(10).team, towerFloor(7).team,
      FRIENDS.map((f, i) => trainingTeam(f, 40, 'normal', seeded(i), 4)),
      REGION_IDS.map(r => rivalStarter(4, r)),
    ];
  };
  return { teams: rngTeams(), ladder: ladder(), trainers: trainers(), gacha: gacha(), safari: safari(), pulled: pulled(), cards: cards(), gyms: gyms(), league: league(), raids: raids(), misc: misc() };
}

describe('Classic (no chapter)', () => {
  const hashes = () => Object.fromEntries(Object.entries(classicSample()).map(([key, value]) => [key, hashString(JSON.stringify(value))]));

  it('gets the same results as before the Journey, RNG draws included', () => {
    expect(withChapter(null, hashes)).toEqual(CLASSIC_BASELINE);
  });

  it('gets them after the chapters filled their caches, too', () => {
    for (const chapter of CHAPTERS) withChapter(chapter, classicSample);
    expect(withChapter(null, hashes)).toEqual(CLASSIC_BASELINE);
  });

  it('every question answers "everything"', () => {
    withChapter(null, () => {
      expect(captureRegion(0)).toBe(0);
      expect(captureRegion(2)).toBe(2);
      expect(speciesList.every(s => usableForm(s.id) === s.id)).toBe(true);
      expect(evolveForLevel(ZUBAT, 100, () => 0)).toBe(CROBAT);
      expect(firstTitleStarter(4, 'johto')).toBe(155);
      expect(firstTitleStarter(155, 'johto')).toBe(4);
      expect(currentGymRegion({ badges: regionBadgeIds('kanto') })).toBe('johto');
      expect(raidLevel('sinnoh')).toBe(140);
      expect(duelLevels(3, 0, 'sinnoh')).toEqual([138, 140]);
      expect(designedGymLevels(REGION_GYMS.sinnoh[0])).toEqual([120, 123]);
      expect(towerUnlocked(1)).toBe(true);
    });
  });
});

describe('integration fixes', () => {
  it('every Elite Four member brings a full team of their own region in its chapter', () => {
    for (const region of REGION_IDS) {
      withChapter(region, () => {
        for (const boss of eliteFour(region)) {
          const team = generateTeam({ level: 70, species: bossRoster(boss), exact: true }, seeded(1));
          expect(team, boss.id).toHaveLength(6);
          expect(Math.max(...team.map(m => getSpecies(m.id).generation)), boss.id).toBeLessThanOrEqual(regionGeneration(region));
        }
      });
    }
  });

  it('Classic and the World keep the regular rosters', () => {
    const phoebe = eliteFour('hoenn').find(b => b.id === 'phoebe')!;
    expect(bossRoster(phoebe)).toBe(phoebe.roster);
    withChapter(WORLD, () => expect(bossRoster(phoebe)).toBe(phoebe.roster));
    withChapter('hoenn', () => expect(bossRoster(phoebe)).toBe(phoebe.journeyRoster));
  });

  it("a card from another region can't evolve or pass levels here", () => {
    const save = defaultSave();
    give(save, GOLBAT, 100);
    give(save, CROBAT, 1);
    withChapter('johto', () => {
      expect(evolutionOptions(save, cardKey(GOLBAT))).toEqual([]);
      expect(transferTargets(save, cardKey(GOLBAT))).toEqual([]);
    });
    withChapter(WORLD, () => {
      expect(evolutionOptions(save, cardKey(GOLBAT)).map(o => o.to)).toEqual([CROBAT]);
      expect(transferTargets(save, cardKey(GOLBAT))).toEqual([CROBAT]);
    });
  });

  it('a chapter once entered stays open, even if a new region now comes before it', () => {
    const save = defaultSave();
    save.journey = { active: WORLD, slots: {} };
    expect(chapterOpen(save, WORLD)).toBe(true);
    save.journey = { active: 'kanto', slots: { [WORLD]: { starter: 1, deck: [], teams: [] } } };
    expect(chapterOpen(save, WORLD)).toBe(true);
    expect(chapterOpen({ league: save.league }, WORLD)).toBe(false);
  });

  it("a region's League run in progress blocks travel; the World's doesn't", () => {
    const save = defaultSave();
    save.journey = defaultJourneySave();
    save.league.titles = 1;
    withChapter('kanto', () => {
      save.league.run = { seed: 1, duel: 0, bonus: 0, startedAt: 1 };
      expect(leagueRunBlocksTravel(save)).toBe(true);
      expect(travel(save, 'johto')).toBe(false);
      expect(save.journey!.active).toBe('kanto');
      delete save.league.run;
      expect(leagueRunBlocksTravel(save)).toBe(false);
      expect(travel(save, 'johto')).toBe(true);
    });
    save.journey = { active: WORLD, slots: {} };
    save.league.master = { runs: 1, best: 0, titles: 0, run: { seed: 1, duel: 0, bonus: 0, startedAt: 1 } };
    expect(leagueRunBlocksTravel(save)).toBe(false);
    expect(leagueRunBlocksTravel(defaultSave())).toBe(false);
  });
});

describe('captures cost money and open with the badges', () => {
  const rich = (badges: string[] = []) => {
    const save = defaultSave();
    save.coins = 1e12;
    save.gyms.badges = badges;
    return save;
  };
  const withProgress = <T>(share: number, fn: () => T): T => {
    setCaptureProgress(share);
    try {
      return fn();
    } finally {
      setCaptureProgress(1);
    }
  };
  const PRICES: [BannerId, number, number][] = [['poke', 50, 500], ['safari', 100, 800], ['great', 150, 1200], ['ultra', 250, 2000]];

  it("charges the Journey's prices, with only ×1 and ×10", () => {
    withChapter('kanto', () => {
      for (const [banner, one, ten] of PRICES) {
        expect(bannerCounts(banner)).toEqual([1, 10]);
        expect(batchCost(banner, 1, 'coins')?.coins).toBe(one);
        expect(batchCost(banner, 10, 'coins')?.coins).toBe(ten);
      }
      expect(batchCost('poke', 100, 'coins')).toBeNull();
      expect(batchCost('safari', 50, 'coins')).toBeNull();
      expect(pull(rich(), 'poke', 100, 'coins', seeded(1), 1e12, 0)).toBeNull();
      expect(canAfford(rich(), 'poke', 100, 'coins')).toBe(false);
      expect(bannerCounts('master')).toEqual([1, 10]);
      expect(batchCost('master', 1, 'ticket')?.tickets).toBe(1);
      expect(batchCost('master', 10, 'ticket')?.tickets).toBe(10);
    });
    withChapter(WORLD, () => expect(batchCost('poke', 10, 'coins')?.coins).toBe(500));
  });

  it('pays from the wallet: ×10 Poké Balls take ₽500', () => {
    withChapter('kanto', () => {
      const save = defaultSave();
      save.coins = 600;
      expect(pull(save, 'poke', 10, 'coins', seeded(1), 1e12, 0)).toHaveLength(10);
      expect(save.coins).toBe(100);
      expect(pull(save, 'poke', 10, 'coins', seeded(2), 1e12, 0)).toBeNull();
      expect(save.coins).toBe(100);
    });
  });

  it("leaves Classic's prices and batch sizes alone", () => {
    expect(bannerCounts('poke')).toEqual([1, 10, 100]);
    expect(bannerCounts('safari')).toEqual([1, 10, 50]);
    expect(batchCost('poke', 100, 'coins')?.coins).toBe(500);
    expect(batchCost('safari', 10, 'coins')?.coins).toBe(150);
    expect(batchCost('great', 10, 'coins')?.coins).toBe(500);
    expect(batchCost('ultra', 10, 'coins')?.coins).toBe(1500);
    withProgress(0, () => expect(capturePool()).toHaveLength(speciesList.length));
  });

  for (const region of REGION_IDS) {
    const size = speciesList.filter(s => s.generation === regionGeneration(region)).length;

    it(`${region}: a quarter of the region opens at the start, and all of it with every badge`, () => {
      withChapter(region, () => {
        withProgress(0, () => expect(capturePool()).toHaveLength(Math.ceil(size * CAPTURE_OPEN_SHARE)));
        withProgress(1, () => expect(capturePool()).toHaveLength(size));
        let before = 0;
        for (let badges = 0; badges <= REGION_GYMS[region].length; badges++) {
          const open = withProgress(badges / REGION_GYMS[region].length, () => capturePool().length);
          expect(open, `${badges} badges`).toBeGreaterThan(before);
          before = open;
        }
      });
    });

    it(`${region}: no amount of money buys past the badges`, () => {
      withChapter(region, () => {
        withProgress(0, () => {
          const save = rich(['a', 'b', 'c']);
          const rng = seeded(11);
          const caught = new Set<number>();
          for (const banner of ['poke', 'safari', 'great', 'ultra'] as const) {
            for (let i = 0; i < 300; i++) for (const r of pull(save, banner, 10, 'coins', rng, 1e12, 0)!) caught.add(r.id);
          }
          expect(caught.size).toBeLessThanOrEqual(Math.ceil(size * CAPTURE_OPEN_SHARE));
          expect([...caught].every(capturable)).toBe(true);
          expect([...caught].some(id => getSpecies(id).legendary || getSpecies(id).mythical)).toBe(false);
        });
      });
    });

    it(`${region}: Safari's featured families and the guaranteed rarity stay in what's open`, () => {
      withChapter(region, () => {
        withProgress(0, () => {
          for (const day of ['2026-01-01', '2026-06-15']) expect(safariFeatured(day).every(capturable)).toBe(true);
          const save = rich(['a', 'b', 'c']);
          save.pity.ultra = BANNERS.ultra.pity!.every - 1;
          expect(pull(save, 'ultra', 1, 'coins', seeded(5), 1e12, 0)!.every(r => capturable(r.id))).toBe(true);
        });
      });
    });

    it(`${region}: a Master Ball can still bring a legendary with no badges`, () => {
      withChapter(region, () => {
        withProgress(0, () => expect(bannerOdds('master', 0).map(o => o.id).sort((a, b) => a - b)).toEqual(raidPool(region).map(s => s.id)));
      });
    });

    it(`${region}: a chapter's start money builds the team of six battles need`, () => {
      withChapter(region, () => {
        withProgress(0, () => {
          const games = 1500;
          let teams = 0;
          for (let game = 0; game < games; game++) {
            const save = defaultSave();
            save.coins = CHAPTER_START_COINS;
            const starter = STARTERS[REGION_IDS.indexOf(region) * 3];
            give(save, starter, 5);
            pull(save, 'poke', 10, 'coins', seeded(game * 37 + 1), 1e12, 0);
            if (Object.keys(save.cards).length >= 6) teams++;
          }
          expect(teams / games).toBeGreaterThan(0.99);
        });
      });
    });

    it(`${region}: costs and pays Kanto's coins`, () => {
      withChapter(region, () => {
        expect(leagueFee(region)).toBe(leagueFee('kanto'));
        expect(raidFee(region)).toBe(RAID_FEES.kanto);
        expect(placementRewards(4, region)).toEqual(placementRewards(4, 'kanto'));
        expect(raidWinRewards(region)[0]).toEqual({ kind: 'coins', amount: 750 });
        REGION_GYMS[region].forEach((gym, i) => {
          expect(gymRewards(defaultGymSave(), gym)[1]).toEqual({ kind: 'coins', amount: GYMS[i].coins });
        });
      });
    });
  }

  it("keeps Classic's fees and prizes, and the Master League's in the World", () => {
    expect(leagueFee('sinnoh')).toBe(6000);
    expect(raidFee('sinnoh')).toBe(RAID_FEES.sinnoh);
    expect(gymRewards(defaultGymSave(), REGION_GYMS.johto[0])[1]).toEqual({ kind: 'coins', amount: REGION_GYMS.johto[0].coins });
    expect(placementRewards(4, 'sinnoh')).not.toEqual(placementRewards(4, 'kanto'));
    withChapter(WORLD, () => expect(leagueFee('master')).toBe(10000));
  });

  describe('a broke player', () => {
    const withCards = (count: number, coins: number) => {
      const save = defaultSave();
      save.coins = coins;
      for (let id = 1; id <= count; id++) give(save, id);
      return save;
    };

    it('with too few cards and no money gets a Poké Ball, until they have a team', () => {
      withChapter('kanto', () => {
        const save = withCards(3, 20);
        rescueBrokePlayer(save);
        expect(save.coins).toBe(50);
        rescueBrokePlayer(save);
        expect(save.coins).toBe(50);
        const team = withCards(6, 0);
        rescueBrokePlayer(team);
        expect(team.coins).toBe(0);
      });
    });

    it("only counts the cards usable here: Kanto's don't make a Johto team", () => {
      withChapter('johto', () => {
        const save = withCards(20, 0);
        rescueBrokePlayer(save);
        expect(save.coins).toBe(50);
      });
    });

    it('survives a card from a newer app', () => {
      withChapter('kanto', () => {
        const save = withCards(1, 0);
        save.cards['9999'] = { level: 1, copies: 1, obtainedAt: 1 };
        expect(() => rescueBrokePlayer(save)).not.toThrow();
        expect(save.coins).toBe(50);
      });
    });

    it('gets nothing in Classic', () => {
      const save = withCards(1, 0);
      rescueBrokePlayer(save);
      expect(save.coins).toBe(0);
    });
  });
});
