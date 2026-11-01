// Small view helpers shared by the Competition and League screens: mode header, trainer portraits,
// team strips (mini sprites) and the "your team isn't ready" check.

import { spriteUrl, trainerSpriteUrl } from '../../data/sprites';
import { getSpecies } from '../../data/species';
import { TYPE_COLOR } from '../../data/types';
import type { TeamMember } from '../../game/battle';
import { DECK_SIZE } from '../../game/economy';
import { playerTeam } from '../../game/teams';
import { L } from '../../i18n';
import { store } from '../../state/store';
import { cardHTML, typeBadge } from '../../ui/card';
import { esc, icon, openModal } from '../../ui/dom';
import { ensureTeam } from './team';

/** Sprite the player is drawn with on ladders and brackets. */
export const PLAYER_SPRITE = 'red';

export function modeHead(title: string, subtitle: string, extra = '') {
  return `
    <header class="mode-head">
      <div class="mode-head-text">
        <h1 class="view-title">${esc(title)}</h1>
        <p class="view-sub">${esc(subtitle)}</p>
      </div>
      ${extra}
    </header>`;
}

export function portrait(sprite: string, alt = '', cls = '') {
  return `<img class="trainer-portrait ${cls}" src="${esc(trainerSpriteUrl(sprite))}" alt="${esc(alt)}" width="80" height="80" loading="lazy" decoding="async" draggable="false">`;
}

/** Row of small sprites in type-colored bubbles. `hidden` shows Poké Ball silhouettes instead. */
export function teamStrip(team: TeamMember[], { hidden = false, size = DECK_SIZE } = {}) {
  const slots = Array.from({ length: size }, (_, i) => team[i]);
  return `<span class="team-strip${hidden ? ' is-hidden' : ''}">${slots.map(m => {
    if (!m || hidden) return `<span class="team-dot is-empty">${hidden && m ? icon('ball') : ''}</span>`;
    const s = getSpecies(m.id);
    return `<span class="team-dot${m.shiny ? ' is-shiny' : ''}" style="--tc:${TYPE_COLOR[s.types[0]]}" title="${esc(`${s.name} · ${L().modes.level(m.level)}`)}">
      <img src="${esc(spriteUrl(m.id, !!m.shiny))}" alt="" width="96" height="96" loading="lazy" decoding="async" draggable="false"></span>`;
  }).join('')}</span>`;
}

export const typeBadges = (types: readonly string[]) => types.map(t => typeBadge(t as Parameters<typeof typeBadge>[0])).join('');

export const classTitle = (classId: string) => L().modes.classes[classId] ?? classId;

export const myTeam = (): TeamMember[] => playerTeam(store.save).map(({ id, level, shiny }) => ({ id, level, shiny }));

/** True when the team is complete; otherwise warns (the hub's shared check) and returns false. */
export const teamReady = () => ensureTeam();

/** Modal with an opponent's full team as cards (scouting before a challenge). Resolves true to battle. */
export function scoutModal({ name, title, sprite, types, team, info, action }: {
  name: string;
  title: string;
  sprite: string;
  types: readonly string[];
  team: TeamMember[];
  info: string;
  action: string;
}): Promise<boolean> {
  return new Promise(resolve => {
    const modal = openModal({
      className: 'modal-scout',
      label: L().modes.competition.teamOf(name),
      onClose: value => resolve(value === true),
      html: `
        <button class="modal-x" type="button" data-close aria-label="${esc(L().core.actions.close)}">${icon('x')}</button>
        <div class="scout">
          <div class="scout-head">
            ${portrait(sprite)}
            <div>
              <h2 class="dialog-title">${esc(name)}</h2>
              <p class="scout-title">${esc(title)}</p>
              <span class="scout-types">${typeBadges(types)}</span>
            </div>
          </div>
          <div class="scout-cards">${team.map(m => cardHTML({ id: m.id, level: m.level, shiny: m.shiny }, { size: 'sm', eager: true })).join('')}</div>
          <p class="scout-info">${info}</p>
          <div class="dialog-actions">
            <button class="btn btn-ghost" type="button" data-close>${esc(L().core.actions.close)}</button>
            <button class="btn btn-primary" type="button" data-go autofocus>${icon('swords')} ${esc(action)}</button>
          </div>
        </div>`,
    });
    modal.root.querySelector('[data-go]')!.addEventListener('click', () => modal.close(true));
  });
}
