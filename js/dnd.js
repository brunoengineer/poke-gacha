// Arrastar e soltar com Pointer Events: funciona com mouse e toque.
// No mouse o arraste começa ao mover alguns pixels; no toque, com um toque longo (para não atrapalhar a rolagem).
// Alvos são elementos com [data-drop="nome"], registrados com dropZone(nome, { accepts, drop }).
// `rect` guarda a posição de origem (para a carta voltar), já que `source` pode mudar durante o arraste.

import { reducedMotion } from './ui.js';

const LONG_PRESS_MS = 260;
const zones = new Map();
let pending = null;
let active = null;
let frame = 0;
let suppressClickUntil = 0;

export function dropZone(name, { accepts = () => true, drop }) {
    zones.set(name, { accepts, drop });
}

/**
 * Torna arrastáveis os elementos de `root` que casam com `selector`.
 * `getPayload(el)` descreve o que está sendo arrastado (ou null para ignorar).
 * `onOutside(payload)` é chamado quando o item é solto fora de qualquer alvo válido.
 */
export function draggable(root, selector, getPayload, { onOutside } = {}) {
    root.addEventListener('pointerdown', event => {
        if (event.button !== 0 || pending || active) return;
        const source = event.target.closest(selector);
        if (!source || !root.contains(source)) return;
        const control = event.target.closest('button, a, input, select');
        if (control && control !== source && source.contains(control)) return;
        const payload = getPayload(source);
        if (!payload) return;

        pending = {
            source, payload, onOutside,
            id: event.pointerId,
            touch: event.pointerType !== 'mouse',
            startX: event.clientX, startY: event.clientY,
            x: event.clientX, y: event.clientY,
        };
        if (pending.touch) pending.timer = setTimeout(begin, LONG_PRESS_MS);
        listen(true);
    });

    // Durante um arraste por toque, impede que a página role.
    root.addEventListener('touchmove', event => {
        if (active) event.preventDefault();
    }, { passive: false });
}

function listen(enable) {
    const method = enable ? 'addEventListener' : 'removeEventListener';
    window[method]('pointermove', onMove);
    window[method]('pointerup', onUp);
    window[method]('pointercancel', onCancel);
}

function onMove(event) {
    const current = active || pending;
    if (!current || event.pointerId !== current.id) return;
    current.x = event.clientX;
    current.y = event.clientY;

    if (!active) {
        const distance = Math.hypot(current.x - current.startX, current.y - current.startY);
        if (pending.touch) {
            if (distance > 10) reset(); // o usuário está rolando a página
        } else if (distance > 6) {
            begin();
        }
        return;
    }
    if (!frame) frame = requestAnimationFrame(update);
}

function begin() {
    clearTimeout(pending.timer);
    const { source } = pending;
    const image = source.querySelector('img');
    const rect = (image || source).getBoundingClientRect();

    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    if (image) ghost.append(image.cloneNode());
    document.body.append(ghost);

    active = {
        ...pending, ghost, rect,
        offsetX: pending.x - rect.left,
        offsetY: pending.y - rect.top,
        lastX: pending.x,
        tilt: 0,
        zone: null,
    };
    pending = null;
    ghost.style.transformOrigin = `${active.offsetX}px ${active.offsetY}px`;
    try { source.setPointerCapture(active.id); } catch { /* ponteiro já liberado */ }

    source.classList.add('drag-source');
    document.body.classList.add('is-dragging');
    document.dispatchEvent(new CustomEvent('dnd:start', { detail: active.payload }));
    for (const zone of document.querySelectorAll('[data-drop]')) {
        if (accepts(zone)) zone.classList.add('drop-ready');
    }
    getSelection()?.removeAllRanges();
    if (active.touch) navigator.vibrate?.(12);
    update();
}

function accepts(zone) {
    const handler = zones.get(zone.dataset.drop);
    return Boolean(handler?.accepts(active.payload, zone));
}

function update() {
    frame = 0;
    if (!active) return;
    const { ghost, x, y } = active;

    // Inclina a carta de acordo com a velocidade horizontal, voltando ao normal quando para.
    const velocity = x - active.lastX;
    active.lastX = x;
    active.tilt += (Math.max(-14, Math.min(14, velocity * 0.9)) - active.tilt) * 0.25;
    ghost.style.transform = `translate3d(${x - active.offsetX}px, ${y - active.offsetY}px, 0) rotate(${active.tilt.toFixed(2)}deg) scale(1.08)`;
    if (Math.abs(active.tilt) > 0.2) frame = requestAnimationFrame(update);

    const hit = document.elementFromPoint(x, y)?.closest('[data-drop]');
    const zone = hit && accepts(hit) ? hit : null;
    if (zone !== active.zone) {
        active.zone?.classList.remove('drop-hover');
        zone?.classList.add('drop-hover');
        active.zone = zone;
    }
}

function onUp(event) {
    const current = active || pending;
    if (!current || event.pointerId !== current.id) return;
    if (!active) return reset();

    const { zone, payload, ghost, rect, onOutside } = active;
    suppressClickUntil = performance.now() + 400;
    if (zone) {
        // drop() pode retornar false (recusado: a carta volta) ou o elemento onde a carta deve pousar.
        const landing = zones.get(zone.dataset.drop).drop(payload, zone);
        const target = landing === false ? rect : (landing instanceof Element ? landing : zone).getBoundingClientRect();
        flyGhost(ghost, target, landing === false ? 1 : 0.9);
    } else if (onOutside) {
        flyGhost(ghost, null, 0);
        onOutside(payload);
    } else {
        flyGhost(ghost, rect, 1);
    }
    reset();
}

function onCancel(event) {
    const current = active || pending;
    if (!current || event.pointerId !== current.id) return;
    if (active) flyGhost(active.ghost, active.rect, 1);
    reset();
}

/** Anima a carta "fantasma" até `target` (ou apenas some, se `target` for null). */
function flyGhost(ghost, target, opacity) {
    if (reducedMotion()) return ghost.remove();
    const width = ghost.offsetWidth;
    const [originX, originY] = ghost.style.transformOrigin.split(' ').map(parseFloat);
    let end = `${ghost.style.transform} scale(.6)`;
    if (target) {
        const scale = target.width / width;
        const x = target.left - originX * (1 - scale);
        const y = target.top - originY * (1 - scale);
        end = `translate3d(${x}px, ${y}px, 0) rotate(0deg) scale(${scale})`;
    }
    ghost.animate(
        [{ transform: ghost.style.transform, opacity: 1 }, { transform: end, opacity: target ? opacity : 0 }],
        { duration: target ? 260 : 200, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' },
    ).finished.then(() => ghost.remove(), () => ghost.remove());
}

function reset() {
    if (pending) clearTimeout(pending.timer);
    if (active) {
        active.source.classList.remove('drag-source');
        active.zone?.classList.remove('drop-hover');
        document.body.classList.remove('is-dragging');
        document.querySelectorAll('.drop-ready').forEach(zone => zone.classList.remove('drop-ready'));
        document.dispatchEvent(new CustomEvent('dnd:end'));
    }
    cancelAnimationFrame(frame);
    frame = 0;
    pending = null;
    active = null;
    listen(false);
}

// O toque longo abre o menu de contexto em alguns celulares; o clique final de um arraste não deve "clicar".
window.addEventListener('contextmenu', event => {
    if (pending || active) {
        event.preventDefault();
        event.stopPropagation();
    }
}, true);

document.addEventListener('selectstart', event => {
    if (pending || active) event.preventDefault();
});

window.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
        suppressClickUntil = 0;
    }
}, true);
