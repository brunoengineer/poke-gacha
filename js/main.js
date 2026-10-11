// Ponto de entrada: carrega os dados, liga o cabeçalho e faz o roteamento entre as telas (#/colecao, #/gacha, #/batalha).

import { loadCards } from './data.js';
import { loadState, on, resetAll, state } from './state.js';
import { initDock, setDockVisible } from './deck.js';
import { mountCollection } from './collection.js';
import { mountGacha } from './gacha.js';
import { mountBattle, showBattle } from './battle.js';
import { animateNumber, confirmDialog, el, fmt } from './ui.js';

const VIEWS = {
    colecao: { mount: mountCollection, dock: true },
    gacha: { mount: mountGacha },
    batalha: { mount: mountBattle, show: showBattle },
};
const mounted = new Set();

async function boot() {
    try {
        await loadCards();
    } catch (error) {
        console.error('Erro ao carregar cartas.json:', error);
        document.getElementById('boot').innerHTML = `
            <p><strong>Não foi possível carregar as cartas.</strong></p>
            <p>Abra o jogo por um servidor web (GitHub Pages, ou a extensão Live Server do VS Code) em vez de abrir o arquivo direto.</p>`;
        return;
    }
    loadState();
    initHeader();
    initDock();
    document.getElementById('boot').remove();
    route();
    addEventListener('hashchange', route);
    registerServiceWorker();
}

function route() {
    const [, name = '', arg = ''] = location.hash.match(/^#\/?([^/]*)\/?(.*)$/) ?? [];
    const current = VIEWS[name] ? name : 'colecao';
    const config = VIEWS[current];

    document.querySelectorAll('.view').forEach(section => {
        const active = section.dataset.view === current;
        section.hidden = !active;
        if (active && !mounted.has(current)) {
            config.mount(section);
            mounted.add(current);
        }
    });
    config.show?.(arg);
    setDockVisible(Boolean(config.dock));
    document.querySelectorAll('.tab').forEach(tab => {
        if (tab.dataset.view === current) tab.setAttribute('aria-current', 'page');
        else tab.removeAttribute('aria-current');
    });
    window.scrollTo({ top: 0 });
}

function initHeader() {
    const coins = document.getElementById('coins');
    const amount = document.getElementById('coin-amount');
    let shown = state.coins;
    amount.textContent = fmt(shown);

    on('coins', delta => {
        animateNumber(amount, shown, state.coins);
        shown = state.coins;
        const chip = el(`<span class="coin-delta ${delta > 0 ? 'up' : 'down'}">${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))}</span>`);
        coins.append(chip);
        setTimeout(() => chip.remove(), 1300);
    });

    const button = document.getElementById('menu-btn');
    const menu = document.getElementById('menu');
    const setOpen = open => {
        menu.hidden = !open;
        button.setAttribute('aria-expanded', String(open));
    };
    button.addEventListener('click', () => setOpen(menu.hidden));
    document.addEventListener('click', event => {
        if (!menu.hidden && !event.target.closest('.menu-wrap')) setOpen(false);
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !menu.hidden) {
            setOpen(false);
            button.focus();
        }
    });

    document.getElementById('reset-btn').addEventListener('click', async () => {
        setOpen(false);
        const ok = await confirmDialog({
            title: 'Resetar o jogo?',
            message: 'Sua coleção, deck, moedas e progresso de batalhas serão apagados. Isso não pode ser desfeito.',
            confirmText: 'Apagar tudo',
            danger: true,
        });
        if (ok) resetAll();
    });
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
        navigator.serviceWorker.register('sw.js').catch(error => console.warn('Service worker não registrado:', error));
    }
}

boot();
