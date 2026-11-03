// The Region Journey, played for real: which game a browser gets, the chapter map, what each chapter allows and the
// battles in it. Classic is covered by the other specs (startGame plays Classic unless asked for the Journey).

import type { Page } from '@playwright/test';
import {
  type Save, CARRY_TEAM, closeOverlays, expect, expectFullyClickable, expectNoSideScroll, fixture, midGameSave, playBattle, rawItem, startGame, stored,
  storedJourney, test, withCarry, withTeam,
} from './helpers';

const KANTO_STARTERS = ['1', '4', '7'];
const JOHTO_STARTERS = ['152', '155', '158'];
/** Strong Johto cards (shinies have no level cap), for fights that have to be won in Johto. */
const JOHTO_TEAM = ['249s', '250s', '251s', '157s', '154s', '160s'];

type Chapter = 'kanto' | 'johto' | 'hoenn' | 'sinnoh' | 'world';

/** A mid-game player on the Journey, in this chapter, with the League titles of the chapters before it (or these). */
function journeySave(active: Chapter, cleared: Chapter[] = []): Save {
  const save = midGameSave();
  const title = { runs: 1, best: 4, titles: 1, duelsWon: 4, hall: [] };
  save.league = { runs: 0, best: 0, titles: 0, duelsWon: 0, hall: [] };
  if (cleared.includes('kanto')) save.league.titles = 1;
  for (const region of ['johto', 'hoenn', 'sinnoh'] as const) if (cleared.includes(region)) save.league[region] = { ...title };
  if (cleared.includes('world')) save.league.master = { ...title };
  save.starter = 4;
  save.journey = { active, slots: {} };
  return save;
}

const startJourney = (page: Page, save: Save | null, path = 'collection', lang: 'en' | 'pt' = 'en') =>
  startGame(page, save, path, lang, 'journey');

/** Opens the browser the way a visitor has it: a guest, with these keys in localStorage (and whatever else is set). */
async function openBrowser(page: Page, items: Record<string, string>, path = 'collection') {
  await page.addInitScript(entries => {
    if (sessionStorage.getItem('e2e-seeded')) return;
    sessionStorage.setItem('e2e-seeded', '1');
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, { 'pg-lang': 'en', 'pg-battle-speed': '2', ...items });
  await page.goto(`/#/${path}`);
}

const GUEST = { 'pg-guest': '1' };

/** Plays the professor's lines until the starters show. */
async function toStarters(page: Page) {
  const starters = page.locator('[data-starter]');
  await expect(async () => {
    if (!(await starters.count())) await page.locator('[data-next]').click({ timeout: 500 });
    await expect(starters.first()).toBeVisible({ timeout: 200 });
  }).toPass({ timeout: 30_000 });
}

const starterIds = (page: Page) => page.locator('[data-starter]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-starter')).sort());

/** Picks a starter and goes through what follows (the first chapter has tips; the later ones finish right away). */
async function pickStarter(page: Page, id: string) {
  await toStarters(page);
  await page.locator(`[data-starter="${id}"]`).click();
  await page.locator('[data-confirm]').click();
  const finish = page.locator('[data-finish]');
  if (!(await finish.isVisible().catch(() => false))) {
    await page.locator('[data-to-tips]').click();
    while (!(await finish.isVisible())) await page.locator('[data-tip="1"]').click();
  }
  await finish.click();
  await expect(page.locator('.onboard')).toBeHidden();
}

/** Waits for the pages that follow `action` (a travel or a switch restarts the app). */
async function reloadAfter(page: Page, action: () => Promise<unknown>) {
  await Promise.all([page.waitForEvent('load'), action()]);
  await expect(page.locator('.topbar, .onboard').first()).toBeVisible();
}

async function switchTrackFromMenu(page: Page) {
  await page.locator('#menu-btn').click();
  await page.locator('#menu [data-act="switch-track"]').click();
  await reloadAfter(page, () => page.locator('.modal-dialog [data-confirm]').click());
}

/** Clicks through celebrations and rewards until the confirm dialog (the offer of the next chapter) shows. */
async function toConfirmDialog(page: Page) {
  const dialog = page.locator('.modal-dialog [data-confirm]');
  await expect(async () => {
    if (await dialog.isVisible()) return;
    await page.locator('.modal-root').last().locator('[data-close].btn, [data-reveal-all], .btn-primary').first().click({ timeout: 500 }).catch(() => {});
    await expect(dialog).toBeVisible({ timeout: 300 });
  }).toPass({ timeout: 30_000 });
}

const modeCard = (page: Page, mode: string) => page.locator(`[data-mode="${mode}"]`);

test.describe('which game a browser gets', () => {
  test('a new browser gets the Journey, with only the 3 Kanto starters', async ({ page }) => {
    await openBrowser(page, GUEST);
    await expect(page.locator('[data-chapter-chip="kanto"]')).toBeAttached();
    await toStarters(page);
    expect(await starterIds(page)).toEqual(KANTO_STARTERS);

    await pickStarter(page, '4');
    const save = await storedJourney(page);
    expect(save.starter).toBe(4);
    expect(save.deck).toEqual(['4']);
    expect(save.coins).toBe(500);
    expect(save.journey.active).toBe('kanto');
    expect(await rawItem(page, 'pg-save-guest'), 'the Classic save must not exist').toBeNull();
  });

  test("a chapter's three starters are centered, not left in half of the grid", async ({ page }) => {
    await openBrowser(page, GUEST);
    await toStarters(page);
    await expect(page.locator('.onb-starter').last()).toHaveCSS('opacity', '1');
    const { left, right, viewport } = await page.locator('.onb-row').evaluate(row => {
      const box = row.getBoundingClientRect();
      return { left: box.left, right: box.right, viewport: document.documentElement.clientWidth };
    });
    expect(Math.abs(left - (viewport - right)), 'the same space on both sides').toBeLessThan(2);
  });

  test('a browser with a Classic save and no choice stays on Classic, untouched', async ({ page }) => {
    const save = midGameSave();
    await openBrowser(page, { ...GUEST, 'pg-save-guest': JSON.stringify(save) });
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('[data-chapter-chip]')).toHaveCount(0);
    await expect(page.locator('.tab[data-view="journey"]')).toHaveCount(0);
    await expect(page.locator('select[data-region]')).toBeAttached(); // the Classic Pokédex has its region filter
    await page.goto('/#/journey'); // Classic has no such screen
    await expect(page.locator('.jc-card')).toHaveCount(0);

    const after = await stored(page);
    expect(after.cards).toEqual(save.cards);
    expect(after.deck).toEqual(save.deck);
    expect(after.coins).toBe(save.coins);
    expect(after.starter).toBe(save.starter);
    expect(after.gyms).toEqual(save.gyms);
    expect('journey' in after).toBe(false);
    expect(await rawItem(page, 'pg-journey-save-guest')).toBeNull();
  });

  test('the login screen picks the game, and guest entry starts it', async ({ page }) => {
    await openBrowser(page, {});
    const option = (track: string) => page.locator(`[data-track="${track}"]`);
    await expect(option('journey')).toHaveAttribute('aria-checked', 'true'); // the default
    await option('classic').click();
    await expect(option('classic')).toHaveAttribute('aria-checked', 'true');
    await expect(option('journey')).toHaveAttribute('aria-checked', 'false');
    expect(await rawItem(page, 'pg-track')).toBe('classic');
    await option('journey').click();
    await expect(option('journey')).toHaveAttribute('aria-checked', 'true');
    await option('classic').click();

    await page.locator('[data-act="guest"]').click();
    await toStarters(page);
    expect(await page.locator('[data-starter]').count(), 'Classic offers every starter').toBe(12);
    expect(await rawItem(page, 'pg-track')).toBe('classic');
  });

  test('on the login screen, choosing the Journey beats a Classic save in the browser', async ({ page }) => {
    const raw = JSON.stringify(midGameSave());
    await openBrowser(page, { 'pg-save-guest': raw });
    await expect(page.locator('[data-track="classic"]')).toHaveAttribute('aria-checked', 'true'); // no surprise move
    await page.locator('[data-track="journey"]').click();
    await page.locator('[data-act="guest"]').click();
    await toStarters(page);
    expect(await starterIds(page)).toEqual(KANTO_STARTERS);
    expect(await rawItem(page, 'pg-track')).toBe('journey');
    expect(await rawItem(page, 'pg-save-guest')).toBe(raw);
  });
});

test.describe('switching game from the account menu', () => {
  // Leaving a game writes its save once (normalized); after that, the other game must leave it alone, byte for byte.
  const same = (page: Page, key: string, expected: string | null, what: string) =>
    rawItem(page, key).then(raw => expect(raw, what).toBe(expected));

  test('Classic to the Journey and back: each game keeps its own save', async ({ page }) => {
    const classic = midGameSave();
    await startGame(page, classic, 'collection');
    await switchTrackFromMenu(page);
    expect(await rawItem(page, 'pg-track')).toBe('journey');
    expect(await rawItem(page, 'pg-journey-save-guest'), 'a new Journey has no save yet').toBeNull();
    await expect(page.locator('.onboard'), 'the Journey starts from the beginning').toBeVisible();
    await toStarters(page);
    expect(await starterIds(page)).toEqual(KANTO_STARTERS);
    const classicRaw = await rawItem(page, 'pg-save-guest');
    expect(JSON.parse(classicRaw!)).toMatchObject({ cards: classic.cards, coins: classic.coins, deck: classic.deck });
    expect(await rawItem(page, 'pg-journey-save-guest'), 'no Journey save before the starter').toBeNull();

    await pickStarter(page, '1');
    expect((await storedJourney(page)).starter).toBe(1);
    await same(page, 'pg-save-guest', classicRaw, 'Classic save while playing the Journey');
    const journeyRaw = await rawItem(page, 'pg-journey-save-guest');

    await switchTrackFromMenu(page);
    expect(await rawItem(page, 'pg-track')).toBe('classic');
    await expect(page.locator('[data-chapter-chip]')).toHaveCount(0);
    const back = await stored(page);
    expect(back.cards).toEqual(classic.cards);
    expect(back.coins).toBe(classic.coins);
    await same(page, 'pg-journey-save-guest', journeyRaw, 'Journey save after leaving it');
  });

  test('the Journey to Classic and back, with a mid-game Journey save', async ({ page }) => {
    const journey = fixture('journey/save-v3-journey.json');
    const classic = midGameSave();
    classic.coins = 12_345;
    await startJourney(page, journey, 'collection');
    await page.evaluate(raw => localStorage.setItem('pg-save-guest', raw), JSON.stringify(classic));

    await switchTrackFromMenu(page);
    await expect(page.locator('[data-chapter-chip]')).toHaveCount(0);
    expect(await rawItem(page, 'pg-track')).toBe('classic');
    const journeyRaw = await rawItem(page, 'pg-journey-save-guest');
    expect(JSON.parse(journeyRaw!)).toMatchObject({ journey: journey.journey, cards: journey.cards, coins: journey.coins, deck: journey.deck });
    const inClassic = await stored(page);
    expect(inClassic.coins, 'Classic plays its own save').toBe(classic.coins);
    expect(inClassic.deck).toEqual(classic.deck);
    expect('journey' in inClassic, 'the Classic save must not get Journey data').toBe(false);
    for (const screen of ['capture', 'battle', 'collection']) await page.goto(`/#/${screen}`);
    await same(page, 'pg-journey-save-guest', journeyRaw, 'Journey save while playing Classic');

    await switchTrackFromMenu(page);
    await expect(page.locator('[data-chapter-chip="johto"]')).toBeAttached(); // back where it was
    expect(await rawItem(page, 'pg-track')).toBe('journey');
    expect(JSON.parse((await rawItem(page, 'pg-save-guest'))!)).toMatchObject({ cards: classic.cards, coins: classic.coins, deck: classic.deck });
    await same(page, 'pg-journey-save-guest', journeyRaw, 'Journey save after the round trip');
    const again = await storedJourney(page);
    expect(again.journey).toEqual(journey.journey);
    expect(again.deck).toEqual(journey.deck);
  });
});

test.describe('the Kanto chapter', () => {
  /** Kanto with a team of one and nothing else: whatever shows up in the cards came from the screen under test. */
  function freshKanto() {
    const save = journeySave('kanto');
    save.cards = {};
    save.caught = {};
    save.coins = 5000;
    return withTeam(save, 5, ['4']);
  }

  test('a new player can only buy a handful of Pokémon, whatever they click', async ({ page }) => {
    await startJourney(page, null, 'capture');
    await pickStarter(page, '4');
    let save = await storedJourney(page);
    expect(save.coins, 'ten Poké Balls').toBe(500);

    await page.goto('/#/capture');
    await expect(page.locator('[data-pull="poke"]:not([data-pay="ticket"])[data-count="100"]')).toHaveCount(0);
    await expect(page.locator('[data-pull="safari"][data-count="50"]')).toHaveCount(0);
    await expect(page.locator('.cap-region-hint')).toContainText('38 of the region\'s 151');
    await page.locator('[data-pull="poke"][data-count="10"]').click();
    await closeOverlays(page);

    save = await storedJourney(page);
    expect(save.coins, 'all spent').toBe(0);
    expect(save.stats.pulls).toBe(10);
    expect(Object.keys(save.caught).length, 'the starter and at most ten more').toBeLessThanOrEqual(11);
    expect(await page.locator('[data-pull="poke"][data-count="10"]').isDisabled().catch(() => true) || save.coins < 500).toBe(true);
  });

  test('Capture has no region picker and gives only Gen 1', async ({ page }) => {
    const before = freshKanto();
    await startJourney(page, before, 'capture');
    await expect(page.locator('.cap-region')).toBeVisible();
    await expect(page.locator('[data-region]')).toHaveCount(0);
    for (let i = 0; i < 3; i++) {
      await page.locator('[data-pull="poke"][data-count="10"]').click();
      await expect(page.locator('.modal-root').first()).toBeVisible();
      while ((await page.locator('.modal-root').count()) > 0) {
        await page.locator('.modal-root').last().locator('[data-close].btn, [data-reveal-all], .btn-primary').first().click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(100);
      }
    }
    const save = await storedJourney(page);
    expect(save.stats.pulls).toBe(before.stats.pulls + 30);
    const ids = Object.keys(save.cards).map(key => parseInt(key, 10));
    expect(ids.length, 'the pulls gave new cards').toBeGreaterThan(1);
    expect(ids.filter(id => id > 151), 'cards from other regions').toEqual([]);
    expect(Object.keys(save.caught).map(Number).filter(id => id > 151)).toEqual([]);
  });

  test('the Pokédex has the 151 Kanto species and no region filter', async ({ page }) => {
    await startJourney(page, journeySave('kanto'), 'collection');
    await expect(page.locator('.dex-tile')).toHaveCount(151);
    await expect(page.locator('select[data-region]')).toHaveCount(0);
    await expect(page.locator('[data-region-pick]')).toHaveCount(0);
  });

  test('the Battle hub locks Tower and Ranked, and their pages go back to the hub', async ({ page }) => {
    await startJourney(page, journeySave('kanto'), 'battle');
    for (const mode of ['tower', 'competition']) await expect(modeCard(page, mode)).toHaveAttribute('aria-disabled', 'true');
    for (const mode of ['training', 'gyms', 'hunt', 'league']) await expect(modeCard(page, mode)).not.toHaveAttribute('aria-disabled', 'true');
    for (const mode of ['tower', 'competition']) {
      await page.goto(`/#/battle/${mode}`);
      await expect(page).toHaveURL(/#\/battle$/);
      await expect(modeCard(page, mode)).toBeVisible();
    }
  });

  test('locked Battle cards are drawn as locked', async ({ page }) => {
    await startJourney(page, journeySave('kanto'), 'battle');
    await expect(modeCard(page, 'tower')).toHaveClass(/(^|\s)locked(\s|$)/);
    await expect(modeCard(page, 'competition')).toHaveClass(/(^|\s)locked(\s|$)/);
    await expect(modeCard(page, 'gyms')).not.toHaveClass(/(^|\s)locked(\s|$)/);
  });

  test('Training lists only the Kanto friends', async ({ page }) => {
    await startJourney(page, journeySave('kanto'), 'battle/training');
    await expect(page.locator('.friend-group')).toHaveCount(1);
    await expect(page.locator('[data-friend="joey"]')).toBeVisible();
    await expect(page.locator('[data-friend="blue"]')).toBeVisible();
    for (const other of ['youngster2', 'silver', 'ethan']) await expect(page.locator(`[data-friend="${other}"]`)).toHaveCount(0);
  });
});

test.describe('the journey map', () => {
  test('Johto stays locked before the Kanto title', async ({ page }) => {
    await startJourney(page, journeySave('kanto'), 'journey');
    await expect(page.locator('.jc-card')).toHaveCount(5);
    await expect(page.locator('[data-chapter="kanto"]')).toHaveAttribute('data-status', 'here');
    await expect(page.locator('[data-chapter="johto"]')).toHaveAttribute('data-status', 'locked');
    await expect(page.locator('[data-travel]')).toHaveCount(0);
  });

  test('with the title, Johto starts: its own starters, team and Pokédex, and Kanto waits intact', async ({ page }) => {
    const save = withTeam(journeySave('kanto', ['kanto']), 50);
    for (const id of [152, 155, 158]) { delete save.cards[id]; delete save.caught[id]; } // no Johto starter owned yet
    await startJourney(page, save, 'journey');
    await expect(page.locator('[data-chapter="johto"]')).toHaveAttribute('data-status', 'ready');
    await expect(page.locator('[data-chapter="hoenn"]')).toHaveAttribute('data-status', 'locked');
    await reloadAfter(page, () => page.locator('[data-travel="johto"]').click());

    await toStarters(page);
    expect(await starterIds(page)).toEqual(JOHTO_STARTERS);
    await pickStarter(page, '155');

    let after = await storedJourney(page);
    expect(after.journey.active).toBe('johto');
    expect(after.cards['155']).toMatchObject({ level: 5, copies: 1 });
    expect(after.starter).toBe(155);
    expect(after.deck).toEqual(['155']);
    expect(after.coins).toBe(save.coins + 500);
    expect(after.items['rare-candy']).toBe(save.items['rare-candy'] + 10);
    expect(after.journey.slots.kanto).toMatchObject({ starter: 4, deck: save.deck });
    await expect(page.locator('[data-chapter-chip="johto"]')).toBeAttached();
    await page.goto('/#/collection');
    await expect(page.locator('.dex-tile')).toHaveCount(100);

    // The way back: the Kanto team and starter are as they were.
    await page.goto('/#/journey');
    await expect(page.locator('[data-chapter="kanto"]')).toHaveAttribute('data-status', 'cleared');
    await reloadAfter(page, () => page.locator('[data-travel="kanto"]').click());
    after = await storedJourney(page);
    expect(after.journey.active).toBe('kanto');
    expect(after.starter).toBe(4);
    expect(after.deck).toEqual(save.deck);
    expect(after.journey.slots.johto).toMatchObject({ starter: 155, deck: ['155'] });
    await page.goto('/#/collection');
    await expect(page.locator('.dex-tile')).toHaveCount(151);
  });

  test('a mid-game save goes back to Kanto with its team and saved teams', async ({ page }) => {
    const save = fixture('journey/save-v3-journey.json');
    await startJourney(page, save, 'journey');
    await expect(page.locator('[data-chapter="johto"]')).toHaveAttribute('data-status', 'here');
    await expect(page.locator('[data-chapter="kanto"]')).toHaveAttribute('data-status', 'cleared');
    await expect(page.locator('[data-chapter="hoenn"]')).toHaveAttribute('data-status', 'locked');
    await reloadAfter(page, () => page.locator('[data-travel="kanto"]').click());
    const after = await storedJourney(page);
    expect(after.journey.active).toBe('kanto');
    expect(after.starter).toBe(4);
    expect(after.deck).toEqual(save.journey.slots.kanto.deck);
    expect(after.teams).toEqual(save.journey.slots.kanto.teams);
    expect(after.journey.slots.johto).toMatchObject({ starter: 152, deck: save.deck, teams: save.teams });
    expect(Object.keys(after.cards).sort()).toEqual(Object.keys(save.cards).sort());
    expect(after.coins).toBe(save.coins);
  });

  test('a League run in progress blocks travel and says so', async ({ page }) => {
    const save = withCarry(journeySave('kanto', ['kanto']));
    save.league.run = { seed: 7, duel: 1, bonus: 0, startedAt: 1, team: CARRY_TEAM, hp: {} };
    await startJourney(page, save, 'journey');
    await expect(page.locator('.jc-blocked')).toBeVisible();
    await expect(page.locator('[data-chapter="johto"]')).toHaveAttribute('data-status', 'ready');
    const buttons = page.locator('[data-travel]');
    expect(await buttons.count()).toBeGreaterThan(0);
    for (const button of await buttons.all()) await expect(button).toBeDisabled();
    await expect(page.locator('.onboard')).toHaveCount(0);
    expect((await storedJourney(page)).journey.active).toBe('kanto');
  });

  test('without the League run, travel is open', async ({ page }) => {
    const save = journeySave('kanto', ['kanto']);
    await startJourney(page, save, 'journey');
    await expect(page.locator('.jc-blocked')).toHaveCount(0);
    await expect(page.locator('[data-travel="johto"]')).toBeEnabled();
  });
});

test.describe('the World', () => {
  const worldSave = () => withCarry(journeySave('world', ['kanto', 'johto', 'hoenn', 'sinnoh']));

  test('opens with the Sinnoh title, and not before', async ({ page }) => {
    await startJourney(page, journeySave('kanto', ['kanto', 'johto', 'hoenn']), 'journey');
    await expect(page.locator('[data-chapter="world"]')).toHaveAttribute('data-status', 'locked');
    await expect(page.locator('[data-travel="world"]')).toHaveCount(0);
  });

  test('travels there from the map', async ({ page }) => {
    const save = journeySave('sinnoh', ['kanto', 'johto', 'hoenn', 'sinnoh']);
    save.journey.slots.kanto = { starter: 4, deck: ['4'], teams: [] }; // the World keeps the first chapter's starter
    await startJourney(page, save, 'journey');
    await expect(page.locator('[data-chapter="world"]')).toHaveAttribute('data-status', 'ready');
    await reloadAfter(page, () => page.locator('[data-travel="world"]').click());
    await expect(page.locator('[data-chapter-chip="world"]')).toBeAttached();
    expect((await storedJourney(page)).journey.active).toBe('world');
    await expect(page.locator('.onboard')).toHaveCount(0); // the World has no starter of its own
  });

  test('Capture has the region picker and the Pokédex shows every species', async ({ page }) => {
    await startJourney(page, worldSave(), 'capture');
    await expect(page.locator('[data-region]')).not.toHaveCount(0);
    await expect(page.locator('[data-region="0"]')).toBeVisible();
    await page.goto('/#/collection');
    await expect(page.locator('.dex-tile')).toHaveCount(493);
    await expect(page.locator('select[data-region]')).toBeAttached();
  });

  test('Tower, Ranked and the Master League are open', async ({ page }) => {
    await startJourney(page, worldSave(), 'battle');
    for (const mode of ['tower', 'competition', 'league', 'training', 'hunt']) await expect(modeCard(page, mode)).not.toHaveAttribute('aria-disabled', 'true');
    await page.goto('/#/battle/tower');
    await expect(page.locator('[data-act="climb"]')).toBeVisible();
    await page.goto('/#/battle/competition');
    await expect(page.locator('.lrow').first()).toBeVisible();
    await page.goto('/#/battle/league');
    await expect(page.locator('.league-locked')).toHaveCount(0);
    await expect(page.locator('[data-act="enter"]')).toBeVisible();
  });

  test('Gyms are locked, with the toast, and their page goes back to the hub', async ({ page }) => {
    await startJourney(page, worldSave(), 'battle');
    await expect(modeCard(page, 'gyms')).toHaveAttribute('aria-disabled', 'true');
    await modeCard(page, 'gyms').click({ force: true }); // aria-disabled, but a real tap still lands
    await expect(page.locator('.toast-warning')).toContainText('The World has no gyms');
    await expect(page).toHaveURL(/#\/battle$/);
    await page.goto('/#/battle/gyms');
    await expect(page).toHaveURL(/#\/battle$/);
  });

  test('Ranked with Ash shows for a No. 1 ladder save', async ({ page }) => {
    const save = worldSave();
    save.ladder.rating = 2001;
    save.ladder.best = 1;
    delete save.ladder.ash;
    await startJourney(page, save, 'battle/competition');
    await expect(page.locator('[data-act="ash"]')).toBeVisible();
    await expect(page.locator('.ash-card.is-locked')).toHaveCount(0);
  });
});

test.describe('battles in the Journey', () => {
  /** Six weak cards: the levels shown are the designed ones, with nothing trained up. */
  const weak = (save: Save, keys = ['19', '16', '10', '13', '129', '41']) => withTeam(save, 1, keys);

  test('Kanto gyms show the Journey levels (Brock 15)', async ({ page }) => {
    const save = weak(journeySave('kanto'));
    save.gyms = { badges: [], records: {} };
    await startJourney(page, save, 'battle/gyms');
    await expect(page.locator('.gym-scaled')).toHaveCount(0);
    await expect(page.locator('.gym-card').first().locator('.gym-levels')).toContainText('15');
    await expect(page.locator('.gym-card').first().locator('.gym-levels')).not.toContainText('20');
  });

  test('Johto\'s first gym is Lv. 20–24 in the Journey and Lv. 60–64 in Classic', async ({ page }) => {
    const journey = weak(journeySave('johto', ['kanto']), ['152', '153', '158', '161', '163', '165']);
    journey.gyms = { badges: ['boulder', 'cascade', 'thunder', 'rainbow', 'soul', 'marsh', 'volcano', 'earth'], records: {} };
    await startJourney(page, journey, 'battle/gyms');
    await expect(page.locator('[data-gym="falkner"]')).toBeVisible();
    await expect(page.locator('.gym-card').first().locator('.gym-levels')).toContainText('20–24');

    // Classic, same player: Johto opens after Kanto's badges, with its own levels.
    const classic = weak(midGameSave());
    classic.gyms = { badges: journey.gyms.badges, records: {} };
    await page.evaluate(raw => { localStorage.setItem('pg-save-guest', raw); localStorage.setItem('pg-track', 'classic'); }, JSON.stringify(classic));
    await page.reload();
    await expect(page.locator('.topbar')).toBeVisible();
    await page.locator('.region-tab[data-region="johto"]').click();
    await expect(page.locator('.gym-card').first().locator('.gym-levels')).toContainText('60–64');
  });

  test('a Kanto gym battle completes: badge and rewards', async ({ page }) => {
    const save = withCarry(journeySave('kanto'));
    save.gyms = { badges: [], records: {} };
    await startJourney(page, save, 'battle/gyms');
    await page.locator('[data-gym="brock"]').click();
    await playBattle(page);
    await closeOverlays(page);
    const after = await storedJourney(page);
    expect(after.gyms.badges).toEqual(['boulder']);
    expect(after.coins).toBe(save.coins + 250);
    expect(await rawItem(page, 'pg-save-guest'), 'Classic save').toBeNull();
  });

  test('a Johto gym battle completes with a Johto team', async ({ page }) => {
    const save = withTeam(journeySave('johto', ['kanto']), 5000, JOHTO_TEAM);
    save.gyms = { badges: ['boulder', 'cascade', 'thunder', 'rainbow', 'soul', 'marsh', 'volcano', 'earth'], records: {} };
    await startJourney(page, save, 'battle/gyms');
    await page.locator('[data-gym="falkner"]').click();
    await playBattle(page);
    await closeOverlays(page);
    const after = await storedJourney(page);
    expect(after.gyms.badges).toContain('zephyr');
    expect(after.stats.wins).toBe(save.stats.wins + 1);
  });

  test('the first League title offers the next chapter, and accepting starts Johto', async ({ page }) => {
    const save = withCarry(journeySave('kanto'));
    save.gyms = { badges: ['boulder', 'cascade', 'thunder', 'rainbow', 'soul', 'marsh', 'volcano', 'earth'], records: {} };
    save.league.run = { seed: 7, duel: 3, bonus: 0, startedAt: 1, team: CARRY_TEAM, hp: {} };
    await startJourney(page, save, 'battle/league');
    await page.locator('[data-act="fight"]').click();
    await playBattle(page);
    await toConfirmDialog(page);
    await expect(page.locator('.modal-dialog')).toContainText('Johto');
    expect((await storedJourney(page)).league.titles).toBe(1);
    await reloadAfter(page, () => page.locator('.modal-dialog [data-confirm]').click());
    await toStarters(page);
    expect(await starterIds(page)).toEqual(JOHTO_STARTERS);
    const after = await storedJourney(page);
    expect(after.journey.active).toBe('johto');
    expect(after.journey.slots.kanto.deck).toEqual(CARRY_TEAM);
  });
});

test('the journey map fits the screen and nothing on it is covered', async ({ page }) => {
  await startJourney(page, fixture('journey/save-v3-journey.json'), 'journey');
  await expect(page.locator('.jc-card')).toHaveCount(5);
  for (const lang of ['en', 'pt']) {
    await page.evaluate(l => localStorage.setItem('pg-lang', l), lang);
    await page.reload();
    await expect(page.locator('.jc-card')).toHaveCount(5);
    await expectNoSideScroll(page);
    for (const button of await page.locator('[data-travel]').all()) await expectFullyClickable(button);
    await expectNoSideScroll(page);
  }
});
