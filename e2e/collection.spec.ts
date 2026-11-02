// The Pokédex, card details, evolving, passing levels and saved teams.

import type { Page } from '@playwright/test';
import { closeOverlays, expect, midGameSave, startGame, stored, test, type Save } from './helpers';

/** Plays a finger on the page, as the game's drag code sees it. */
const finger = (page: Page, type: string, x: number, y: number) => page.evaluate(([kind, px, py]) => {
  const target = kind === 'pointerdown' ? document.elementFromPoint(px as number, py as number)! : window;
  target.dispatchEvent(new PointerEvent(kind as string, { bubbles: true, pointerId: 7, pointerType: 'touch', button: 0, clientX: px as number, clientY: py as number }));
}, [type, x, y]);

const own = (save: Save, key: string, level: number) => {
  save.cards[key] = { level, copies: 2, obtainedAt: 1 };
  save.caught[parseInt(key, 10)] = 1;
};

test('dragging: on a phone the card shrinks to aim at the deck and still lands there', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'long press is the touch gesture');
  const save = midGameSave();
  save.deck = save.deck.slice(0, 5);
  own(save, '9', 40);
  await startGame(page, save, 'collection');
  const tile = page.locator('.dex-tile[data-key="9"]');
  await tile.evaluate(node => node.scrollIntoView({ block: 'center' })); // clear of the deck bar
  const card = (await tile.locator('.pcard').boundingBox())!;
  await finger(page, 'pointerdown', card.x + card.width / 2, card.y + card.height / 2);
  const ghost = page.locator('.drag-ghost');
  await expect(ghost).toBeVisible();
  await expect.poll(async () => (await ghost.boundingBox())!.width).toBeLessThan(card.width * 0.8);

  const slot = (await page.locator('.dock-slot').last().boundingBox())!;
  await finger(page, 'pointermove', slot.x + slot.width / 2, slot.y + slot.height / 2);
  await expect(page.locator('.dock-slot.drop-hover, .dock-slots.drop-hover').first()).toBeVisible();
  await finger(page, 'pointerup', slot.x + slot.width / 2, slot.y + slot.height / 2);
  await expect(ghost).toHaveCount(0);
  expect((await stored(page)).deck).toContain('9');
});

test('dragging: with a mouse the card keeps its size', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones have no mouse');
  const save = midGameSave();
  own(save, '9', 40);
  await startGame(page, save, 'collection');
  const tile = page.locator('.dex-tile[data-key="9"]');
  await tile.evaluate(node => node.scrollIntoView({ block: 'center' })); // clear of the deck bar
  const card = (await tile.locator('.pcard').boundingBox())!;
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
  await page.mouse.down();
  await page.mouse.move(card.x + card.width / 2 + 30, card.y + card.height / 2 - 30);
  const ghost = page.locator('.drag-ghost');
  await expect(ghost).toBeVisible();
  await expect.poll(async () => (await ghost.boundingBox())!.width).toBeGreaterThan(card.width);
  await page.mouse.up();
});

/** A save with no pending passes of its own, so the counts below are exact. */
function cleanSave() {
  const save = midGameSave();
  const keep = ['6s', '248', '158', '212', '150'];
  save.cards = Object.fromEntries(keep.map(key => [key, { level: 30, copies: 1, obtainedAt: 1 }]));
  save.deck = keep;
  return save;
}

test('Rare Candy levels a card up to its cap, then stops', async ({ page }) => {
  const save = cleanSave();
  own(save, '19', 99);
  save.items['rare-candy'] = 5;
  await startGame(page, save, 'collection/19');
  await expect(page.locator('.dx-level')).toContainText('/ 100');
  await page.locator('[data-act="candy"][data-n="1"]').click();
  await expect.poll(async () => (await stored(page)).cards['19'].level).toBe(100);
  await expect(page.locator('[data-act="candy"]').first()).toBeDisabled();
  expect((await stored(page)).items['rare-candy']).toBe(4);
});

test('legendaries and mythicals have their own caps, shinies none', async ({ page }) => {
  const save = cleanSave();
  own(save, '386', 10);
  await startGame(page, save, 'collection/150');
  await expect(page.locator('.dx-level')).toContainText('/ 120');
  await page.locator('.modal-dex .modal-x').click();
  await page.goto('/#/collection/386');
  await expect(page.locator('.dx-level')).toContainText('/ 140');
  await page.locator('.modal-dex .modal-x').click();
  await page.goto('/#/collection/6s');
  await expect(page.locator('.dx-level')).toContainText('∞');
});

test('a Lv. 100 card turns into a foil', async ({ page }) => {
  const save = cleanSave();
  own(save, '19', 100);
  own(save, '16', 99);
  await startGame(page, save, 'collection');
  await expect(page.locator('.dex-tile[data-key="19"] .pcard[data-foil]')).toHaveCount(1);
  await expect(page.locator('.dex-tile[data-key="16"] .pcard[data-foil]')).toHaveCount(0);
});

test('evolving swaps the team slot and leaves the old species registered', async ({ page }) => {
  const save = cleanSave();
  own(save, '4', 20);
  save.deck = ['4', '248'];
  await startGame(page, save, 'collection/4');
  await page.locator('.modal-dex [data-act="evolve"]').first().click();
  await page.locator('.modal-evo-confirm [data-confirm]').click();
  await closeOverlays(page);
  const after = await stored(page);
  expect(after.cards['4']).toBeUndefined();
  expect(after.cards['5'].level).toBe(20);
  expect(after.deck).toEqual(['5', '248']);
  await expect(page.locator('.dex-tile[data-key="4"]')).toHaveAttribute('data-state', 'registered');
});

test('passing a level by hand needs no stone', async ({ page }) => {
  const save = cleanSave();
  own(save, '33', 27);
  own(save, '34', 1);
  await startGame(page, save, 'collection/33');
  await page.locator('[data-act="transfer"]').click();
  await page.locator('.modal-dialog [data-confirm]').click();
  await expect.poll(async () => (await stored(page)).cards['34']?.level).toBe(28);
  expect((await stored(page)).cards['33']).toBeUndefined();
});

test.describe('pass levels button', () => {
  test('passes everything at once, except what the player keeps out', async ({ page }) => {
    const save = cleanSave();
    own(save, '33', 27); own(save, '34', 1); // Nidorino, Nidoking
    own(save, '43', 12); own(save, '44', 9); own(save, '45', 30); // Oddish, Gloom, Vileplume
    own(save, '133', 8); own(save, '135', 50); // Eevee, Jolteon
    await startGame(page, save, 'collection');
    await expect(page.locator('[data-autopass-text]')).toContainText('4 Pokémon');
    await page.locator('[data-autopass-open]').click();
    await expect(page.locator('.ap-row')).toHaveCount(4);
    await page.locator('.ap-row[data-from="133"]').click();
    await expect(page.locator('.modal-autopass [data-confirm]')).toContainText('3');
    await page.locator('.modal-autopass [data-confirm]').click();
    await closeOverlays(page);
    const after = await stored(page);
    expect(after.cards['34'].level).toBe(28);
    expect(after.cards['45'].level).toBe(32);
    expect(after.cards['133'].level).toBe(8); // kept out
    expect(after.cards['135'].level).toBe(50);
    for (const key of ['33', '43', '44']) expect(after.cards[key]).toBeUndefined();
    await expect(page.locator('.dex-tile[data-key="33"]')).toHaveAttribute('data-state', 'registered');
  });

  test('stays hidden with nothing to pass', async ({ page }) => {
    await startGame(page, cleanSave(), 'collection');
    await expect(page.locator('[data-autopass]')).toBeHidden();
  });
});

test.describe('saved teams', () => {
  const fullTeam = ['6s', '248', '158', '212', '150', '5'];

  function teamSave() {
    const save = cleanSave();
    own(save, '5', 40);
    own(save, '19', 10);
    save.deck = [...fullTeam];
    return save;
  }

  test('saves a team, follows an evolution, and loads it in one click', async ({ page }) => {
    await startGame(page, teamSave(), 'collection');
    await page.locator('#deck-dock [data-open-teams]').click();
    await page.locator('.modal-teams [data-act="save"]').click();
    await page.keyboard.type('Main team');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await stored(page)).teams[0]?.name).toBe('Main team');
    await page.locator('.modal-teams .modal-x').click();

    // Evolve a member of the saved team while it's not on the current one.
    await page.locator('#deck-dock [data-act="clear"]').click();
    await page.locator('.modal-dialog [data-confirm]').click();
    await page.goto('/#/collection/5');
    await page.locator('.modal-dex [data-act="evolve"]').first().click();
    await page.locator('.modal-evo-confirm [data-confirm]').click();
    await closeOverlays(page);
    expect((await stored(page)).teams[0].keys).toEqual(['6s', '248', '158', '212', '150', '6']);

    // One click on the Battle hub's chip brings it back, with Charizard in the same slot.
    await page.goto('/#/battle');
    await page.locator('.st-chip', { hasText: 'Main team' }).click();
    await expect.poll(async () => (await stored(page)).deck).toEqual(['6s', '248', '158', '212', '150', '6']);
    await expect(page.locator('.st-chip.is-active')).toHaveText(/Main team/);
  });

  test('deleting asks first and leaves the Pokémon alone', async ({ page }) => {
    const save = teamSave();
    save.teams = [{ id: 'a', name: 'Old', keys: fullTeam }];
    await startGame(page, save, 'battle');
    await page.locator('.team-summary [data-open-teams]').click();
    await page.locator('.st-row [data-act="delete"]').click();
    await page.locator('.modal-dialog [data-confirm]').click();
    await expect(page.locator('.st-row')).toHaveCount(0);
    const after = await stored(page);
    expect(after.teams).toEqual([]);
    expect(after.deck).toEqual(fullTeam);
  });
});

test('the Mart sells items for coins', async ({ page }) => {
  const save = cleanSave();
  save.coins = 1000;
  save.items = {};
  await startGame(page, save, 'capture');
  await page.locator('.cap-tabs .seg-btn').last().click();
  await page.locator('[data-item="rare-candy"] [data-buy]').click();
  await expect.poll(async () => (await stored(page)).items['rare-candy']).toBe(1);
  expect((await stored(page)).coins).toBe(700);
});

test('the daily gift gives its reward once a day', async ({ page }) => {
  const save = cleanSave();
  save.daily = { last: null, streak: 0 };
  save.items = {};
  const coins = save.coins;
  await startGame(page, save, 'capture');
  await page.locator('[data-claim]').click();
  await expect(page.locator('.daily.is-opened')).toBeVisible();
  const after = await stored(page);
  expect(after.coins).toBe(coins + 80);
  expect(after.items['rare-candy']).toBe(2);
  expect(after.items['master-ball']).toBeUndefined();
  await page.reload();
  await expect(page.locator('[data-claim]')).toHaveCount(0);
});

test('a capture spends coins and adds the cards', async ({ page }) => {
  const save = cleanSave();
  save.coins = 500;
  const pulls = save.stats.pulls;
  await startGame(page, save, 'capture');
  await page.locator('[data-pull="poke"][data-count="1"]').click();
  await closeOverlays(page);
  const after = await stored(page);
  expect(after.stats.pulls).toBe(pulls + 1);
  expect(after.coins).toBe(495);
});
