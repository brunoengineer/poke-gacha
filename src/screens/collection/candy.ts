// Rare Candy controls of the details modal (+1 / +10 / max) and the level-up effect.

import { sfx } from '../../audio';
import { itemSprite, RARE_CANDY } from '../../data/items';
import { parseKey, type CardKey } from '../../game/cards';
import { candyRoom } from '../../game/progression';
import { fmt, itemName, L, speciesName } from '../../i18n';
import { candies, useCandies } from '../../state/actions';
import { store } from '../../state/store';
import { animateNumber, confirmDialog, el, esc, reducedMotion, toast } from '../../ui/dom';
import { burst } from '../../ui/fx';

/** How many candies "max" would use (all the player has, up to the card's cap). */
const maxAmount = (key: CardKey) => Math.min(candies(), candyRoom(store.save, key));

export function candyHTML(key: CardKey): string {
  const t = L().collection.candy;
  const have = candies();
  const room = candyRoom(store.save, key);
  const max = maxAmount(key);
  const disabled = (n: number) => (have < 1 || room < 1 || (n > 1 && max < 2) ? 'disabled' : '');
  return `
    <div class="dx-candy ${have ? '' : 'empty'}">
      <span class="dx-candy-have" title="${esc(itemName(RARE_CANDY))}">
        <img src="${esc(itemSprite(RARE_CANDY))}" alt="" width="30" height="30">
        <span><small>${esc(itemName(RARE_CANDY))}</small><b>×${fmt(have)}</b></span>
      </span>
      <span class="dx-candy-btns" role="group" aria-label="${esc(t.use)}">
        <button class="btn btn-sm" type="button" data-act="candy" data-n="1" ${disabled(1)} aria-label="${esc(t.useN(1))}">+1</button>
        <button class="btn btn-sm" type="button" data-act="candy" data-n="10" ${disabled(10)} aria-label="${esc(t.useN(Math.min(10, max)))}">+10</button>
        <button class="btn btn-sm" type="button" data-act="candy" data-n="max" ${disabled(2)} aria-label="${esc(t.useN(max))}">${esc(t.max)}${max > 1 ? ` <small>+${fmt(max)}</small>` : ''}</button>
      </span>
    </div>
    ${room < 1 ? `<p class="hint">${esc(t.atCap)}</p>` : have < 1 ? `<p class="hint">${esc(t.none)}</p>` : ''}`;
}

/**
 * Uses candies on `key` and plays the level-up effect inside `root` (the details modal), whose content is
 * re-rendered by the 'cards' event in between. Returns the number of candies used.
 */
export async function feedCandy(root: HTMLElement, key: CardKey, which: string): Promise<number> {
  const t = L().collection.candy;
  const max = maxAmount(key);
  const amount = which === 'max' ? max : Math.min(Number(which), max);
  if (amount < 1) {
    sfx('error');
    return 0;
  }
  if (which === 'max' && amount >= 25) {
    const ok = await confirmDialog({ title: t.confirmTitle, message: t.confirmText(amount, speciesName(parseKey(key).id)), confirmText: t.useN(amount) });
    if (!ok) return 0;
  }
  const before = store.save.cards[key].level;
  const used = useCandies(key, amount);
  if (!used) return 0;
  const after = store.save.cards[key].level;

  sfx('candy');
  setTimeout(() => sfx('levelUp'), 160);
  toast(t.done(speciesName(parseKey(key).id), after), 'success', 1800);

  const levelNode = root.querySelector('[data-level]');
  if (levelNode) animateNumber(levelNode, before, after, 700);
  const art = root.querySelector<HTMLElement>('.dx-art');
  const card = art?.querySelector<HTMLElement>('.pcard');
  if (!art || !card || reducedMotion()) return used;

  card.animate([
    { filter: 'brightness(1)', scale: '1' },
    { filter: 'brightness(1.7) saturate(1.3)', scale: '1.05', offset: 0.35 },
    { filter: 'brightness(1)', scale: '1' },
  ], { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)' });
  burst(art.querySelector('.dx-particles'), { color: '#ffe27a', count: 14 + Math.min(used, 30), distance: 170, duration: 900, shape: 'star' });
  const pop = el(`<span class="dx-levelup">${esc(t.levelUp(used))}</span>`);
  art.append(pop);
  pop.animate([
    { opacity: 0, transform: 'translate(-50%, 10px) scale(.8)' },
    { opacity: 1, transform: 'translate(-50%, -14px) scale(1.05)', offset: 0.25 },
    { opacity: 0, transform: 'translate(-50%, -56px) scale(1)' },
  ], { duration: 1300, easing: 'ease-out' }).finished.then(() => pop.remove(), () => pop.remove());
  return used;
}
