// League bracket view: 16 entrants in a mirrored tree (left half, final in the middle, right half).
// Results show up round by round as the player wins; the player's path is highlighted in gold.

import { MASTER_RIVALS, type Bracket, type Entrant } from '../../game/modes/league';
import { L } from '../../i18n';
import { esc, icon } from '../../ui/dom';
import { classTitle, PLAYER_SPRITE, portrait } from './competition-ui';

export function entrantName(e: Entrant) {
  return e.kind === 'player' ? L().modes.you : e.name;
}

export function entrantTitle(e: Entrant) {
  const t = L().modes.league;
  if (e.kind === 'champion') return t.champion;
  if (MASTER_RIVALS.some(rival => rival.id === e.id)) return t.masterRules.formerChampion;
  if (e.kind === 'e4') return t.eliteFour;
  if (e.kind === 'elite') return classTitle(e.classId ?? '');
  return '';
}

/**
 * @param won duels the player has won in this run (results of rounds below this are shown)
 * @param fresh round whose entrants just appeared (animated), if any
 */
export function bracketHTML(b: Bracket, won: number, fresh = -1): string {
  const t = L().modes.league;

  const entrant = (round: number, index: number | undefined, decided: boolean, winner: number | undefined) => {
    if (index == null || round > won) return `<div class="bk-ent is-tbd"><span class="bk-pic">${icon('ball')}</span><span class="bk-name">${esc(t.tbd)}</span></div>`;
    const e = b.slots[index];
    const state = !decided ? '' : winner === index ? ' is-win' : ' is-out';
    const you = e.kind === 'player' ? ' is-you' : '';
    const isNew = round === fresh ? ' is-new' : '';
    return `
      <div class="bk-ent${state}${you}${isNew}" data-kind="${e.kind}" title="${esc(`${entrantName(e)}${entrantTitle(e) ? ` · ${entrantTitle(e)}` : ''}`)}">
        <span class="bk-pic">${portrait(e.kind === 'player' ? PLAYER_SPRITE : e.sprite)}</span>
        <span class="bk-name">${esc(entrantName(e))}</span>
        ${state === ' is-win' ? icon('check', 'bk-mark') : ''}
      </div>`;
  };

  const match = (round: number, m: number) => {
    const entrants = b.rounds[round];
    const [a, c] = [entrants[m * 2], entrants[m * 2 + 1]];
    const decided = round < won;
    const winner = b.rounds[round + 1]?.[m];
    const hasYou = round <= won && (a === 0 || c === 0);
    const next = hasYou && round === won;
    return `
      <div class="bk-match${hasYou ? ' is-you' : ''}${next ? ' is-next' : ''}">
        ${entrant(round, a, decided, winner)}
        ${entrant(round, c, decided, winner)}
      </div>`;
  };

  // Column = list of groups; a group of two matches gets the joining bracket line.
  const column = (round: number, matches: number[], side: 'left' | 'right') => {
    const groups: number[][] = [];
    for (let i = 0; i < matches.length; i += 2) groups.push(matches.slice(i, i + 2));
    return `
      <div class="bk-col bk-${side}" data-round="${round}">
        <span class="bk-label">${esc(t.stagesShort[round])}</span>
        <div class="bk-groups">
          ${groups.map(g => `<div class="bk-group${g.length > 1 ? ' is-pair' : ''}">${g.map(m => match(round, m)).join('')}</div>`).join('')}
        </div>
      </div>`;
  };

  const championIndex = won >= 4 ? b.rounds[4][0] : undefined;
  const champ = championIndex != null ? b.slots[championIndex] : null;

  return `
    <div class="bracket" role="img" aria-label="${esc(t.bracket)}">
      ${column(0, [0, 1, 2, 3], 'left')}
      ${column(1, [0, 1], 'left')}
      ${column(2, [0], 'left')}
      <div class="bk-col bk-center" data-round="3">
        <span class="bk-label">${esc(t.stagesShort[3])}</span>
        <div class="bk-groups">
          <div class="bk-final">
            <span class="bk-trophy${champ ? ' is-won' : ''}">${icon(champ ? 'crown' : 'trophy')}</span>
            <div class="bk-group">${match(3, 0)}</div>
            ${champ ? `<span class="bk-champ">${esc(entrantName(champ))}</span>` : ''}
          </div>
        </div>
      </div>
      ${column(2, [1], 'right')}
      ${column(1, [2, 3], 'right')}
      ${column(0, [4, 5, 6, 7], 'right')}
    </div>`;
}
