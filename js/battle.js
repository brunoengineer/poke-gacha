// Batalha: escolha do oponente e o duelo em 7 rodadas.
// Em cada rodada a carta inimiga aparece, mas seus atributos só são revelados depois da sua jogada.

import { byKey, cards, DECK_SIZE, pick, RANK_COLOR, RANKS, shuffle, STATS } from './data.js';
import { addCard, addCoins, markBeaten, state } from './state.js';
import { draggable, dropZone } from './dnd.js';
import { burst } from './fx.js';
import {
    animateNumber, cardBack, cardImg, confirmDialog, esc, fmt, icon, openModal, rankPill, reducedMotion, sleep, toast,
} from './ui.js';

const LEVELS = Array.from({ length: 20 }, (_, i) => (i + 1) * 5);
const ROUNDS = DECK_SIZE;

const BOSS_DECKS = {
    95: ['Venti-S', 'Zhongli-S', 'Raiden-S', 'Nahida-S', 'Furina-S', 'Mavuika-S', 'Hutao-S'],
    100: ['Barbatos-S', 'Morax-S', 'Raiden Ei-S', 'Rukkhadevata-S', 'Murata-S', 'Mavuika-S', 'Hutao-S'],
};

// Quantidade de cartas de cada rank no deck do oponente, por nível máximo.
const DISTRIBUTIONS = [
    [5, { F: 7 }], [10, { F: 6, E: 1 }], [15, { F: 4, E: 3 }], [20, { F: 2, E: 4, D: 1 }],
    [25, { E: 5, D: 1, C: 1 }], [30, { E: 4, D: 2, C: 1 }], [35, { E: 2, D: 3, C: 2 }],
    [40, { E: 1, D: 3, C: 2, B: 1 }], [45, { D: 2, C: 3, B: 1, A: 1 }], [50, { C: 3, B: 2, A: 1, S: 1 }],
    [55, { C: 2, B: 2, A: 2, S: 1 }], [60, { B: 2, A: 3, S: 2 }], [65, { B: 1, A: 4, S: 2 }],
    [70, { A: 4, S: 3 }], [75, { A: 3, S: 4 }], [80, { A: 2, S: 5 }], [85, { A: 1, S: 6 }], [Infinity, { S: 7 }],
];

const OUTCOME = {
    win: { title: 'Você venceu a rodada!', icon: 'check' },
    lose: { title: 'O oponente venceu a rodada', icon: 'x' },
    draw: { title: 'Empate na rodada', icon: 'minus' },
};

let view;
let battle = null; // estado da batalha em andamento (sobrevive à troca de abas)
let ui = null;     // referências do DOM da arena atual

// --- Regras ---------------------------------------------------------------

function generateOpponent(level) {
    if (BOSS_DECKS[level]) return shuffle(BOSS_DECKS[level].map(key => byKey.get(key)).filter(Boolean));
    const distribution = DISTRIBUTIONS.find(([max]) => level <= max)[1];
    const ranks = shuffle(Object.entries(distribution).flatMap(([rank, amount]) => Array(amount).fill(rank)));
    const used = new Set();
    return ranks.map(rank => {
        const fresh = cards.filter(card => card.rank === rank && !used.has(card.key));
        const card = pick(fresh.length ? fresh : cards.filter(c => c.rank === rank));
        used.add(card.key);
        return card;
    });
}

/** Rank da carta de recompensa pela primeira vitória em cada nível (E no nível 5 até S no 100). */
function rewardRank(level) {
    const ranks = RANKS.slice(1);
    const step = (100 - 5) / (ranks.length - 1);
    const clamped = Math.max(5, Math.min(100, level));
    return ranks[Math.min(ranks.length - 1, Math.floor((clamped - 5) / step))];
}

function difficulty(level) {
    if (level === 100) return { label: 'Deuses', cls: 'boss' };
    if (level === 95) return { label: 'Arcontes', cls: 'boss' };
    if (level <= 20) return { label: 'Fácil', cls: 'easy' };
    if (level <= 45) return { label: 'Médio', cls: 'medium' };
    if (level <= 70) return { label: 'Difícil', cls: 'hard' };
    return { label: 'Extremo', cls: 'extreme' };
}

function opponentRanks(level) {
    if (BOSS_DECKS[level]) return ['S'];
    const distribution = DISTRIBUTIONS.find(([max]) => level <= max)[1];
    return RANKS.filter(rank => distribution[rank]).reverse();
}

// --- Montagem -----------------------------------------------------------

export function mountBattle(section) {
    view = section;
    view.addEventListener('click', onClick);

    dropZone('arena', {
        accepts: payload => payload.type === 'hand' && battle && !battle.resolved && !battle.used.has(payload.index),
        drop: payload => {
            select(payload.index, { fromDrop: true });
            return ui.youCard;
        },
    });
}

export function showBattle(arg) {
    const level = Number(arg);
    if (LEVELS.includes(level)) {
        history.replaceState(null, '', '#/batalha');
        if (!battle || battle.level !== level) return start(level);
    }
    if (battle) renderArena();
    else renderLobby();
}

function onClick(event) {
    const level = event.target.closest('[data-level]');
    if (level) return start(Number(level.dataset.level));

    const hand = event.target.closest('.hand-card');
    if (hand) return select(Number(hand.dataset.index));

    const stat = event.target.closest('.stat[data-pick]');
    if (stat) return fight(stat.dataset.stat);

    const action = event.target.closest('[data-act]')?.dataset.act;
    if (action === 'next') next();
    if (action === 'leave') leave();
    if (action === 'unselect' && battle && !battle.resolved) select(battle.selected);
}

// --- Lobby (lista de oponentes) -------------------------------------------

function renderLobby() {
    ui = null;
    const ready = state.deck.length === DECK_SIZE;
    view.innerHTML = `
        <div class="view-head">
            <div>
                <h1 class="view-title">Batalha</h1>
                <p class="view-sub">Você vê a carta do oponente, mas os atributos dela só aparecem depois da sua jogada.</p>
            </div>
        </div>
        <section class="deck-summary ${ready ? 'ready' : 'incomplete'}">
            <div class="deck-summary-cards">
                ${Array.from({ length: DECK_SIZE }, (_, i) => {
                    const card = byKey.get(state.deck[i]);
                    return `<div class="mini-card" ${card ? `data-rank="${card.rank}"` : ''}>${card ? cardImg(card) : ''}</div>`;
                }).join('')}
            </div>
            <div class="deck-summary-text">
                <strong>${ready ? 'Deck pronto para a batalha' : `Seu deck tem ${state.deck.length}/${DECK_SIZE} cartas`}</strong>
                <span>${ready ? 'Escolha um oponente abaixo.' : `Adicione mais ${DECK_SIZE - state.deck.length} na Coleção para batalhar.`}</span>
            </div>
            <a class="btn ${ready ? 'btn-ghost' : 'btn-primary'} btn-sm" href="#/colecao">${icon('cards')} ${ready ? 'Editar deck' : 'Montar deck'}</a>
        </section>
        <h2 class="section-title">Oponentes</h2>
        <div class="levels">
            ${LEVELS.map(level => {
                const beaten = state.beaten.has(level);
                const { label, cls } = difficulty(level);
                const firstReward = level === 100 ? (beaten ? 'B' : 'S') : (beaten ? null : rewardRank(level));
                return `
                    <button class="level level-${cls} ${beaten ? 'beaten' : ''}" type="button" data-level="${level}" ${ready ? '' : 'aria-disabled="true"'}>
                        <span class="level-top">
                            <span class="level-num">${cls === 'boss' ? icon('crown') : ''}Nv. ${level}</span>
                            ${beaten ? `<span class="level-check" title="Vencido">${icon('check')}</span>` : ''}
                        </span>
                        <span class="level-diff">${label}</span>
                        <span class="level-ranks">${opponentRanks(level).map(rankPill).join('')}</span>
                        <span class="level-reward">
                            <span>${icon('coin', 'i-coin')}${level}</span>
                            ${firstReward ? `<span title="Carta de recompensa">${icon('cards')}${firstReward}</span>` : ''}
                        </span>
                    </button>`;
            }).join('')}
        </div>`;
}

// --- Batalha ---------------------------------------------------------------

function start(level) {
    if (state.deck.length !== DECK_SIZE) {
        toast(`Seu deck precisa ter exatamente ${DECK_SIZE} cartas.`, 'warning');
        renderLobby();
        view.querySelector('.deck-summary')?.animate(
            [{ transform: 'scale(1)' }, { transform: 'scale(1.02)' }, { transform: 'scale(1)' }], { duration: 300 });
        return;
    }
    battle = {
        level,
        opponent: generateOpponent(level),
        hand: state.deck.map(key => byKey.get(key)),
        used: new Map(),   // índice da mão -> resultado
        results: [],       // por rodada
        round: 0,
        selected: null,
        resolved: null,    // rodada atual já jogada, aguardando "Próxima"
        score: { you: 0, opp: 0 },
    };
    for (const card of battle.opponent) {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.src = card.imagem;
    }
    renderArena();
    window.scrollTo({ top: 0 });
}

function renderArena() {
    const b = battle;
    view.innerHTML = `
        <div class="arena">
            <div class="arena-bar">
                <button class="btn btn-ghost btn-sm" type="button" data-act="leave">${icon('left')}<span>Sair</span></button>
                <div class="arena-info">
                    <span class="arena-level">Nível ${b.level} · ${difficulty(b.level).label}</span>
                    <span class="arena-round">Rodada <b data-round></b>/${ROUNDS}</span>
                </div>
                <div class="scoreboard" aria-label="Placar">
                    <span class="score you"><small>Você</small><b data-score="you">${b.score.you}</b></span>
                    <span class="score-sep">:</span>
                    <span class="score opp"><b data-score="opp">${b.score.opp}</b><small>Rival</small></span>
                </div>
            </div>
            <ol class="opp-track" aria-label="Cartas do oponente"></ol>
            <div class="field">
                <div class="fighter you">
                    <div class="fighter-card" data-drop="arena"></div>
                    <div class="stats" data-side="you"></div>
                </div>
                <div class="versus" aria-hidden="true"><span>VS</span><div class="fx-particles"></div></div>
                <div class="fighter opp">
                    <div class="fighter-card"></div>
                    <div class="stats" data-side="opp"></div>
                </div>
                <div class="round-result" aria-live="polite"></div>
            </div>
            <div class="hand-wrap">
                <div class="hand-head">
                    <span class="label">Sua mão</span>
                    <span class="hand-tip">Toque ou arraste uma carta para a arena, depois escolha um atributo</span>
                </div>
                <div class="hand"></div>
            </div>
        </div>`;

    ui = {
        arena: view.querySelector('.arena'),
        round: view.querySelector('[data-round]'),
        track: view.querySelector('.opp-track'),
        you: view.querySelector('.fighter.you'),
        opp: view.querySelector('.fighter.opp'),
        youCard: view.querySelector('.fighter.you .fighter-card'),
        oppCard: view.querySelector('.fighter.opp .fighter-card'),
        youStats: view.querySelector('.stats[data-side="you"]'),
        oppStats: view.querySelector('.stats[data-side="opp"]'),
        versus: view.querySelector('.versus'),
        result: view.querySelector('.round-result'),
        hand: view.querySelector('.hand'),
    };

    draggable(ui.hand, '.hand-card:not(.used)', node => (
        battle && !battle.resolved ? { type: 'hand', index: Number(node.dataset.index) } : null));
    ui.youStats.addEventListener('pointerover', event => peek(event.target.closest('.stat')?.dataset.stat));
    ui.youStats.addEventListener('pointerleave', () => peek(null));
    ui.youStats.addEventListener('focusin', event => peek(event.target.closest('.stat')?.dataset.stat));
    ui.youStats.addEventListener('focusout', () => peek(null));

    renderRound();
    if (b.resolved) showResolved();
}

/** Desenha a rodada atual (carta inimiga com atributos ocultos). */
function renderRound({ animate = false } = {}) {
    const b = battle;
    const opponent = b.opponent[b.round];
    ui.round.textContent = b.round + 1;
    ui.arena.classList.remove('resolving');
    ui.you.classList.remove('winner', 'loser', 'tie');
    ui.opp.classList.remove('winner', 'loser', 'tie');
    ui.result.innerHTML = '';

    ui.oppCard.innerHTML = `
        <div class="fc" data-rank="${opponent.rank}" style="--rc:${RANK_COLOR[opponent.rank]}">
            ${cardImg(opponent, { eager: true })}
        </div>
        <p class="fc-name">${esc(opponent.nome)} ${rankPill(opponent.rank)}</p>`;
    ui.oppStats.innerHTML = STATS.map(({ id, label }) => `
        <div class="stat hidden" data-stat="${id}"><span>${label}</span><b>???</b></div>`).join('');

    renderPlayer();
    renderTrack();
    renderHand();

    if (animate && !reducedMotion()) {
        ui.oppCard.querySelector('.fc').animate([
            { transform: 'translateY(-30px) rotateY(90deg)', opacity: 0 },
            { transform: 'none', opacity: 1 },
        ], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
}

function renderPlayer({ fromRect = null } = {}) {
    const b = battle;
    const index = b.resolved ? b.resolved.handIndex : b.selected;
    const card = index == null ? null : b.hand[index];

    if (!card) {
        ui.youCard.innerHTML = `
            <div class="drop-hint">${icon('cards')}<span>Toque ou arraste<br>uma carta aqui</span></div>`;
        ui.youStats.innerHTML = STATS.map(({ id, label }) => `
            <button class="stat" type="button" data-stat="${id}" disabled><span>${label}</span><b>—</b></button>`).join('');
        return;
    }

    ui.youCard.innerHTML = `
        <button class="fc" type="button" data-act="unselect" data-rank="${card.rank}" style="--rc:${RANK_COLOR[card.rank]}" aria-label="Devolver ${esc(card.nome)} para a mão">
            ${cardImg(card, { eager: true })}
        </button>
        <p class="fc-name">${esc(card.nome)} ${rankPill(card.rank)}</p>`;
    ui.youStats.innerHTML = STATS.map(({ id, label }) => `
        <button class="stat" type="button" data-stat="${id}" data-pick ${b.resolved ? 'disabled' : ''}>
            <span>${label}</span><b>${fmt(card[id])}</b>
        </button>`).join('');

    if (fromRect && !reducedMotion()) {
        const fc = ui.youCard.querySelector('.fc');
        const to = fc.getBoundingClientRect();
        fc.animate([
            { transformOrigin: 'top left', transform: `translate(${fromRect.left - to.left}px, ${fromRect.top - to.top}px) scale(${fromRect.width / to.width})` },
            { transformOrigin: 'top left', transform: 'none' },
        ], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
}

function renderTrack() {
    const b = battle;
    ui.track.innerHTML = b.opponent.map((card, i) => {
        const result = b.results[i];
        if (i === b.round && !result) {
            return `<li class="track-card current" aria-label="Rodada ${i + 1}: ${esc(card.nome)}">${cardImg(card)}</li>`;
        }
        if (result) {
            return `<li class="track-card done ${result.outcome}" aria-label="Rodada ${i + 1}: ${OUTCOME[result.outcome].title}">
                ${cardImg(card)}<span class="track-mark">${icon(OUTCOME[result.outcome].icon)}</span></li>`;
        }
        return `<li class="track-card hidden" aria-label="Rodada ${i + 1}: carta oculta">${cardBack()}</li>`;
    }).join('');
}

function renderHand() {
    const b = battle;
    ui.hand.innerHTML = b.hand.map((card, i) => {
        const outcome = b.used.get(i);
        const selected = b.selected === i || b.resolved?.handIndex === i;
        return `
            <button class="hand-card ${outcome ? `used ${outcome}` : ''} ${selected ? 'selected' : ''}" type="button" data-index="${i}" data-rank="${card.rank}"
                ${outcome || b.resolved ? 'disabled' : ''} aria-pressed="${selected}" aria-label="${esc(card.nome)} rank ${card.rank}">
                ${cardImg(card)}
                ${outcome ? `<span class="hand-mark">${icon(OUTCOME[outcome].icon)}</span>` : ''}
            </button>`;
    }).join('');
}

function peek(stat) {
    if (!ui || battle?.resolved) return;
    ui.oppStats.querySelectorAll('.stat').forEach(row => row.classList.toggle('peek', row.dataset.stat === stat));
}

function select(index, { fromDrop = false } = {}) {
    const b = battle;
    if (!b || b.resolved || b.used.has(index)) return;
    const handCard = ui.hand.querySelector(`[data-index="${index}"]`);
    const fromRect = fromDrop ? null : handCard?.getBoundingClientRect();
    b.selected = b.selected === index && !fromDrop ? null : index;
    renderPlayer({ fromRect: b.selected == null ? null : fromRect });
    renderHand();
    if (b.selected != null) ui.youStats.querySelector('.stat')?.focus({ preventScroll: true });
}

async function fight(stat) {
    const b = battle;
    if (!b || b.resolved || b.selected == null) return;

    // Resolve a rodada imediatamente; as animações abaixo só mostram o resultado.
    const handIndex = b.selected;
    const you = b.hand[handIndex];
    const opp = b.opponent[b.round];
    const outcome = you[stat] > opp[stat] ? 'win' : you[stat] < opp[stat] ? 'lose' : 'draw';
    if (outcome === 'win') b.score.you++;
    if (outcome === 'lose') b.score.opp++;
    b.used.set(handIndex, outcome);
    b.results[b.round] = { outcome, stat, you, opp };
    b.resolved = { handIndex, stat, outcome };
    b.selected = null;

    const current = ui;
    current.arena.classList.add('resolving');
    current.youStats.querySelectorAll('.stat').forEach(row => {
        row.disabled = true;
        row.classList.toggle('chosen', row.dataset.stat === stat);
    });
    peek(null);
    renderHand();

    await revealStats(current, opp, stat);
    if (ui !== current) return;
    await clash(current, outcome);
    if (ui !== current) return;
    showResolved({ animate: true });
}

async function revealStats(current, card, chosen) {
    const rows = [...current.oppStats.querySelectorAll('.stat')];
    const flipRow = async (row, delay) => {
        await sleep(delay);
        const reveal = () => {
            row.querySelector('b').textContent = fmt(card[row.dataset.stat]);
            row.classList.remove('hidden');
            row.classList.toggle('chosen', row.dataset.stat === chosen);
        };
        if (reducedMotion()) return reveal();
        await row.animate([{ transform: 'rotateX(0)' }, { transform: 'rotateX(90deg)' }], { duration: 140, easing: 'ease-in' }).finished;
        reveal();
        await row.animate([{ transform: 'rotateX(-90deg)' }, { transform: 'rotateX(0)' }], { duration: 180, easing: 'ease-out' }).finished;
    };
    const others = rows.filter(row => row.dataset.stat !== chosen);
    const target = rows.find(row => row.dataset.stat === chosen);
    await Promise.all(others.map((row, i) => flipRow(row, reducedMotion() ? 0 : i * 70)));
    await flipRow(target, reducedMotion() ? 0 : 220);
}

async function clash(current, outcome) {
    if (reducedMotion()) return;
    const youFc = current.youCard.querySelector('.fc');
    const oppFc = current.oppCard.querySelector('.fc');
    const hit = { duration: 420, easing: 'cubic-bezier(.5,0,.5,1)' };
    burst(current.versus.querySelector('.fx-particles'), {
        color: outcome === 'win' ? '#f4dca3' : outcome === 'lose' ? '#f06a6a' : '#a6adbb', count: 26, distance: 120, duration: 700,
    });
    await Promise.all([
        youFc.animate([{ transform: 'none' }, { transform: 'translateX(18%) rotate(4deg) scale(1.04)', offset: 0.45 }, { transform: 'none' }], hit).finished,
        oppFc.animate([{ transform: 'none' }, { transform: 'translateX(-18%) rotate(-4deg) scale(1.04)', offset: 0.45 }, { transform: 'none' }], hit).finished,
    ]);
}

/** Mostra o estado de rodada jogada: vencedor destacado e botão para continuar. */
function showResolved({ animate = false } = {}) {
    const b = battle;
    const { stat, outcome } = b.resolved;
    const result = b.results[b.round];
    const label = STATS.find(s => s.id === stat).label;

    if (!animate) {
        ui.arena.classList.add('resolving');
        ui.oppStats.querySelectorAll('.stat').forEach(row => {
            row.querySelector('b').textContent = fmt(result.opp[row.dataset.stat]);
            row.classList.remove('hidden');
            row.classList.toggle('chosen', row.dataset.stat === stat);
        });
        ui.youStats.querySelectorAll('.stat').forEach(row => row.classList.toggle('chosen', row.dataset.stat === stat));
    }

    ui.you.classList.add(outcome === 'win' ? 'winner' : outcome === 'lose' ? 'loser' : 'tie');
    ui.opp.classList.add(outcome === 'lose' ? 'winner' : outcome === 'win' ? 'loser' : 'tie');
    for (const side of ['you', 'opp']) {
        const node = view.querySelector(`[data-score="${side}"]`);
        if (Number(node.textContent) !== b.score[side]) {
            node.textContent = b.score[side];
            if (animate && !reducedMotion()) node.animate([{ transform: 'scale(1.7)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
        }
    }
    renderTrack();

    const last = b.round === ROUNDS - 1;
    ui.result.innerHTML = `
        <div class="rr rr-${outcome}">
            <div class="rr-text">
                <strong>${icon(OUTCOME[outcome].icon)} ${OUTCOME[outcome].title}</strong>
                <span>${label}: <b>${fmt(result.you[stat])}</b> vs <b>${fmt(result.opp[stat])}</b></span>
            </div>
            <button class="btn btn-primary" type="button" data-act="next">${last ? 'Ver resultado' : 'Próxima rodada'} ${icon('right')}</button>
        </div>`;
    if (animate && !reducedMotion()) {
        ui.result.firstElementChild.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' });
    }
    ui.result.querySelector('[data-act="next"]').focus({ preventScroll: true });
    if (animate) ui.result.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

function next() {
    const b = battle;
    if (!b?.resolved) return;
    b.resolved = null;
    b.round++;
    if (b.round >= ROUNDS) return finish();
    renderRound({ animate: true });
}

async function leave() {
    if (!battle) return renderLobby();
    const ok = await confirmDialog({
        title: 'Abandonar a batalha?',
        message: 'Você não receberá nenhuma recompensa por esta batalha.',
        confirmText: 'Abandonar',
        danger: true,
    });
    if (!ok) return;
    battle = null;
    renderLobby();
}

// --- Fim de batalha --------------------------------------------------------

function finish() {
    const b = battle;
    battle = null;
    const { you, opp } = b.score;
    const outcome = you > opp ? 'win' : you < opp ? 'lose' : 'draw';
    let coins = 0;
    let perfect = false;
    let reward = null;
    let rewardNote = '';

    if (outcome === 'win') {
        coins = Math.min(b.level, 500);
        if (you === ROUNDS && opp === 0) {
            coins *= 2;
            perfect = true;
        }
        if (b.level === 100) {
            const first = !state.beaten.has(100);
            reward = pick(cards.filter(card => card.rank === (first ? 'S' : 'B')));
            rewardNote = first ? 'Primeira vitória épica contra os Deuses!' : 'Recompensa por vencer o Nível 100';
            if (first) markBeaten(100);
        } else if (!state.beaten.has(b.level)) {
            markBeaten(b.level);
            reward = pick(cards.filter(card => card.rank === rewardRank(b.level)));
            rewardNote = 'Recompensa de primeira vitória';
        }
    } else if (outcome === 'draw') {
        coins = Math.min(Math.floor(b.level / 5), 10);
    }
    addCoins(coins);
    const isNew = reward ? addCard(reward.key) : false;

    const titles = { win: 'Vitória!', lose: 'Derrota', draw: 'Empate' };
    const modal = openModal({
        className: `modal-result result-${outcome}`,
        label: titles[outcome],
        dismissable: false,
        html: `
            <div class="result">
                <div class="result-crest">${icon(outcome === 'win' ? 'trophy' : outcome === 'lose' ? 'flag' : 'minus')}</div>
                <h2 class="result-title">${titles[outcome]}</h2>
                ${perfect ? '<p class="result-perfect">Vitória perfeita! Moedas ×2</p>' : ''}
                <p class="result-score"><b>${you}</b><span>×</span><b>${opp}</b></p>
                <p class="result-coins">${icon('coin', 'i-coin')} +<span data-coins>0</span> moedas</p>
                ${reward ? `
                    <div class="result-reward">
                        <p class="label">${rewardNote}</p>
                        <div class="flip-card" data-rank="${reward.rank}" style="--rc:${RANK_COLOR[reward.rank]}">
                            <span class="flip-inner">
                                <span class="face back">${cardBack()}</span>
                                <span class="face front">${cardImg(reward, { eager: true })}${isNew ? '<span class="new-tag">NOVA!</span>' : ''}</span>
                            </span>
                        </div>
                        <p class="result-reward-name">${esc(reward.nome)} ${rankPill(reward.rank)}</p>
                    </div>` : ''}
                <details class="result-log">
                    <summary>${icon('chevron')} Resumo das rodadas</summary>
                    <ol>
                        ${b.results.map((r, i) => `
                            <li class="log-${r.outcome}">
                                <span class="log-round">${i + 1}</span>
                                <span class="log-card">${esc(r.you.nome)} ${rankPill(r.you.rank)}</span>
                                <span class="log-stat">${STATS.find(s => s.id === r.stat).label} ${fmt(r.you[r.stat])} vs ${fmt(r.opp[r.stat])}</span>
                                <span class="log-card">${esc(r.opp.nome)} ${rankPill(r.opp.rank)}</span>
                                <span class="log-mark">${icon(OUTCOME[r.outcome].icon)}</span>
                            </li>`).join('')}
                    </ol>
                </details>
                <div class="dialog-actions">
                    <button class="btn btn-ghost" type="button" data-close data-go="lobby">Oponentes</button>
                    <button class="btn btn-primary" type="button" data-close data-go="again" autofocus>${icon('reset')} Jogar de novo</button>
                </div>
            </div>`,
    });

    modal.root.addEventListener('click', event => {
        const go = event.target.closest('[data-go]')?.dataset.go;
        if (go === 'again') start(b.level);
        if (go === 'lobby') renderLobby();
    });
    animateNumber(modal.root.querySelector('[data-coins]'), 0, coins, 900);
    if (outcome === 'win') burst(modal.root.querySelector('.result-crest'), { color: '#f4dca3', count: 34, distance: 200 });

    const flip = modal.root.querySelector('.flip-card');
    if (flip) {
        setTimeout(() => {
            flip.classList.add('is-flipped');
            burst(flip, { color: RANK_COLOR[reward.rank], count: 30, distance: 160 });
        }, reducedMotion() ? 0 : 700);
    }
}
