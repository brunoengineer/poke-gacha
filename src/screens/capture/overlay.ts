// Full-screen overlay shared by the pull animations (×1, ×10) and the catch summary (×50/×100):
// opens the modal, wires "skip" (tap anywhere / Esc while animating), and the closing actions
// (Close, Capture again, evolution hint link to the Collection).

import { canAfford, canUseBanner, type BannerId, type Payment } from '../../game/gacha';
import type { CardKey } from '../../game/cards';
import { L } from '../../i18n';
import { store } from '../../state/store';
import { esc, openModal, type Modal } from '../../ui/dom';
import { costHTML, evolveHintHTML } from './common';

export interface PullContext {
  banner: BannerId;
  count: number;
  payWith: Payment;
  /** Cards that became evolvable with this batch. */
  evolvable: CardKey[];
}

export type PullExit = 'again' | 'close' | 'go';

export interface PullOverlay {
  modal: Modal;
  root: HTMLElement;
  /** Marks the animation as finished: shows the actions and focuses "Capture again". */
  finish: () => void;
  done: () => boolean;
}

export const canPullAgain = (ctx: PullContext) =>
  canUseBanner(store.save, ctx.banner) && canAfford(store.save, ctx.banner, ctx.count, ctx.payWith);

export function actionsHTML(ctx: PullContext, { revealAll = false } = {}) {
  const t = L();
  return `
    ${evolveHintHTML(ctx.evolvable)}
    <div class="cap-actions">
      ${revealAll ? `<button class="btn btn-ghost btn-lg" type="button" data-reveal-all>${esc(t.capture.pull.revealAll)}</button>` : ''}
      <button class="btn btn-ghost btn-lg" type="button" data-close data-end>${esc(t.core.actions.close)}</button>
      <button class="btn btn-primary btn-lg pull-again" type="button" data-again data-end>
        <span>${esc(t.capture.pull.again(ctx.count))}</span>${costHTML(ctx.banner, ctx.count, ctx.payWith)}
      </button>
    </div>
    <p class="fx-skip">${esc(t.core.actions.skip)}</p>`;
}

/**
 * Opens the overlay. `onTap` gets clicks made while the animation runs (outside the end buttons),
 * so each animation decides what a tap means (skip intro, flip a card, reveal all).
 */
export function openPullOverlay({ ctx, className, html, onTap, onEnd }: {
  ctx: PullContext;
  className: string;
  html: string;
  onTap: (event: MouseEvent) => void;
  onEnd: (exit: PullExit) => void;
}): PullOverlay {
  const modal = openModal({
    className: `fx-overlay cap-fx ${className}`,
    label: L().capture.pull.label,
    dismissable: false,
    html,
    onClose: value => {
      document.removeEventListener('keydown', onKey, true);
      onEnd((value as PullExit) ?? 'close');
    },
  });
  const root = modal.root;
  const done = () => root.classList.contains('is-done');

  root.querySelectorAll<HTMLElement>('[data-end]').forEach(node => { node.hidden = true; });

  root.addEventListener('click', event => {
    const target = event.target as Element;
    if (target.closest('[data-again]')) return modal.close('again');
    if (target.closest('[data-close-go]')) return modal.close('go');
    if (target.closest('[data-close]') || done()) return;
    onTap(event);
  });

  function onKey(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !root.isConnected) return;
    event.preventDefault();
    if (done()) modal.close('close');
    else onTap(new MouseEvent('click'));
  }
  document.addEventListener('keydown', onKey, true);

  const finish = () => {
    if (done()) return;
    root.classList.add('is-done');
    root.querySelector<HTMLElement>('[data-reveal-all]')?.remove();
    root.querySelectorAll<HTMLElement>('[data-end]').forEach(node => { node.hidden = false; });
    const again = root.querySelector<HTMLButtonElement>('[data-again]');
    const ok = !!again && canPullAgain(ctx);
    if (again) again.disabled = !ok;
    const focus = ok ? again : root.querySelector<HTMLElement>('[data-close]');
    focus?.focus({ preventScroll: true });
  };

  return { modal, root, finish, done };
}
