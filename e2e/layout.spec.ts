// Layout bugs that only show on a real screen: covered buttons, sideways overflow, things that jump around.

import { expect, expectFullyClickable, expectNoSideScroll, midGameSave, startGame, test, withTeam } from './helpers';

const SCREENS = [
  'collection', 'capture', 'battle', 'battle/training', 'battle/competition', 'battle/gyms', 'battle/hunt', 'battle/tower', 'battle/league', 'ranking',
];

test('no screen overflows sideways', async ({ page }) => {
  await startGame(page, midGameSave(), 'collection');
  for (const screen of SCREENS) {
    await page.goto(`/#/${screen}`);
    await expect(page.locator('.view:not([hidden])')).not.toBeEmpty();
    await expectNoSideScroll(page);
  }
});

test('the team dock buttons are clickable from edge to edge', async ({ page }) => {
  await startGame(page, midGameSave(), 'collection');
  for (const button of ['[data-act="clear"]', '[data-open-teams]', '[data-act="auto"]', '[data-act="battle"]']) {
    await expectFullyClickable(page.locator(`#deck-dock ${button}`));
  }
});

test('the Battle hub mode cards are clickable from edge to edge', async ({ page }) => {
  await startGame(page, midGameSave(), 'battle');
  for (const mode of ['training', 'competition', 'gyms', 'hunt', 'tower', 'league']) {
    await expectFullyClickable(page.locator(`[data-mode="${mode}"]`));
  }
});

test('the header fits on every screen wide enough to show the tabs', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones use the side menu');
  const save = midGameSave();
  save.coins = 12_345_678;
  await startGame(page, save, 'collection', 'en');
  for (const lang of ['en', 'pt']) {
    await page.evaluate(l => localStorage.setItem('pg-lang', l), lang);
    await page.reload();
    await expect(page.locator('.topbar')).toBeVisible();
    for (const width of [681, 700, 760, 761, 880, 960, 961, 1024]) {
      await page.setViewportSize({ width, height: 700 });
      await expectNoSideScroll(page);
      const [brand, tabs, end] = await Promise.all(['.brand', '.tabs', '.topbar-end'].map(s => page.locator(s).boundingBox()));
      expect(tabs!.x, `${lang}: tabs clear the logo at ${width}px`).toBeGreaterThanOrEqual(brand!.x + brand!.width);
      expect(tabs!.x + tabs!.width, `${lang}: tabs clear the coins at ${width}px`).toBeLessThanOrEqual(end!.x);
    }
  }
});

test('the main menu goes to every screen', async ({ page, isMobile }) => {
  await startGame(page, midGameSave(), 'collection');
  for (const view of ['capture', 'battle', 'ranking', 'collection']) {
    if (isMobile) await page.locator('.side-nav-handle').click();
    const tab = page.locator(`${isMobile ? '.side-nav' : '.tabs'} .tab[data-view="${view}"]`);
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(page).toHaveURL(new RegExp(`#/${view}`));
    if (isMobile) await expect(page.locator('.side-nav.open')).toHaveCount(0);
  }
});

test('the phone menu closes by tapping elsewhere and stays out of battles', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phones only');
  await startGame(page, withTeam(midGameSave(), 5000), 'battle/training');
  await page.locator('.side-nav-handle').click();
  await expect(page.locator('.side-nav.open')).toHaveCount(1);
  await page.locator('h1').first().click();
  await expect(page.locator('.side-nav.open')).toHaveCount(0);
  await page.locator('[data-friend="joey"]').click();
  await expect(page.locator('.side-nav')).toBeHidden();
});

test('the battle prompt keeps its height through every state, so nothing jumps', async ({ page, isMobile }) => {
  // Far above the Tower's first floor: our Pokémon never faints, so the next prompt is always keep-or-switch.
  const save = withTeam(midGameSave(), 5000);
  save.tower = { best: 0, wins: 0, losses: 0 };
  await startGame(page, save, 'battle/tower');
  await page.locator('[data-act="climb"]').click();
  const arena = page.locator('.arena-layer');
  await arena.locator('[data-act="start"]').click();
  await expect(arena).toHaveClass(/choosing/);

  const prompt = arena.locator('.arena-prompt');
  const height = async () => Math.round((await prompt.boundingBox())!.height);
  const expected = isMobile ? 92 : 78;
  expect(await height(), 'nothing picked').toBe(expected);

  const cards = arena.locator('.hand-card:not(:disabled)');
  await cards.nth(0).click();
  expect(await height(), 'first card picked').toBe(expected);
  await cards.nth(1).click();
  expect(await height(), 'another card picked').toBe(expected);
  await arena.locator('.arena-prompt [data-act="confirm"]').click();
  expect(await height(), 'duel running').toBe(expected);

  // Skip to the keep-or-switch choice after the first knockout.
  await expect(async () => {
    await arena.locator('.scene').click({ timeout: 300 }).catch(() => {});
    await expect(arena).toHaveClass(/choosing/, { timeout: 100 });
  }).toPass({ timeout: 30_000 });
  expect(await height(), 'keep or switch').toBe(expected);
  await expect(prompt.locator('.prompt-text')).toHaveCount(0); // the field already says who came out
  await cards.nth(2).click();
  expect(await height(), 'keep or switch, other card').toBe(expected);
});
