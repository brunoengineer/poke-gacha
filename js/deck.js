// Barra do deck (fixa no rodapé da Coleção): 7 slots que aceitam cartas arrastadas.

import { byKey, DECK_SIZE } from './data.js';
import { addToDeck, clearDeck, inDeck, moveInDeck, on, removeFromDeck, state } from './state.js';
import { draggable, dropZone } from './dnd.js';
import { openDetails, toggleDeck } from './details.js';
import { cardImg, confirmDialog, esc, icon, toast } from './ui.js';

const COLLAPSED_KEY = 'ui.dockCollapsed';
let dock;
let slots = [];

export function initDock() {
    dock = document.getElementById('deck-dock');
    dock.innerHTML = `
        <div class="dock-head">
            <button class="dock-toggle" type="button" aria-expanded="true" aria-controls="dock-slots">
                <span class="dock-title">Deck</span>
                <span class="dock-count"><b>0</b>/${DECK_SIZE}</span>
                ${icon('chevron', 'dock-chevron')}
            </button>
            <span class="dock-hint"></span>
            <div class="dock-actions">
                <button class="btn btn-ghost btn-sm" type="button" data-act="clear" aria-label="Limpar deck">${icon('trash')}<span class="hide-sm">Limpar</span></button>
                <a class="btn btn-primary btn-sm" href="#/batalha" data-act="battle">${icon('swords')}<span>Batalhar</span></a>
            </div>
        </div>
        <div class="dock-slots" id="dock-slots" data-drop="deck">
            ${Array.from({ length: DECK_SIZE }, (_, i) => `
                <div class="slot" data-drop="deck-slot" data-index="${i}">
                    <span class="slot-empty" aria-hidden="true">${i + 1}</span>
                </div>`).join('')}
        </div>`;
    slots = [...dock.querySelectorAll('.slot')];

    try {
        if (localStorage.getItem(COLLAPSED_KEY) === '1') setCollapsed(true);
    } catch { /* armazenamento indisponível */ }

    dock.querySelector('.dock-toggle').addEventListener('click', () => setCollapsed(!dock.classList.contains('collapsed'), true));
    dock.addEventListener('click', onClick);
    dock.addEventListener('contextmenu', event => {
        const card = event.target.closest('.slot-card');
        if (!card) return;
        event.preventDefault();
        removeFromDeck(card.dataset.key);
    });
    dock.addEventListener('keydown', event => {
        const card = event.target.closest('.slot-card');
        if (!card || event.target !== card) return;
        if (event.key === 'Delete' || event.key === 'Backspace') removeFromDeck(card.dataset.key);
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openDetails(card.dataset.key, [...state.deck]);
        }
    });

    draggable(dock, '.slot-card', node => ({
        type: 'deck',
        key: node.dataset.key,
        index: Number(node.closest('.slot').dataset.index),
    }), { onOutside: payload => removeFromDeck(payload.key) });

    dropZone('deck-slot', {
        accepts: payload => payload.type === 'card' || payload.type === 'deck',
        drop: (payload, zone) => {
            const index = Number(zone.dataset.index);
            const from = payload.type === 'deck' ? payload.index : state.deck.indexOf(payload.key);
            if (from >= 0) {
                moveInDeck(from, index);
                return slots[Math.min(index, state.deck.length - 1)];
            }
            return report(addToDeck(payload.key, index), payload.key) && slots[Math.min(index, state.deck.length - 1)];
        },
    });

    // Soltar em qualquer lugar da barra: entra no primeiro slot livre.
    dropZone('deck', {
        accepts: payload => payload.type === 'deck' || (payload.type === 'card' && !inDeck(payload.key) && state.deck.length < DECK_SIZE),
        drop: payload => {
            if (payload.type === 'deck') return slots[payload.index];
            return report(addToDeck(payload.key), payload.key) && slots[state.deck.length - 1];
        },
    });

    document.addEventListener('dnd:start', event => {
        if (dock.hidden) return;
        dock.classList.add('dragging');
        if (dock.classList.contains('collapsed')) setCollapsed(false);
        if (event.detail.type === 'deck') setHint('Solte fora do deck para remover');
    });
    document.addEventListener('dnd:end', () => {
        dock.classList.remove('dragging');
        setHint();
    });

    new ResizeObserver(() => {
        document.documentElement.style.setProperty('--dock-h', `${dock.hidden ? 0 : dock.offsetHeight}px`);
    }).observe(dock);

    on('deck', render);
    render();
}

export function setDockVisible(visible) {
    dock.hidden = !visible;
    document.documentElement.style.setProperty('--dock-h', `${visible ? dock.offsetHeight : 0}px`);
}

function setCollapsed(collapsed, persist = false) {
    dock.classList.toggle('collapsed', collapsed);
    dock.querySelector('.dock-toggle').setAttribute('aria-expanded', String(!collapsed));
    if (persist) {
        try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0'); } catch { /* ignorado */ }
    }
}

function report(result, key) {
    const card = byKey.get(key);
    if (result === 'full') toast('Deck cheio! Solte sobre uma carta do deck para substituí-la.', 'warning');
    else if (result === 'duplicate') toast(`${card.nome} (${card.rank}) já está no deck.`, 'warning');
    else if (result === 'not-owned') toast('Você ainda não tem esta carta.', 'warning');
    return result === 'added' || result === 'replaced';
}

async function onClick(event) {
    const action = event.target.closest('[data-act]')?.dataset.act;
    if (action === 'clear') {
        if (!state.deck.length) return;
        const ok = await confirmDialog({ title: 'Limpar o deck?', message: 'Todas as cartas sairão do deck (elas continuam na sua coleção).', confirmText: 'Limpar', danger: true });
        if (ok) clearDeck();
        return;
    }
    if (action === 'battle' && state.deck.length < DECK_SIZE) {
        event.preventDefault();
        toast(`Monte um deck com ${DECK_SIZE} cartas para batalhar.`, 'warning');
        return;
    }
    const remove = event.target.closest('.slot-remove');
    if (remove) return toggleDeck(remove.dataset.key);
    const card = event.target.closest('.slot-card');
    if (card) openDetails(card.dataset.key, [...state.deck]);
}

function render() {
    slots.forEach((slot, index) => {
        const key = state.deck[index] ?? null;
        const currentKey = slot.querySelector('.slot-card')?.dataset.key ?? null;
        if (key === currentKey) return;
        slot.querySelector('.slot-card')?.remove();
        slot.classList.toggle('filled', Boolean(key));
        if (!key) return;
        const card = byKey.get(key);
        slot.insertAdjacentHTML('beforeend', `
            <div class="slot-card pop" data-key="${esc(key)}" data-rank="${card.rank}" tabindex="0" role="button" aria-label="${esc(card.nome)} rank ${card.rank} no deck">
                ${cardImg(card)}
                <button class="slot-remove" type="button" data-key="${esc(key)}" aria-label="Remover ${esc(card.nome)} do deck">${icon('x')}</button>
            </div>`);
    });

    const count = state.deck.length;
    dock.querySelector('.dock-count b').textContent = count;
    dock.classList.toggle('complete', count === DECK_SIZE);
    dock.querySelector('[data-act="battle"]').setAttribute('aria-disabled', String(count < DECK_SIZE));
    dock.querySelector('[data-act="clear"]').disabled = count === 0;
    setHint();
}

function setHint(text) {
    const count = state.deck.length;
    dock.querySelector('.dock-hint').textContent = text ?? (count === DECK_SIZE
        ? 'Deck completo! Arraste sobre um slot para trocar.'
        : `Arraste cartas para cá · faltam ${DECK_SIZE - count}`);
}
