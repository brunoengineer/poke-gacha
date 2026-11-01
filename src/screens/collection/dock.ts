// Team dock (fixed at the bottom of the Collection screen): six slots that accept cards dragged from the grid.
// Drag between slots to reorder, drag out to remove; right click / Delete removes; "Auto" picks the strongest;
// "Teams" opens the saved teams (saved-teams.ts).

import { sfx } from '../../audio';
import { DECK_SIZE } from '../../game/economy';
import { fmt, L } from '../../i18n';
import { addToDeck, clearDeck, inDeck, moveInDeck, removeFromDeck } from '../../state/actions';
import { on, store } from '../../state/store';
import { cardHTML } from '../../ui/card';
import { draggable, dropZone } from '../../ui/dnd';
import { animateNumber, confirmDialog, esc, icon, toast } from '../../ui/dom';
import { parseKey } from '../../game/cards';
import { openDetails } from './details';
import './saved-teams';
import { autoTeam, cardLabel, reportAdd, teamPower } from './team';

const COLLAPSED_KEY = 'pg-dock-collapsed';
let dock: HTMLElement;
let slots: HTMLElement[] = [];
let shownPower = 0;

const deck = () => store.save.deck;

export function initDock() {
  const t = L().collection.dock;
  dock = document.getElementById('deck-dock')!;
  dock.setAttribute('aria-label', t.title);
  dock.innerHTML = `
    <div class="dock-head">
      <button class="dock-toggle" type="button" aria-expanded="true" aria-controls="dock-slots">
        <span class="dock-title">${esc(t.title)}</span>
        <span class="dock-count"><b>0</b>/${DECK_SIZE}</span>
        ${icon('chevron', 'dock-chevron')}
      </button>
      <span class="dock-power" title="${esc(t.powerTitle)}"><small>${esc(L().core.card.power)}</small><b data-power>0</b></span>
      <span class="dock-hint" aria-live="polite"></span>
      <div class="dock-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-act="clear" aria-label="${esc(t.clear)}" title="${esc(t.clear)}">${icon('trash')}</button>
        <button class="btn btn-secondary btn-sm" type="button" data-open-teams title="${esc(t.teamsTitle)}">${icon('layers')}<span>${esc(t.teams)}</span></button>
        <button class="btn btn-secondary btn-sm" type="button" data-act="auto" title="${esc(t.autoTitle)}">${icon('bolt')}<span>${esc(t.auto)}</span></button>
        <a class="btn btn-primary btn-sm" href="#/battle" data-act="battle">${icon('swords')}<span>${esc(t.battle)}</span></a>
      </div>
    </div>
    <div class="dock-slots" id="dock-slots" data-drop="team">
      ${Array.from({ length: DECK_SIZE }, (_, i) => `
        <div class="dock-slot" data-drop="team-slot" data-index="${i}">
          <span class="slot-empty" aria-hidden="true">${icon('ball')}<b>${i + 1}</b></span>
        </div>`).join('')}
    </div>`;
  slots = [...dock.querySelectorAll<HTMLElement>('.dock-slot')];

  try {
    if (localStorage.getItem(COLLAPSED_KEY) === '1') setCollapsed(true);
  } catch { /* storage blocked */ }

  dock.querySelector('.dock-toggle')!.addEventListener('click', () => setCollapsed(!dock.classList.contains('collapsed'), true));
  dock.addEventListener('click', onClick);
  dock.addEventListener('contextmenu', event => {
    const card = (event.target as Element).closest<HTMLElement>('.team-card');
    if (!card) return;
    event.preventDefault();
    removeFromDeck(card.dataset.key!);
    sfx('deckRemove');
  });
  dock.addEventListener('keydown', event => {
    const card = event.target as HTMLElement;
    if (!card.classList?.contains('team-card')) return;
    const index = Number(card.closest<HTMLElement>('.dock-slot')!.dataset.index);
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      removeFromDeck(card.dataset.key!);
      sfx('deckRemove');
      (slots[Math.min(index, deck().length - 1)]?.querySelector<HTMLElement>('.team-card') ?? dock.querySelector<HTMLElement>('[data-act="auto"]'))?.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDetails(card.dataset.key!, [...deck()]);
    } else if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && event.altKey) {
      // Alt + arrows move the card to the neighboring slot.
      event.preventDefault();
      const to = index + (event.key === 'ArrowLeft' ? -1 : 1);
      if (to < 0 || to >= deck().length) return;
      moveInDeck(index, to);
      slots[to].querySelector<HTMLElement>('.team-card')?.focus();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      slots[index + (event.key === 'ArrowLeft' ? -1 : 1)]?.querySelector<HTMLElement>('.team-card')?.focus();
    }
  });

  draggable(dock, '.team-card', node => ({
    type: 'team',
    key: node.dataset.key!,
    index: Number(node.closest<HTMLElement>('.dock-slot')!.dataset.index),
  }), {
    onOutside: payload => {
      removeFromDeck(String(payload.key));
      sfx('deckRemove');
    },
  });

  dropZone('team-slot', {
    accepts: payload => payload.type === 'card' || payload.type === 'team',
    drop: (payload, zone) => {
      const index = Number(zone.dataset.index);
      const key = String(payload.key);
      const from = payload.type === 'team' ? Number(payload.index) : deck().indexOf(key);
      if (from >= 0) {
        moveInDeck(from, index);
        sfx('cardPlace');
        return slots[Math.min(index, deck().length - 1)];
      }
      return reportAdd(addToDeck(key, index), key) && slots[Math.min(index, deck().length - 1)];
    },
  });

  // Dropping anywhere else on the dock: first free slot.
  dropZone('team', {
    accepts: payload => payload.type === 'team' || (payload.type === 'card' && !inDeck(String(payload.key)) && deck().length < DECK_SIZE),
    drop: payload => {
      if (payload.type === 'team') return slots[Number(payload.index)];
      return reportAdd(addToDeck(String(payload.key)), String(payload.key)) && slots[deck().length - 1];
    },
  });

  document.addEventListener('dnd:start', event => {
    if (dock.hidden) return;
    dock.classList.add('dragging');
    if (dock.classList.contains('collapsed')) setCollapsed(false);
    const payload = (event as CustomEvent).detail;
    setHint(payload.type === 'team' ? t.hintRemove : deck().length >= DECK_SIZE ? t.hintReplace : t.hintDrop);
  });
  document.addEventListener('dnd:end', () => {
    dock.classList.remove('dragging');
    setHint();
  });

  new ResizeObserver(syncHeight).observe(dock);
  on('deck', render);
  on('cards', render);
  render();
}

function syncHeight() {
  document.documentElement.style.setProperty('--dock-h', `${dock.hidden ? 0 : dock.offsetHeight + 12}px`);
}

export function setDockVisible(visible: boolean) {
  if (!dock) return;
  dock.hidden = !visible;
  syncHeight();
}

function setCollapsed(collapsed: boolean, persist = false) {
  dock.classList.toggle('collapsed', collapsed);
  dock.querySelector('.dock-toggle')!.setAttribute('aria-expanded', String(!collapsed));
  if (persist) {
    sfx(collapsed ? 'close' : 'open');
    try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0'); } catch { /* storage blocked */ }
  }
}

async function onClick(event: Event) {
  const t = L().collection.dock;
  const target = event.target as Element;
  const action = target.closest<HTMLElement>('[data-act]')?.dataset.act;
  if (action === 'clear') {
    if (!deck().length) return;
    const ok = await confirmDialog({ title: t.clearTitle, message: t.clearText, confirmText: t.clear, danger: true });
    if (ok) {
      clearDeck();
      sfx('deckRemove');
    }
    return;
  }
  if (action === 'auto') return autoTeam();
  if (action === 'battle') {
    if (deck().length < DECK_SIZE) {
      event.preventDefault();
      sfx('error');
      toast(t.needFull(DECK_SIZE), 'warning');
    }
    return;
  }
  const remove = target.closest<HTMLElement>('.team-remove');
  if (remove) {
    removeFromDeck(remove.dataset.key!);
    sfx('deckRemove');
    return;
  }
  const card = target.closest<HTMLElement>('.team-card');
  if (card) openDetails(card.dataset.key!, [...deck()]);
}

function render() {
  const t = L().collection.dock;
  slots.forEach((slot, index) => {
    const key = deck()[index] ?? null;
    const current = slot.querySelector<HTMLElement>('.team-card');
    const level = key ? store.save.cards[key]?.level : undefined;
    const sig = key ? `${key}|${level}` : '';
    if ((current?.dataset.sig ?? '') === sig) return;
    const isNew = current?.dataset.key !== key;
    current?.remove();
    slot.classList.toggle('filled', !!key);
    if (!key) return;
    const { id, shiny } = parseKey(key);
    slot.insertAdjacentHTML('beforeend', `
      <div class="team-card${isNew ? ' is-new' : ''}" data-key="${esc(key)}" data-sig="${esc(sig)}" tabindex="0" role="button"
        aria-label="${esc(t.slotLabel(index + 1, cardLabel(key), level ?? 0))}">
        ${cardHTML({ id, shiny, level }, { size: 'sm', eager: true })}
        <button class="team-remove" type="button" tabindex="-1" data-key="${esc(key)}" aria-label="${esc(t.remove(cardLabel(key)))}">${icon('x')}</button>
      </div>`);
  });

  const count = deck().length;
  dock.querySelector('.dock-count b')!.textContent = String(count);
  dock.classList.toggle('complete', count === DECK_SIZE);
  dock.querySelector('[data-act="battle"]')!.setAttribute('aria-disabled', String(count < DECK_SIZE));
  dock.querySelector<HTMLButtonElement>('[data-act="clear"]')!.disabled = count === 0;
  const power = teamPower();
  animateNumber(dock.querySelector('[data-power]')!, shownPower, power, 500, fmt);
  shownPower = power;
  setHint();
}

function setHint(text?: string) {
  const t = L().collection.dock;
  const count = deck().length;
  dock.querySelector('.dock-hint')!.textContent = text ?? (count === DECK_SIZE ? t.hintFull : t.hintEmpty(DECK_SIZE - count));
}
