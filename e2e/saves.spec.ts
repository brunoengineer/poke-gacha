// Old saves through the real game: players have real progress, and every release must open it on every screen.

import { expect, fixture, fixtureNames, midGameSave, startGame, stored, test } from './helpers';

const SCREENS = [
  'collection', 'capture', 'battle', 'battle/training', 'battle/competition', 'battle/gyms', 'battle/hunt', 'battle/tower', 'battle/league',
];

for (const name of fixtureNames()) {
  test(`${name} opens on every screen and loses nothing`, async ({ page }) => {
    const save = fixture(name);
    await startGame(page, save, 'collection');
    for (const screen of SCREENS) {
      await page.goto(`/#/${screen}`);
      await expect(page.locator('.view:not([hidden])')).toBeVisible();
      await expect(page.locator('.view:not([hidden])')).not.toBeEmpty();
    }
    await page.reload();
    await expect(page.locator('.topbar')).toBeVisible();

    const after = await stored(page);
    expect(Object.keys(after.cards).sort()).toEqual(Object.keys(save.cards).sort());
    for (const [key, card] of Object.entries(save.cards)) expect(after.cards[key]).toMatchObject(card as Record<string, unknown>);
    expect(after.deck).toEqual(save.deck);
    expect(after.coins).toBe(save.coins);
    expect(after.gyms.badges).toEqual(save.gyms.badges);
  });
}

test('every screen works in Portuguese too', async ({ page }) => {
  await startGame(page, midGameSave(), 'collection', 'pt');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  for (const screen of SCREENS) {
    await page.goto(`/#/${screen}`);
    await expect(page.locator('.view:not([hidden])')).not.toBeEmpty();
  }
});
