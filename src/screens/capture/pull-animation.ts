// Capture animations. ×1: the ball is thrown, lands, wobbles (more wobbles hint at a rarer catch), clicks shut
// and bursts open in the rarity color, then the card flips over. Legendaries and shinies get extra drama.
// ×10: ten balls drop into a grid, wobble together and pop in rarity order (rarest last); cards flip one by one,
// or on tap, or all at once. Every step is skippable (tap / Esc) and honors reduced motion.

import { playCry, sfx } from '../../audio';
import { getSpecies } from '../../data/species';
import { RARITY_COLOR } from '../../game/cards';
import type { PullResult } from '../../game/gacha';
import { L } from '../../i18n';
import { cardBackHTML, cardHTML } from '../../ui/card';
import { esc } from '../../ui/dom';
import { burst, Sequence } from '../../ui/fx';
import {
  ballHTML, bannerName, bestResult, isLegendaryPlus, isRarePlus, isRouted, rarityName, revealSound, revealWeight,
  SHINY_COLOR, tagHTML,
} from './common';
import { actionsHTML, openPullOverlay, type PullContext, type PullExit } from './overlay';

const lightOf = (r: PullResult) => (r.shiny ? SHINY_COLOR : RARITY_COLOR[r.rarity]);

/** Wobbles before the click: 1 for commons, up to 3 for epics and above. */
function wobbleCount(r: PullResult) {
  switch (r.rarity) {
    case 'common': return 1;
    case 'uncommon': return Math.random() < 0.4 ? 2 : 1;
    case 'rare': return 2;
    default: return 3;
  }
}

/** Card for a result: the pulled species. A copy routed to an evolved card shows no level of its own. */
function resultCard(r: PullResult, animated: boolean) {
  const level = isRouted(r) ? undefined : r.to;
  return cardHTML({ id: r.id, shiny: r.shiny, level }, { size: 'sm', animated, eager: true });
}

const flipHTML = (r: PullResult, animated: boolean) => `
  <span class="flip-inner">
    <span class="flip-face flip-back">${cardBackHTML('sm')}</span>
    <span class="flip-face flip-front">${resultCard(r, animated)}</span>
  </span>`;

const WOBBLE: Keyframe[] = [
  { transform: 'rotate(0)' },
  { transform: 'rotate(-24deg)', offset: 0.22 },
  { transform: 'rotate(0)', offset: 0.45 },
  { transform: 'rotate(16deg)', offset: 0.68 },
  { transform: 'rotate(0)' },
];

const OPEN_TOP: Keyframe[] = [
  { transform: 'none' },
  { transform: 'translate(-6%, -46%) rotate(-38deg)' },
];

// --- ×1 -------------------------------------------------------------------------------

export function playSingle(r: PullResult, ctx: PullContext): Promise<PullExit> {
  const t = L().capture.pull;
  const species = getSpecies(r.id);
  const epic = isLegendaryPlus(r.rarity);
  const callout = r.shiny ? t.shiny : r.rarity === 'mythical' ? t.mythical : r.rarity === 'legendary' ? t.legendary : '';

  return new Promise(resolve => {
    const seq = new Sequence();
    const overlay = openPullOverlay({
      ctx,
      className: `cap-single ${epic ? 'is-epic' : ''} ${r.shiny ? 'is-shiny' : ''}`,
      onTap: () => seq.skip(),
      onEnd: resolve,
      html: `
        <div class="cap-stage" data-rarity="${r.rarity}" style="--rc:${lightOf(r)}">
          <span class="cap-rays" aria-hidden="true"></span>
          <span class="cap-flash" aria-hidden="true"></span>
          <div class="cap-arena" aria-hidden="true">
            <span class="cap-shadow"></span>
            <span class="cap-ball-wrap">${ballHTML(ctx.banner, 112)}</span>
          </div>
          <div class="cap-result">
            ${callout ? `<p class="cap-callout">${r.shiny ? '✦ ' : ''}${esc(callout)}${r.shiny ? ' ✦' : ''}</p>` : ''}
            <div class="flip flip-single">${flipHTML(r, true)}</div>
            <div class="cap-caption">
              <h2 class="cap-name">${esc(species.name)}</h2>
              <div class="cap-caption-row">
                <span class="rarity-pill" data-rarity="${r.rarity}">${esc(rarityName(r.rarity))}</span>
                ${tagHTML(r)}
              </div>
              ${r.newSpecies ? `<p class="cap-newdex">${esc(t.newSpecies)}</p>` : ''}
            </div>
          </div>
        </div>
        ${actionsHTML(ctx)}`,
    });
    void runSingle(overlay.root, r, seq).then(overlay.finish);
  });
}

async function runSingle(root: HTMLElement, r: PullResult, seq: Sequence) {
  const stage = root.querySelector<HTMLElement>('.cap-stage')!;
  const wrap = root.querySelector<HTMLElement>('.cap-ball-wrap')!;
  const ball = wrap.querySelector<HTMLElement>('.pball')!;
  const shadow = root.querySelector<HTMLElement>('.cap-shadow')!;
  const flip = root.querySelector<HTMLElement>('.flip')!;
  const epic = isLegendaryPlus(r.rarity);
  const color = lightOf(r);

  // 1. Throw: an arc from the bottom corner, spinning.
  if (!seq.skipped) sfx('ballThrow');
  seq.anim(shadow, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 760, easing: 'ease-in' });
  await seq.anim(wrap, [
    { transform: 'translate(46vw, 38vh) rotate(0) scale(.45)', opacity: 0 },
    { transform: 'translate(32vw, -6vh) rotate(-260deg) scale(.7)', opacity: 1, offset: 0.3 },
    { transform: 'translate(14vw, -22vh) rotate(-520deg) scale(.85)', offset: 0.6 },
    { transform: 'translate(0, 0) rotate(-720deg) scale(1)' },
  ], { duration: 760, easing: 'cubic-bezier(.35,.1,.55,1)' });

  // 2. Lands with a small bounce.
  await seq.anim(wrap, [
    { transform: 'translateY(0)' },
    { transform: 'translateY(-28px)', offset: 0.35 },
    { transform: 'translateY(0)', offset: 0.7 },
    { transform: 'translateY(-6px)', offset: 0.85 },
    { transform: 'translateY(0)' },
  ], { duration: 420, easing: 'ease-out' });

  // 2b. Legendary/mythical: the ball rises and glows, light rays fill the screen.
  if (epic) {
    await seq.wait(250);
    stage.classList.add('is-charging');
    seq.anim(root.querySelector('.cap-rays')!, [{ opacity: 0, transform: 'scale(.4) rotate(0)' }, { opacity: 1, transform: 'scale(1) rotate(40deg)' }], { duration: 1100, easing: 'ease-out' });
    await seq.anim(wrap, [{ transform: 'translateY(0)' }, { transform: 'translateY(-34px)' }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }

  // 3. Wobbles.
  const wobbles = wobbleCount(r);
  for (let i = 0; i < wobbles; i++) {
    await seq.wait(i ? 380 : 320);
    if (!seq.skipped) sfx('ballWobble');
    await seq.anim(ball, WOBBLE, { duration: epic ? 480 : 560, easing: 'ease-in-out' });
  }
  if (epic) {
    // A violent final shake before it gives in.
    if (!seq.skipped) sfx('ballWobble');
    await seq.anim(ball, [
      { transform: 'translateX(0)' }, { transform: 'translateX(-7px) rotate(-6deg)' }, { transform: 'translateX(7px) rotate(6deg)' },
      { transform: 'translateX(-5px) rotate(-4deg)' }, { transform: 'translateX(5px) rotate(4deg)' }, { transform: 'translateX(0)' },
    ], { duration: 520, iterations: 2 });
  }

  // 4. Click.
  await seq.wait(300);
  if (!seq.skipped) {
    sfx('ballClick');
    burst(wrap, { color: '#fff', count: 7, distance: 70, duration: 600, shape: 'star' });
  }
  await seq.anim(ball.querySelector('.pball-button')!, [
    { boxShadow: '0 0 0 0 transparent', filter: 'brightness(1)' },
    { boxShadow: `0 0 26px 8px ${color}`, filter: 'brightness(1.6)', offset: 0.4 },
    { boxShadow: '0 0 0 0 transparent', filter: 'brightness(1)' },
  ], { duration: 520 });
  await seq.wait(epic ? 380 : 220);

  // 5. Bursts open with light in the rarity color.
  if (!seq.skipped) {
    sfx('ballOpen');
    burst(stage, { color, count: epic ? 70 : isRarePlus(r.rarity) ? 40 : 22, distance: epic ? 320 : 220, duration: 1000 });
  }
  seq.anim(ball.querySelector('.pball-top')!, OPEN_TOP, { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
  seq.anim(root.querySelector('.cap-flash')!, [
    { opacity: 0, transform: 'scale(.15)' },
    { opacity: 1, transform: 'scale(1)', offset: 0.3 },
    { opacity: 0, transform: 'scale(1.5)' },
  ], { duration: epic ? 1100 : 700, easing: 'ease-out' });
  const lift = epic ? 'translateY(-34px) ' : '';
  await seq.anim(wrap, [{ opacity: 1, transform: `${lift}scale(1)` }, { opacity: 0, transform: `${lift}scale(1.25)` }], { duration: 260, delay: 140 });

  // 6. Reveal: the card rises out of the light and flips.
  stage.classList.add('is-revealed');
  await seq.anim(flip, [
    { opacity: 0, transform: 'translateY(40px) scale(.3)' },
    { opacity: 1, transform: 'none' },
  ], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.15)' });
  await seq.wait(epic ? 450 : 160);
  if (seq.skipped) stage.classList.add('no-anim');
  flip.classList.add('is-flipped');
  revealSound(r);
  playCry(r.id);
  if (r.kind === 'new') sfx('newCard');
  else if (r.kind === 'level') sfx('levelUp');
  if (isRarePlus(r.rarity) || r.shiny) burst(flip, { color, count: epic ? 48 : 28, distance: 200, duration: 1100 });
  if (r.shiny) burst(flip, { color: SHINY_COLOR, count: 26, distance: 170, duration: 1300, shape: 'star' });
  stage.classList.add('is-flipped');
  await seq.wait(450);
}

// --- ×10 --------------------------------------------------------------------------------

export function playMulti(results: PullResult[], ctx: PullContext): Promise<PullExit> {
  const t = L().capture.pull;
  return new Promise(resolve => {
    const intro = new Sequence();
    const reveal = new Sequence();
    let flipAll: () => void = () => {};
    let flipOne: (slot: HTMLElement) => void = () => {};

    const overlay = openPullOverlay({
      ctx,
      className: 'cap-multi',
      onEnd: resolve,
      onTap: event => {
        const root = overlay.root;
        if (!root.classList.contains('show-cards')) return intro.skip();
        const target = event.target as Element | null;
        if (target?.closest?.('[data-reveal-all]')) return flipAll();
        const slot = target?.closest?.<HTMLElement>('.slot');
        if (slot) return flipOne(slot);
        flipAll();
      },
      html: `
        <h2 class="fx-title cap-multi-title">${esc(bannerName(ctx.banner))} ×${results.length}</h2>
        <div class="cap-grid" data-n="${results.length}">
          ${results.map((r, i) => `
            <div class="slot" data-i="${i}" data-rarity="${r.rarity}" ${r.shiny ? 'data-shiny="true"' : ''} style="--rc:${lightOf(r)}">
              <span class="slot-flash" aria-hidden="true"></span>
              <span class="slot-ball">${ballHTML(ctx.banner, 54)}</span>
              <button class="flip" type="button" tabindex="-1" aria-label="${esc(t.revealCard(i + 1))}">${flipHTML(r, false)}</button>
              <span class="slot-tag">${tagHTML(r)}</span>
            </div>`).join('')}
        </div>
        ${actionsHTML(ctx, { revealAll: true })}`,
    });

    const root = overlay.root;
    const slots = [...root.querySelectorAll<HTMLElement>('.slot')];
    // Pop and flip order: rarest (and shinies) last; same rarity keeps grid order.
    const order = results.map((_, i) => i).sort((a, b) => revealWeight(results[a]) - revealWeight(results[b]) || a - b);
    const best = bestResult(results);
    let flipped = 0;

    flipOne = slot => {
      if (slot.classList.contains('is-flipped')) return;
      const r = results[Number(slot.dataset.i)];
      slot.classList.add('is-flipped');
      const button = slot.querySelector<HTMLElement>('.flip')!;
      button.setAttribute('aria-label', `${getSpecies(r.id).name}, ${rarityName(r.rarity)}`);
      if (!reveal.skipped || r === best) revealSound(r);
      if (isRarePlus(r.rarity) || r.shiny) burst(button, { color: lightOf(r), count: isLegendaryPlus(r.rarity) ? 36 : 18, distance: 120 });
      if (r.shiny) burst(button, { color: SHINY_COLOR, count: 16, distance: 110, shape: 'star' });
      if (r === best) playCry(r.id);
      if (++flipped === slots.length) {
        if (results.some(x => x.kind === 'new')) sfx('newCard');
        else sfx('levelUp');
        overlay.finish();
      }
    };

    flipAll = () => {
      reveal.skip();
      for (const i of order) flipOne(slots[i]);
    };

    void runMulti(root, results, order, intro, reveal, flipOne, flipAll);
  });
}

async function runMulti(
  root: HTMLElement, results: PullResult[], order: number[], intro: Sequence, reveal: Sequence,
  flipOne: (slot: HTMLElement) => void, flipAll: () => void,
) {
  const slots = [...root.querySelectorAll<HTMLElement>('.slot')];
  const balls = slots.map(slot => slot.querySelector<HTMLElement>('.pball')!);
  const wobbles = results.map(wobbleCount);

  // 1. Balls drop in.
  if (!intro.skipped) sfx('ballThrow');
  await Promise.all(slots.map((slot, i) => intro.anim(slot.querySelector('.slot-ball')!, [
    { transform: 'translateY(-70vh) rotate(-200deg)', opacity: 0 },
    { transform: 'translateY(0) rotate(0)', opacity: 1, offset: 0.7 },
    { transform: 'translateY(-14px)', offset: 0.85 },
    { transform: 'translateY(0)' },
  ], { duration: 620, delay: i * 55, easing: 'ease-in' })));

  // 2. Wobble together; the rarer ones keep wobbling a little longer.
  const rounds = Math.max(...wobbles);
  for (let w = 0; w < rounds; w++) {
    await intro.wait(w ? 260 : 300);
    if (!intro.skipped) sfx('ballWobble');
    await Promise.all(balls.map((ball, i) => (wobbles[i] > w ? intro.anim(ball, WOBBLE, { duration: 520, delay: (i % 5) * 25, easing: 'ease-in-out' }) : null)));
  }
  await intro.wait(200);
  if (!intro.skipped) sfx('ballClick');

  // 3. Pop open one by one, rarest last.
  for (const i of order) {
    if (intro.skipped) break;
    const r = results[i];
    popSlot(slots[i], intro, !intro.skipped);
    await intro.wait(isRarePlus(r.rarity) || r.shiny ? 340 : 110);
  }
  slots.forEach(slot => popSlot(slot, intro, false));
  root.classList.add('show-cards');
  slots.forEach(slot => slot.querySelector<HTMLElement>('.flip')!.removeAttribute('tabindex'));
  root.querySelector<HTMLElement>('[data-reveal-all]')?.focus({ preventScroll: true });

  // 4. Cards flip in the same order (tap a card to flip it first, tap elsewhere to reveal all).
  await reveal.wait(350);
  for (const i of order) {
    if (reveal.skipped) break;
    const r = results[i];
    const rare = isRarePlus(r.rarity) || r.shiny;
    await reveal.wait(rare ? 420 : 140);
    if (reveal.skipped) break;
    flipOne(slots[i]);
    if (rare) await reveal.wait(260);
  }
  if (reveal.skipped) flipAll();
}

function popSlot(slot: HTMLElement, seq: Sequence, animate: boolean) {
  if (slot.classList.contains('is-popped')) return;
  slot.classList.add('is-popped');
  if (!animate) return;
  const r = slot.dataset.rarity!;
  if (r !== 'common') sfx('ballOpen');
  const ball = slot.querySelector<HTMLElement>('.slot-ball')!;
  seq.anim(ball.querySelector('.pball-top')!, OPEN_TOP, { duration: 200 });
  seq.anim(ball, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.3)' }], { duration: 240, delay: 80 });
  seq.anim(slot.querySelector('.slot-flash')!, [{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(1)', offset: 0.35 }, { opacity: 0, transform: 'scale(1.4)' }], { duration: 520 });
  seq.anim(slot.querySelector('.flip')!, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: 90, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
}
