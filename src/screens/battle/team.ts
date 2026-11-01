// Team helpers shared by the Battle hub and the modes: readiness check and the team summary strip.

import { sfx } from '../../audio';
import { teamPower, toBattleCard } from '../../game/battle';
import { DECK_SIZE } from '../../game/economy';
import { leagueUnlocked } from '../../game/modes/league';
import { playerTeam } from '../../game/teams';
import { fmt, L } from '../../i18n';
import { store } from '../../state/store';
import { cardHTML } from '../../ui/card';
import { esc, icon, toast } from '../../ui/dom';

/** True when the team has all six cards (battles are blocked otherwise). */
export const teamReady = () => playerTeam(store.save).length >= DECK_SIZE;

/** The League screen opens with the Kanto League (Johto's shows inside it, locked until its badges). */
export const leagueOpen = () => leagueUnlocked(store.save);

/** Shows the "team incomplete" warning (modes call it before starting a battle). */
export function ensureTeam(): boolean {
  if (teamReady()) return true;
  sfx('error');
  toast(L().battle.hub.blocked, 'warning');
  return false;
}

/** The player's team strip (also reused at the top of each mode). */
export function teamSummaryHTML(compact = false): string {
  const t = L().battle.hub;
  const team = playerTeam(store.save);
  const ready = team.length >= DECK_SIZE;
  const cards = team.map(m => toBattleCard(m, m.key));
  const avgLevel = cards.length ? Math.round(cards.reduce((s, c) => s + c.level, 0) / cards.length) : 0;
  return `
    <section class="team-summary ${ready ? 'ready' : 'incomplete'} ${compact ? 'compact' : ''}" aria-label="${esc(t.teamTitle)}">
      <div class="team-cards">
        ${Array.from({ length: DECK_SIZE }, (_, i) => {
          const m = team[i];
          return m ? `<div class="team-slot">${cardHTML({ id: m.id, shiny: m.shiny, level: m.level }, { size: 'xs' })}</div>`
            : `<div class="team-slot empty" aria-label="${esc(t.emptySlot)}">${icon('plus')}</div>`;
        }).join('')}
      </div>
      <div class="team-text">
        <strong>${ready ? `${icon('check')} ${esc(t.ready)}` : `${icon('flag')} ${esc(t.incomplete(team.length))}`}</strong>
        ${ready ? `
          <span class="team-stats">
            <span><small>${esc(t.avgLevel)}</small><b>${fmt(avgLevel)}</b></span>
            <span><small>${esc(t.avgPower)}</small><b>${fmt(teamPower(cards))}</b></span>
          </span>` : `<span class="team-hint">${esc(t.needMore(DECK_SIZE - team.length))}</span>`}
      </div>
      <a class="btn ${ready ? 'btn-ghost' : 'btn-primary'} btn-sm" href="#/collection">${icon('cards')} ${esc(ready ? t.edit : t.build)}</a>
    </section>`;
}
