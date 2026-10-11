// Tela de Oração (gacha): banners, animação de meteoro e revelação das cartas.

import { byName, cards, pick, RANK_COLOR, rankIndex, shuffle } from './data.js';
import { addCard, on, spendCoins, state } from './state.js';
import { Sequence, burst } from './fx.js';
import { openDetails } from './details.js';
import { cardBack, cardImg, esc, fmt, icon, openModal, rankPill, shakeCoins, stars, toast } from './ui.js';

// Mesmas probabilidades da versão original.
const BANNERS = {
    common: {
        name: 'Oração Comum',
        cost: 10,
        counts: [1, 10],
        ranks: [['S', 0.001], ['A', 0.002], ['B', 0.003], ['C', 0.006], ['D', 0.013], ['E', 0.025], ['F', 0.95]],
        fiveStar: 1 / 3,
    },
    premium: {
        name: 'Oração Premium',
        cost: 1500,
        counts: [1],
        ranks: [['S', 0.05], ['A', 0.45], ['B', 0.5]],
        fiveStar: 0.5,
    },
};

const pools = new Map(); // "rank-tier" -> cartas
let view;
let history = [];
let busy = false;

function roll(banner) {
    let r = Math.random();
    let rank = banner.ranks.at(-1)[0];
    for (const [candidate, chance] of banner.ranks) {
        if (r < chance) { rank = candidate; break; }
        r -= chance;
    }
    const tier = Math.random() < banner.fiveStar ? 5 : 4;
    const pool = pools.get(`${rank}-${tier}`) ?? cards.filter(card => card.rank === rank);
    return pick(pool);
}

const percent = value => `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export function mountGacha(section) {
    view = section;
    for (const card of cards) {
        const id = `${card.rank}-${card.tier}`;
        if (!pools.has(id)) pools.set(id, []);
        pools.get(id).push(card);
    }

    const featured = {
        common: shuffle(cards.filter(card => card.rank === 'A')).slice(0, 3),
        // Arcontes e Deuses (personagens que só existem no rank S).
        premium: shuffle(cards.filter(card => byName.get(card.nome).length === 1)).slice(0, 3),
    };

    view.innerHTML = `
        <div class="view-head">
            <div>
                <h1 class="view-title">Oração</h1>
                <p class="view-sub">Use suas moedas para invocar novas cartas.</p>
            </div>
        </div>
        <div class="banners">
            ${Object.entries(BANNERS).map(([id, banner]) => `
                <article class="banner banner-${id}">
                    <div class="banner-art" aria-hidden="true">
                        ${featured[id].map(card => `<div class="banner-card">${cardImg(card)}</div>`).join('')}
                    </div>
                    <div class="banner-body">
                        <p class="banner-kicker">${id === 'premium' ? 'Rank B ou superior garantido' : 'Qualquer rank, do F ao S'}</p>
                        <h2 class="banner-title">${banner.name}</h2>
                        <p class="banner-text">${id === 'premium'
                            ? '5% de chance de rank S, inclusive Arcontes e Deuses.'
                            : 'Ótima para encher a coleção e juntar cópias para evoluir.'}</p>
                        <div class="banner-actions">
                            ${banner.counts.map(count => `
                                <button class="btn ${id === 'premium' ? 'btn-primary' : 'btn-secondary'} btn-lg pull-btn" type="button" data-pull="${id}" data-count="${count}">
                                    <span>Orar ×${count}</span>
                                    <span class="cost">${icon('coin', 'i-coin')}${fmt(banner.cost * count)}</span>
                                </button>`).join('')}
                        </div>
                    </div>
                </article>`).join('')}
        </div>
        <details class="odds">
            <summary>${icon('chevron')} Probabilidades</summary>
            <div class="odds-grid">
                ${Object.values(BANNERS).map(banner => `
                    <div>
                        <h3>${banner.name}</h3>
                        <ul>
                            ${banner.ranks.map(([rank, chance]) => `<li>${rankPill(rank)}<span>${percent(chance)}</span></li>`).join('')}
                            <li><span class="stars">★★★★★</span><span>${percent(banner.fiveStar)}</span></li>
                        </ul>
                    </div>`).join('')}
            </div>
        </details>
        <section class="history" data-history hidden>
            <h2 class="section-title">Orações recentes</h2>
            <div class="history-row" data-history-row></div>
        </section>`;

    view.addEventListener('click', event => {
        const button = event.target.closest('[data-pull]');
        if (button) return pull(button.dataset.pull, Number(button.dataset.count));
        const item = event.target.closest('[data-history-key]');
        if (item) openDetails(item.dataset.historyKey);
    });
    on('coins', updateButtons);
    updateButtons();
}

function updateButtons() {
    view.querySelectorAll('[data-pull]').forEach(button => {
        const cost = BANNERS[button.dataset.pull].cost * Number(button.dataset.count);
        button.classList.toggle('cant-afford', state.coins < cost);
    });
}

async function pull(type, count) {
    if (busy) return;
    const banner = BANNERS[type];
    const cost = banner.cost * count;
    if (!spendCoins(cost)) {
        shakeCoins();
        toast(`Moedas insuficientes! Você precisa de ${fmt(cost)}.`, 'error');
        return;
    }
    busy = true;
    const results = Array.from({ length: count }, () => {
        const card = roll(banner);
        return { card, isNew: addCard(card.key) };
    });
    history = [...results, ...history].slice(0, 20);
    renderHistory();

    const again = await playPull(results, banner, count);
    busy = false;
    if (again) pull(type, count);
}

function renderHistory() {
    view.querySelector('[data-history]').hidden = !history.length;
    view.querySelector('[data-history-row]').innerHTML = history.map(({ card, isNew }) => `
        <button class="history-item" type="button" data-history-key="${esc(card.key)}" data-rank="${card.rank}" aria-label="${esc(card.nome)} rank ${card.rank}">
            ${cardImg(card)}${isNew ? '<span class="new-dot" title="Nova"></span>' : ''}
        </button>`).join('');
}

function meteorColor(results) {
    const best = results.reduce((top, { card }) => Math.max(top, rankIndex(card.rank)), 0);
    if (best >= rankIndex('S')) return RANK_COLOR.S;
    if (best >= rankIndex('B')) return RANK_COLOR.A;
    return RANK_COLOR.B;
}

function playPull(results, banner, count) {
    const color = meteorColor(results);
    const single = results.length === 1;
    const againCost = banner.cost * count;

    return new Promise(resolve => {
        const modal = openModal({
            className: 'fx-overlay pull',
            label: 'Resultado da oração',
            dismissable: false,
            onClose: resolve,
            html: `
                <div class="pull-sky" aria-hidden="true"></div>
                <div class="meteor" style="--c:${color}" aria-hidden="true"></div>
                <div class="pull-flash" style="--c:${color}" aria-hidden="true"></div>
                <div class="pull-grid ${single ? 'single' : ''}">
                    ${results.map(({ card, isNew }, i) => `
                        <button class="flip-card" type="button" data-i="${i}" data-rank="${card.rank}" style="--rc:${RANK_COLOR[card.rank]}" aria-label="Revelar carta">
                            <span class="flip-inner">
                                <span class="face back">${cardBack()}</span>
                                <span class="face front">${cardImg(card, { eager: true })}${isNew ? '<span class="new-tag">NOVA!</span>' : ''}</span>
                            </span>
                            <span class="flip-caption"><span class="flip-name">${esc(card.nome)}</span>${stars(card.tier)}</span>
                        </button>`).join('')}
                </div>
                <div class="pull-actions">
                    <button class="btn btn-ghost" type="button" data-act="reveal">Revelar tudo</button>
                    <button class="btn btn-ghost" type="button" data-close hidden>Fechar</button>
                    <button class="btn btn-primary" type="button" data-act="again" hidden>
                        Orar ×${count} de novo <span class="cost">${icon('coin', 'i-coin')}${fmt(againCost)}</span>
                    </button>
                </div>
                <p class="fx-skip">Toque para pular</p>`,
        });
        runPull(modal, results, againCost);
    });
}

async function runPull(modal, results, againCost) {
    const { root } = modal;
    const intro = new Sequence();
    const reveal = new Sequence();
    const flips = [...root.querySelectorAll('.flip-card')];
    let revealed = 0;

    const finish = () => {
        root.classList.add('is-done');
        root.querySelector('[data-act="reveal"]').hidden = true;
        root.querySelector('[data-close]').hidden = false;
        const again = root.querySelector('[data-act="again"]');
        again.hidden = false;
        again.disabled = state.coins < againCost;
        (again.disabled ? root.querySelector('[data-close]') : again).focus({ preventScroll: true });
    };

    const flip = card => {
        if (card.classList.contains('is-flipped')) return;
        card.classList.add('is-flipped');
        card.setAttribute('aria-label', card.querySelector('img').alt);
        if (['S', 'A'].includes(card.dataset.rank)) {
            card.classList.add('is-rare');
            burst(card, { color: card.style.getPropertyValue('--rc'), count: card.dataset.rank === 'S' ? 36 : 20, distance: 150 });
        }
        if (++revealed === flips.length) finish();
    };

    const revealAll = () => {
        reveal.skip();
        flips.forEach(flip);
    };

    root.addEventListener('click', event => {
        if (event.target.closest('[data-act="again"]')) return modal.close(true);
        if (event.target.closest('[data-close]') || root.classList.contains('is-done')) return;
        if (!root.classList.contains('show-cards')) return intro.skip();
        const card = event.target.closest('.flip-card');
        if (card && !event.target.closest('[data-act]')) return flip(card);
        revealAll();
    });

    // 1. Meteoro cruzando o céu (cor indica a melhor raridade).
    intro.anim(root.querySelector('.pull-sky'), [{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
    await intro.anim(root.querySelector('.meteor'), [
        { transform: 'translate(45vw, -50vh) rotate(-35deg) scaleX(.4)', opacity: 0 },
        { transform: 'translate(20vw, -28vh) rotate(-35deg) scaleX(1)', opacity: 1, offset: 0.25 },
        { transform: 'translate(-8vw, 4vh) rotate(-35deg) scaleX(1)', opacity: 1, offset: 0.8 },
        { transform: 'translate(-12vw, 8vh) rotate(-35deg) scaleX(.2)', opacity: 0 },
    ], { duration: 1300, easing: 'cubic-bezier(.4,0,.6,1)' });

    // 2. Clarão.
    await intro.anim(root.querySelector('.pull-flash'), [
        { opacity: 0, transform: 'scale(.2)' },
        { opacity: 1, transform: 'scale(1)', offset: 0.35 },
        { opacity: 0, transform: 'scale(1.6)' },
    ], { duration: 650, easing: 'ease-out' });
    root.classList.add('show-cards');

    // 3. Cartas aparecem viradas e são reveladas uma a uma (toque numa carta para virá-la antes).
    await Promise.all(flips.map((card, i) => reveal.anim(card, [
        { opacity: 0, transform: 'translateY(30px) scale(.8)' },
        { opacity: 1, transform: 'none' },
    ], { duration: 380, delay: i * 55, easing: 'cubic-bezier(.2,.8,.2,1)' })));

    for (const card of flips) {
        if (reveal.skipped) break;
        await reveal.wait(['S', 'A'].includes(card.dataset.rank) ? 420 : 170);
        flip(card);
    }
    if (reveal.skipped) flips.forEach(flip);
}
