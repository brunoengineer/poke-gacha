// Every battle mode, played for real from its lobby to its rewards.

import type { Page } from '@playwright/test';
import { type Save, CARRY_TEAM, closeOverlays, expect, midGameSave, playBattle, startGame, stored, STRONG_TEAM, test, withCarry, withTeam } from './helpers';

const strongSave = () => withTeam(midGameSave(), 5000);
/** Reputation above the top of the ladder: the player is No. 1. */
const reputationAtTop = 2001;
/** Six weak cards: they lose to anything from the Tower's first floor up. */
const weakSave = () => withTeam(midGameSave(), 1, ['19', '16', '10', '13', '129', '41']);

test.describe('luck', () => {
  interface Pop { name: string; color: string; size: string }

  /** Opens a battle and forces the first hit's roll, so it goes the way the test wants. */
  async function firstHit(page: Page, roll: number) {
    await page.addInitScript(() => {
      const state = window as unknown as { forcedRolls?: number[]; pops: Pop[] };
      // The game keeps its own reference to Math.random, so this has to be in place before the game loads. Only the
      // battle's rolls are forced: particles and sounds use Math.random too.
      const real = Math.random;
      Math.random = () => (state.forcedRolls?.length && new Error().stack?.includes('duel.ts') ? state.forcedRolls.shift()! : real());
      // The numbers over the Pokémon are gone in a moment: note each one as it appears, whatever the machine's speed.
      state.pops = [];
      new MutationObserver(changes => {
        for (const node of changes.flatMap(change => [...change.addedNodes])) {
          if (!(node instanceof HTMLElement) || !node.classList.contains('pop')) continue;
          const style = getComputedStyle(node);
          state.pops.push({ name: node.className, color: style.color, size: style.fontSize });
        }
      }).observe(document, { childList: true, subtree: true });
    });
    await startGame(page, strongSave(), 'battle/training');
    await page.locator('[data-friend="joey"]').click();
    await page.locator('.arena-layer [data-act="start"]').click();
    await page.locator('.arena-layer .hand-card:not(:disabled)').first().click();
    await page.evaluate(value => {
      (window as unknown as { forcedRolls: number[] }).forcedRolls = [value];
    }, roll);
    await page.locator('.arena-prompt [data-act="confirm"]').click();
  }

  const pops = (page: Page) => page.evaluate(() => (window as unknown as { pops: Pop[] }).pops);

  test('a critical shows a bigger, yellow number', async ({ page, isMobile }) => {
    await firstHit(page, 0.05);
    await expect.poll(async () => (await pops(page))[0]?.name ?? '').toContain('pop-crit');
    const [crit] = await pops(page);
    expect(crit.color).toBe('rgb(255, 230, 0)');
    expect(crit.size).toBe(isMobile ? '40px' : '56px');
  });

  for (const [what, roll, name] of [['miss', 0.01, 'pop-miss'], ['block', 0.025, 'pop-block']] as const) {
    test(`a ${what} says so and the battle carries on`, async ({ page }) => {
      await firstHit(page, roll);
      await expect.poll(async () => (await pops(page))[0]?.name ?? '').toContain(name);
      // A later hit lands (the next one could roll badly too).
      await expect.poll(async () => (await pops(page)).some(pop => pop.name.includes('pop-dmg'))).toBe(true);
    });
  }
});

test.describe('legendary battle', () => {
  /** A team that wins Kanto's boss: strong shinies at Lv. 70, where the boss stays at its designed level. */
  function raidSave() {
    const save = withTeam(midGameSave(), 70);
    save.league.titles = 1;
    save.coins = 50_000;
    return save;
  }

  /** Fixes this mode's rolls at 50%: Moltres comes out, and no catch happens by luck (only the guaranteed one). */
  const fixRolls = (page: Page) => page.addInitScript(() => {
    const real = Math.random;
    Math.random = () => (new Error().stack?.includes('raid.ts') ? 0.5 : real());
  });

  async function challengeKanto(page: Page, save: Save) {
    await startGame(page, save, 'battle/raid');
    await page.locator('.region-tab[data-region="kanto"]').click();
    await page.locator('[data-act="raid"]').click();
    await page.locator('.modal-dialog [data-confirm]').click();
    await expect(page.locator('.arena-layer')).toBeVisible();
  }

  test('a win pays, and the guaranteed catch gives the card', async ({ page }) => {
    const save = raidSave();
    for (const id of [144, 145, 146, 150, 151]) delete save.cards[id];
    save.raid = { kanto: { wins: 14, losses: 0, sinceCatch: 14 } };
    await fixRolls(page);
    await challengeKanto(page, save);
    await expect(page.locator('.arena-layer .intro-opp')).toContainText('Moltres');
    await playBattle(page);
    await page.locator('.rewards-continue').click();
    const after = await stored(page);
    expect(after.raid.kanto).toMatchObject({ wins: 15, sinceCatch: 0 });
    expect(after.coins).toBeGreaterThanOrEqual(save.coins - 3000 + 750);
    expect([144, 145, 146, 150, 151].filter(id => after.cards[id])).toEqual([146]);
    expect(after.items['rare-candy']).toBeGreaterThan(save.items['rare-candy'] ?? 0);
  });

  test('an owned boss gives a Master Ball instead', async ({ page }) => {
    const save = raidSave();
    for (const id of [144, 145, 146, 150, 151]) save.cards[id] = { level: 50, copies: 1, obtainedAt: 1 };
    save.raid = { kanto: { wins: 14, losses: 0, sinceCatch: 14 } };
    await fixRolls(page);
    await challengeKanto(page, save);
    await playBattle(page);
    await page.locator('.rewards-continue').click();
    const after = await stored(page);
    expect(after.items['master-ball']).toBe((save.items['master-ball'] ?? 0) + 1);
    expect(after.cards[146].copies).toBe(1);
  });

  test('giving up keeps the fee and pays nothing', async ({ page }) => {
    const save = raidSave();
    await challengeKanto(page, save);
    await page.locator('.arena-layer [data-act="start"]').click();
    await page.locator('.arena-layer [data-act="forfeit"]').click();
    await page.locator('.modal-dialog [data-confirm]').click();
    await expect(page.locator('.arena-layer')).toHaveCount(0);
    const after = await stored(page);
    expect(after.coins).toBe(save.coins - 3000);
    expect(after.raid.kanto).toMatchObject({ wins: 0, losses: 1, sinceCatch: 0 });
  });

  test('a region without its title stays closed', async ({ page }) => {
    const save = raidSave();
    await startGame(page, save, 'battle/raid');
    await page.locator('.region-tab[data-region="sinnoh"]').click();
    await expect(page.locator('.raid-panel.is-locked')).toBeVisible();
    await expect(page.locator('[data-act="raid"]')).toHaveCount(0);
  });
});

test.describe('master league', () => {
  const NORMAL_TEAM = ['6', '10', '13', '16', '19', '25'];

  /** Every title won, with a team allowed in; the huge levels only make the wins certain (the test checks the flow). */
  function masterSave() {
    const save = midGameSave();
    const title = { runs: 1, best: 4, titles: 1 };
    Object.assign(save.league, { ...title, johto: title, hoenn: title, sinnoh: title });
    delete save.league.run;
    save.coins = 50_000;
    return withTeam(save, 999, NORMAL_TEAM);
  }

  test('stays closed until all four titles', async ({ page }) => {
    const save = masterSave();
    delete save.league.sinnoh;
    await startGame(page, save, 'battle/league');
    await page.locator('.region-tab[data-region="master"]').click();
    await expect(page.locator('.league-locked')).toBeVisible();
    await expect(page.locator('.region-tab[data-region="master"] small')).toHaveText('3/4');
  });

  test('names the cards that cannot enter, and refuses them', async ({ page }) => {
    const save = withTeam(masterSave(), 100, ['6s', '150', '251', '10', '13', '16']);
    await startGame(page, save, 'battle/league');
    await page.locator('.region-tab[data-region="master"]').click();
    const warning = page.locator('[data-banned]');
    await expect(warning).toContainText('Shiny Charizard');
    await expect(warning).toContainText('Mewtwo');
    await expect(warning).toContainText('Celebi');
    await page.locator('[data-act="enter"]').click();
    await expect(page.locator('.modal-dialog')).toHaveCount(0);
    expect((await stored(page)).league.master?.run).toBeUndefined();
  });

  test('a full run pays each win, then the title and a shiny', async ({ page }) => {
    test.setTimeout(240_000);
    const save = masterSave();
    await startGame(page, save, 'battle/league');
    await page.locator('.region-tab[data-region="master"]').click();
    await page.locator('[data-act="enter"]').click();
    await page.locator('.modal-dialog [data-confirm]').click();
    let after = await stored(page);
    expect(after.coins).toBe(save.coins - 10_000);
    expect(after.league.master.entries).toBe(1);

    const balls = save.items['master-ball'] ?? 0;
    let paid = 0;
    for (const prize of [2, 3, 5]) {
      await page.locator('[data-act="fight"]').click();
      await playBattle(page);
      await page.locator('.rewards-continue').click();
      await expect(page.locator('.modal-rewards')).toHaveCount(0);
      paid += prize;
      after = await stored(page);
      expect(after.items['master-ball']).toBe(balls + paid);
    }

    const shinies = Object.keys(save.cards).filter(key => key.endsWith('s')).length;
    await page.locator('[data-act="fight"]').click();
    await playBattle(page);
    await expect.poll(async () => (await stored(page)).league.master.titles).toBe(1);
    after = await stored(page);
    expect(after.items['master-ball']).toBe(balls + paid + 10);
    expect(after.league.master.run).toBeUndefined();
    expect(Object.keys(after.cards).filter(key => key.endsWith('s'))).toHaveLength(shinies + 1);
  });

  test('between duels the team recovers and a saved team can take over, within the rules', async ({ page }) => {
    const save = masterSave();
    const other = ['1', '2', '4', '5', '7', '20'];
    for (const key of other) save.cards[key] = { level: 999, copies: 1, obtainedAt: 1 };
    save.cards['150'] = { level: 100, copies: 1, obtainedAt: 1 };
    save.teams = [
      { id: 'a', name: 'Other team', keys: other },
      { id: 'b', name: 'Not allowed', keys: ['150', '2', '4', '5', '7', '20'] },
    ];
    await startGame(page, save, 'battle/league');
    await page.locator('.region-tab[data-region="master"]').click();
    await page.locator('[data-act="enter"]').click();
    await page.locator('.modal-dialog [data-confirm]').click();
    await page.locator('[data-act="fight"]').click();
    await playBattle(page);
    await page.locator('.rewards-continue').click();
    await expect(page.locator('.modal-rewards')).toHaveCount(0);

    // A team outside the rules can't fight, and says who is the problem.
    await page.locator('.st-chip[data-load-team="b"]').click();
    await expect(page.locator('.league-next [data-banned]')).toContainText('Mewtwo');
    await expect(page.locator('[data-act="fight"]')).toHaveCount(0);

    await page.locator('.st-chip[data-load-team="a"]').click();
    await page.locator('[data-act="fight"]').click();
    await page.locator('.arena-layer [data-act="start"]').click();
    // The new team, all six ready, with no heal choice in between.
    await expect(page.locator('.arena-layer .hand-card:not(:disabled)')).toHaveCount(6);
    await playBattle(page);
    const after = await stored(page);
    expect(after.deck).toEqual(other);
    expect(after.league.master.run.duel).toBe(2);
    expect(after.league.master.run.hp).toEqual({});
  });

  test('a loss still uses the entry, and the third one closes the day', async ({ page }) => {
    const save = masterSave();
    await startGame(page, save, 'battle/league');
    await page.locator('.region-tab[data-region="master"]').click();
    for (const used of [1, 2, 3]) {
      await page.locator('[data-act="enter"]').click();
      await page.locator('.modal-dialog [data-confirm]').click();
      await page.locator('[data-act="abandon"]').click();
      await page.locator('.modal-dialog [data-confirm]').click();
      await page.locator('.rewards-continue').click();
      await expect(page.locator('.modal-rewards')).toHaveCount(0);
      expect((await stored(page)).league.master.entries).toBe(used);
    }
    const coins = (await stored(page)).coins;
    await page.locator('[data-act="enter"]').click();
    await expect(page.locator('.league-warn')).toBeVisible();
    await expect(page.locator('.modal-dialog')).toHaveCount(0);
    expect((await stored(page)).coins).toBe(coins);
  });
});

test.describe('training', () => {
  test('a win pays coins and candy, and the team member picked trains', async ({ page }) => {
    const save = strongSave();
    await startGame(page, save, 'battle/training');
    await page.locator('[data-friend="joey"]').click();
    await playBattle(page, { stayOnEnd: true });

    // The choice comes before the end: playBattle already picked the first card that can train.
    const trained = await stored(page);
    expect(trained.cards[STRONG_TEAM[0]].level).toBeGreaterThan(5000);

    await page.locator('.arena-layer [data-act="continue"]').click();
    await expect(page.locator('.rewards-continue')).toBeVisible();
    await closeOverlays(page);
    const after = await stored(page);
    expect(after.coins).toBeGreaterThan(save.coins);
    expect(after.items['rare-candy']).toBeGreaterThan(save.items['rare-candy'] ?? 0);
    expect(after.stats.wins).toBe(save.stats.wins + 1);
    expect(after.training.records.joey.wins).toBeGreaterThan(save.training.records.joey?.wins ?? 0);
  });

  test('forfeiting asks first, counts as a loss and pays nothing', async ({ page }) => {
    const save = strongSave();
    await startGame(page, save, 'battle/training');
    await page.locator('[data-friend="joey"]').click();
    await page.locator('.arena-layer [data-act="start"]').click();
    await page.locator('.arena-layer [data-act="forfeit"]').click();
    await page.locator('.modal-dialog [data-confirm]').click();
    await expect(page.locator('.arena-layer')).toHaveCount(0);
    const after = await stored(page);
    expect(after.coins).toBe(save.coins);
    expect(after.stats.losses).toBe(save.stats.losses + 1);
    expect(after.cards[STRONG_TEAM[0]].level).toBe(5000); // forfeits don't train
  });
});

test.describe('gyms', () => {
  test('beating Brock gives the badge, its rewards and opens Misty', async ({ page }) => {
    const save = withCarry(midGameSave());
    save.gyms = { badges: [], records: {} };
    await startGame(page, save, 'battle/gyms');
    await expect(page.locator('[data-gym="misty"]')).toHaveCount(0); // locked
    await page.locator('[data-gym="brock"]').click();
    await playBattle(page);
    await closeOverlays(page);
    const after = await stored(page);
    expect(after.gyms.badges).toEqual(['boulder']);
    expect(after.coins).toBe(save.coins + 250);
    expect(after.items['great-ball']).toBe((save.items['great-ball'] ?? 0) + 3);
    await expect(page.locator('[data-gym="misty"]')).toBeVisible();
  });

  test('a team below the levels sees them as designed; an overleveled one sees them trained up', async ({ page }) => {
    // Lv. 1 team: every gym as designed.
    const low = withTeam(midGameSave(), 1, ['19', '16', '10', '13', '129', '41']);
    low.gyms = { badges: [], records: {} };
    await startGame(page, low, 'battle/gyms');
    await page.locator('.region-tab[data-region="kanto"]').click();
    await expect(page.locator('.gym-scaled')).toHaveCount(0);
    await expect(page.locator('.gym-card').first().locator('.gym-levels')).toContainText('15');
  });

  test('an overleveled team makes leaders train up, with an ace at its strongest level', async ({ page }) => {
    const save = withTeam(midGameSave(), 178);
    save.cards[STRONG_TEAM[0]].level = 330;
    // Average 203: Brock at 65% of it, Giovanni at all of it with the ace at 330.
    await startGame(page, save, 'battle/gyms');
    await page.locator('.region-tab[data-region="kanto"]').click();
    const cards = page.locator('.gym-card');
    await expect(cards.nth(0).locator('.gym-levels')).toContainText('132');
    await expect(cards.nth(7).locator('.gym-levels')).toContainText('203');
    await expect(cards.nth(7).locator('.gym-scaled')).toContainText('330');

    // The real battle brings those levels: the leader's first Pokémon shows Lv. 203.
    await page.locator('[data-gym="giovanni"]').click();
    await page.locator('.arena-layer [data-act="start"]').click();
    await expect(page.locator('.arena-layer .hpbox').first()).toContainText('203');
  });

  test('a later region stays locked until the one before is complete', async ({ page }) => {
    const save = strongSave();
    save.gyms.badges = ['boulder', 'cascade', 'thunder', 'rainbow', 'soul', 'marsh', 'volcano', 'earth'];
    await startGame(page, save, 'battle/gyms');
    await page.locator('.region-tab[data-region="hoenn"]').click();
    await expect(page.locator('.region-locked').first()).toBeVisible();
    await expect(page.locator('[data-gym="roxanne"]')).toHaveCount(0);
    await page.locator('.region-tab[data-region="johto"]').click();
    await expect(page.locator('[data-gym="falkner"]')).toBeVisible();
  });
});

test.describe('ranked ladder', () => {
  const atTop = () => {
    const save = withCarry(midGameSave());
    save.ladder.rating = reputationAtTop;
    save.ladder.best = 1;
    delete save.ladder.ash;
    return save;
  };

  test('trainers above are shown at the team average +10% per place', async ({ page }) => {
    const save = withTeam(midGameSave(), 100);
    await startGame(page, save, 'battle/competition');
    const levels = await page.locator('.lrow.is-target .lrow-level').allInnerTexts();
    expect(levels.map(text => Number(text.replace(/\D/g, '')))).toEqual([150, 140, 130, 120, 110]);
  });

  test('Ash stays locked until No. 1', async ({ page }) => {
    const save = withCarry(midGameSave());
    delete save.ladder.best;
    save.ladder.milestones = [];
    await startGame(page, save, 'battle/competition');
    await expect(page.locator('.ash-card.is-locked')).toBeVisible();
    await expect(page.locator('[data-act="ash"]')).toHaveCount(0);
  });

  test('a loss to Ash pays nothing and starts the hour', async ({ page }) => {
    const save = atTop();
    const balls = save.items['master-ball'] ?? 0;
    await startGame(page, save, 'battle/competition');
    await page.locator('[data-act="ash"]').click();
    await page.locator('.arena-layer [data-act="start"]').click();
    await expect(page.locator('.arena-layer .intro-name, .arena-layer')).toBeVisible();
    await page.locator('.arena-layer [data-act="forfeit"]').click();
    await page.locator('.modal-dialog [data-confirm]').click();
    await expect(page.locator('.arena-layer')).toHaveCount(0);
    const after = await stored(page);
    expect(after.ladder.ash).toMatchObject({ wins: 0, losses: 1 });
    expect(after.items['master-ball'] ?? 0).toBe(balls);
    await expect(page.locator('[data-act="ash"]')).toHaveCount(0);
    await expect(page.locator('.ash-wait')).toBeVisible();
    // Reloading doesn't give another try.
    await page.reload();
    await expect(page.locator('.ash-wait')).toBeVisible();
  });

  test('beating Ash pays five Master Balls, once per hour', async ({ page }) => {
    const save = atTop();
    // Far above his team, and able to beat a Pikachu 100 levels above it.
    save.cards[CARRY_TEAM[0]].level = 100_000;
    const balls = save.items['master-ball'] ?? 0;
    await startGame(page, save, 'battle/competition');
    await page.locator('[data-act="ash"]').click();
    await expect(page.locator('.arena-layer .intro-name')).toHaveText('Ash');
    await playBattle(page);
    await closeOverlays(page);
    const after = await stored(page);
    expect(after.items['master-ball']).toBe(balls + 5);
    expect(after.ladder.ash).toMatchObject({ wins: 1, losses: 0 });
    await expect(page.locator('.ash-wait')).toBeVisible();
  });

  test('Ash opens again after the hour', async ({ page }) => {
    const save = atTop();
    save.ladder.ash = { wins: 0, losses: 1, lastAt: Date.now() - 61 * 60 * 1000 };
    await startGame(page, save, 'battle/competition');
    await expect(page.locator('[data-act="ash"]')).toBeVisible();
  });

  test('beating a trainer above climbs the ladder', async ({ page }) => {
    const save = withCarry(midGameSave());
    await startGame(page, save, 'battle/competition');
    const before = save.ladder.rating ?? 0;
    // The nearest one, directly above.
    await page.locator('[data-act="challenge"]').last().click();
    await playBattle(page);
    await closeOverlays(page);
    const after = await stored(page);
    expect(after.ladder.rating).toBeGreaterThan(before);
    expect(after.coins).toBeGreaterThan(save.coins);
  });
});

test.describe('infinity tower', () => {
  test('a win clears the floor once and pays its prize', async ({ page }) => {
    const save = strongSave();
    save.gyms.badges = ['boulder'];
    delete save.tower;
    await startGame(page, save, 'battle/tower');
    await page.locator('[data-act="climb"]').click();
    await playBattle(page);
    await closeOverlays(page);
    const after = await stored(page);
    expect(after.tower).toMatchObject({ best: 1, wins: 1, losses: 0 });
    expect(after.coins).toBe(save.coins + 300);
  });

  test('a loss keeps the climb where it was', async ({ page }) => {
    const save = weakSave();
    save.tower = { best: 4, wins: 4, losses: 0 };
    await startGame(page, save, 'battle/tower');
    await page.locator('[data-act="climb"]').click();
    await playBattle(page);
    await closeOverlays(page);
    const after = await stored(page);
    expect(after.tower).toMatchObject({ best: 4, wins: 4, losses: 1 });
  });

  test('stays closed without a badge', async ({ page }) => {
    const save = strongSave();
    save.gyms = { badges: [], records: {} };
    await startGame(page, save, 'battle/tower');
    await expect(page.locator('[data-act="climb"]')).toHaveCount(0);
  });
});

test.describe('shiny hunt', () => {
  test('hunting from a card charges the fee and grows the chain', async ({ page }) => {
    const save = strongSave();
    delete save.hunt;
    save.cards['19'] = { level: 10, copies: 1, obtainedAt: 1 };
    save.caught['19'] = 1;
    await startGame(page, save, 'collection/19');
    await page.locator('.dx-hunt [data-act="hunt"]').click();
    await expect(page).toHaveURL(/battle\/hunt/);
    await page.locator('[data-act="hunt"]').click();
    await playBattle(page);
    await closeOverlays(page);
    const after = await stored(page);
    expect(after.hunt).toMatchObject({ target: 19, chain: 1, wins: 1 });
    // ₽100 for a Common; a dropped copy doesn't pay coins.
    expect(after.coins).toBe(save.coins - 100);
  });

  test("won't hunt a legendary", async ({ page }) => {
    await startGame(page, strongSave(), 'collection/150');
    await expect(page.locator('.dx-hunt')).toBeVisible();
    await expect(page.locator('.dx-hunt [data-act="hunt"]')).toHaveCount(0);
  });
});

test.describe('pokémon league', () => {
  const kantoSave = () => {
    const save = withCarry(midGameSave());
    delete save.league.run;
    return save;
  };

  test('entering registers the team, and winning a duel advances', async ({ page }) => {
    const save = kantoSave();
    await startGame(page, save, 'battle/league');
    await page.locator('.region-tab[data-region="kanto"]').click();
    await page.locator('[data-act="enter"]').click();
    await page.locator('.modal-dialog [data-confirm]').click();
    let after = await stored(page);
    expect(after.coins).toBe(save.coins - 1000);
    expect(after.league.run.team).toEqual(CARRY_TEAM);
    await expect(page.locator('.run-mon')).toHaveCount(6);

    await page.locator('[data-act="fight"]').click();
    await playBattle(page);
    after = await stored(page);
    expect(after.league.run.duel).toBe(1);
  });

  test('HP carries over, and the items come before the next duel', async ({ page }) => {
    const save = kantoSave();
    save.league.run = {
      seed: 7, duel: 1, bonus: 0, startedAt: 1, team: CARRY_TEAM,
      hp: { '150s': 1, 19: 0, 16: 0.4, 10: 0.7, 13: 0.6, 129: 0.8 },
    };
    await startGame(page, save, 'battle/league');
    await page.locator('.region-tab[data-region="kanto"]').click();

    // Battling is blocked until the items are used.
    await expect(page.locator('[data-act="fight"]')).toHaveCount(0);
    await expect(page.locator('.run-mon.is-fainted')).toHaveCount(1);
    await page.locator('[data-heal="revive"]').click();
    let after = await stored(page);
    expect(after.league.run.hp['19']).toBe(0.5);
    await expect(page.locator('[data-kit-left]')).toContainText('1');
    await expect(page.locator('[data-act="fight"]')).toHaveCount(0);
    for (const name of ['Rattata', 'Caterpie', 'Weedle', 'Magikarp']) await page.locator('.run-mon', { hasText: name }).locator('[data-heal="potion"]').click();
    after = await stored(page);
    expect(after.league.run.hp['19']).toBe(1);
    expect(after.league.run.hp['10']).toBe(1);
    expect(after.league.run.used).toEqual({ duel: 1, potions: 4, revives: 1 });
    await expect(page.locator('[data-heal]')).toHaveCount(0);

    // The strong one wins alone, so whoever stayed out keeps the HP they had.
    await page.locator('[data-act="fight"]').click();
    await playBattle(page);
    after = await stored(page);
    expect(after.league.run.duel).toBe(2);
    expect(after.league.run.hp['16']).toBeCloseTo(0.4, 1);
  });

  test('changing the team mid-run does not change who fights', async ({ page }) => {
    const save = kantoSave();
    save.league.run = { seed: 7, duel: 0, bonus: 0, startedAt: 1, team: CARRY_TEAM, hp: {} };
    save.deck = ['41'];
    save.cards['41'] = { level: 1, copies: 1, obtainedAt: 1 };
    await startGame(page, save, 'battle/league');
    await page.locator('.region-tab[data-region="kanto"]').click();
    await page.locator('[data-act="fight"]').click();
    await expect(page.locator('.arena-layer .hand-card')).toHaveCount(6);
    await playBattle(page);
    const after = await stored(page);
    expect(after.league.run.duel).toBe(1);
    // The level-up goes to the team that fought, not to the current one.
    expect(after.cards['150s'].level).toBeGreaterThan(355);
    expect(after.cards['41'].level).toBe(1);
  });

  test('an overleveled team sees the opponents trained up', async ({ page }) => {
    const save = withTeam(midGameSave(), 178);
    save.cards[STRONG_TEAM[0]].level = 330;
    delete save.league.run;
    save.league.run = { seed: 7, duel: 3, bonus: 0, startedAt: 1, team: STRONG_TEAM, hp: {} };
    await startGame(page, save, 'battle/league');
    await page.locator('.region-tab[data-region="kanto"]').click();
    // Average 203: the final at +30% (264), its ace at the team's strongest.
    await expect(page.locator('.league-next .pill.is-scaled')).toContainText('330');
    await expect(page.locator('.league-next .next-meta')).toContainText('264');
  });

  test('giving up ends the run with its placement prize', async ({ page }) => {
    const save = kantoSave();
    save.league.run = { seed: 7, duel: 0, bonus: 0, startedAt: 1, team: CARRY_TEAM, hp: {} };
    await startGame(page, save, 'battle/league');
    await page.locator('.region-tab[data-region="kanto"]').click();
    await page.locator('[data-act="abandon"]').click();
    await page.locator('.modal-dialog [data-confirm]').click();
    await closeOverlays(page);
    const after = await stored(page);
    expect(after.league.run).toBeUndefined();
    expect(after.coins).toBe(save.coins + 250);
  });
});
