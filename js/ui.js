// Utilitários de interface: templates, toasts, modais e diálogos.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = value => String(value).replace(/[&<>"']/g, ch => ESCAPES[ch]);
export const fmt = value => Number(value).toLocaleString('pt-BR');
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const icon = (name, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

export function el(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
}

export function cardImg(card, { eager = false } = {}) {
    return `<img src="${esc(card.imagem)}" alt="${esc(card.nome)}, rank ${card.rank}" width="324" height="486" `
        + `${eager ? '' : 'loading="lazy" '}decoding="async" crossorigin="anonymous" draggable="false">`;
}

export const cardBack = () => `<span class="card-back" aria-hidden="true">${icon('sparkle')}</span>`;
export const rankPill = rank => `<span class="rank-pill" data-rank="${rank}">${rank}</span>`;
export const stars = tier => `<span class="stars" aria-label="${tier} estrelas">${'★'.repeat(tier)}</span>`;

// --- Toasts --------------------------------------------------------------

const TOAST_ICON = { info: 'sparkle', success: 'check', warning: 'flag', error: 'x' };

export function toast(message, type = 'info', duration = 2800) {
    const host = document.getElementById('toasts');
    const node = el(`<div class="toast toast-${type}" role="status">${icon(TOAST_ICON[type])}<span>${esc(message)}</span></div>`);
    host.append(node);
    while (host.children.length > 3) host.firstElementChild.remove();
    setTimeout(() => {
        node.classList.add('leaving');
        setTimeout(() => node.remove(), 250);
    }, duration);
}

export function shakeCoins() {
    document.getElementById('coins').animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }],
        { duration: 360 },
    );
}

// --- Modais --------------------------------------------------------------

const stack = [];
const FOCUSABLE = 'button:not([disabled]), a[href], input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Abre um modal. Elementos com [data-close] fecham o modal; `dismissable` controla Esc e clique no fundo.
 * `close(value)` repassa `value` para `onClose`.
 */
export function openModal({ html, className = '', label = '', dismissable = true, onClose } = {}) {
    const lastFocus = document.activeElement;
    const root = el(`
        <div class="modal-root ${className}" role="dialog" aria-modal="true" aria-label="${esc(label)}">
            <div class="modal-backdrop" ${dismissable ? 'data-close' : ''}></div>
            <div class="modal-panel">${html}</div>
        </div>`);

    let closed = false;
    const entry = { root, dismissable, close };

    function close(value) {
        if (closed) return;
        closed = true;
        stack.splice(stack.indexOf(entry), 1);
        if (!stack.length) document.documentElement.classList.remove('modal-open');
        root.classList.add('closing');
        setTimeout(() => root.remove(), reducedMotion() ? 0 : 200);
        if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
        onClose?.(value);
    }

    root.addEventListener('click', event => {
        if (event.target.closest('[data-close]')) close();
    });

    stack.push(entry);
    document.documentElement.classList.add('modal-open');
    document.body.append(root);
    requestAnimationFrame(() => {
        const target = root.querySelector('[autofocus]') || root.querySelector(`.modal-panel ${FOCUSABLE.split(',')[0]}`);
        target?.focus({ preventScroll: true });
    });
    return entry;
}

export const isTopModal = entry => stack.at(-1) === entry;

document.addEventListener('keydown', event => {
    const top = stack.at(-1);
    if (!top) return;
    if (event.key === 'Escape' && top.dismissable) {
        event.preventDefault();
        top.close();
    } else if (event.key === 'Tab') {
        const items = [...top.root.querySelectorAll(FOCUSABLE)].filter(node => node.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }
});

export function confirmDialog({ title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false }) {
    return new Promise(resolve => {
        const modal = openModal({
            className: 'modal-dialog',
            label: title,
            onClose: value => resolve(value === true),
            html: `
                <h2 class="dialog-title">${esc(title)}</h2>
                <p class="dialog-text">${esc(message)}</p>
                <div class="dialog-actions">
                    <button class="btn btn-ghost" type="button" data-close>${esc(cancelText)}</button>
                    <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="button" data-confirm autofocus>${esc(confirmText)}</button>
                </div>`,
        });
        modal.root.querySelector('[data-confirm]').addEventListener('click', () => modal.close(true));
    });
}

// --- Números animados ----------------------------------------------------

const counters = new WeakMap();

export function animateNumber(node, from, to, duration = 650) {
    cancelAnimationFrame(counters.get(node));
    if (reducedMotion() || from === to) {
        node.textContent = fmt(to);
        return;
    }
    const start = performance.now();
    const step = now => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - (1 - t) ** 3;
        node.textContent = fmt(Math.round(from + (to - from) * eased));
        if (t < 1) counters.set(node, requestAnimationFrame(step));
    };
    counters.set(node, requestAnimationFrame(step));
}
