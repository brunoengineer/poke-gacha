// Every battle mode, played for real from its lobby to its rewards.

import { CARRY_TEAM, closeOverlays, expect, midGameSave, playBattle, startGame, stored, STRONG_TEAM, test, withCarry, withTeam } from './helpers';

const strongSave = () => withTeam(midGameSave(), 5000);
/** Six weak cards: they lose to anything from the Tower's first floor up. */
const weakSave = () => withTeam(midGameSave(), 1, ['19', '16', '10', '13', '129', '41']);

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
  test('beating a trainer above climbs the ladder', async ({ page }) => {
    const save = strongSave();
    await startGame(page, save, 'battle/competition');
    const before = save.ladder.rating ?? 0;
    await page.locator('[data-act="challenge"]').first().click();
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

  test('HP carries over, and the heal choice comes before the next duel', async ({ page }) => {
    const save = kantoSave();
    save.league.run = {
      seed: 7, duel: 1, bonus: 0, startedAt: 1, team: CARRY_TEAM,
      hp: { '150s': 1, 19: 0, 16: 0.4, 10: 1, 13: 1, 129: 1 },
    };
    await startGame(page, save, 'battle/league');
    await page.locator('.region-tab[data-region="kanto"]').click();

    // Battling is blocked until the heal is chosen.
    await expect(page.locator('[data-act="fight"]')).toHaveCount(0);
    await expect(page.locator('.run-mon.is-fainted')).toHaveCount(1);
    await page.locator('[data-heal="revive"]').click();
    let after = await stored(page);
    expect(after.league.run.hp['19']).toBe(0.5);
    expect(after.league.run.healed).toBe(1);
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
    save.league.run = { seed: 7, duel: 3, bonus: 0, startedAt: 1, team: STRONG_TEAM, hp: {}, healed: 3 };
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
