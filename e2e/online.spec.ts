// The online ranking screen, against a fake board (the game's localhost test hook replaces Firestore). The Firestore
// rules and the real network are not exercised here.

import type { Page } from '@playwright/test';
import { expect, midGameSave, startGame, stored, test } from './helpers';

const OTHERS = [
  { uid: 'a', name: 'Misty', tower: 40, power: 90000, caught: 300 },
  { uid: 'b', name: 'Brock', tower: 12, power: 50000, caught: 490 },
  { uid: 'c', name: 'Gary', tower: 12, power: 10, caught: 2 },
  { uid: 'd', name: 'NoTower', tower: 0, power: 5, caught: 1 },
];

/** Installs the fake board, before the game starts. */
const fakeBoard = (page: Page, entries: unknown[] = OTHERS) =>
  page.addInitScript(rows => { (window as unknown as Record<string, unknown>).__PG_FAKE_LEADERBOARD__ = rows; }, entries);

test('shows the boards, with tied players sharing a place and no score left out', async ({ page }) => {
  await fakeBoard(page);
  await startGame(page, midGameSave(), 'ranking');
  const rows = page.locator('.online-row');
  await expect(rows).toHaveCount(3); // NoTower has no floor on this board
  await expect(rows.nth(0)).toContainText('Misty');
  await expect(rows.nth(1).locator('.online-pos')).toHaveText('2');
  await expect(rows.nth(2).locator('.online-pos')).toHaveText('2');

  await page.locator('[data-board="caught"]').click();
  await expect(rows.first()).toContainText('Brock');
  await expect(rows).toHaveCount(4);
});

test('a player joins, shows up with their place, changes nickname and leaves', async ({ page }) => {
  await fakeBoard(page);
  const save = midGameSave();
  save.tower = { best: 20, wins: 20, losses: 0 };
  await startGame(page, save, 'ranking');

  // Invalid nickname: refused.
  await page.locator('.online-input').fill('<b>');
  await page.locator('.online-form [type="submit"]').click();
  await expect(page.locator('.toast-warning')).toBeVisible();
  expect((await stored(page)).online?.joined).toBeFalsy();

  await page.locator('.online-input').fill('  Red   Ranger ');
  await page.locator('.online-form [type="submit"]').click();
  await expect(page.locator('.online-row.is-you')).toContainText('Red Ranger');
  await expect(page.locator('.online-place')).toHaveText('#2');
  await expect(page.locator('.online-row.is-you')).toContainText('Floor 20');
  expect((await stored(page)).online).toEqual({ joined: true, nickname: 'Red Ranger' });

  await page.locator('[data-act="edit-name"]').click();
  await page.locator('.online-input').fill('Ace');
  await page.locator('.online-form [type="submit"]').click();
  await expect(page.locator('.online-row.is-you')).toContainText('Ace');
  await expect(page.locator('.online-row', { hasText: 'Red Ranger' })).toHaveCount(0);

  await page.locator('[data-act="leave"]').click();
  await page.locator('.modal-dialog [data-confirm]').click();
  await expect(page.locator('.online-row.is-you')).toHaveCount(0);
  expect((await stored(page)).online.joined).toBe(false);
});

test('a guest can read the boards, and is asked to sign in to join', async ({ page }) => {
  await fakeBoard(page);
  await page.addInitScript(() => { (window as unknown as Record<string, unknown>).__PG_FAKE_LEADERBOARD_GUEST__ = true; });
  await startGame(page, midGameSave(), 'ranking');
  await expect(page.locator('.online-row')).toHaveCount(3);
  await expect(page.locator('[data-act="sign-in"]')).toBeVisible();
  await expect(page.locator('.online-input')).toHaveCount(0);
});

test('a player who joined is published a little after opening the game', async ({ page }) => {
  await fakeBoard(page, []);
  await page.clock.install();
  const save = midGameSave();
  save.tower = { best: 20, wins: 20, losses: 0 };
  save.online = { joined: true, nickname: 'Misty' };
  await startGame(page, save, 'battle');
  const board = () => page.evaluate(() => (window as unknown as { __PG_FAKE_LEADERBOARD__: { name: string; tower: number }[] }).__PG_FAKE_LEADERBOARD__);
  expect(await board()).toEqual([]);
  await page.clock.fastForward(31_000);
  await expect.poll(board).toEqual([expect.objectContaining({ name: 'Misty', tower: 20 })]);
});

test('opening the screen publishes first, so a returning player sees their own row', async ({ page }) => {
  await fakeBoard(page);
  const save = midGameSave();
  save.tower = { best: 20, wins: 20, losses: 0 };
  save.online = { joined: true, nickname: 'Ace' };
  await startGame(page, save, 'ranking');
  await expect(page.locator('.online-row.is-you')).toContainText('Floor 20');
  await expect(page.locator('.online-place')).toHaveText('#2');
});

test('resetting the progress keeps the player in the ranking, with the new scores', async ({ page }) => {
  await fakeBoard(page, []);
  const save = midGameSave();
  save.tower = { best: 20, wins: 20, losses: 0 };
  save.online = { joined: true, nickname: 'Misty' };
  await startGame(page, save, 'ranking');
  await expect(page.locator('.online-me')).toContainText('Misty');
  await page.locator('[data-act="reset"]').dispatchEvent('click');
  await Promise.all([page.waitForEvent('load'), page.locator('.modal-dialog [data-confirm]').click()]);
  const after = await stored(page);
  expect(after.tower.best).toBe(0);
  expect(after.online).toEqual({ joined: true, nickname: 'Misty' });
});

test('names from other players can not inject anything', async ({ page }) => {
  await fakeBoard(page, [
    { uid: 'x', name: '<img src=x onerror=alert(1)>', tower: 99, power: 1, caught: 1 },
    { uid: 'y', name: 'Fine_Name', tower: 'NaN', power: -1, caught: {} },
    { uid: 'z', name: 'Good', tower: 7, power: 1, caught: 1 },
  ]);
  await startGame(page, midGameSave(), 'ranking');
  await expect(page.locator('.online-row')).toHaveCount(1);
  await expect(page.locator('.online-row')).toContainText('Good');
  await expect(page.locator('.online-list img')).toHaveCount(0);
});

test('an empty board invites the player', async ({ page }) => {
  await fakeBoard(page, []);
  await startGame(page, midGameSave(), 'ranking');
  await expect(page.locator('.online-state')).toBeVisible();
});

test('it is a section of its own: not a battle mode, and the old link still gets there', async ({ page }) => {
  await fakeBoard(page);
  await startGame(page, midGameSave(), 'battle');
  await expect(page.locator('[data-mode]')).toHaveCount(6);
  await expect(page.locator('[data-mode="online"]')).toHaveCount(0);
  await page.goto('/#/battle/online');
  await expect(page).toHaveURL(/#\/ranking$/);
  await expect(page.locator('.online-row').first()).toBeVisible();
});

test('without Firebase configured it says so instead of breaking', async ({ page }) => {
  await startGame(page, midGameSave(), 'ranking');
  await expect(page.locator('.online-state')).toBeVisible();
  await expect(page.locator('.online-tabs')).toHaveCount(0);
});
