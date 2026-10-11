// Estado do jogador (coleção, deck, moedas, níveis vencidos) e persistência.
// Usa as mesmas chaves e formato do localStorage da versão anterior, então saves antigos continuam válidos.

import { byKey, cards, DECK_SIZE, keyOf, nextRank, pick, toRaw } from './data.js';

const STORAGE = { collection: 'colecaoJogador', deck: 'deck', coins: 'moedas', beaten: 'beatenLevels' };
const START_COINS = 100;

export const state = {
    collection: new Map(), // key -> quantidade
    deck: [],              // keys, na ordem dos slots
    coins: START_COINS,
    beaten: new Set(),
};

// --- Eventos -------------------------------------------------------------

const listeners = new Map();

export function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event).delete(fn);
}

function emit(event, detail) {
    listeners.get(event)?.forEach(fn => fn(detail));
}

// --- Persistência --------------------------------------------------------

function read(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value == null ? fallback : JSON.parse(value);
    } catch {
        return fallback;
    }
}

export function loadState() {
    const collection = read(STORAGE.collection, {});
    for (const [key, value] of Object.entries(collection ?? {})) {
        const quantity = Math.floor(typeof value === 'number' ? value : Number(value?.quantidade));
        if (byKey.has(key) && quantity > 0) state.collection.set(key, quantity);
    }

    const deck = read(STORAGE.deck, []);
    if (Array.isArray(deck)) {
        for (const entry of deck) {
            const key = typeof entry === 'string' ? entry : entry && keyOf(entry.nome, entry.rank);
            if (state.collection.has(key) && !state.deck.includes(key) && state.deck.length < DECK_SIZE) {
                state.deck.push(key);
            }
        }
    }

    const coins = parseInt(read(STORAGE.coins, START_COINS), 10);
    state.coins = Number.isFinite(coins) ? coins : START_COINS;

    const beaten = read(STORAGE.beaten, []);
    if (Array.isArray(beaten)) beaten.forEach(level => state.beaten.add(Number(level)));
}

let saveTimer = 0;

function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 150);
}

export function saveNow() {
    clearTimeout(saveTimer);
    try {
        const collection = {};
        state.collection.forEach((quantidade, key) => {
            collection[key] = { ...toRaw(byKey.get(key)), quantidade };
        });
        localStorage.setItem(STORAGE.collection, JSON.stringify(collection));
        localStorage.setItem(STORAGE.deck, JSON.stringify(state.deck.map(key => toRaw(byKey.get(key)))));
        localStorage.setItem(STORAGE.coins, String(state.coins));
        localStorage.setItem(STORAGE.beaten, JSON.stringify([...state.beaten]));
    } catch (error) {
        console.error('Não foi possível salvar o progresso:', error);
    }
}

addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
});

export function resetAll() {
    clearTimeout(saveTimer);
    Object.values(STORAGE).forEach(key => localStorage.removeItem(key));
    removeEventListener('pagehide', saveNow);
    location.reload();
}

// --- Moedas --------------------------------------------------------------

export function addCoins(amount) {
    if (!amount) return;
    state.coins += amount;
    scheduleSave();
    emit('coins', amount);
}

export function spendCoins(amount) {
    if (state.coins < amount) return false;
    state.coins -= amount;
    scheduleSave();
    emit('coins', -amount);
    return true;
}

// --- Coleção -------------------------------------------------------------

export const owned = key => state.collection.get(key) ?? 0;

/** Adiciona uma cópia. Retorna true se for a primeira cópia (carta nova). */
export function addCard(key) {
    const quantity = owned(key) + 1;
    state.collection.set(key, quantity);
    scheduleSave();
    emit('collection', [key]);
    return quantity === 1;
}

export const evolveNeed = rank => (rank === 'S' ? 2 : 3);
export const canEvolve = key => owned(key) >= evolveNeed(byKey.get(key).rank);

/** Cópias consumidas: sempre sobra pelo menos uma cópia da carta original. */
export const evolveCost = key => (byKey.get(key).rank === 'S' ? 1 : Math.min(3, owned(key) - 1));

/**
 * Evolui uma carta: 3 cópias -> próximo rank do mesmo personagem.
 * Cartas S (2 cópias) se transformam em uma carta S aleatória.
 */
export function evolve(key) {
    const from = byKey.get(key);
    if (!from || !canEvolve(key)) return null;

    const to = from.rank === 'S'
        ? pick(cards.filter(card => card.rank === 'S' && card.key !== key))
        : byKey.get(keyOf(from.nome, nextRank(from.rank)));
    if (!to) return null;

    const cost = evolveCost(key);
    state.collection.set(key, owned(key) - cost);
    const isNew = owned(to.key) === 0;
    state.collection.set(to.key, owned(to.key) + 1);
    scheduleSave();
    emit('collection', [key, to.key]);
    return { from, to, cost, isNew };
}

// --- Deck ----------------------------------------------------------------

export const inDeck = key => state.deck.includes(key);

/**
 * Adiciona ao deck. Com `index` apontando para um slot ocupado, substitui a carta daquele slot.
 * Retorna 'added' | 'replaced' | 'full' | 'duplicate' | 'not-owned'.
 */
export function addToDeck(key, index = state.deck.length) {
    if (!owned(key)) return 'not-owned';
    if (inDeck(key)) return 'duplicate';
    let result;
    if (index < state.deck.length) {
        state.deck[index] = key;
        result = 'replaced';
    } else if (state.deck.length >= DECK_SIZE) {
        return 'full';
    } else {
        state.deck.push(key);
        result = 'added';
    }
    scheduleSave();
    emit('deck');
    return result;
}

export function removeFromDeck(key) {
    const index = state.deck.indexOf(key);
    if (index < 0) return;
    state.deck.splice(index, 1);
    scheduleSave();
    emit('deck');
}

/** Troca duas cartas de lugar; um destino vazio move a carta para o fim. */
export function moveInDeck(from, to) {
    if (from === to || from < 0 || from >= state.deck.length) return;
    if (to >= state.deck.length) {
        state.deck.push(...state.deck.splice(from, 1));
    } else {
        [state.deck[from], state.deck[to]] = [state.deck[to], state.deck[from]];
    }
    scheduleSave();
    emit('deck');
}

export function clearDeck() {
    state.deck = [];
    scheduleSave();
    emit('deck');
}

// --- Batalha -------------------------------------------------------------

export function markBeaten(level) {
    state.beaten.add(level);
    scheduleSave();
}
