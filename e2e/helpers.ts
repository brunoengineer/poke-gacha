// Shared tools for the browser tests.
//   - Every test fails on a page error or a console error.
//   - Sprites, cries and fonts come from other sites in production; here they are stubbed, so tests run offline and fast.
//   - Saves are seeded straight into localStorage, the way a returning guest player has them.
//   - Battles use real randomness, so tests that need a win use a team far above any opponent: they check that the
//     flow works, not the balance (the balance numbers are pinned in src/game/modes/difficulty-baseline.test.ts).

import { readdirSync, readFileSync } from 'node:fs';
import { test as base, expect, type Locator, type Page } from '@playwright/test';

/** A save as stored in the browser (only what the tests need to read or set). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Save = Record<string, any>;

const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(`page error: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    await page.route(url => url.hostname !== 'localhost', route => {
      const type = route.request().resourceType();
      if (type === 'image') return route.fulfill({ contentType: 'image/png', body: PIXEL });
      if (type === 'stylesheet') return route.fulfill({ contentType: 'text/css', body: '' });
      if (type === 'font') return route.abort();
      return route.fulfill({ status: 200, body: '' });
    });
    await use(page);
    expect(errors, 'the game logged errors during this test').toEqual([]);
  },
});

export { expect };

const FIXTURES = new URL('../src/state/fixtures/', import.meta.url);

/** Every released save kept for compatibility, by file name. */
export const fixtureNames = () => readdirSync(FIXTURES).filter(file => file.endsWith('.json')).sort();
export const fixture = (name: string): Save => JSON.parse(readFileSync(new URL(name, FIXTURES), 'utf8'));

/** A mid-game player: many cards, Kanto done, Johto started. */
export const midGameSave = () => fixture('save-v2-tower-hunt.json');

/** Keys of the team that wins everything: shinies have no level cap. */
export const STRONG_TEAM = ['6s', '25s', '3s', '9s', '150s', '149s'];

/** Gives the save a team of six at this level. */
export function withTeam(save: Save, level: number, keys = STRONG_TEAM): Save {
  for (const key of keys) {
    save.cards[key] = { level, copies: 1, obtainedAt: 1 };
    save.caught[parseInt(key, 10)] = 1;
  }
  save.deck = [...keys];
  return save;
}

/** Opens the game as a guest with this save (none: a brand-new player). */
export async function startGame(page: Page, save: Save | null, path = 'collection', lang: 'en' | 'pt' = 'en') {
  await page.addInitScript(([json, language]) => {
    if (sessionStorage.getItem('e2e-seeded')) return;
    sessionStorage.setItem('e2e-seeded', '1');
    localStorage.setItem('pg-guest', '1');
    localStorage.setItem('pg-lang', language!);
    localStorage.setItem('pg-battle-speed', '2');
    if (json) localStorage.setItem('pg-save-guest', json);
  }, [save && JSON.stringify(save), lang]);
  await page.goto(`/#/${path}`);
  await expect(page.locator('.topbar')).toBeVisible();
}

/** The save as the game stored it (the game writes on the next tick, so this reads after that). */
export const stored = (page: Page): Promise<Save> =>
  page.evaluate(() => new Promise<Save>(resolve => setTimeout(() => resolve(JSON.parse(localStorage.getItem('pg-save-guest')!)))));

const visible = (locator: Locator) => locator.isVisible().catch(() => false);
const tryClick = async (locator: Locator) => {
  if (!(await visible(locator))) return false;
  await locator.click({ timeout: 1500 }).catch(() => {});
  return true;
};

/**
 * Plays the open battle to its end screen, sending the first Pokémon available and keeping it in, skips the duels and
 * picks who trains. Leaves the end screen open when `stayOnEnd` is set; otherwise continues out of the arena.
 */
export async function playBattle(page: Page, { stayOnEnd = false } = {}) {
  const arena = page.locator('.arena-layer');
  await expect(arena).toBeVisible();
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await tryClick(arena.locator('[data-act="start"]'))) continue;
    if (await arena.evaluate(node => node.classList.contains('choosing')).catch(() => false)) {
      if (!(await tryClick(arena.locator('.arena-prompt [data-act="confirm"]')))) {
        await tryClick(arena.locator('.hand-card:not(:disabled)').first());
      }
      continue;
    }
    if (await tryClick(arena.locator('.train-card:not(:disabled)').first())) continue;
    const next = arena.locator('[data-act="continue"]');
    if (await visible(next)) {
      if (stayOnEnd) return;
      await next.click();
      await expect(arena).toBeHidden();
      return;
    }
    await arena.locator('.scene').click({ timeout: 500 }).catch(() => {});
  }
  throw new Error('The battle did not reach its end screen in time');
}

/** Clicks through whatever reward or celebration screens are open, until none is left. */
export async function closeOverlays(page: Page) {
  const modals = page.locator('.modal-root');
  const deadline = Date.now() + 30_000;
  while ((await modals.count()) > 0) {
    if (Date.now() > deadline) throw new Error('A screen stayed open');
    const top = modals.last();
    const button = top.locator('[data-close].btn, [data-reveal-all], .btn-primary').first();
    if (await visible(button)) await button.click({ timeout: 1500 }).catch(() => {});
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }
}

/** Fails unless a real click anywhere along the element lands on it (nothing covers it). */
export async function expectFullyClickable(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const misses = await locator.evaluate(node => {
    const box = node.getBoundingClientRect();
    return [0.1, 0.3, 0.5, 0.7, 0.9].flatMap(f => {
      const hit = document.elementFromPoint(box.left + box.width * f, box.top + box.height / 2);
      return hit && node.contains(hit) ? [] : [`${Math.round(f * 100)}% is covered by .${hit?.className || hit?.tagName}`];
    });
  });
  expect(misses, 'parts of this element can not be clicked').toEqual([]);
}

/** Fails if the page can be scrolled sideways (something overflows the screen). */
export async function expectNoSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'the page overflows sideways').toBeLessThanOrEqual(0);
}
