// Daily gift card on the Capture screen: shows today's reward and the week track (a Master Ball every 7th day),
// opens with a small gift animation, then stays as a compact "come back tomorrow" card.

import { sfx } from '../../audio';
import { itemSprite } from '../../data/items';
import { DAILY_BALL, DAILY_BALL_EVERY, dailyGift } from '../../game/economy';
import { previousDayKey } from '../../game/rng';
import { fmt, itemName, L } from '../../i18n';
import { claimDaily, dailyAvailable } from '../../state/actions';
import { store } from '../../state/store';
import { esc, icon } from '../../ui/dom';
import { burst, Sequence } from '../../ui/fx';

/** Streak the player would reach by claiming today. */
function nextStreak(now = new Date()) {
  const { last, streak } = store.save.daily;
  return last === previousDayKey(now) ? streak + 1 : 1;
}

function trackHTML(day: number, claimed: boolean) {
  const t = L().capture.daily;
  const pos = ((day - 1) % DAILY_BALL_EVERY) + 1;
  return `
    <ol class="daily-track" aria-label="${esc(t.trackLabel(pos))}">
      ${Array.from({ length: DAILY_BALL_EVERY }, (_, i) => {
        const n = i + 1;
        const state = n < pos || (claimed && n === pos) ? 'done' : n === pos ? 'today' : '';
        const ball = n === DAILY_BALL_EVERY ? `<img src="${esc(itemSprite(DAILY_BALL))}" alt="" width="24" height="24">` : '';
        return `<li class="${state}">${ball || (state === 'done' ? icon('check') : `<span>${n}</span>`)}</li>`;
      }).join('')}
    </ol>`;
}

function rewardChips(day: number) {
  const gift = dailyGift(day);
  return `
    <span class="daily-chip">${icon('coin', 'i-coin')}${fmt(gift.coins)}</span>
    <span class="daily-chip"><img src="${esc(itemSprite('rare-candy'))}" alt="" width="22" height="22">${esc(itemName('rare-candy'))} ×${gift.candy}</span>
    ${gift.ball ? `<span class="daily-chip"><img src="${esc(itemSprite(gift.ball))}" alt="" width="22" height="22">${esc(itemName(gift.ball))}</span>` : ''}`;
}

export function dailyHTML() {
  const t = L().capture.daily;
  if (dailyAvailable()) {
    const day = nextStreak();
    return `
      <section class="daily" data-daily="ready" aria-labelledby="daily-title">
        <span class="daily-gift" aria-hidden="true"><span class="gift-lid"></span><span class="gift-box"></span></span>
        <div class="daily-body">
          <p class="daily-kicker">${esc(t.day(day))}</p>
          <h2 class="daily-title" id="daily-title">${esc(t.title)}</h2>
          <p class="daily-text">${esc(t.ready)}</p>
          ${trackHTML(day, false)}
        </div>
        <div class="daily-side">
          <div class="daily-rewards">${rewardChips(day)}</div>
          <button class="btn btn-primary btn-lg" type="button" data-claim>${icon('gift')} ${esc(t.claim)}</button>
        </div>
      </section>`;
  }
  const streak = Math.max(1, store.save.daily.streak);
  return `
    <section class="daily is-claimed" data-daily="claimed" aria-labelledby="daily-title">
      <span class="daily-done" aria-hidden="true">${icon('check')}</span>
      <div class="daily-body">
        <h2 class="daily-title" id="daily-title">${esc(t.claimedTitle)}</h2>
        <p class="daily-text">${esc(t.streak(streak))} · ${esc(t.tomorrow(L().core.coins(dailyGift(streak + 1).coins)))}</p>
      </div>
      ${trackHTML(streak, true)}
    </section>`;
}

/** Claims the gift and plays the opening animation inside the card. */
export async function claim(card: HTMLElement) {
  const t = L().capture.daily;
  const button = card.querySelector<HTMLButtonElement>('[data-claim]');
  if (button) button.disabled = true;
  const gift = card.querySelector<HTMLElement>('.daily-gift');
  const seq = new Sequence();
  if (gift) {
    await seq.anim(gift, [
      { transform: 'rotate(0)' }, { transform: 'rotate(-10deg) scale(1.05)' }, { transform: 'rotate(9deg) scale(1.08)' },
      { transform: 'rotate(-6deg) scale(1.1)' }, { transform: 'rotate(0) scale(1.12)' },
    ], { duration: 520, easing: 'ease-in-out' });
  }
  const result = claimDaily();
  if (!result) {
    card.outerHTML = dailyHTML();
    return;
  }
  sfx('daily');
  if (gift) {
    seq.anim(gift.querySelector('.gift-lid')!, [{ transform: 'none', opacity: 1 }, { transform: 'translate(18px, -46px) rotate(28deg)', opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
    burst(gift, { color: '#f2c94c', count: 30, distance: 140, duration: 900 });
    burst(gift, { color: '#fff3c4', count: 10, distance: 90, duration: 800, shape: 'star' });
  }
  card.classList.add('is-opened');
  card.dataset.daily = 'opened';
  card.querySelector('.daily-kicker')!.textContent = t.day(result.streak);
  card.querySelector('.daily-title')!.textContent = t.gotTitle(result.streak);
  card.querySelector('.daily-text')!.textContent = t.gotText;
  card.querySelector('.daily-track')!.outerHTML = trackHTML(result.streak, true);
  const side = card.querySelector<HTMLElement>('.daily-side')!;
  side.innerHTML = `<div class="daily-rewards is-got">${rewardChips(result.streak).replace(/daily-chip/g, 'daily-chip daily-chip-got')}</div>`;
}
