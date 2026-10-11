// Animação de evolução: as cópias se fundem, um clarão e a nova carta é revelada.

import { RANK_COLOR, STATS } from './data.js';
import { evolve } from './state.js';
import { Sequence, burst } from './fx.js';
import { cardImg, esc, fmt, icon, openModal, rankPill, toast } from './ui.js';

export async function evolveWithAnimation(key) {
    const result = evolve(key);
    if (!result) {
        toast('Cópias insuficientes para evoluir.', 'error');
        return null;
    }
    await playEvolution(result);
    return result;
}

/** Mostra várias evoluções de uma vez (botão "Evoluir todas"). */
export function playBatch(results) {
    return new Promise(resolve => {
        const modal = openModal({
            className: 'fx-overlay evo-batch',
            label: 'Evoluções concluídas',
            dismissable: false,
            onClose: resolve,
            html: `
                <div class="batch">
                    <h2 class="fx-title">Evoluções concluídas!</h2>
                    <div class="batch-grid">
                        ${results.map(({ from, to, isNew, count = 1 }) => `
                            <div class="batch-item" style="--rc:${RANK_COLOR[to.rank]}">
                                <div class="batch-card">
                                    ${cardImg(to, { eager: true })}
                                    ${isNew ? '<span class="new-tag">NOVA</span>' : ''}
                                    ${count > 1 ? `<span class="batch-count">×${count}</span>` : ''}
                                </div>
                                <span class="batch-label">${esc(to.nome)} ${rankPill(from.rank)}${icon('right')}${rankPill(to.rank)}</span>
                            </div>`).join('')}
                    </div>
                    <button class="btn btn-primary btn-lg" type="button" data-close>Continuar</button>
                </div>`,
        });
        const seq = new Sequence();
        modal.root.querySelectorAll('.batch-item').forEach((item, i) => {
            seq.anim(item, [
                { opacity: 0, transform: 'translateY(18px) scale(.85) rotateY(70deg)' },
                { opacity: 1, transform: 'none' },
            ], { duration: 480, delay: 120 + i * 70, easing: 'cubic-bezier(.2,.8,.2,1)' });
        });
    });
}

function playEvolution({ from, to, isNew }) {
    const transmute = from.rank === 'S';
    const copies = transmute ? 2 : 3;
    return new Promise(resolve => {
        const modal = openModal({
            className: 'fx-overlay evo',
            label: transmute ? 'Transmutação' : 'Evolução',
            dismissable: false,
            onClose: resolve,
            html: `
                <div class="evo-stage" style="--from:${RANK_COLOR[from.rank]};--to:${RANK_COLOR[to.rank]}">
                    <div class="evo-rays"></div>
                    <div class="evo-glow"></div>
                    ${`<div class="evo-copy">${cardImg(from, { eager: true })}</div>`.repeat(copies)}
                    <div class="evo-result">${cardImg(to, { eager: true })}${isNew ? '<span class="new-tag">NOVA!</span>' : ''}</div>
                    <div class="evo-flash"></div>
                    <div class="fx-particles"></div>
                </div>
                <div class="evo-caption">
                    <div class="evo-ranks">${rankPill(from.rank)}${icon('right')}${rankPill(to.rank)}</div>
                    <h2 class="fx-title">${esc(to.nome)}</h2>
                    <p class="evo-sub">${transmute ? `${esc(from.nome)} se transformou!` : 'Evolução concluída!'}</p>
                    ${transmute ? '' : `<div class="evo-deltas">${STATS.map(s => `<span><small>${s.label}</small>+${fmt(to[s.id] - from[s.id])}</span>`).join('')}</div>`}
                    <button class="btn btn-primary btn-lg" type="button" data-close>Continuar</button>
                </div>
                <p class="fx-skip">Toque para pular</p>`,
        });
        run(modal.root, to);
    });
}

async function run(root, to) {
    const seq = new Sequence();
    const stage = root.querySelector('.evo-stage');
    const copies = [...root.querySelectorAll('.evo-copy')];
    const result = root.querySelector('.evo-result');
    const particles = root.querySelector('.fx-particles');

    root.addEventListener('click', event => {
        if (!root.classList.contains('is-done') && !event.target.closest('.btn')) seq.skip();
    });

    const spread = copies.length === 3 ? [-1, 0, 1] : [-0.6, 0.6];

    // 1. As cópias aparecem em leque.
    await Promise.all(copies.map((copy, i) => seq.anim(copy, [
        { opacity: 0, transform: `translateX(${spread[i] * 20}%) translateY(40px) scale(.6)` },
        { opacity: 1, transform: `translateX(${spread[i] * 72}%) rotate(${spread[i] * 10}deg)` },
    ], { duration: 460, delay: i * 90, easing: 'cubic-bezier(.2,.8,.2,1)' })));

    // 2. Energia converge e as cópias se fundem.
    burst(particles, { color: RANK_COLOR[to.rank], count: 30, distance: 260, duration: 1000, inward: true });
    seq.anim(root.querySelector('.evo-glow'), [
        { opacity: 0, transform: 'scale(.5)' },
        { opacity: 1, transform: 'scale(1.15)' },
    ], { duration: 1000, easing: 'ease-in' });
    await Promise.all(copies.map((copy, i) => seq.anim(copy, [
        { transform: `translateX(${spread[i] * 72}%) rotate(${spread[i] * 10}deg)` },
        { transform: `translateX(${spread[i] * 12}%) rotate(${spread[i] * 2}deg)`, offset: 0.65 },
        { transform: 'translateX(0) rotate(0) scale(.94)' },
    ], { duration: 950, easing: 'cubic-bezier(.6,0,.4,1)' })));
    await seq.anim(stage, [
        { transform: 'translate(0, 0)' }, { transform: 'translate(-4px, 2px)' }, { transform: 'translate(4px, -2px)' },
        { transform: 'translate(-3px, -1px)' }, { transform: 'translate(3px, 1px)' }, { transform: 'translate(0, 0)' },
    ], { duration: 280, fill: 'none' });

    // 3. Clarão e revelação.
    seq.anim(root.querySelector('.evo-flash'), [
        { opacity: 0, transform: 'scale(.3)' },
        { opacity: 1, transform: 'scale(1.3)', offset: 0.3 },
        { opacity: 0, transform: 'scale(2.2)' },
    ], { duration: 750, easing: 'ease-out' });
    await seq.wait(180);
    root.classList.add('is-merged');
    burst(particles, { color: RANK_COLOR[to.rank], count: 40, distance: 320, duration: 1100 });
    seq.anim(root.querySelector('.evo-rays'), [{ opacity: 0 }, { opacity: 1 }], { duration: 700 });
    await seq.anim(result, [
        { opacity: 0, transform: 'scale(1.35) rotateY(100deg)' },
        { opacity: 1, transform: 'scale(.97) rotateY(-10deg)', offset: 0.6 },
        { opacity: 1, transform: 'none' },
    ], { duration: 760, easing: 'cubic-bezier(.2,.8,.2,1)' });

    // 4. Legenda com o resultado.
    await seq.anim(root.querySelector('.evo-caption'), [
        { opacity: 0, transform: 'translateY(16px)' },
        { opacity: 1, transform: 'none' },
    ], { duration: 380, easing: 'ease-out' });

    root.classList.add('is-merged', 'is-done');
    root.querySelector('.evo-caption .btn').focus({ preventScroll: true });
}
