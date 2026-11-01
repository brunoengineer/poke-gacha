// Banner cards (one per ball) and the odds panel. Banners are rendered once; refreshBanner() updates the parts
// that change (affordability, owned balls, pity, lock state) in place, so focus and hover states survive.

import { spriteImg } from '../../ui/card';
import { getSpecies } from '../../data/species';
import { spriteUrl } from '../../data/sprites';
import { rarity, rarityRank, RARITIES, RARITY_COLOR, type Rarity } from '../../game/cards';
import {
  BANNERS, bannerOdds, canAfford, canUseBanner, rarityOdds, safariFeatured, type BannerId, type Payment,
} from '../../game/gacha';
import { itemCount } from '../../game/progression';
import { dayKey, hashString, seeded, shuffle } from '../../game/rng';
import { fmt, getLang, itemName, L } from '../../i18n';
import { store } from '../../state/store';
import { esc, icon } from '../../ui/dom';
import { ballHTML, ballSprite, bannerName, costHTML, costText, rarityName } from './common';

/** Rarities shown in each banner's art (a daily pick, so the banners feel alive). */
const SHOWCASE: Record<Exclude<BannerId, 'safari'>, Rarity[]> = {
  poke: ['common', 'uncommon'],
  great: ['rare'],
  ultra: ['epic'],
  master: ['legendary', 'mythical'],
};

export function showcase(id: BannerId): number[] {
  if (id === 'safari') return safariFeatured();
  const wanted = SHOWCASE[id];
  const odds = bannerOdds(id);
  const pool = odds.filter(o => wanted.includes(rarity(o.id))).map(o => o.id);
  const rng = seeded(hashString(`showcase:${id}:${dayKey()}`));
  return shuffle(pool.length >= 3 ? pool : odds.map(o => o.id), rng).slice(0, 3);
}

const percent = (value: number) => {
  const digits = value < 0.001 ? 3 : value < 0.1 ? 2 : 1;
  return `${(value * 100).toLocaleString(getLang() === 'pt' ? 'pt-BR' : 'en-US', { maximumFractionDigits: digits })}%`;
};

function pullButton(id: BannerId, count: number, payWith: Payment) {
  const t = L().capture;
  const label = t.pullLabel(count, bannerName(id), costText(id, count, payWith));
  return `
    <button class="pull-btn ${payWith === 'ticket' ? 'pull-btn-ball' : ''}" type="button" data-pull="${id}" data-count="${count}" data-pay="${payWith}" aria-label="${esc(label)}">
      <span class="pull-count">×${fmt(count)}</span>
      ${costHTML(id, count, payWith)}
    </button>`;
}

function actionsHTML(id: BannerId) {
  const t = L().capture;
  const banner = BANNERS[id];
  const coinRow = banner.cost != null
    ? `<div class="pull-row" role="group" aria-label="${esc(t.payCoins)}">${banner.counts.map(c => pullButton(id, c, 'coins')).join('')}</div>`
    : '';
  const ticketRow = banner.ticket
    ? `<div class="pull-row-label" data-ticket-label></div>
       <div class="pull-row" role="group" data-ticket-row>${banner.counts.map(c => pullButton(id, c, 'ticket')).join('')}</div>`
    : '';
  return coinRow + ticketRow;
}

function lockHTML(id: BannerId) {
  const t = L().capture;
  const need = BANNERS[id].badges;
  const have = store.save.gyms.badges.length;
  return `
    <div class="banner-lock">
      <span class="banner-lock-icon">${icon('lock')}</span>
      <b>${esc(t.locked(need))}</b>
      <span class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${need}" aria-valuenow="${have}"><i style="width:${(have / need) * 100}%"></i></span>
      <small>${esc(t.lockedProgress(have, need))}</small>
      <a class="btn btn-secondary btn-sm" href="#/battle/gyms">${icon('medal')} ${esc(t.goGyms)}</a>
    </div>`;
}

export function bannerHTML(id: BannerId) {
  const t = L().capture;
  const text = t.banners[id];
  const banner = BANNERS[id];
  const ids = showcase(id);
  const locked = !canUseBanner(store.save, id);
  return `
    <article class="banner" data-banner="${id}" ${locked ? 'data-locked="true"' : ''} aria-labelledby="banner-${id}-title">
      <div class="banner-art" aria-hidden="true">
        <span class="banner-glow"></span>
        ${ballHTML(id, 150, 'banner-ball')}
        <div class="banner-mons">
          ${ids.map(mon => `<span class="banner-mon" style="--rc:${RARITY_COLOR[rarity(mon)]}">${spriteImg(mon, false, { alt: '' })}</span>`).join('')}
        </div>
        <span class="banner-chip">${id === 'safari' ? esc(t.featuredToday) : esc(t.showcase)}</span>
      </div>
      <div class="banner-body">
        <p class="banner-kicker">${ballSprite(id, 22)}<span>${esc(text.kicker)}</span></p>
        <h2 class="banner-title" id="banner-${id}-title">${esc(text.name)}</h2>
        <p class="banner-text">${esc(text.text)}</p>
        ${id === 'safari' ? `<p class="banner-featured">${ids.map(mon => `<span>${esc(getSpecies(mon).name)}</span>`).join('')}</p>` : ''}
        <div class="banner-meta">
          <span class="badge badge-gold">${icon('sparkle')}${esc(t.shinyRate(Math.round(1 / banner.shinyRate)))}</span>
          ${banner.pity ? '<span class="banner-pity" data-pity></span>' : ''}
        </div>
        <div class="banner-actions" data-actions>${locked ? lockHTML(id) : actionsHTML(id)}</div>
        ${id === 'master' ? `<p class="banner-hint" data-master-hint>${esc(t.masterHint)}</p>` : ''}
      </div>
    </article>`;
}

/** Updates a banner's dynamic parts. Re-renders its actions only when the lock state flips. */
export function refreshBanner(node: HTMLElement) {
  const id = node.dataset.banner as BannerId;
  const t = L().capture;
  const banner = BANNERS[id];
  const save = store.save;
  const locked = !canUseBanner(save, id);
  const actions = node.querySelector<HTMLElement>('[data-actions]')!;
  if (locked !== (node.dataset.locked === 'true')) {
    node.toggleAttribute('data-locked', locked);
    if (locked) node.dataset.locked = 'true';
    actions.innerHTML = locked ? lockHTML(id) : actionsHTML(id);
  }

  node.querySelectorAll<HTMLButtonElement>('[data-pull]').forEach(button => {
    const ok = canAfford(save, id, Number(button.dataset.count), button.dataset.pay as Payment);
    button.classList.toggle('cant-afford', !ok);
  });

  if (banner.ticket) {
    const owned = itemCount(save, banner.ticket);
    const label = node.querySelector('[data-ticket-label]');
    if (label) label.innerHTML = `${ballSprite(id, 18)}<span>${esc(t.payBalls(itemName(banner.ticket), owned))}</span>`;
    // Ball buttons only make sense when the player has at least one ball (Master Ball always shows its button).
    const row = node.querySelector<HTMLElement>('[data-ticket-row]');
    const hide = owned === 0 && banner.cost != null;
    if (row) row.hidden = hide;
    if (label) (label as HTMLElement).hidden = hide;
    node.querySelector<HTMLElement>('[data-master-hint]')?.toggleAttribute('hidden', owned > 0);
  }

  const pity = node.querySelector<HTMLElement>('[data-pity]');
  if (pity && banner.pity) {
    const count = save.pity[id] ?? 0;
    const left = banner.pity.every - count;
    pity.innerHTML = `
      <span class="pity-text">${esc(t.pity(left, rarityName(banner.pity.min)))}</span>
      <span class="pity-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${banner.pity.every}" aria-valuenow="${count}" aria-label="${esc(t.pity(left, rarityName(banner.pity.min)))}">
        ${Array.from({ length: banner.pity.every }, (_, i) => `<i class="${i < count ? 'on' : ''}"></i>`).join('')}
      </span>`;
    pity.style.setProperty('--rc', RARITY_COLOR[banner.pity.min]);
  }
}

// --- Odds panel ---------------------------------------------------------------------

export function oddsHTML() {
  const t = L().capture;
  return `
    <details class="odds" data-odds>
      <summary>${icon('chevron')}<span>${esc(t.odds.title)}</span></summary>
      <div class="odds-body">
        <div class="seg odds-tabs" role="tablist" aria-label="${esc(t.odds.pick)}">
          ${Object.keys(BANNERS).map((id, i) => `
            <button type="button" role="tab" class="seg-btn" data-odds-tab="${id}" aria-selected="${i === 0}">${ballSprite(id as BannerId, 18)}<span>${esc(bannerName(id as BannerId))}</span></button>`).join('')}
        </div>
        <div class="odds-panel" role="tabpanel" data-odds-panel></div>
      </div>
    </details>`;
}

export function renderOdds(panel: HTMLElement, id: BannerId) {
  const t = L().capture;
  const banner = BANNERS[id];
  const byRarity = rarityOdds(id);
  const species = bannerOdds(id);
  const notes = [
    banner.pity ? t.odds.pityNote(banner.pity.every, rarityName(banner.pity.min)) : '',
    id === 'safari' ? t.odds.safariNote : '',
    id === 'master' ? t.odds.masterNote : '',
  ].filter(Boolean);
  panel.innerHTML = `
    <div class="odds-cols">
      <div>
        <h3 class="label">${esc(t.odds.byRarity)}</h3>
        <ul class="odds-rarity">
          ${RARITIES.filter(r => byRarity[r] > 0).map(r => `
            <li style="--rc:${RARITY_COLOR[r]}">
              <span class="odds-name">${esc(rarityName(r))}</span>
              <span class="odds-bar"><i style="width:${Math.max(1.5, byRarity[r] * 100)}%"></i></span>
              <b>${percent(byRarity[r])}</b>
            </li>`).join('')}
        </ul>
      </div>
      <div class="odds-side">
        <h3 class="label">${esc(t.odds.shiny)}</h3>
        <p class="odds-shiny">${icon('sparkle')}<b>1/${fmt(Math.round(1 / banner.shinyRate))}</b><span>${percent(banner.shinyRate)}</span></p>
        ${notes.map(note => `<p class="odds-note">${esc(note)}</p>`).join('')}
      </div>
    </div>
    <details class="odds-species">
      <summary>${icon('chevron')}<span>${esc(t.odds.species(species.length))}</span></summary>
      <ol class="odds-list" data-species-list></ol>
    </details>`;
  const list = panel.querySelector<HTMLElement>('[data-species-list]')!;
  // The full list (151+ rows) is only built when opened.
  panel.querySelector('.odds-species')!.addEventListener('toggle', () => {
    if (list.childElementCount) return;
    list.innerHTML = species.map(({ id: mon, chance }) => {
      const r = rarity(mon);
      return `
        <li style="--rc:${RARITY_COLOR[r]}" data-rank="${rarityRank(r)}">
          <img src="${esc(spriteUrl(mon))}" alt="" width="40" height="40" loading="lazy">
          <span class="odds-mon"><b>${esc(getSpecies(mon).name)}</b><small>${esc(rarityName(r))}</small></span>
          <span class="odds-pct">${percent(chance)}</span>
        </li>`;
    }).join('');
  });
}
