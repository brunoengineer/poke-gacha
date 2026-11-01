// Reward reveal modal, shared by every mode (battle wins, milestones, league placements, daily gift).
//
// API contract: showRewards(applied, { title, subtitle }) -> Promise that resolves when the player closes it.
// rewardItemHTML(reward) renders one reward tile (final state, no animation) for screens that list rewards.
//
// The reveal: the crest pops in with particles, then each reward pops in turn (coins count up, cards get a
// burst in their rarity color, shinies sparkle). Tapping the panel skips straight to the end.

import { playCry, sfx } from '../audio';
import { itemSprite } from '../data/items';
import { rarity, RARITY_COLOR, rarityRank } from '../game/cards';
import type { AppliedReward } from '../game/rewards';
import { fmt, itemName, L } from '../i18n';
import { cardHTML } from './card';
import { animateNumber, esc, icon, openModal } from './dom';
import { burst, Sequence } from './fx';

export interface RewardsOptions {
  title?: string;
  subtitle?: string;
  /** Badge display names, by badge id (the gyms module knows them). */
  badgeNames?: Record<string, string>;
  /** Badge image URLs, by badge id. */
  badgeImages?: Record<string, string>;
  /** Icon id for the crest above the title (default 'trophy'; 'gift' fits the daily gift). */
  crest?: string;
  /** Color scheme: gold (default), 'lose' (muted red, for consolation prizes) or 'champion' (stars, bigger burst). */
  tone?: 'default' | 'lose' | 'champion';
}

export function rewardItemHTML(r: AppliedReward, opts: RewardsOptions = {}): string {
  const t = L().core.rewards;
  switch (r.kind) {
    case 'coins':
      return `
        <div class="reward reward-coins">
          <span class="reward-art">${icon('coin', 'i-coin')}</span>
          <b class="reward-amount" data-amount="${r.amount}">${esc(t.coins(r.amount))}</b>
          <small class="reward-label">${esc(L().core.currency)}</small>
        </div>`;
    case 'item':
      return `
        <div class="reward reward-item">
          <span class="reward-art"><img class="reward-sprite" src="${esc(itemSprite(r.item))}" alt="" width="30" height="30"></span>
          ${r.amount > 1 ? `<span class="reward-qty">×${fmt(r.amount)}</span>` : ''}
          <b class="reward-name">${esc(itemName(r.item))}</b>
          <span class="sr-only">${esc(t.item(itemName(r.item), r.amount))}</span>
        </div>`;
    case 'badge': {
      const name = opts.badgeNames?.[r.badge] ?? r.badge;
      const image = opts.badgeImages?.[r.badge];
      return `
        <div class="reward reward-badge">
          <span class="reward-art">${image ? `<img class="reward-sprite" src="${esc(image)}" alt="">` : icon('medal')}</span>
          <b class="reward-name">${esc(t.badge(name))}</b>
        </div>`;
    }
    case 'card': {
      const copy = r.copy;
      const level = copy?.to ?? 1;
      const kind = copy?.kind ?? 'new';
      const tag = kind === 'new'
        ? `<span class="new-tag">${esc(t.newCard)}</span>`
        : '';
      const note = kind === 'new' ? '' : kind === 'max' ? t.maxed : t.levelUp(copy!.from, copy!.to);
      return `
        <div class="reward reward-card" data-rarity="${rarity(r.id)}"${r.shiny ? ' data-shiny="true"' : ''}>
          <span class="reward-card-wrap">${cardHTML({ id: r.id, shiny: r.shiny, level }, { size: 'sm', eager: true, extra: tag })}</span>
          ${note ? `<small class="reward-note">${esc(note)}</small>` : ''}
        </div>`;
    }
  }
}

const CREST_COLOR = { default: '#f4dca3', lose: '#ffb9b9', champion: '#ffe27a' };

export function showRewards(applied: AppliedReward[], opts: RewardsOptions = {}): Promise<void> {
  const tone = opts.tone ?? 'default';
  const title = opts.title ?? L().core.rewards.title;
  const seq = new Sequence();
  return new Promise(resolve => {
    const modal = openModal({
      className: `modal-rewards rewards-${tone}`,
      label: title,
      onClose: () => {
        seq.skip();
        resolve();
      },
      html: `
        <div class="rewards${seq.skipped ? '' : ' is-staged'}">
          <div class="rewards-crest">
            <span class="rewards-rays" aria-hidden="true"></span>
            ${icon(opts.crest ?? (tone === 'champion' ? 'crown' : tone === 'lose' ? 'flag' : 'trophy'))}
          </div>
          <h2 class="rewards-title">${esc(title)}</h2>
          ${opts.subtitle ? `<p class="rewards-sub">${esc(opts.subtitle)}</p>` : ''}
          ${applied.length ? `<div class="rewards-list">${applied.map(r => rewardItemHTML(r, opts)).join('')}</div>` : ''}
          <button class="btn btn-primary btn-lg rewards-continue" type="button" data-close autofocus>${esc(L().core.actions.continue)}</button>
          <p class="rewards-skip" aria-hidden="true">${esc(L().core.actions.skip)}</p>
        </div>`,
    });

    // Tall reveals scroll: start at the crest even though focus lands on the button.
    requestAnimationFrame(() => requestAnimationFrame(() => { modal.root.scrollTop = 0; }));
    const root = modal.root.querySelector<HTMLElement>('.rewards')!;
    const crest = root.querySelector<HTMLElement>('.rewards-crest')!;
    const tiles = [...root.querySelectorAll<HTMLElement>('.reward')];

    const finish = (skipping = false) => {
      seq.skip();
      root.classList.remove('is-staged');
      root.classList.add('is-done');
      tiles.forEach(tile => tile.classList.add('is-in'));
      if (skipping) root.querySelectorAll<HTMLElement>('.reward-amount').forEach(node => {
        const amount = Number(node.dataset.amount);
        animateNumber(node, amount, amount, 0, value => L().core.rewards.coins(value));
      });
    };
    root.addEventListener('click', event => {
      if (!(event.target as Element).closest('[data-close]')) finish(true);
    });

    void (async () => {
      sfx(tone === 'lose' ? 'close' : 'open');
      await seq.anim(crest, [{ transform: 'scale(.3) rotate(-25deg)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.2,.9,.3,1.3)' });
      if (tone !== 'lose') {
        burst(crest, { color: CREST_COLOR[tone], count: tone === 'champion' ? 46 : 30, distance: tone === 'champion' ? 240 : 180 });
        if (tone === 'champion') burst(crest, { color: '#fff4c2', count: 18, distance: 200, shape: 'star' });
      }
      for (const [i, tile] of tiles.entries()) {
        if (seq.skipped) break;
        await seq.wait(i ? 170 : 220);
        if (seq.skipped) break;
        reveal(tile, applied[i]);
      }
      await seq.wait(250);
      finish();
    })();

    function reveal(tile: HTMLElement, reward: AppliedReward) {
      tile.classList.add('is-in');
      if (reward.kind === 'coins') {
        sfx('coin');
        const node = tile.querySelector('.reward-amount')!;
        animateNumber(node, 0, reward.amount, Math.min(1400, 500 + reward.amount / 8), value => L().core.rewards.coins(value));
      } else if (reward.kind === 'card') {
        const r = rarity(reward.id);
        sfx(reward.copy?.kind === 'new' ? 'newCard' : 'levelUp');
        if (reward.copy?.kind === 'new' && rarityRank(r) >= rarityRank('epic')) playCry(reward.id);
        const art = tile.querySelector('.reward-card-wrap');
        burst(art, { color: RARITY_COLOR[r], count: 22, distance: 130 });
        if (reward.shiny) {
          sfx('shiny');
          burst(art, { color: '#fff1b0', count: 16, distance: 120, shape: 'star' });
        }
      } else if (reward.kind === 'badge') {
        sfx('badge');
        burst(tile.querySelector('.reward-art'), { color: '#f4dca3', count: 20, distance: 110, shape: 'star' });
      } else {
        sfx('click');
        burst(tile.querySelector('.reward-art'), { color: '#cfe1ff', count: 10, distance: 70 });
      }
    }
  });
}
