// Pokémon card renderer. Every screen draws cards through cardHTML(), so the card design lives in one place
// (this file + styles/card.css). Cards are pure HTML/CSS around the pixel sprite, which is what makes them work
// for any generation: only the sprite and the data change.
//
// API contract (used by all screens — keep it stable):
//   cardHTML(view, options) -> HTML string with a root `.pcard` element.
//   Root attributes: data-type (primary type), data-rarity, data-shiny ("true"/absent), data-foil (Lv. 100+), data-locked,
//   data-live (effects animate while hovered).
//   Size classes: pcard-xs (team slots, history), pcard-sm (grids), pcard-md (battle), pcard-lg (details/reveals).
//   bindTilt(el) / bindTiltGroup(root): hover tilt + light glare on pointer devices.

import { animatedSpriteUrl, spriteUrl } from '../data/sprites';
import { getSpecies } from '../data/species';
import { TYPE_COLOR, type PokemonType } from '../data/types';
import { cardPower, isUncapped, MAX_LEVEL, rarity, rarityRank, RARITY_COLOR, type Rarity } from '../game/cards';
import { fmt, L } from '../i18n';
import { esc, reducedMotion } from './dom';

export interface CardView {
  id: number;
  shiny?: boolean;
  /** Omit for species views (Pokédex entries not tied to a card). */
  level?: number;
  /** Not caught yet: silhouette. */
  locked?: boolean;
}

export interface CardOptions {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Animated sprite (Black/White GIF) instead of the static one. */
  animated?: boolean;
  /** Load the image right away (cards visible on open). */
  eager?: boolean;
  /** Extra classes on the root. */
  className?: string;
  /** Extra HTML inside the card (tags, overlays). */
  extra?: string;
  /** Hides the Combat Power (PC) even when a level is given. */
  hidePower?: boolean;
  /** The effects (shine, sparkles, star) animate while the card is hovered; elsewhere they stay still, for performance. */
  live?: boolean;
}

// --- Type icons ------------------------------------------------------------------
// Small glyphs drawn for this game (24×24, filled), injected once as an SVG sprite: <use href="#t-fire">.

const TYPE_ICONS: Record<PokemonType, string> = {
  normal: '<path fill-rule="evenodd" d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 4.6a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8z"/>',
  fire: '<path d="M12.3 2c.7 3.6 5.7 5.8 5.7 11.3A6 6 0 0 1 12 19.5a6 6 0 0 1-6-6c0-2.5 1.2-4.4 2.7-5.8.1 1.9.9 3.2 2.3 3.8-.6-3.4-.1-6.6 1.3-9.5z"/><path d="M12 22a3.4 3.4 0 0 1-3.4-3.4c0-1.6 1.2-2.6 2.2-3.6.2 1 .8 1.6 1.6 1.9.1-1.3.5-2.4 1.3-3.4.9 1.6 1.7 3 1.7 4.9A3.4 3.4 0 0 1 12 22z" opacity=".55"/>',
  water: '<path d="M12 2.5C9 7 5.5 10.4 5.5 14.6a6.5 6.5 0 0 0 13 0C18.5 10.4 15 7 12 2.5zm-3 12.2c0 1.9 1.3 3.3 3 3.6v1.6c-2.6-.3-4.6-2.5-4.6-5.2H9z"/>',
  electric: '<path d="M14 1.5 4.5 13.6h6l-1.6 8.9 10.6-13h-6.2z"/>',
  grass: '<path d="M20.5 3.5C11.4 3 4.8 7.4 4.8 14.4c0 1.5.4 2.9 1 4.1l-2.3 2.3 1.2 1.2 2.3-2.3c1.3.9 2.9 1.4 4.6 1.4 7 0 10.1-7.3 8.9-17.6zM8.7 17.4c1.9-4.2 5-7.4 8.9-9.8-3 2.9-5.4 6.2-7.4 10.6z"/>',
  ice: '<g><rect x="11" y="2" width="2" height="20" rx="1"/><rect x="11" y="2" width="2" height="20" rx="1" transform="rotate(60 12 12)"/><rect x="11" y="2" width="2" height="20" rx="1" transform="rotate(120 12 12)"/><path d="m9 3.6 3 2.6 3-2.6.9 1.2L12 8.3 8.1 4.8zM9 20.4l3-2.6 3 2.6.9-1.2-3.9-3.5-3.9 3.5z"/></g>',
  fighting: '<path d="M12 1.8 14.3 7.5l5.9-2.4-2.4 5.8 4.4 2.3-5.4 1.6 1.4 5.8-5.4-3.1-3.4 4.7-.9-5.8-5.6 1.2 3.4-4.7L2 9.7l6.2-.7z"/>',
  poison: '<circle cx="10" cy="15" r="6"/><circle cx="17" cy="7.5" r="3.4"/><circle cx="7.4" cy="5.4" r="2.2"/>',
  ground: '<path d="M1.5 20 8.4 8.6l3.6 5.6 3-4.2L22.5 20z"/><path d="M8.4 4.2 10 6.8H6.8z" opacity=".55"/>',
  flying: '<path d="M2 17.5c4.7-.4 8.6-3.4 10.4-9.9 1.2 2.3 1.3 4.4.6 6.4 2.2-1.2 3.8-3.6 4.5-6.6 1.4 2.8.9 5.9-1.2 8.1 2.3-.2 4.3-1.2 5.7-3-.6 4.9-5.2 8-10.4 8H6.4z"/>',
  psychic: '<path fill-rule="evenodd" d="M1.8 12C4.4 7.3 8 4.9 12 4.9s7.6 2.4 10.2 7.1C19.6 16.7 16 19.1 12 19.1S4.4 16.7 1.8 12zM12 7.6a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8zm0 2.6a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6z"/>',
  bug: '<path fill-rule="evenodd" d="M12 7.2c3.3 0 5.6 3.2 5.6 7.4S15.3 22 12 22s-5.6-3.2-5.6-7.4S8.7 7.2 12 7.2zm-.7 2.4v10.6h1.4V9.6z"/><circle cx="12" cy="4.6" r="2.6"/><path d="M8.6 1.6 10 3.2l-.9.6-1.4-1.6zM15.4 1.6l.9.6L14.9 3.8l-.9-.6z"/>',
  rock: '<path fill-rule="evenodd" d="M7.4 3.5h8.4l5.6 6.6-3 10.4H6.8l-4.3-7.6zm1 2-2.6 7.3 5.6-2.3z"/>',
  ghost: '<path fill-rule="evenodd" d="M12 2a7.5 7.5 0 0 1 7.5 7.5V22l-2.6-2.1-2.4 2.1-2.5-2.1-2.5 2.1-2.4-2.1L4.5 22V9.5A7.5 7.5 0 0 1 12 2zm-2.8 6.4a1.6 2 0 1 0 0 4 1.6 2 0 0 0 0-4zm5.6 0a1.6 2 0 1 0 0 4 1.6 2 0 0 0 0-4z"/>',
  dragon: '<path d="M4.5 2.5c3.6 2.6 5.6 6.4 5.6 11.2 0 3-1 5.8-2.6 7.8 1-4.8.1-9.5-3-19zM10.5 2.5c3.6 2.6 5.6 6.4 5.6 11.2 0 3-1 5.8-2.6 7.8 1-4.8.1-9.5-3-19zM16.5 2.5c3.3 2.4 5 5.8 5 10.1 0 2.6-.8 5-2.2 6.8.8-4.2.1-8.4-2.8-16.9z"/>',
  dark: '<path d="M15.2 2.4A9.6 9.6 0 1 0 21.6 17 8.1 8.1 0 0 1 15.2 2.4z"/>',
  steel: '<path fill-rule="evenodd" d="m12 1.8 8.8 5.1v10.2L12 22.2l-8.8-5.1V6.9zm0 6.4a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z"/>',
  fairy: '<path d="m10.5 2 2.1 7.4L20 11.5l-7.4 2.1-2.1 7.4-2.1-7.4L1 11.5l7.4-2.1z"/><path d="m18.5 14.5.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" opacity=".7"/>',
};

if (typeof document !== 'undefined' && !document.getElementById('type-icons')) {
  const symbols = Object.entries(TYPE_ICONS).map(([type, body]) => `<symbol id="t-${type}" viewBox="0 0 24 24">${body}</symbol>`).join('');
  document.body.insertAdjacentHTML('afterbegin', `<svg id="type-icons" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${symbols}</defs></svg>`);
}

export const typeIcon = (type: PokemonType, cls = '') =>
  `<svg class="type-ico ${cls}" aria-hidden="true"><use href="#t-${type}"></use></svg>`;

export const typeBadge = (type: PokemonType) =>
  `<span class="type-badge" data-type="${type}" style="--tc:${TYPE_COLOR[type]}">${typeIcon(type)}<span class="type-name">${esc(L().core.types[type])}</span></span>`;

/** Rarity as a row of small gems (1 for Common … 6 for Mythical). */
export const rarityPips = (r: Rarity, cls = 'pcard-pips') =>
  `<span class="${cls}" data-rarity="${r}" aria-hidden="true">${'<i></i>'.repeat(rarityRank(r) + 1)}</span>`;

// --- Sprites -----------------------------------------------------------------------

export function spriteImg(id: number, shiny = false, { animated = false, eager = false, alt = '' } = {}) {
  const gif = animated ? animatedSpriteUrl(id, shiny) : null;
  const src = gif || spriteUrl(id, shiny);
  // Animated GIFs come in different sizes: once loaded they are scaled to the same pixel size as the static
  // 96×96 sprites (see the load listener below). data-static is the fallback when a GIF is missing.
  const anim = gif ? ` data-anim data-static="${esc(spriteUrl(id, shiny))}"` : '';
  return `<img class="sprite" src="${esc(src)}" alt="${esc(alt)}" width="96" height="96"${anim} ${eager ? '' : 'loading="lazy" '}decoding="async" draggable="false">`;
}

if (typeof document !== 'undefined') {
  document.addEventListener('load', event => {
    const img = event.target as HTMLImageElement;
    if (img.tagName !== 'IMG' || !img.hasAttribute('data-anim')) return;
    img.style.setProperty('--sw', String(img.naturalWidth / 96));
    img.classList.add('ready');
  }, true);
  document.addEventListener('error', event => {
    const img = event.target as HTMLImageElement;
    if (img.tagName !== 'IMG' || !img.dataset.static) return;
    img.removeAttribute('data-anim');
    img.src = img.dataset.static;
    delete img.dataset.static;
  }, true);
}

// --- Card ----------------------------------------------------------------------------

const SPARKLES = '<span class="pcard-sparkles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
/** Lv. 100 foil: glints on the art (shinies already have their sparkles). */
const GLINTS = '<span class="pcard-glints" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
const STAR = '<svg class="pcard-star" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 1.5 2.6 7.9H23l-6.8 4.9 2.6 8-6.8-5-6.8 5 2.6-8L1 9.4h8.4z"/></svg>';

export function cardHTML(view: CardView, opts: CardOptions = {}): string {
  const t = L().core;
  const s = getSpecies(view.id);
  const locked = !!view.locked;
  const shiny = !!view.shiny && !locked;
  const r = rarity(view.id);
  const [primary, secondary] = s.types;
  const level = locked ? undefined : view.level;
  const uncapped = level != null && isUncapped(view.id, shiny);
  // Reaching Lv. 100 turns the card into a foil (gold sheen over it, glints, gold level tag). A shiny keeps its starry
  // sky and only takes the gold tag and frame glow: a sheen over the art washed its colors out.
  const foil = level != null && level >= MAX_LEVEL;
  const dex = `#${String(s.id).padStart(3, '0')}`;
  const label = locked
    ? `${t.card.dex(s.id)} · ${t.card.notCaught}`
    : `${s.name}${shiny ? ` (${t.card.shiny})` : ''}${level != null ? `, ${t.card.levelFull(level)}` : ''}`;

  const levelTag = level == null ? '' : `
    <span class="pcard-level${uncapped ? ' uncapped' : ''}${foil ? ' max' : ''}${level > MAX_LEVEL ? ' beyond' : ''}">
      <small>${esc(t.card.level)}</small>${fmt(level)}${uncapped ? `<b class="pcard-inf" title="${esc(t.card.uncapped)}">∞</b>` : ''}
    </span>`;
  const powerTag = level == null || opts.hidePower ? '' :
    `<span class="pcard-power"><small>${esc(t.card.power)}</small>${fmt(cardPower(view.id, level, shiny))}</span>`;

  return `
    <div class="pcard pcard-${opts.size ?? 'sm'} ${opts.className ?? ''}" data-type="${primary}"${secondary ? ` data-type2="${secondary}"` : ''}
      data-rarity="${r}"${shiny ? ' data-shiny="true"' : ''}${foil ? ' data-foil="true"' : ''}${locked ? ' data-locked="true"' : ''}${level == null && !locked ? ' data-species="true"' : ''}${opts.live ? ' data-live="true"' : ''}
      style="--t1:${TYPE_COLOR[primary]};--t2:${TYPE_COLOR[secondary ?? primary]};--rc:${RARITY_COLOR[r]}"
      role="img" aria-label="${esc(label)}">
      <div class="pcard-frame">
        <div class="pcard-face">
          <div class="pcard-art">
            <span class="pcard-pattern"></span>
            ${spriteImg(view.id, shiny, { animated: opts.animated && !locked, eager: opts.eager })}
            ${shiny ? SPARKLES : foil ? GLINTS : ''}
          </div>
          <div class="pcard-head">
            ${levelTag}
            ${shiny ? `<span class="pcard-shiny" title="${esc(t.card.shiny)}">${STAR}</span>` : ''}
          </div>
          <div class="pcard-foot">
            ${locked ? '' : rarityPips(r)}
            <span class="pcard-title">
              <span class="pcard-name">${locked ? '???' : esc(s.name)}</span>
              <span class="pcard-dex">${dex}</span>
            </span>
            ${locked ? '' : `<span class="pcard-row"><span class="pcard-types">${s.types.map(typeBadge).join('')}</span>${powerTag}</span>`}
          </div>
          ${foil && !shiny ? '<span class="pcard-foil" aria-hidden="true"></span>' : ''}
        </div>
      </div>
      <span class="pcard-glare" aria-hidden="true"></span>
      ${opts.extra ?? ''}
    </div>`;
}

/** Face-down card back (Poké Ball design). */
export const cardBackHTML = (size: CardOptions['size'] = 'sm') =>
  `<div class="pcard pcard-${size} pcard-back" aria-hidden="true"><div class="pcard-frame"><span class="pcard-back-ball"></span></div></div>`;

// --- Hover tilt ---------------------------------------------------------------------------

const finePointer = typeof matchMedia !== 'undefined' ? matchMedia('(hover: hover) and (pointer: fine)') : null;
const canTilt = () => !!finePointer?.matches && !reducedMotion();

function tiltTo(card: HTMLElement, x: number, y: number, max: number) {
  card.style.setProperty('--rx', `${((0.5 - y) * max).toFixed(2)}deg`);
  card.style.setProperty('--ry', `${((x - 0.5) * max * 1.2).toFixed(2)}deg`);
  card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
  card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
}

function untilt(card: HTMLElement) {
  card.classList.remove('tilting');
  card.style.removeProperty('--rx');
  card.style.removeProperty('--ry');
  card.style.removeProperty('--mx');
  card.style.removeProperty('--my');
}

/**
 * Hover tilt with a light glare (and a moving foil on Lv. 100 cards) for one card. `target` is the `.pcard`
 * or an element containing it (better: its box doesn't move while the card tilts). Pointer devices only.
 * Returns a cleanup function.
 */
export function bindTilt(target: HTMLElement, { max = 16 } = {}): () => void {
  if (!canTilt()) return () => {};
  const find = () => (target.classList.contains('pcard') ? target : target.querySelector<HTMLElement>('.pcard'));
  let frame = 0;
  let last: PointerEvent | null = null;

  const apply = () => {
    frame = 0;
    const card = find();
    if (!card || !last) return;
    const rect = target.getBoundingClientRect();
    card.classList.add('tiltable', 'tilting');
    tiltTo(card, clamp((last.clientX - rect.left) / rect.width), clamp((last.clientY - rect.top) / rect.height), max);
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    last = event;
    if (!frame) frame = requestAnimationFrame(apply);
  };
  const leave = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    const card = find();
    if (card) untilt(card);
  };
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerleave', leave);
  return () => {
    leave();
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerleave', leave);
  };
}

/** Delegated tilt for many cards inside `root` (grids): one listener, gentler angle. */
export function bindTiltGroup(root: HTMLElement, { selector = '.pcard', max = 10 } = {}): () => void {
  if (!canTilt()) return () => {};
  let current: HTMLElement | null = null;
  let frame = 0;
  let last: PointerEvent | null = null;

  const apply = () => {
    frame = 0;
    if (!last) return;
    const card = (last.target as Element | null)?.closest<HTMLElement>(selector) ?? null;
    if (card !== current) {
      if (current) untilt(current);
      current = card && root.contains(card) && !document.body.classList.contains('is-dragging') ? card : null;
    }
    if (!current) return;
    // The card's own box moves while it tilts; its parent's doesn't.
    const rect = (current.parentElement ?? current).getBoundingClientRect();
    current.classList.add('tiltable', 'tilting');
    tiltTo(current, clamp((last.clientX - rect.left) / rect.width), clamp((last.clientY - rect.top) / rect.height), max);
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    last = event;
    if (!frame) frame = requestAnimationFrame(apply);
  };
  const leave = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (current) untilt(current);
    current = null;
  };
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerleave', leave);
  root.addEventListener('pointerdown', leave);
  return () => {
    leave();
    root.removeEventListener('pointermove', move);
    root.removeEventListener('pointerleave', leave);
    root.removeEventListener('pointerdown', leave);
  };
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));
