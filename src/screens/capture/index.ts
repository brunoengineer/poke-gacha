// Capture screen (#/capture, #/capture/mart): the daily gift, one banner per ball, the odds panel and recent
// captures on the first tab; the Poké Mart and the bag on the second. Pulls go through capture() and then play
// the right animation for the batch size (×1, ×10, or the catch summary for ×50/×100).

import { sfx } from '../../audio';
import { BANNERS, BANNER_ORDER, batchCost, canAfford, canUseBanner, type BannerId, type Payment } from '../../game/gacha';
import { getSpecies } from '../../data/species';
import { parseKey } from '../../game/cards';
import { dayKey } from '../../game/rng';
import { itemName, L } from '../../i18n';
import { capture } from '../../state/actions';
import { on, store } from '../../state/store';
import { cardHTML } from '../../ui/card';
import { esc, icon, shakeCoins, toast } from '../../ui/dom';
import type { ViewModule } from '../types';
import { bannerHTML, oddsHTML, refreshBanner, renderOdds } from './banners';
import { evolvableKeys, newlyEvolvable, pushHistory, readHistory, type HistoryEntry } from './common';
import { claim, dailyHTML } from './daily';
import { handleMartClick, martHTML, refreshMart } from './mart';
import type { PullContext, PullExit } from './overlay';
import { playMulti, playSingle } from './pull-animation';
import { playSummary } from './summary';

type Tab = 'capture' | 'mart';

let view: HTMLElement;
let tab: Tab = 'capture';
let busy = false;
/** Day the banners were drawn for (the Safari's featured families change daily). */
let renderedDay = '';

function headHTML() {
  const t = L().capture;
  const tabLink = (id: Tab, iconName: string, label: string) =>
    `<a class="seg-btn" role="tab" id="cap-tab-${id}" href="#/capture${id === 'mart' ? '/mart' : ''}" data-tab="${id}" aria-controls="cap-panel-${id}">${icon(iconName)}<span>${esc(label)}</span></a>`;
  return `
    <div class="view-head cap-head">
      <div>
        <h1 class="view-title">${esc(t.title)}</h1>
        <p class="view-sub">${esc(t.subtitle)}</p>
      </div>
      <nav class="seg cap-tabs" role="tablist" aria-label="${esc(t.tabs.label)}">
        ${tabLink('capture', 'ball', t.tabs.capture)}
        ${tabLink('mart', 'bag', t.tabs.mart)}
      </nav>
    </div>`;
}

function historyHTML(entries: HistoryEntry[]) {
  const t = L().capture.history;
  if (!entries.length) return `<p class="history-empty">${icon('ball')}<span>${esc(t.empty)}</span></p>`;
  return `<div class="history-row">${entries.map(e => `
    <div class="history-item">
      ${cardHTML({ id: e.id, shiny: e.shiny }, { size: 'xs' })}
      ${e.isNew ? `<span class="new-dot" title="${esc(L().capture.pull.tagNew)}"></span>` : ''}
    </div>`).join('')}</div>`;
}

function render() {
  const t = L().capture;
  renderedDay = dayKey();
  view.innerHTML = `
    ${headHTML()}
    <div class="cap-panel" id="cap-panel-capture" role="tabpanel" aria-labelledby="cap-tab-capture" data-panel="capture">
      <div data-daily-slot>${dailyHTML()}</div>
      <div class="banners">${BANNER_ORDER.map(bannerHTML).join('')}</div>
      ${oddsHTML()}
      <section class="history" aria-labelledby="cap-history-title">
        <h2 class="section-title" id="cap-history-title">${esc(t.history.title)}</h2>
        <div data-history>${historyHTML(readHistory())}</div>
      </section>
    </div>
    <div class="cap-panel" id="cap-panel-mart" role="tabpanel" aria-labelledby="cap-tab-mart" data-panel="mart" hidden>
      ${martHTML()}
    </div>`;
  renderOdds(view.querySelector('[data-odds-panel]')!, 'poke');
  refreshAll();
}

function refreshBanners() {
  view.querySelectorAll<HTMLElement>('.banner').forEach(refreshBanner);
}

function refreshAll() {
  refreshBanners();
  refreshMart(view.querySelector('[data-panel="mart"]')!);
}

function setTab(next: Tab) {
  tab = next;
  view.querySelectorAll<HTMLElement>('[data-tab]').forEach(link => {
    const active = link.dataset.tab === tab;
    link.setAttribute('aria-selected', String(active));
    link.tabIndex = active ? 0 : -1;
  });
  view.querySelectorAll<HTMLElement>('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== tab; });
}

/** Re-renders the daily card when its state is stale (a new day started while the app was open). */
function refreshDaily() {
  const slot = view.querySelector<HTMLElement>('[data-daily-slot]')!;
  const card = slot.firstElementChild as HTMLElement | null;
  if (card?.dataset.daily === 'opened') return;
  const ready = card?.dataset.daily === 'ready';
  const fresh = dailyHTML();
  if (!card || ready !== fresh.includes('data-daily="ready"')) slot.innerHTML = fresh;
}

// --- Pulling -------------------------------------------------------------------

function playFor(results: NonNullable<ReturnType<typeof capture>>, ctx: PullContext): Promise<PullExit> {
  if (results.length === 1) return playSingle(results[0], ctx);
  if (results.length <= 10) return playMulti(results, ctx);
  return playSummary(results, ctx);
}

async function pull(banner: BannerId, count: number, payWith: Payment) {
  if (busy) return;
  const t = L().capture;
  const save = store.save;
  if (!canUseBanner(save, banner)) {
    sfx('error');
    toast(t.bannerLocked, 'warning');
    return;
  }
  if (!canAfford(save, banner, count, payWith)) {
    sfx('error');
    if (payWith === 'coins') {
      shakeCoins();
      toast(L().core.notEnoughCoins(batchCost(banner, count, 'coins')!.coins), 'error');
    } else {
      toast(t.notEnoughBalls(itemName(BANNERS[banner].ticket!)), 'error');
    }
    return;
  }

  busy = true;
  const before = evolvableKeys();
  const results = capture(banner, count, payWith);
  if (!results) {
    busy = false;
    return;
  }
  view.querySelector('[data-history]')!.innerHTML = historyHTML(pushHistory(results));
  const ctx: PullContext = { banner, count, payWith, evolvable: newlyEvolvable(results, before) };
  const exit = await playFor(results, ctx);
  busy = false;

  if (exit === 'again') return pull(banner, count, payWith);
  if (exit === 'close' && ctx.evolvable.length) {
    const p = t.pull;
    const msg = ctx.evolvable.length === 1 ? p.canEvolve(getSpecies(parseKey(ctx.evolvable[0]).id).name) : p.canEvolveMany(ctx.evolvable.length);
    toast(msg, 'success', 4000);
  }
}

function useBall(banner: BannerId) {
  location.hash = '#/capture';
  requestAnimationFrame(() => {
    const node = view.querySelector<HTMLElement>(`.banner[data-banner="${banner}"]`);
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node?.querySelector<HTMLElement>('[data-pay="ticket"]:not(.cant-afford), [data-pull]')?.focus({ preventScroll: true });
  });
}

// --- View ------------------------------------------------------------------------

function onClick(event: MouseEvent) {
  const target = event.target as Element;
  const pullButton = target.closest<HTMLElement>('[data-pull]');
  if (pullButton) {
    void pull(pullButton.dataset.pull as BannerId, Number(pullButton.dataset.count), pullButton.dataset.pay as Payment);
    return;
  }
  const claimButton = target.closest('[data-claim]');
  if (claimButton) {
    void claim(claimButton.closest<HTMLElement>('.daily')!);
    return;
  }
  const oddsTab = target.closest<HTMLElement>('[data-odds-tab]');
  if (oddsTab) {
    sfx('tab');
    view.querySelectorAll('[data-odds-tab]').forEach(b => b.setAttribute('aria-selected', String(b === oddsTab)));
    renderOdds(view.querySelector('[data-odds-panel]')!, oddsTab.dataset.oddsTab as BannerId);
    return;
  }
  const ball = target.closest<HTMLElement>('[data-use-ball]');
  if (ball) {
    useBall(ball.dataset.useBall as BannerId);
    return;
  }
  if (target.closest('[data-panel="mart"]')) handleMartClick(view.querySelector('[data-panel="mart"]')!, target);
}

/** Arrow keys move between tabs (screen tabs and odds tabs). */
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  const current = (event.target as Element).closest<HTMLElement>('[role="tab"]');
  const list = current?.closest('[role="tablist"]');
  if (!current || !list) return;
  const tabs = [...list.querySelectorAll<HTMLElement>('[role="tab"]')];
  const next = tabs[(tabs.indexOf(current) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
  event.preventDefault();
  next.focus();
  next.click();
}

export const captureView: ViewModule = {
  mount(section) {
    view = section;
    view.classList.add('capture-view');
    render();
    view.addEventListener('click', onClick);
    view.addEventListener('keydown', onKeydown);
    on('coins', refreshAll);
    on('items', refreshAll);
    on('progress', refreshBanners);
  },
  show(arg) {
    if (renderedDay !== dayKey()) render();
    setTab(arg === 'mart' ? 'mart' : 'capture');
    refreshDaily();
    refreshAll();
  },
};
