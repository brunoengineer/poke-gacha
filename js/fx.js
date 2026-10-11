// Efeitos visuais compartilhados: sequências de animação que podem ser puladas e partículas.

import { reducedMotion } from './ui.js';

/**
 * Encadeia animações (Web Animations API) com `await`.
 * `skip()` termina tudo o que está rodando e faz as próximas etapas resolverem na hora.
 */
export class Sequence {
    constructor() {
        this.skipped = reducedMotion();
        this.running = new Set();
        this.waits = new Set();
    }

    anim(node, keyframes, options) {
        if (this.skipped) return Promise.resolve();
        const animation = node.animate(keyframes, { fill: 'both', ...options });
        this.running.add(animation);
        return animation.finished.catch(() => {}).finally(() => this.running.delete(animation));
    }

    wait(ms) {
        if (this.skipped) return Promise.resolve();
        return new Promise(resolve => {
            const entry = { resolve, timer: setTimeout(() => { this.waits.delete(entry); resolve(); }, ms) };
            this.waits.add(entry);
        });
    }

    skip() {
        if (this.skipped) return;
        this.skipped = true;
        this.running.forEach(animation => animation.finish());
        this.waits.forEach(({ resolve, timer }) => { clearTimeout(timer); resolve(); });
        this.waits.clear();
    }
}

/** Explosão (ou implosão, com `inward`) de partículas a partir do centro de `host`. */
export function burst(host, { color, count = 24, distance = 180, duration = 900, inward = false } = {}) {
    if (reducedMotion() || !host.isConnected) return;
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('i');
        const size = 3 + Math.random() * 6;
        const angle = Math.random() * Math.PI * 2;
        const reach = distance * (0.45 + Math.random() * 0.75);
        particle.className = 'particle';
        particle.style.cssText = `width:${size}px;height:${size}px;color:${color}`;
        host.append(particle);

        const far = `translate(${Math.cos(angle) * reach}px, ${Math.sin(angle) * reach}px) scale(${inward ? 1 : 0.2})`;
        const near = 'translate(0, 0) scale(1)';
        particle.animate(
            [{ transform: inward ? far : near, opacity: inward ? 0 : 1 }, { transform: inward ? near : far, opacity: inward ? 1 : 0 }],
            {
                duration: duration * (0.65 + Math.random() * 0.5),
                delay: Math.random() * (inward ? 450 : 90),
                easing: inward ? 'cubic-bezier(.55,0,.9,.45)' : 'cubic-bezier(.1,.8,.3,1)',
                fill: 'backwards',
            },
        ).finished.then(() => particle.remove(), () => particle.remove());
    }
}
