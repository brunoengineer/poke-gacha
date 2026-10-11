// Tela de Coleção: catálogo com busca, filtros, ordenação e arraste para o deck.
// Cada carta vira um elemento uma única vez; filtros só reordenam/ocultam esses elementos.

import { byKey, byName, cards, RANKS, rankIndex } from './data.js';
import { canEvolve, evolve, inDeck, on, owned } from './state.js';
import { draggable } from './dnd.js';
import { openDetails, toggleDeck } from './details.js';
import { evolveWithAnimation, playBatch } from './evolution.js';
import { cardImg, confirmDialog, esc, icon, toast } from './ui.js';

const FILTERS_KEY = 'ui.collection';
const MODES = [
    { id: 'todos', label: 'Todas' },
    { id: 'tenho', label: 'Tenho' },
    { id: 'nao-tenho', label: 'Não tenho' },
    { id: 'evoluir', label: 'Evoluir' },
];
const SORTS = [
    { id: 'nome', label: 'Nome' },
    { id: 'rank', label: 'Rank' },
    { id: 'hp', label: 'HP' },
    { id: 'atq', label: 'ATQ' },
    { id: 'def', label: 'DEF' },
    { id: 'prof', label: 'PROF' },
    { id: 'qtd', label: 'Quantidade' },
];

const filters = { mode: 'todos', ranks: [], tier: 'all', sort: 'nome', query: '' };
const tiles = new Map();
let view;
let grid;
let visibleKeys = [];
let lastPointer = 'mouse';

const normalize = text => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function mountCollection(section) {
    view = section;
    try {
        Object.assign(filters, JSON.parse(localStorage.getItem(FILTERS_KEY)) ?? {}, { query: '' });
    } catch { /* usa os filtros padrão */ }

    view.innerHTML = `
        <div class="view-head">
            <div>
                <h1 class="view-title">Coleção</h1>
                <p class="view-sub" data-stats></p>
            </div>
            <div class="progress" aria-hidden="true"><i data-progress></i></div>
        </div>
        <div class="onboarding" data-onboarding hidden>
            <div>
                <strong>Comece sua coleção!</strong>
                <p>Faça orações para conseguir cartas e depois arraste-as para o deck.</p>
            </div>
            <a class="btn btn-primary" href="#/gacha">${icon('sparkle')} Ir para Oração</a>
        </div>
        <div class="toolbar">
            <label class="search">
                ${icon('search')}
                <input type="search" placeholder="Buscar personagem…" aria-label="Buscar personagem" data-search>
            </label>
            <div class="segmented" role="group" aria-label="Filtrar por posse">
                ${MODES.map(m => `<button type="button" class="seg" data-mode="${m.id}">${m.label}${m.id === 'evoluir' ? ' <span class="count" data-evolve-count></span>' : ''}</button>`).join('')}
            </div>
            <div class="rank-filter" role="group" aria-label="Filtrar por rank">
                ${[...RANKS].reverse().map(r => `<button type="button" class="rank-chip" data-rank-filter="${r}" data-rank="${r}" aria-pressed="false">${r}</button>`).join('')}
            </div>
            <div class="selects">
                <label class="select">
                    <span class="sr-only">Estrelas</span>
                    <select data-tier>
                        <option value="all">Todas ★</option>
                        <option value="5">5 ★</option>
                        <option value="4">4 ★</option>
                    </select>
                </label>
                <label class="select">
                    <span class="sr-only">Ordenar por</span>
                    <select data-sort>${SORTS.map(s => `<option value="${s.id}">Ordenar: ${s.label}</option>`).join('')}</select>
                </label>
            </div>
        </div>
        <div class="evolve-bar" data-evolve-bar hidden>
            <span>${icon('up')} <b data-evolve-total></b></span>
            <button class="btn btn-evolve btn-sm" type="button" data-evolve-all>Evoluir todas</button>
        </div>
        <div class="card-grid" data-grid></div>
        <p class="empty" data-empty hidden>Nenhuma carta encontrada com esses filtros.</p>
        <p class="tip">${icon('sparkle')} Dica: arraste uma carta até o deck (no celular, toque e segure). Clique com o botão direito para adicionar/remover rapidamente.</p>`;

    grid = view.querySelector('[data-grid]');
    grid.innerHTML = cards.map(tileTemplate).join('');
    for (const tile of grid.children) tiles.set(tile.dataset.key, tile);
    tiles.forEach((_, key) => updateTile(key));

    bindToolbar();
    bindGrid();
    on('collection', keys => {
        keys.forEach(updateTile);
        refresh(filters.mode !== 'todos');
    });
    on('deck', () => {
        tiles.forEach((tile, key) => tile.classList.toggle('in-deck', inDeck(key)));
    });
    refresh(true);
}

function tileTemplate(card) {
    return `
        <div class="tile" data-key="${esc(card.key)}" data-rank="${card.rank}" tabindex="0" role="button">
            <div class="tile-art">
                ${cardImg(card)}
                <span class="tile-lock">${icon('lock')}</span>
                <span class="tile-qty"></span>
                <span class="tile-deck" title="No deck">${icon('check')}</span>
                <button class="tile-evolve" type="button" tabindex="-1" aria-label="Evoluir ${esc(card.nome)} ${card.rank}" title="Evoluir">${icon('up')}</button>
            </div>
            <span class="tile-name">${esc(card.nome)}</span>
        </div>`;
}

function updateTile(key) {
    const tile = tiles.get(key);
    const quantity = owned(key);
    const card = byKey.get(key);
    tile.classList.toggle('owned', quantity > 0);
    tile.classList.toggle('multi', quantity > 1);
    tile.classList.toggle('evolvable', quantity > 0 && canEvolve(key));
    tile.classList.toggle('in-deck', inDeck(key));
    tile.querySelector('.tile-qty').textContent = `×${quantity}`;
    tile.setAttribute('aria-label', `${card.nome}, rank ${card.rank}${quantity ? `, ${quantity} ${quantity === 1 ? 'cópia' : 'cópias'}` : ', não obtida'}`);
}

function bindToolbar() {
    const search = view.querySelector('[data-search]');
    let searchTimer = 0;
    search.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            filters.query = normalize(search.value.trim());
            refresh(true);
        }, 120);
    });

    view.querySelector('.segmented').addEventListener('click', event => {
        const button = event.target.closest('[data-mode]');
        if (!button) return;
        filters.mode = button.dataset.mode;
        refresh(true);
    });

    view.querySelector('.rank-filter').addEventListener('click', event => {
        const rank = event.target.closest('[data-rank-filter]')?.dataset.rankFilter;
        if (!rank) return;
        filters.ranks = filters.ranks.includes(rank) ? filters.ranks.filter(r => r !== rank) : [...filters.ranks, rank];
        refresh(true);
    });

    const tier = view.querySelector('[data-tier]');
    const sort = view.querySelector('[data-sort]');
    tier.value = filters.tier;
    sort.value = filters.sort;
    tier.addEventListener('change', () => { filters.tier = tier.value; refresh(true); });
    sort.addEventListener('change', () => { filters.sort = sort.value; refresh(true); });

    view.querySelector('[data-evolve-all]').addEventListener('click', evolveAll);
}

function bindGrid() {
    grid.addEventListener('pointerdown', event => { lastPointer = event.pointerType; });

    grid.addEventListener('click', event => {
        const tile = event.target.closest('.tile');
        if (!tile) return;
        if (event.target.closest('.tile-evolve')) return evolveWithAnimation(tile.dataset.key);
        openDetails(tile.dataset.key, visibleKeys);
    });

    grid.addEventListener('keydown', event => {
        const tile = event.target.closest('.tile');
        if (!tile || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        openDetails(tile.dataset.key, visibleKeys);
    });

    // Botão direito: adiciona/remove do deck (no toque, o toque longo é usado para arrastar).
    grid.addEventListener('contextmenu', event => {
        const tile = event.target.closest('.tile');
        if (!tile) return;
        event.preventDefault();
        if (lastPointer === 'touch') return;
        toggleDeck(tile.dataset.key, { notify: true });
    });

    draggable(grid, '.tile.owned', tile => ({ type: 'card', key: tile.dataset.key }));
}

function matches(card) {
    const quantity = owned(card.key);
    if (filters.mode === 'tenho' && !quantity) return false;
    if (filters.mode === 'nao-tenho' && quantity) return false;
    if (filters.mode === 'evoluir' && !(quantity && canEvolve(card.key))) return false;
    if (filters.ranks.length && !filters.ranks.includes(card.rank)) return false;
    if (filters.tier !== 'all' && card.tier !== Number(filters.tier)) return false;
    if (filters.query && !normalize(card.nome).includes(filters.query)) return false;
    return true;
}

function compare(a, b) {
    const byNameThenRank = a.nome.localeCompare(b.nome, 'pt-BR') || rankIndex(a.rank) - rankIndex(b.rank);
    switch (filters.sort) {
        case 'rank': return rankIndex(b.rank) - rankIndex(a.rank) || byNameThenRank;
        case 'qtd': return owned(b.key) - owned(a.key) || byNameThenRank;
        case 'nome': return byNameThenRank;
        default: return b[filters.sort] - a[filters.sort] || byNameThenRank;
    }
}

/** Atualiza contadores e, se `regrid`, reaplica filtros e ordenação. */
function refresh(regrid) {
    if (regrid) {
        const list = cards.filter(matches).sort(compare);
        visibleKeys = list.map(card => card.key);
        grid.replaceChildren(...list.map(card => tiles.get(card.key)));
        view.querySelector('[data-empty]').hidden = list.length > 0;
        saveFilters();
    }

    view.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === filters.mode));
    view.querySelectorAll('[data-rank-filter]').forEach(chip => {
        const pressed = filters.ranks.includes(chip.dataset.rankFilter);
        chip.classList.toggle('active', pressed);
        chip.setAttribute('aria-pressed', String(pressed));
    });

    const ownedCards = cards.filter(card => owned(card.key)).length;
    const ownedNames = [...byName.keys()].filter(name => byName.get(name).some(card => owned(card.key))).length;
    const evolvable = cards.filter(card => owned(card.key) && canEvolve(card.key)).length;
    view.querySelector('[data-stats]').innerHTML = `<b>${ownedCards}</b>/${cards.length} cartas · <b>${ownedNames}</b>/${byName.size} personagens`;
    view.querySelector('[data-progress]').style.width = `${(ownedCards / cards.length) * 100}%`;
    view.querySelector('[data-onboarding]').hidden = ownedCards > 0;
    view.querySelector('[data-evolve-count]').textContent = evolvable || '';

    const batchable = cards.filter(card => card.rank !== 'S' && owned(card.key) && canEvolve(card.key)).length;
    view.querySelector('[data-evolve-bar]').hidden = filters.mode !== 'evoluir' || !batchable;
    view.querySelector('[data-evolve-total]').textContent = `${batchable} ${batchable === 1 ? 'carta pode' : 'cartas podem'} evoluir`;
}

function saveFilters() {
    try {
        const { query, ...persisted } = filters;
        localStorage.setItem(FILTERS_KEY, JSON.stringify(persisted));
    } catch { /* ignorado */ }
}

/** Evolui todas as cartas não-S possíveis (inclusive em cadeia) e mostra um resumo. */
async function evolveAll() {
    const ok = await confirmDialog({
        title: 'Evoluir todas?',
        message: 'Todas as cartas de rank F a A com cópias suficientes serão evoluídas, em cadeia. Cartas S não entram, pois viram personagens aleatórios.',
        confirmText: 'Evoluir',
    });
    if (!ok) return;

    const results = [];
    let next;
    while ((next = cards.find(card => card.rank !== 'S' && owned(card.key) && canEvolve(card.key)))) {
        const result = evolve(next.key);
        if (!result) break;
        results.push(result);
    }
    if (!results.length) return toast('Nada para evoluir.', 'info');

    // Agrupa evoluções iguais (ex.: 3× Albedo F -> E) em um único item.
    const groups = new Map();
    for (const result of results) {
        const id = `${result.from.key}>${result.to.key}`;
        const group = groups.get(id) ?? { ...result, count: 0 };
        group.count += 1;
        group.isNew ||= result.isNew;
        groups.set(id, group);
    }
    await playBatch([...groups.values()]);
    toast(`${results.length} ${results.length === 1 ? 'evolução concluída' : 'evoluções concluídas'}!`, 'success');
}
