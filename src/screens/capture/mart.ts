// Poké Mart tab: items for sale (quantity stepper + buy) and the player's bag (everything owned, by category).

import { sfx } from '../../audio';
import { getItem, ITEMS, itemSprite, type ItemCategory } from '../../data/items';
import { BANNER_ORDER } from '../../game/gacha';
import { fmt, itemDescription, itemName, L } from '../../i18n';
import { buyItem } from '../../state/actions';
import { store } from '../../state/store';
import { esc, icon, shakeCoins, toast } from '../../ui/dom';
import { burst } from '../../ui/fx';
import { BALL_ITEM } from './common';

const MAX_QTY = 99;
const quantities = new Map<string, number>();
const forSale = () => ITEMS.filter(item => item.price != null);
const qty = (id: string) => quantities.get(id) ?? 1;
const bannerOfBall = (item: string) => BANNER_ORDER.find(id => BALL_ITEM[id] === item);

function itemHTML(id: string) {
  const t = L().capture.mart;
  const price = getItem(id).price!;
  return `
    <article class="mart-item" data-item="${esc(id)}" aria-labelledby="mart-${esc(id)}">
      <div class="mart-shelf"><img src="${esc(itemSprite(id))}" alt="" width="60" height="60" loading="lazy"></div>
      <div class="mart-info">
        <h3 id="mart-${esc(id)}">${esc(itemName(id))}</h3>
        <p>${esc(itemDescription(id))}</p>
        <span class="mart-owned" data-owned></span>
      </div>
      <div class="mart-buy">
        <span class="mart-price">${icon('coin', 'i-coin')}${fmt(price)}</span>
        <div class="stepper" role="group" aria-label="${esc(t.quantity)}">
          <button type="button" data-step="-1" aria-label="${esc(t.less)}">${icon('minus')}</button>
          <output data-qty aria-live="polite">1</output>
          <button type="button" data-step="1" aria-label="${esc(t.more)}">${icon('plus')}</button>
        </div>
        <button class="btn btn-primary mart-btn" type="button" data-buy></button>
      </div>
    </article>`;
}

const CATEGORY_ORDER: ItemCategory[] = ['ball', 'candy', 'evolution'];

function bagHTML() {
  const t = L().capture.bag;
  const owned = Object.entries(store.save.items).filter(([, count]) => count > 0);
  if (!owned.length) return `<p class="bag-empty">${icon('bag')}<span>${esc(t.empty)}</span></p>`;
  return CATEGORY_ORDER.map(category => {
    const list = owned.filter(([id]) => getItem(id).category === category);
    if (!list.length) return '';
    return `
      <div class="bag-group">
        <h3 class="label">${esc(t.categories[category])}</h3>
        <ul class="bag-list">
          ${list.map(([id, count]) => {
            const banner = category === 'ball' ? bannerOfBall(id) : undefined;
            const action = banner
              ? `<button class="btn btn-secondary btn-sm" type="button" data-use-ball="${banner}">${esc(t.use)}</button>`
              : `<a class="btn btn-ghost btn-sm" href="#/collection">${esc(t.useInCollection)}</a>`;
            return `
              <li class="bag-item">
                <img src="${esc(itemSprite(id))}" alt="" width="44" height="44" loading="lazy">
                <span class="bag-info"><b>${esc(itemName(id))} <span class="bag-count">×${fmt(count)}</span></b><small>${esc(itemDescription(id))}</small></span>
                ${action}
              </li>`;
          }).join('')}
        </ul>
      </div>`;
  }).join('');
}

export function martHTML() {
  const t = L().capture;
  return `
    <section class="mart" aria-labelledby="mart-title">
      <div class="mart-head">
        <span class="mart-sign" aria-hidden="true">${icon('bag')}</span>
        <div>
          <h2 class="section-title" id="mart-title">${esc(t.mart.title)}</h2>
          <p class="view-sub">${esc(t.mart.subtitle)}</p>
        </div>
      </div>
      <div class="mart-grid">${forSale().map(item => itemHTML(item.id)).join('')}</div>
      <h2 class="section-title bag-title">${icon('bag')} ${esc(t.bag.title)}</h2>
      <div class="bag" data-bag></div>
    </section>`;
}

/** Updates prices, steppers and the bag (called on coins/items changes). */
export function refreshMart(root: HTMLElement) {
  const t = L().capture.mart;
  root.querySelectorAll<HTMLElement>('.mart-item').forEach(node => {
    const id = node.dataset.item!;
    const price = getItem(id).price!;
    const amount = qty(id);
    const total = price * amount;
    node.querySelector('[data-qty]')!.textContent = String(amount);
    node.querySelector('[data-owned]')!.textContent = t.inBag(store.save.items[id] ?? 0);
    const buy = node.querySelector<HTMLButtonElement>('[data-buy]')!;
    buy.innerHTML = `<span>${esc(t.buy)}</span><span class="cost">${icon('coin', 'i-coin')}${fmt(total)}</span>`;
    buy.setAttribute('aria-label', `${t.buyTotal(L().core.coins(total))}: ${itemName(id)} ×${amount}`);
    buy.classList.toggle('cant-afford', store.save.coins < total);
    node.querySelector<HTMLButtonElement>('[data-step="-1"]')!.disabled = amount <= 1;
    node.querySelector<HTMLButtonElement>('[data-step="1"]')!.disabled = amount >= MAX_QTY;
  });
  const bag = root.querySelector<HTMLElement>('[data-bag]');
  if (bag) bag.innerHTML = bagHTML();
}

/** Click handling for the Mart (delegated from the screen). Returns true when the click was handled. */
export function handleMartClick(root: HTMLElement, target: Element): boolean {
  const step = target.closest<HTMLElement>('[data-step]');
  if (step) {
    const id = step.closest<HTMLElement>('.mart-item')!.dataset.item!;
    quantities.set(id, Math.max(1, Math.min(MAX_QTY, qty(id) + Number(step.dataset.step))));
    sfx('click');
    refreshMart(root);
    return true;
  }
  const buy = target.closest<HTMLElement>('[data-buy]');
  if (buy) {
    const node = buy.closest<HTMLElement>('.mart-item')!;
    const id = node.dataset.item!;
    const amount = qty(id);
    const total = getItem(id).price! * amount;
    if (!buyItem(id, amount)) {
      sfx('error');
      shakeCoins();
      toast(L().core.notEnoughCoins(total), 'error');
      return true;
    }
    sfx('buy');
    quantities.set(id, 1);
    toast(L().capture.mart.bought(itemName(id), amount), 'success');
    const shelf = node.querySelector('.mart-shelf')!;
    shelf.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15) rotate(-6deg)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' });
    burst(shelf, { color: '#f4dca3', count: 14, distance: 70, duration: 650 });
    refreshMart(root);
    return true;
  }
  return false;
}

