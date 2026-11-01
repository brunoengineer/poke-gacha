// Catch summary for big batches (×50, ×100): nobody wants to sit through 100 flips. A short shower of balls,
// then the highlights (shinies, new species, Rare and up), level-up rows grouped by card, and the totals.

import { playCry, sfx } from '../../audio';
import { getSpecies } from '../../data/species';
import { spriteUrl } from '../../data/sprites';
import { parseKey, rarity, rarityRank, RARITY_COLOR, type CardKey } from '../../game/cards';
import type { PullResult } from '../../game/gacha';
import { fmt, L } from '../../i18n';
import { store } from '../../state/store';
import { cardHTML } from '../../ui/card';
import { animateNumber, esc, icon } from '../../ui/dom';
import { burst, Sequence } from '../../ui/fx';
import {
  ballHTML, ballSprite, bannerName, bestResult, isRarePlus, isRouted, rarityName, regionChipHTML, revealSound, revealWeight, SHINY_COLOR,
} from './common';
import { actionsHTML, openPullOverlay, type PullContext, type PullExit } from './overlay';

interface Highlight {
  first: PullResult;
  count: number;
  isNew: boolean;
  from: number;
  to: number;
}

interface LevelRow {
  key: CardKey;
  copies: number;
  from: number;
  to: number;
  isNew: boolean;
}

function highlights(results: PullResult[]): Highlight[] {
  const groups = new Map<string, Highlight>();
  for (const r of results) {
    if (!r.shiny && r.kind !== 'new' && !isRarePlus(r.rarity)) continue;
    const id = `${r.id}:${r.shiny}`;
    const group = groups.get(id);
    if (group) {
      group.count += 1;
      group.to = Math.max(group.to, r.to);
    } else {
      groups.set(id, { first: r, count: 1, isNew: r.kind === 'new', from: r.from, to: r.to });
    }
  }
  return [...groups.values()].sort((a, b) => revealWeight(b.first) - revealWeight(a.first) || Number(b.isNew) - Number(a.isNew));
}

function levelRows(results: PullResult[]): LevelRow[] {
  const rows = new Map<CardKey, LevelRow>();
  for (const r of results) {
    if (r.kind === 'max') continue;
    const row = rows.get(r.key);
    if (row) {
      row.copies += 1;
      row.to = Math.max(row.to, r.to);
    } else {
      rows.set(r.key, { key: r.key, copies: 1, from: r.from, to: r.to, isNew: r.kind === 'new' });
    }
  }
  // A single brand-new copy is already in the highlights.
  return [...rows.values()]
    .filter(row => !(row.isNew && row.copies === 1))
    .sort((a, b) => (b.to - b.from) - (a.to - a.from) || rarityRank(rarity(parseKey(b.key).id)) - rarityRank(rarity(parseKey(a.key).id)));
}

function highlightHTML(h: Highlight, index: number) {
  const t = L().capture;
  const r = h.first;
  const level = isRouted(r) ? undefined : store.save.cards[r.key]?.level ?? h.to;
  const tag = h.isNew
    ? `<span class="cap-tag" data-tag="new">${esc(t.pull.tagNew)}</span>`
    : isRouted(r)
      ? `<span class="cap-tag" data-tag="route">${esc(t.pull.tagRoute(getSpecies(parseKey(r.key).id).name))}</span>`
      : `<span class="cap-tag" data-tag="level">${icon('up')}${esc(t.pull.tagLevel(h.from, h.to))}</span>`;
  return `
    <div class="sum-card" style="--i:${index};--rc:${r.shiny ? SHINY_COLOR : RARITY_COLOR[r.rarity]}" data-rarity="${r.rarity}">
      ${cardHTML({ id: r.id, shiny: r.shiny, level }, { size: 'sm', eager: index < 12 })}
      ${h.count > 1 ? `<span class="sum-count">${esc(t.summary.copies(h.count))}</span>` : ''}
      ${tag}
    </div>`;
}

function rowHTML(row: LevelRow) {
  const t = L();
  const { id, shiny } = parseKey(row.key);
  const r = rarity(id);
  return `
    <li class="sum-row" style="--rc:${shiny ? SHINY_COLOR : RARITY_COLOR[r]}">
      <img class="sum-row-sprite" src="${esc(spriteUrl(id, shiny))}" alt="" width="48" height="48" loading="lazy">
      <span class="sum-row-name"><b>${esc(getSpecies(id).name)}${shiny ? ' <span class="sum-shiny">✦</span>' : ''}</b><small>${esc(rarityName(r))}</small></span>
      <span class="sum-row-lv">
        ${row.isNew ? `<span class="sum-new">${esc(t.capture.summary.newCard)}</span>` : `${esc(t.core.card.level)} ${fmt(row.from)}`}
        ${icon('right')}<b>${esc(t.core.card.level)} ${fmt(row.to)}</b>
      </span>
      <span class="sum-row-n">${esc(t.capture.summary.copies(row.copies))}</span>
    </li>`;
}

export function playSummary(results: PullResult[], ctx: PullContext): Promise<PullExit> {
  const t = L().capture.summary;
  const tops = highlights(results);
  const rows = levelRows(results);
  const totals = {
    newSpecies: results.filter(r => r.newSpecies).length,
    levels: results.reduce((sum, r) => sum + (r.kind === 'level' ? r.to - r.from : 0), 0),
    candies: results.filter(r => r.kind === 'max').length,
    shinies: results.filter(r => r.shiny).length,
  };
  const stat = (key: keyof typeof totals, label: string, iconName: string) => `
    <div class="sum-stat" data-stat="${key}" ${totals[key] ? '' : 'data-zero'}>
      ${icon(iconName)}<b data-count="${totals[key]}">0</b><span>${esc(label)}</span>
    </div>`;

  return new Promise(resolve => {
    const seq = new Sequence();
    const overlay = openPullOverlay({
      ctx,
      className: 'cap-summary',
      onTap: () => seq.skip(),
      onEnd: resolve,
      html: `
        <div class="cap-rain" aria-hidden="true">
          ${Array.from({ length: 16 }, (_, i) => `<span class="rain-ball" style="--x:${(i * 37) % 100}%;--d:${(i * 53) % 11}">${ballHTML(ctx.banner, 40 + ((i * 17) % 24))}</span>`).join('')}
        </div>
        <div class="sum">
          <header class="sum-head">
            <p class="sum-kicker">${ballSprite(ctx.banner, 22)}<span>${esc(t.subtitle(bannerName(ctx.banner)))}</span>${regionChipHTML(ctx.region)}</p>
            <h2 class="fx-title">${esc(t.title(results.length))}</h2>
          </header>
          <div class="sum-stats">
            ${stat('newSpecies', t.newSpecies, 'star')}
            ${stat('levels', t.levels, 'up')}
            ${stat('candies', t.candies, 'sparkle')}
            ${stat('shinies', t.shinies, 'sparkle')}
          </div>
          <section class="sum-section">
            <h3 class="label">${esc(t.highlights)}</h3>
            ${tops.length ? `<div class="sum-highlights">${tops.map(highlightHTML).join('')}</div>` : `<p class="sum-empty">${esc(t.nothingNew)}</p>`}
          </section>
          ${rows.length ? `
            <section class="sum-section">
              <h3 class="label">${esc(t.levelUps)}</h3>
              <ul class="sum-levels">${rows.map(rowHTML).join('')}</ul>
            </section>` : ''}
          ${totals.candies ? `<p class="sum-candy">${icon('sparkle')}${esc(t.candyNote(totals.candies))}</p>` : ''}
        </div>
        ${actionsHTML(ctx)}`,
    });
    void runSummary(overlay.root, results, seq).then(overlay.finish);
  });
}

async function runSummary(root: HTMLElement, results: PullResult[], seq: Sequence) {
  const rain = root.querySelector<HTMLElement>('.cap-rain')!;
  if (!seq.skipped) sfx('ballThrow');
  const drops = [...rain.querySelectorAll<HTMLElement>('.rain-ball')].map((ball, i) => seq.anim(ball, [
    { transform: 'translateY(-20vh) rotate(0)', opacity: 0 },
    { opacity: 1, offset: 0.15 },
    { transform: 'translateY(115vh) rotate(540deg)', opacity: 1 },
  ], { duration: 900, delay: (i % 8) * 70 + Math.floor(i / 8) * 260, easing: 'cubic-bezier(.5,0,.9,.6)' }));
  await seq.wait(700);
  if (!seq.skipped) sfx('ballClick');
  await Promise.all(drops);
  rain.remove();

  root.classList.add('show-cards');
  root.querySelectorAll<HTMLElement>('[data-count]').forEach(node => animateNumber(node, 0, Number(node.dataset.count), seq.skipped ? 0 : 900));

  const best = bestResult(results);
  revealSound(best);
  if (isRarePlus(best.rarity) || best.kind === 'new') playCry(best.id);
  if (best.kind === 'new' || results.some(r => r.newSpecies)) sfx('newCard');
  else sfx('levelUp');
  const first = root.querySelector('.sum-card');
  if (first && (isRarePlus(best.rarity) || best.shiny)) {
    burst(first, { color: best.shiny ? SHINY_COLOR : RARITY_COLOR[best.rarity], count: 30, distance: 160 });
  }
}
