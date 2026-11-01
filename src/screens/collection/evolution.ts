// Evolution: the confirmation dialog (branch choice, level clamp and merge warnings) and the full-screen
// animation: the sprite turns into a white silhouette that pulses faster and faster between the old and the
// new form, then a flash reveals the evolved card. playEvolution() is reusable by other screens.

import { playCry, sfx } from '../../audio';
import { itemSprite } from '../../data/items';
import { getSpecies } from '../../data/species';
import { spriteUrl } from '../../data/sprites';
import { TYPE_COLOR } from '../../data/types';
import { parseKey, STAT_IDS, statsAt, type CardKey } from '../../game/cards';
import { evolutionOptions, itemCount, previewEvolution, type EvolutionOption, type EvolveResult } from '../../game/progression';
import { fmt, itemName, L } from '../../i18n';
import { evolve } from '../../state/actions';
import { store } from '../../state/store';
import { cardHTML } from '../../ui/card';
import { esc, icon, openModal, toast } from '../../ui/dom';
import { burst, Sequence } from '../../ui/fx';

/** Short requirement label for an evolution option ("Lv. 16", "Fire Stone"). */
export function requirementHTML(option: Pick<EvolutionOption, 'level' | 'item' | 'missing'>, { status = true } = {}): string {
  const t = L().collection.evolution;
  const parts: string[] = [];
  if (option.level != null) {
    const ok = !option.missing.level;
    parts.push(`<span class="evo-req ${status ? (ok ? 'ok' : 'no') : ''}">${status ? icon(ok ? 'check' : 'lock') : ''}${esc(t.levelReq(option.level))}</span>`);
  }
  if (option.item) {
    const ok = !option.missing.item;
    const have = itemCount(store.save, option.item);
    parts.push(`<span class="evo-req ${status ? (ok ? 'ok' : 'no') : ''}"><img src="${esc(itemSprite(option.item))}" alt="" width="24" height="24">${esc(itemName(option.item))}${status ? ` <small>(${fmt(have)})</small>` : ''}</span>`);
  }
  return parts.join('');
}

/** Why an option isn't ready, as a sentence. */
export function missingText(option: EvolutionOption): string {
  const t = L().collection.evolution;
  if (option.missing.level) return t.needLevel(option.missing.level);
  if (option.missing.item) return t.needItem(itemName(option.missing.item));
  return '';
}

/**
 * Asks for confirmation (and the branch, for Eevee-like species), evolves and plays the animation.
 * Resolves with the result, or null when cancelled / not possible.
 */
export async function evolveFlow(key: CardKey, to?: number): Promise<EvolveResult | null> {
  const options = evolutionOptions(store.save, key);
  const ready = options.filter(o => o.ready);
  if (!ready.length) {
    if (options[0]) toast(missingText(options[0]), 'warning');
    sfx('error');
    return null;
  }
  const chosen = await confirmEvolution(key, options, to);
  if (chosen == null) return null;
  const result = evolve(key, chosen);
  if (!result) {
    toast(L().collection.evolution.failed, 'error');
    return null;
  }
  await playEvolution(result);
  return result;
}

function confirmEvolution(key: CardKey, options: EvolutionOption[], preferred?: number): Promise<number | null> {
  const t = L().collection.evolution;
  const { id } = parseKey(key);
  const name = getSpecies(id).name;
  let selected = (options.find(o => o.to === preferred && o.ready) ?? options.find(o => o.ready))!.to;

  return new Promise(resolve => {
    const modal = openModal({
      className: 'modal-dialog modal-evo-confirm',
      label: t.confirmTitle(name),
      onClose: value => resolve(typeof value === 'number' ? value : null),
      html: `
        <h2 class="dialog-title">${esc(t.confirmTitle(name))}</h2>
        <div class="evo-confirm-body"></div>
        <div class="dialog-actions">
          <button class="btn btn-ghost" type="button" data-close>${esc(L().core.actions.cancel)}</button>
          <button class="btn btn-evolve" type="button" data-confirm autofocus>${icon('up')} ${esc(t.evolve)}</button>
        </div>`,
    });
    const body = modal.root.querySelector<HTMLElement>('.evo-confirm-body')!;

    const draw = () => {
      const card = store.save.cards[key];
      const preview = previewEvolution(store.save, key, selected);
      const option = options.find(o => o.to === selected)!;
      const target = getSpecies(selected);
      const notes: string[] = [];
      if (option.item) notes.push(`<li class="note-item">${icon('bag')}${esc(t.consumes(itemName(option.item)))}</li>`);
      if (preview.clamped) notes.push(`<li class="note-warn">${icon('flag')}${esc(t.clampWarning(name, card.level, preview.level))}</li>`);
      if (preview.merged) notes.push(`<li class="note-merge">${icon('cards')}${esc(t.mergeNote(target.name, preview.level))}</li>`);
      body.innerHTML = `
        ${options.length > 1 ? `
          <p class="dialog-text">${esc(t.chooseBranch)}</p>
          <div class="evo-branches" role="radiogroup" aria-label="${esc(t.chooseBranch)}">
            ${options.map(o => `
              <button type="button" class="evo-branch" role="radio" data-to="${o.to}" aria-checked="${o.to === selected}" ${o.ready ? '' : 'disabled'}
                style="--tc:${TYPE_COLOR[getSpecies(o.to).types[0]]}">
                <img src="${esc(spriteUrl(o.to))}" alt="" width="96" height="96">
                <b>${esc(getSpecies(o.to).name)}</b>
                <span class="evo-branch-req">${requirementHTML(o)}</span>
              </button>`).join('')}
          </div>` : ''}
        <div class="evo-preview" style="--t1:${TYPE_COLOR[getSpecies(id).types[0]]};--t2:${TYPE_COLOR[target.types[0]]}">
          <div class="evo-preview-side">
            <img src="${esc(spriteUrl(id))}" alt="" width="96" height="96">
            <b>${esc(name)}</b><small>${esc(L().core.card.levelFull(card.level))}</small>
          </div>
          <span class="evo-preview-arrow">${icon('right')}</span>
          <div class="evo-preview-side is-target">
            <img src="${esc(spriteUrl(selected))}" alt="" width="96" height="96">
            <b>${esc(target.name)}</b><small class="${preview.clamped ? 'down' : ''}">${esc(L().core.card.levelFull(preview.level))}</small>
          </div>
        </div>
        ${notes.length ? `<ul class="evo-notes">${notes.join('')}</ul>` : ''}`;
    };

    body.addEventListener('click', event => {
      const branch = (event.target as Element).closest<HTMLButtonElement>('.evo-branch');
      if (!branch || branch.disabled) return;
      selected = Number(branch.dataset.to);
      sfx('click');
      draw();
      body.querySelector<HTMLElement>(`.evo-branch[data-to="${selected}"]`)?.focus();
    });
    body.addEventListener('keydown', event => {
      if (!(event.target as Element).closest('.evo-branch') || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const ready = options.filter(o => o.ready);
      const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      selected = ready[(ready.findIndex(o => o.to === selected) + step + ready.length) % ready.length].to;
      draw();
      body.querySelector<HTMLElement>(`.evo-branch[data-to="${selected}"]`)?.focus();
    });
    modal.root.querySelector('[data-confirm]')!.addEventListener('click', () => modal.close(selected));
    draw();
  });
}

/** Full-screen evolution animation. Resolves when the player closes it. */
export function playEvolution(result: EvolveResult): Promise<void> {
  const t = L().collection.evolution;
  const from = getSpecies(result.from);
  const to = getSpecies(result.to);
  const before = statsAt(from, result.levelBefore);
  const after = statsAt(to, result.level);
  const deltas = STAT_IDS.map(stat => {
    const d = after[stat] - before[stat];
    return `<span class="${d < 0 ? 'down' : ''}"><small>${esc(L().core.statsShort[stat])}</small>${d >= 0 ? '+' : '−'}${fmt(Math.abs(d))}</span>`;
  }).join('');
  const notes = [
    result.newSpecies ? `<span class="badge badge-gold">${icon('sparkle')} ${esc(t.newEntry)}</span>` : '',
    result.merged ? `<span class="badge">${icon('cards')} ${esc(t.mergedDone)}</span>` : '',
    result.level < result.levelBefore ? `<span class="badge">${esc(t.clampedDone(result.levelBefore, result.level))}</span>` : '',
  ].join('');

  return new Promise(resolve => {
    const modal = openModal({
      className: 'fx-overlay fx-evo',
      label: t.animLabel,
      dismissable: false,
      onClose: () => resolve(),
      html: `
        <div class="evo-stage" style="--t1:${TYPE_COLOR[from.types[0]]};--t2:${TYPE_COLOR[to.types[0]]}">
          <div class="evo-rays"></div>
          <div class="evo-glow"></div>
          <div class="evo-sprites">
            <img class="evo-from" src="${esc(spriteUrl(from.id))}" alt="" width="96" height="96">
            <img class="evo-to" src="${esc(spriteUrl(to.id))}" alt="" width="96" height="96">
          </div>
          <div class="evo-result">${cardHTML({ id: to.id, level: store.save.cards[result.toKey]?.level ?? result.level }, { size: 'lg', eager: true, animated: true })}</div>
          <div class="evo-flash"></div>
          <div class="fx-particles"></div>
        </div>
        <p class="evo-intro" aria-live="polite">${esc(t.intro(from.name))}</p>
        <div class="evo-caption">
          <p class="evo-names">${esc(from.name)} ${icon('right')} <b>${esc(to.name)}</b></p>
          <h2 class="fx-title">${esc(t.done(from.name, to.name))}</h2>
          <div class="evo-deltas">${deltas}</div>
          ${notes ? `<div class="evo-notes-row">${notes}</div>` : ''}
          <button class="btn btn-primary btn-lg" type="button" data-close>${esc(L().core.actions.continue)}</button>
        </div>
        <p class="fx-skip">${esc(L().core.actions.skip)}</p>`,
    });
    void runEvolution(modal.root, result);
  });
}

async function runEvolution(root: HTMLElement, result: EvolveResult) {
  const seq = new Sequence();
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const stage = $('.evo-stage');
  const sprites = $('.evo-sprites');
  const particles = $('.fx-particles');
  const color = TYPE_COLOR[getSpecies(result.to).types[0]];

  root.addEventListener('click', event => {
    if (!root.classList.contains('is-done') && !(event.target as Element).closest('.btn')) seq.skip();
  });
  root.addEventListener('keydown', event => {
    if (!root.classList.contains('is-done') && (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      seq.skip();
    }
  });
  root.querySelector<HTMLElement>('.modal-panel')!.tabIndex = -1;
  root.querySelector<HTMLElement>('.modal-panel')!.focus({ preventScroll: true });

  // 1. The old form appears and calls out.
  if (!seq.skipped) {
    sfx('evolveStart');
    playCry(result.from);
  }
  await seq.anim(sprites, [
    { opacity: 0, transform: 'translateY(24px) scale(.9)' },
    { opacity: 1, transform: 'none' },
  ], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
  await seq.wait(800);

  // 2. It turns into light while energy gathers.
  if (!seq.skipped) sfx('evolveCharge');
  root.classList.add('is-charging');
  seq.anim($('.evo-glow'), [
    { opacity: 0, transform: 'scale(.4)' },
    { opacity: 1, transform: 'scale(1.1)' },
  ], { duration: 3600, easing: 'ease-in' });
  burst(particles, { color: '#fff', count: 40, distance: 280, duration: 1600, inward: true });
  await seq.anim($('.evo-from'), [
    { filter: 'brightness(1)' },
    { filter: 'brightness(0) invert(1) drop-shadow(0 0 12px #fff)' },
  ], { duration: 650, easing: 'ease-in' });

  // 3. Old and new silhouettes alternate, faster and faster.
  const intervals = [520, 430, 360, 300, 250, 210, 175, 145, 120, 100, 84, 70, 60, 52, 46, 40, 36, 32, 30, 28];
  let showNew = false;
  for (const [i, ms] of intervals.entries()) {
    if (seq.skipped) break;
    showNew = !showNew;
    sprites.classList.toggle('show-to', showNew);
    if (i === 8) burst(particles, { color, count: 30, distance: 260, duration: 1300, inward: true });
    await seq.wait(ms);
  }
  sprites.classList.add('show-to');
  await seq.anim(stage, [
    { transform: 'translate(0, 0)' }, { transform: 'translate(-5px, 2px)' }, { transform: 'translate(5px, -2px)' },
    { transform: 'translate(-4px, -1px)' }, { transform: 'translate(4px, 1px)' }, { transform: 'translate(0, 0)' },
  ], { duration: 300, fill: 'none' });

  // 4. Flash and reveal.
  seq.anim($('.evo-flash'), [
    { opacity: 0, transform: 'scale(.3)' },
    { opacity: 1, transform: 'scale(1.4)', offset: 0.3 },
    { opacity: 0, transform: 'scale(2.4)' },
  ], { duration: 900, easing: 'ease-out' });
  await seq.wait(220);
  root.classList.add('is-revealed');
  sfx('evolveDone');
  playCry(result.to);
  burst(particles, { color, count: 46, distance: 360, duration: 1300, shape: 'star' });
  burst(particles, { color: '#fff', count: 24, distance: 240, duration: 900 });
  seq.anim($('.evo-rays'), [{ opacity: 0 }, { opacity: 1 }], { duration: 700 });
  await seq.anim($('.evo-result'), [
    { opacity: 0, transform: 'scale(1.3)' },
    { opacity: 1, transform: 'scale(.96)', offset: 0.6 },
    { opacity: 1, transform: 'none' },
  ], { duration: 720, easing: 'cubic-bezier(.2,.8,.2,1)' });

  // 5. Caption with the stat gains.
  await seq.anim($('.evo-caption'), [
    { opacity: 0, transform: 'translateY(16px)' },
    { opacity: 1, transform: 'none' },
  ], { duration: 380, easing: 'ease-out' });
  root.classList.add('is-revealed', 'is-done');
  $('.evo-caption .btn').focus({ preventScroll: true });
}
