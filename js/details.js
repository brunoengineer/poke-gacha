// Modal de detalhes da carta: arte com efeito 3D, atributos, linha de evolução e ações.

import { byKey, byName, DECK_SIZE, STATS, statMax } from './data.js';
import { addToDeck, canEvolve, evolveCost, evolveNeed, inDeck, on, owned, removeFromDeck, state } from './state.js';
import { evolveWithAnimation } from './evolution.js';
import { cardImg, esc, fmt, icon, isTopModal, openModal, rankPill, stars, toast } from './ui.js';

const canHover = matchMedia('(hover: hover) and (pointer: fine)');

/** Abre os detalhes de `key`. `list` (opcional) permite navegar entre cartas com as setas. */
export function openDetails(key, list = null) {
    let current = key;
    const unsubscribe = [];
    const modal = openModal({
        className: 'modal-card',
        label: 'Detalhes da carta',
        html: '<div class="detail"></div>',
        onClose: () => unsubscribe.forEach(off => off()),
    });
    const root = modal.root.querySelector('.detail');

    const render = () => {
        const focused = root.contains(document.activeElement) ? document.activeElement.dataset.act : null;
        root.innerHTML = template(byKey.get(current), list);
        bindTilt(root.querySelector('.detail-art'));
        if (focused) root.querySelector(`[data-act="${focused}"]:not([disabled])`)?.focus({ preventScroll: true });
    };

    const go = step => {
        if (!list?.length) return;
        const index = list.indexOf(current);
        current = list[(index + step + list.length) % list.length];
        render();
    };

    root.addEventListener('click', async event => {
        const chain = event.target.closest('[data-key]');
        if (chain) {
            current = chain.dataset.key;
            return render();
        }
        const action = event.target.closest('[data-act]')?.dataset.act;
        if (action === 'prev') go(-1);
        if (action === 'next') go(1);
        if (action === 'deck') toggleDeck(current);
        if (action === 'evolve') {
            const result = await evolveWithAnimation(current);
            if (result) {
                current = result.to.key;
                render();
            }
        }
    });

    const onKey = event => {
        if (!isTopModal(modal)) return;
        if (event.key === 'ArrowLeft') go(-1);
        if (event.key === 'ArrowRight') go(1);
    };
    document.addEventListener('keydown', onKey);
    unsubscribe.push(() => document.removeEventListener('keydown', onKey), on('collection', render), on('deck', render));
    render();
}

export function toggleDeck(key, { notify = false } = {}) {
    const card = byKey.get(key);
    if (inDeck(key)) {
        removeFromDeck(key);
        if (notify) toast(`${card.nome} (${card.rank}) saiu do deck.`);
        return;
    }
    const result = addToDeck(key);
    if (result === 'full') toast(`Deck cheio (${DECK_SIZE}/${DECK_SIZE}). Arraste a carta sobre um slot para substituir.`, 'warning');
    else if (result === 'not-owned') toast('Você ainda não tem esta carta.', 'warning');
    else if (notify) toast(`${card.nome} (${card.rank}) entrou no deck.`, 'success');
}

function template(card, list) {
    const quantity = owned(card.key);
    const chain = byName.get(card.nome);
    const deckFull = state.deck.length >= DECK_SIZE;
    const isInDeck = inDeck(card.key);
    const evolvable = quantity > 0 && canEvolve(card.key);
    const need = evolveNeed(card.rank);

    const deckButton = isInDeck
        ? `<button class="btn btn-danger" type="button" data-act="deck">${icon('minus')} Remover do deck</button>`
        : `<button class="btn btn-primary" type="button" data-act="deck" ${deckFull ? 'disabled title="Deck cheio"' : ''}>${icon('plus')} Adicionar ao deck</button>`;
    const cost = evolvable ? evolveCost(card.key) : 0;
    const copies = n => `${n} ${n === 1 ? 'cópia' : 'cópias'}`;
    const evolveHint = card.rank === 'S'
        ? `Transmutação: com ${need} cópias, 1 delas vira uma carta S aleatória.${evolvable ? ` Agora gasta ${copies(cost)}.` : ''}`
        : `Evolui para rank ${chain[chain.indexOf(card) + 1]?.rank} com ${need} cópias (sempre sobra pelo menos 1).${evolvable ? ` Agora gasta ${copies(cost)}.` : ''}`;

    return `
        <button class="modal-x" type="button" data-close aria-label="Fechar">${icon('x')}</button>
        <div class="detail-media">
            ${list?.length > 1 ? `<button class="nav-arrow prev" type="button" data-act="prev" aria-label="Carta anterior">${icon('left')}</button>` : ''}
            <div class="detail-art ${quantity ? '' : 'locked'}" data-rank="${card.rank}">
                ${cardImg(card, { eager: true })}
                <span class="detail-shine"></span>
            </div>
            ${list?.length > 1 ? `<button class="nav-arrow next" type="button" data-act="next" aria-label="Próxima carta">${icon('right')}</button>` : ''}
        </div>
        <div class="detail-info">
            <div class="detail-meta">
                ${rankPill(card.rank)} ${stars(card.tier)}
                ${quantity
                    ? `<span class="badge">×${quantity}</span>`
                    : `<span class="badge badge-muted">${icon('lock')} Não obtida</span>`}
                ${isInDeck ? `<span class="badge badge-gold">${icon('check')} No deck</span>` : ''}
            </div>
            <h2 class="detail-name">${esc(card.nome)}</h2>
            <div class="stat-bars">
                ${STATS.map(({ id, label }) => `
                    <div class="stat-bar">
                        <span>${label}</span>
                        <span class="bar"><i style="width:${Math.min(100, (card[id] / statMax[id]) * 100).toFixed(1)}%"></i></span>
                        <b>${fmt(card[id])}</b>
                    </div>`).join('')}
            </div>
            ${chain.length > 1 ? `
                <div class="chain">
                    <p class="label">Linha de evolução</p>
                    <div class="chain-row">
                        ${chain.map(step => `
                            <button class="chain-item ${owned(step.key) ? 'owned' : ''} ${step.key === card.key ? 'current' : ''}" type="button" data-key="${esc(step.key)}" aria-label="${esc(step.nome)} rank ${step.rank}">
                                ${cardImg(step)}<span>${step.rank}</span>
                            </button>`).join('')}
                    </div>
                </div>` : ''}
            ${quantity ? `
                <div class="detail-actions">
                    ${deckButton}
                    <button class="btn btn-evolve" type="button" data-act="evolve" ${evolvable ? '' : 'disabled'}>
                        ${icon('up')} Evoluir <small>${Math.min(quantity, need)}/${need}</small>
                    </button>
                </div>
                <p class="hint">${evolveHint}</p>`
            : '<p class="hint">Consiga esta carta na Oração ou vencendo batalhas.</p>'}
        </div>`;
}

function bindTilt(art) {
    if (!canHover.matches || !art) return;
    art.addEventListener('pointermove', event => {
        const rect = art.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        art.style.setProperty('--rx', `${(0.5 - y) * 16}deg`);
        art.style.setProperty('--ry', `${(x - 0.5) * 20}deg`);
        art.style.setProperty('--mx', `${x * 100}%`);
        art.style.setProperty('--my', `${y * 100}%`);
    });
    art.addEventListener('pointerleave', () => {
        art.style.setProperty('--rx', '0deg');
        art.style.setProperty('--ry', '0deg');
    });
}
