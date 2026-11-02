// "Pass levels": the banner above the Pokédex grid (only when something can be passed) and the review list that passes
// every level at once. Tapping a row keeps that Pokémon out. Rules in planTransfers() (src/game/progression.ts).

import { sfx } from '../../audio';
import { getSpecies } from '../../data/species';
import { spriteUrl } from '../../data/sprites';
import { cardKey, parseKey, type CardKey } from '../../game/cards';
import { planTransfers } from '../../game/progression';
import { fmt, L } from '../../i18n';
import { transferLevels } from '../../state/actions';
import { store } from '../../state/store';
import { esc, icon, openModal, toast } from '../../ui/dom';

/** Shows or hides the banner, with the current count. */
export function syncAutoPass(banner: HTMLElement) {
  const count = planTransfers(store.save).length;
  banner.hidden = count === 0;
  if (count) banner.querySelector('[data-autopass-text]')!.textContent = L().collection.autoPass.banner(count);
}

export function openAutoPass() {
  const t = L().collection.autoPass;
  // The rows stay as first listed; keeping one out only changes the resulting levels.
  const rows = planTransfers(store.save);
  if (!rows.length) return;
  sfx('open');
  const kept = new Set<CardKey>();

  const modal = openModal({
    className: 'modal-dialog modal-autopass',
    label: t.title,
    html: `
      <button class="modal-x" type="button" data-close aria-label="${esc(L().core.actions.close)}">${icon('x')}</button>
      <h2 class="dialog-title">${icon('up')} ${esc(t.title)}</h2>
      <p class="dialog-text">${esc(t.sub)}</p>
      <ul class="ap-list"></ul>
      <div class="dialog-actions">
        <button class="btn btn-ghost" type="button" data-close>${esc(L().core.actions.cancel)}</button>
        <button class="btn btn-evolve" type="button" data-confirm></button>
      </div>`,
  });
  const list = modal.root.querySelector<HTMLElement>('.ap-list')!;
  const confirm = modal.root.querySelector<HTMLButtonElement>('[data-confirm]')!;

  const render = () => {
    const plan = planTransfers(store.save, kept);
    list.innerHTML = rows.map(row => {
      const out = kept.has(row.from);
      const planned = plan.find(p => p.from === row.from);
      const from = getSpecies(parseKey(row.from).id);
      const to = getSpecies(row.to);
      return `
        <li>
          <button class="ap-row ${out ? 'is-out' : ''}" type="button" data-from="${esc(row.from)}" aria-pressed="${!out}">
            <span class="ap-check">${out ? '' : icon('check')}</span>
            <span class="ap-mon"><img src="${esc(spriteUrl(from.id))}" alt="" width="96" height="96" loading="lazy"><b>${esc(from.name)}</b><small>${esc(L().core.card.levelFull(row.fromLevel))}</small></span>
            <span class="ap-arrow">${icon('right')}</span>
            <span class="ap-mon"><img src="${esc(spriteUrl(to.id))}" alt="" width="96" height="96" loading="lazy"><b>${esc(to.name)}</b><small>${esc(out || !planned ? t.keeps : L().core.card.levelFull(planned.level))}</small></span>
          </button>
        </li>`;
    }).join('');
    confirm.disabled = plan.length === 0;
    confirm.innerHTML = `${icon('up')} ${esc(t.confirm(plan.length))}`;
  };
  render();

  list.addEventListener('click', event => {
    const row = (event.target as Element).closest<HTMLElement>('[data-from]');
    if (!row) return;
    const key = row.dataset.from!;
    if (!kept.delete(key)) kept.add(key);
    sfx('toggle');
    const top = list.scrollTop;
    render();
    list.scrollTop = top;
    list.querySelector<HTMLElement>(`[data-from="${key}"]`)?.focus();
  });

  confirm.addEventListener('click', () => {
    const plan = planTransfers(store.save, kept);
    const done = transferLevels(plan);
    modal.close();
    if (!done) {
      toast(L().collection.evolution.failed, 'error');
      return;
    }
    sfx('levelUp');
    const cards = new Set(plan.map(p => cardKey(p.to))).size;
    toast(t.done(fmt(done), fmt(cards)), 'success');
  });
}
