// Drag and drop with Pointer Events: works with mouse and touch.
// With a mouse, dragging starts after moving a few pixels; on touch, after a long press (so scrolling still works).
// Targets are elements with [data-drop="name"], registered with dropZone(name, { accepts, drop }).
// The ghost copies the dragged element's `.pcard` (or its image), so it looks like the card itself.

import { reducedMotion } from './dom';

export type DragPayload = Record<string, unknown> & { type: string };

interface ZoneHandler {
  accepts: (payload: DragPayload, zone: HTMLElement) => boolean;
  /** Returns false (refused: the card flies back) or the element the card should land on. */
  drop: (payload: DragPayload, zone: HTMLElement) => Element | false | void;
}

interface Pending {
  source: HTMLElement;
  payload: DragPayload;
  onOutside?: (payload: DragPayload) => void;
  id: number;
  touch: boolean;
  startX: number;
  startY: number;
  x: number;
  y: number;
  timer?: ReturnType<typeof setTimeout>;
}

interface Active extends Pending {
  ghost: HTMLElement;
  rect: DOMRect;
  offsetX: number;
  offsetY: number;
  lastX: number;
  tilt: number;
  scale: number;
  targetScale: number;
  zone: HTMLElement | null;
}

const LONG_PRESS_MS = 260;
const LIFT_SCALE = 1.08;
/** On touch a big card shrinks to about this width while dragged, so the finger can see where it's aiming. */
const TOUCH_DRAG_WIDTH = 80;
const zones = new Map<string, ZoneHandler>();
let pending: Pending | null = null;
let active: Active | null = null;
let frame = 0;
let suppressClickUntil = 0;

export function dropZone(name: string, { accepts = () => true, drop }: Partial<ZoneHandler> & Pick<ZoneHandler, 'drop'>) {
  zones.set(name, { accepts, drop });
}

/**
 * Makes elements of `root` matching `selector` draggable.
 * `getPayload(el)` describes what is being dragged (or null to ignore).
 * `onOutside(payload)` runs when the item is dropped outside any valid target.
 */
export function draggable(
  root: HTMLElement,
  selector: string,
  getPayload: (el: HTMLElement) => DragPayload | null,
  { onOutside }: { onOutside?: (payload: DragPayload) => void } = {},
) {
  root.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pending || active) return;
    const target = event.target as HTMLElement;
    const source = target.closest<HTMLElement>(selector);
    if (!source || !root.contains(source)) return;
    const control = target.closest('button, a, input, select');
    if (control && control !== source && source.contains(control)) return;
    const payload = getPayload(source);
    if (!payload) return;

    pending = {
      source, payload, onOutside,
      id: event.pointerId,
      touch: event.pointerType !== 'mouse',
      startX: event.clientX, startY: event.clientY,
      x: event.clientX, y: event.clientY,
    };
    if (pending.touch) pending.timer = setTimeout(begin, LONG_PRESS_MS);
    listen(true);
  });

  // While dragging by touch, keep the page from scrolling.
  root.addEventListener('touchmove', event => {
    if (active) event.preventDefault();
  }, { passive: false });
}

function listen(enable: boolean) {
  const method = enable ? 'addEventListener' : 'removeEventListener';
  window[method]('pointermove', onMove as EventListener);
  window[method]('pointerup', onUp as EventListener);
  window[method]('pointercancel', onCancel as EventListener);
}

function onMove(event: PointerEvent) {
  const current = active || pending;
  if (!current || event.pointerId !== current.id) return;
  current.x = event.clientX;
  current.y = event.clientY;

  if (!active) {
    const distance = Math.hypot(current.x - current.startX, current.y - current.startY);
    if (current.touch) {
      if (distance > 10) reset(); // the user is scrolling
    } else if (distance > 6) {
      begin();
    }
    return;
  }
  if (!frame) frame = requestAnimationFrame(update);
}

function begin() {
  if (!pending) return;
  clearTimeout(pending.timer);
  const { source } = pending;
  const visual = source.querySelector<HTMLElement>('.pcard') ?? source.querySelector('img') ?? source;
  const rect = visual.getBoundingClientRect();

  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.append(visual.cloneNode(true));
  document.body.append(ghost);
  const targetScale = pending.touch ? Math.min(LIFT_SCALE, TOUCH_DRAG_WIDTH / rect.width) : LIFT_SCALE;

  active = {
    ...pending, ghost, rect,
    offsetX: pending.x - rect.left,
    offsetY: pending.y - rect.top,
    lastX: pending.x,
    tilt: 0,
    scale: reducedMotion() ? targetScale : LIFT_SCALE,
    targetScale,
    zone: null,
  };
  pending = null;
  ghost.style.transformOrigin = `${active.offsetX}px ${active.offsetY}px`;
  try { source.setPointerCapture(active.id); } catch { /* pointer already released */ }

  source.classList.add('drag-source');
  document.body.classList.add('is-dragging');
  document.dispatchEvent(new CustomEvent('dnd:start', { detail: active.payload }));
  for (const zone of document.querySelectorAll<HTMLElement>('[data-drop]')) {
    if (accepts(zone)) zone.classList.add('drop-ready');
  }
  getSelection()?.removeAllRanges();
  if (active.touch) navigator.vibrate?.(12);
  update();
}

function accepts(zone: HTMLElement) {
  const handler = zones.get(zone.dataset.drop ?? '');
  return Boolean(active && handler?.accepts(active.payload, zone));
}

function update() {
  frame = 0;
  if (!active) return;
  const { ghost, x, y } = active;

  // Tilt the card with horizontal speed, settling back when it stops.
  const velocity = x - active.lastX;
  active.lastX = x;
  active.tilt += (Math.max(-14, Math.min(14, velocity * 0.9)) - active.tilt) * 0.25;
  active.scale += (active.targetScale - active.scale) * 0.25;
  ghost.style.transform = `translate3d(${x - active.offsetX}px, ${y - active.offsetY}px, 0) rotate(${active.tilt.toFixed(2)}deg) scale(${active.scale.toFixed(3)})`;
  if (Math.abs(active.tilt) > 0.2 || Math.abs(active.targetScale - active.scale) > 0.004) frame = requestAnimationFrame(update);

  const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]');
  const zone = hit && accepts(hit) ? hit : null;
  if (zone !== active.zone) {
    active.zone?.classList.remove('drop-hover');
    zone?.classList.add('drop-hover');
    active.zone = zone;
  }
}

function onUp(event: PointerEvent) {
  const current = active || pending;
  if (!current || event.pointerId !== current.id) return;
  if (!active) return reset();

  const { zone, payload, ghost, rect, onOutside } = active;
  suppressClickUntil = performance.now() + 400;
  if (zone) {
    const landing = zones.get(zone.dataset.drop!)!.drop(payload, zone);
    const target = landing === false ? rect : (landing instanceof Element ? landing : zone).getBoundingClientRect();
    flyGhost(ghost, target, landing === false ? 1 : 0.9);
  } else if (onOutside) {
    flyGhost(ghost, null, 0);
    onOutside(payload);
  } else {
    flyGhost(ghost, rect, 1);
  }
  reset();
}

function onCancel(event: PointerEvent) {
  const current = active || pending;
  if (!current || event.pointerId !== current.id) return;
  if (active) flyGhost(active.ghost, active.rect, 1);
  reset();
}

/** Animates the ghost card to `target` (or just fades it, when `target` is null). */
function flyGhost(ghost: HTMLElement, target: DOMRect | null, opacity: number) {
  if (reducedMotion()) return ghost.remove();
  const width = ghost.offsetWidth;
  const [originX, originY] = ghost.style.transformOrigin.split(' ').map(parseFloat);
  let end = `${ghost.style.transform} scale(.6)`;
  if (target) {
    const scale = target.width / width;
    const x = target.left - originX * (1 - scale);
    const y = target.top - originY * (1 - scale);
    end = `translate3d(${x}px, ${y}px, 0) rotate(0deg) scale(${scale})`;
  }
  ghost.animate(
    [{ transform: ghost.style.transform, opacity: 1 }, { transform: end, opacity: target ? opacity : 0 }],
    { duration: target ? 260 : 200, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' },
  ).finished.then(() => ghost.remove(), () => ghost.remove());
}

function reset() {
  if (pending) clearTimeout(pending.timer);
  if (active) {
    active.source.classList.remove('drag-source');
    active.zone?.classList.remove('drop-hover');
    document.body.classList.remove('is-dragging');
    document.querySelectorAll('.drop-ready').forEach(zone => zone.classList.remove('drop-ready'));
    document.dispatchEvent(new CustomEvent('dnd:end'));
  }
  cancelAnimationFrame(frame);
  frame = 0;
  pending = null;
  active = null;
  listen(false);
}

// A long press opens the context menu on some phones; the click that ends a drag must not "click".
window.addEventListener('contextmenu', event => {
  if (pending || active) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);

document.addEventListener('selectstart', event => {
  if (pending || active) event.preventDefault();
});

window.addEventListener('click', event => {
  if (performance.now() < suppressClickUntil) {
    event.preventDefault();
    event.stopPropagation();
    suppressClickUntil = 0;
  }
}, true);
