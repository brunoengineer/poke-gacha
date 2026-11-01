// UI utilities: templates, toasts, modals and dialogs.

import { fmt, L } from '../i18n';
import { store } from '../state/store';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value: unknown) => String(value).replace(/[&<>"']/g, ch => ESCAPES[ch]);
export const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** True when the OS asks for less motion or the player turned on "fast effects". */
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Multiplier for effect durations (shorter with the "fast effects" setting). */
export const fxSpeed = () => (store.save.settings.fastFx ? 0.45 : 1);

export const icon = (name: string, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

export function el<T extends HTMLElement = HTMLElement>(html: string): T {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild as T;
}

export const $ = <T extends Element = HTMLElement>(root: ParentNode, selector: string) => root.querySelector<T & Element>(selector) as T;
export const $$ = <T extends Element = HTMLElement>(root: ParentNode, selector: string) => [...root.querySelectorAll<T & Element>(selector)] as T[];

// --- Toasts --------------------------------------------------------------

export type ToastType = 'info' | 'success' | 'warning' | 'error';
const TOAST_ICON: Record<ToastType, string> = { info: 'sparkle', success: 'check', warning: 'flag', error: 'x' };

export function toast(message: string, type: ToastType = 'info', duration = 2800) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const node = el(`<div class="toast toast-${type}" role="status">${icon(TOAST_ICON[type])}<span>${esc(message)}</span></div>`);
  host.append(node);
  while (host.children.length > 3) host.firstElementChild!.remove();
  setTimeout(() => {
    node.classList.add('leaving');
    setTimeout(() => node.remove(), 250);
  }, duration);
}

export function shakeCoins() {
  document.getElementById('coins')?.animate(
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }],
    { duration: 360 },
  );
}

// --- Modals --------------------------------------------------------------

export interface Modal {
  root: HTMLElement;
  dismissable: boolean;
  close: (value?: unknown) => void;
}

const stack: Modal[] = [];
const FOCUSABLE = 'button:not([disabled]), a[href], input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Opens a modal. Elements with [data-close] close it; `dismissable` controls Esc and backdrop clicks.
 * `close(value)` passes `value` to `onClose`.
 */
export function openModal({ html, className = '', label = '', dismissable = true, onClose }: {
  html: string;
  className?: string;
  label?: string;
  dismissable?: boolean;
  onClose?: (value?: unknown) => void;
}): Modal {
  const lastFocus = document.activeElement as HTMLElement | null;
  const root = el(`
    <div class="modal-root ${className}" role="dialog" aria-modal="true" aria-label="${esc(label)}">
      <div class="modal-backdrop" ${dismissable ? 'data-close' : ''}></div>
      <div class="modal-panel">${html}</div>
    </div>`);

  let closed = false;
  const entry: Modal = { root, dismissable, close };

  function close(value?: unknown) {
    if (closed) return;
    closed = true;
    stack.splice(stack.indexOf(entry), 1);
    if (!stack.length) document.documentElement.classList.remove('modal-open');
    root.classList.add('closing');
    setTimeout(() => root.remove(), reducedMotion() ? 0 : 200);
    if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
    onClose?.(value);
  }

  root.addEventListener('click', event => {
    if ((event.target as Element).closest('[data-close]')) close();
  });

  stack.push(entry);
  document.documentElement.classList.add('modal-open');
  document.body.append(root);
  requestAnimationFrame(() => {
    const target = root.querySelector<HTMLElement>('[autofocus]') || root.querySelector<HTMLElement>('.modal-panel button:not([disabled])');
    target?.focus({ preventScroll: true });
  });
  return entry;
}

export const isTopModal = (entry: Modal) => stack.at(-1) === entry;
export const modalOpen = () => stack.length > 0;

document.addEventListener('keydown', event => {
  const top = stack.at(-1);
  if (!top) return;
  if (event.key === 'Escape' && top.dismissable) {
    event.preventDefault();
    top.close();
  } else if (event.key === 'Tab') {
    const items = [...top.root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(node => node.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

export function confirmDialog({ title, message, confirmText, cancelText, danger = false }: {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}): Promise<boolean> {
  const t = L().core.actions;
  return new Promise(resolve => {
    const modal = openModal({
      className: 'modal-dialog',
      label: title,
      onClose: value => resolve(value === true),
      html: `
        <h2 class="dialog-title">${esc(title)}</h2>
        <p class="dialog-text">${esc(message)}</p>
        <div class="dialog-actions">
          <button class="btn btn-ghost" type="button" data-close>${esc(cancelText ?? t.cancel)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="button" data-confirm autofocus>${esc(confirmText ?? t.confirm)}</button>
        </div>`,
    });
    modal.root.querySelector('[data-confirm]')!.addEventListener('click', () => modal.close(true));
  });
}

// --- Animated numbers ----------------------------------------------------

const counters = new WeakMap<Element, number>();

export function animateNumber(node: Element, from: number, to: number, duration = 650, format: (n: number) => string = fmt) {
  cancelAnimationFrame(counters.get(node) ?? 0);
  if (reducedMotion() || from === to) {
    node.textContent = format(to);
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 3;
    node.textContent = format(Math.round(from + (to - from) * eased));
    if (t < 1) counters.set(node, requestAnimationFrame(step));
  };
  counters.set(node, requestAnimationFrame(step));
}
