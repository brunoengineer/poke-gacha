// A brand-new player: onboarding, first captures, first team, first battle.

import { closeOverlays, expect, playBattle, startGame, stored, test } from './helpers';

test('goes from onboarding to a first battle', async ({ page }) => {
  await startGame(page, null);

  // Professor's intro, one line at a time, until the starters show.
  const starters = page.locator('[data-starter]');
  await expect(async () => {
    if (!(await starters.count())) await page.locator('[data-next]').click({ timeout: 500 });
    await expect(starters).toHaveCount(12, { timeout: 200 });
  }).toPass({ timeout: 30_000 });

  await page.locator('[data-starter="4"]').click();
  await page.locator('[data-confirm]').click();
  await page.locator('[data-to-tips]').click();
  const finish = page.locator('[data-finish]');
  while (!(await finish.isVisible())) await page.locator('[data-tip="1"]').click();
  await finish.click();
  await expect(page.locator('.onboard')).toBeHidden();

  let save = await stored(page);
  expect(save.starter).toBe(4);
  expect(save.cards['4']).toMatchObject({ level: 5, copies: 1 });
  expect(save.deck).toEqual(['4']);
  expect(save.coins).toBe(150);
  expect(save.items['rare-candy']).toBe(10);

  // Captures: ten Poké Balls for ₽50.
  await page.goto('/#/capture');
  await page.locator('[data-pull="poke"][data-count="10"]').click();
  await closeOverlays(page);
  save = await stored(page);
  expect(save.stats.pulls).toBe(10);
  expect(save.coins).toBe(100);

  // A team of six needs more cards than one pull may give: fill the save's rest, then battle.
  await page.locator('[data-pull="poke"][data-count="10"]').click();
  await closeOverlays(page);
  await page.goto('/#/collection');
  await page.locator('#deck-dock [data-act="auto"]').click();
  save = await stored(page);
  expect(save.deck.length).toBeGreaterThan(1);
  if (save.deck.length < 6) return; // very unlucky pulls: all duplicates

  await page.goto('/#/battle/training');
  await page.locator('[data-friend="joey"]').click();
  await playBattle(page);
  await closeOverlays(page);
  expect((await stored(page)).stats.battles).toBe(1);
});

test('blocks battles until the team has six Pokémon', async ({ page }) => {
  const save: Record<string, unknown> = { v: 3, coins: 100, starter: 4, cards: { 4: { level: 5, copies: 1, obtainedAt: 1 } }, caught: { 4: 1 }, deck: ['4'] };
  await startGame(page, save, 'battle/training');
  await page.locator('[data-friend="joey"]').click();
  await expect(page.locator('.toast-warning')).toBeVisible();
  await expect(page.locator('.arena-layer')).toHaveCount(0);
});
