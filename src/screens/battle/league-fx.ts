// Champion celebration: a full-screen moment with the trophy, light rays, star bursts and the winning team
// parading in, Hall of Fame style. Skippable; resolves when the player continues.

import { playCry, sfx } from '../../audio';
import type { TeamMember } from '../../game/battle';
import { L } from '../../i18n';
import { cardHTML } from '../../ui/card';
import { esc, openModal } from '../../ui/dom';
import { burst, Sequence } from '../../ui/fx';

/** Gold trophy drawn inline (bigger and richer than the stroke icon). */
export const TROPHY_SVG = `
  <svg class="trophy-art" viewBox="0 0 120 120" aria-hidden="true">
    <defs>
      <linearGradient id="trophy-gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff3c4"/><stop offset=".45" stop-color="#f2c94c"/><stop offset="1" stop-color="#b8862b"/>
      </linearGradient>
      <linearGradient id="trophy-shine" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="M30 18h60v14c0 20-12 36-30 38-18-2-30-18-30-38z" fill="url(#trophy-gold)" stroke="#8a6418" stroke-width="2.5"/>
    <path d="M30 26H16c0 16 8 26 20 28M90 26h14c0 16-8 26-20 28" fill="none" stroke="url(#trophy-gold)" stroke-width="7" stroke-linecap="round"/>
    <path d="M52 70h16l3 16H49z" fill="url(#trophy-gold)" stroke="#8a6418" stroke-width="2"/>
    <rect x="36" y="86" width="48" height="12" rx="3" fill="url(#trophy-gold)" stroke="#8a6418" stroke-width="2"/>
    <rect x="30" y="98" width="60" height="10" rx="3" fill="#5a3e12" stroke="#3b2808" stroke-width="2"/>
    <path d="M42 24h8v20c0 8 3 14 8 18-9-2-16-10-16-22z" fill="url(#trophy-shine)" opacity=".8"/>
    <circle cx="60" cy="40" r="9" fill="#ef4a4a" stroke="#1b1b24" stroke-width="2"/>
    <path d="M51 40h18" stroke="#1b1b24" stroke-width="2"/>
    <circle cx="60" cy="40" r="3" fill="#f4f4f6" stroke="#1b1b24" stroke-width="1.6"/>
  </svg>`;

export function celebrateChampion(team: TeamMember[], rival: string): Promise<void> {
  const t = L().modes.league;
  const seq = new Sequence();
  sfx('champion');
  return new Promise(resolve => {
    const modal = openModal({
      className: 'fx-overlay champ-overlay',
      label: t.championTitle,
      onClose: () => { seq.skip(); resolve(); },
      html: `
        <div class="champ">
          <span class="champ-rays" aria-hidden="true"></span>
          <div class="champ-trophy">${TROPHY_SVG}</div>
          <p class="label champ-kicker">${esc(t.title)} · ${esc(t.hall)}</p>
          <h2 class="fx-title champ-title">${esc(t.championTitle)}</h2>
          <p class="champ-sub">${esc(t.championSub(rival))}</p>
          <div class="champ-team">${team.map(m => `<span class="champ-card">${cardHTML({ id: m.id, level: m.level, shiny: m.shiny }, { size: 'sm', eager: true, animated: true })}</span>`).join('')}</div>
          <button class="btn btn-primary btn-lg" type="button" data-close autofocus>${esc(L().core.actions.continue)}</button>
        </div>`,
    });
    const box = modal.root.querySelector<HTMLElement>('.champ')!;
    const trophy = box.querySelector<HTMLElement>('.champ-trophy')!;
    const cards = [...box.querySelectorAll<HTMLElement>('.champ-card')];
    box.addEventListener('click', event => {
      if (!(event.target as Element).closest('[data-close]')) finish();
    });
    const finish = () => {
      seq.skip();
      box.classList.add('is-done');
    };

    void (async () => {
      box.classList.add('is-playing');
      await seq.anim(trophy, [
        { transform: 'translateY(-60px) scale(.4) rotate(-12deg)', opacity: 0 },
        { transform: 'translateY(6px) scale(1.12) rotate(3deg)', opacity: 1, offset: 0.65 },
        { transform: 'none', opacity: 1 },
      ], { duration: 800, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
      for (let i = 0; i < 3 && !seq.skipped; i++) {
        burst(trophy, { color: '#ffe27a', count: 34, distance: 240 });
        burst(trophy, { color: '#ffffff', count: 14, distance: 200, shape: 'star' });
        await seq.wait(420);
      }
      for (const [i, card] of cards.entries()) {
        if (seq.skipped) break;
        void seq.anim(card, [{ transform: 'translateY(40px) scale(.7)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
        await seq.wait(160);
        if (i === cards.length - 1) playCry(team[i].id);
      }
      finish();
    })();
  });
}
