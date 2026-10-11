// Dados das cartas: carregados uma única vez e indexados para acesso rápido.

export const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
export const DECK_SIZE = 7;
export const STATS = [
    { id: 'hp', label: 'HP' },
    { id: 'atq', label: 'ATQ' },
    { id: 'def', label: 'DEF' },
    { id: 'prof', label: 'PROF' },
];
export const RANK_COLOR = {
    S: '#f6c453', A: '#c58cff', B: '#5aa9ff', C: '#4fd18b', D: '#3cc8c0', E: '#a6adbb', F: '#b98c6a',
};

export const cards = [];
export const byKey = new Map();   // "Nome-Rank" -> carta
export const byName = new Map();  // "Nome" -> cartas ordenadas de F a S
export const statMax = {};        // referência (percentil 95) para as barras de atributo

export const keyOf = (nome, rank) => `${nome}-${rank}`;
export const rankIndex = rank => RANKS.indexOf(rank);
export const nextRank = rank => RANKS[Math.min(rankIndex(rank) + 1, RANKS.length - 1)];

export async function loadCards() {
    const response = await fetch('cartas.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { personagens } = await response.json();

    for (const raw of personagens) {
        const card = Object.freeze({ ...raw, key: keyOf(raw.nome, raw.rank) });
        cards.push(card);
        byKey.set(card.key, card);
        if (!byName.has(card.nome)) byName.set(card.nome, []);
        byName.get(card.nome).push(card);
    }
    for (const list of byName.values()) list.sort((a, b) => rankIndex(a.rank) - rankIndex(b.rank));

    for (const { id } of STATS) {
        const values = cards.map(card => card[id]).sort((a, b) => a - b);
        statMax[id] = values[Math.floor(values.length * 0.95)];
    }
}

// Formato salvo no localStorage (sem o campo interno "key").
export function toRaw(card) {
    const { key, ...raw } = card;
    return raw;
}

export const pick = list => list[Math.floor(Math.random() * list.length)];

export function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
