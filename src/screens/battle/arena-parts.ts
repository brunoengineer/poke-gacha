// HTML pieces of the battle arena (src/screens/battle/arena.ts): layout, hand, stats, track, sprites,
// intro and result panels. Pure templates: no state, no listeners.

import { animatedBackSpriteUrl, animatedSpriteUrl, backSpriteUrl, spriteUrl } from '../../data/sprites';
import { getSpecies } from '../../data/species';
import { TYPE_COLOR } from '../../data/types';
import type { BattleCard, RoundOutcome, RoundResult } from '../../game/battle';
import { STAT_IDS, type StatId } from '../../game/cards';
import { fmt, getLang, L } from '../../i18n';
import { cardBackHTML, cardHTML, typeBadge } from '../../ui/card';
import { esc, icon } from '../../ui/dom';

export const OUTCOME_ICON: Record<RoundOutcome, string> = { win: 'check', lose: 'x', draw: 'minus' };

export const frontSprite = (c: Pick<BattleCard, 'id' | 'shiny'>) => animatedSpriteUrl(c.id, c.shiny) ?? spriteUrl(c.id, c.shiny);
export const backSprite = (c: Pick<BattleCard, 'id' | 'shiny'>) => animatedBackSpriteUrl(c.id, c.shiny) ?? backSpriteUrl(c.id, c.shiny);
export const staticFront = (c: Pick<BattleCard, 'id' | 'shiny'>) => spriteUrl(c.id, c.shiny);
export const staticBack = (c: Pick<BattleCard, 'id' | 'shiny'>) => backSpriteUrl(c.id, c.shiny);

/** Multiplier as shown to the player: ×1,3 (pt) / ×1.3 (en). */
export const multText = (mult: number) => `×${getLang() === 'pt' ? String(mult).replace('.', ',') : String(mult)}`;

export function layoutHTML(opts: { stage: string; opponentName: string; forfeitLabel: string }): string {
  const t = L().battle.arena;
  return `
    <div class="arena">
      <header class="arena-bar">
        <button class="btn btn-ghost btn-sm arena-forfeit" type="button" data-act="forfeit">${icon('flag')}<span>${esc(opts.forfeitLabel)}</span></button>
        <div class="arena-info">
          <span class="arena-stage">${esc(opts.stage)}</span>
          <span class="arena-round" data-round></span>
        </div>
        <div class="scoreboard" role="group" aria-label="${esc(t.scoreboard)}">
          <span class="score you"><small>${esc(t.you)}</small><b data-score="you">0</b></span>
          <span class="score-sep" aria-hidden="true">:</span>
          <span class="score opp"><b data-score="opp">0</b><small>${esc(opts.opponentName)}</small></span>
        </div>
      </header>
      <ol class="arena-track" aria-label="${esc(t.track)}"></ol>
      <div class="arena-main">
        <section class="side side-you" aria-label="${esc(t.you)}">
          <div class="side-card" data-drop="arena-slot"></div>
          <div class="stats" role="group" aria-label="${esc(t.yourStats)}"></div>
        </section>
        <section class="scene" aria-label="${esc(t.label)}">
          <div class="scene-bg" aria-hidden="true"><i class="scene-sun"></i><i class="scene-hill"></i></div>
          <div class="mon mon-opp"><i class="platform" aria-hidden="true"></i><div class="mon-body"></div><div class="mon-tag"></div></div>
          <div class="mon mon-you"><i class="platform" aria-hidden="true"></i><div class="mon-body"></div><div class="mon-tag"></div></div>
          <div class="scene-fx" aria-hidden="true"><div class="fx-particles"></div></div>
          <p class="scene-text" aria-live="polite"></p>
          <div class="round-result"></div>
        </section>
        <section class="side side-opp" aria-label="${esc(opts.opponentName)}">
          <div class="side-card"></div>
          <div class="stats" role="group" aria-label="${esc(t.oppStats)}"></div>
        </section>
      </div>
      <div class="hand-wrap">
        <div class="hand-head">
          <span class="label">${esc(t.hand)}</span>
          <span class="hand-tip">${esc(t.handTip)}</span>
        </div>
        <div class="hand"></div>
      </div>
    </div>`;
}

/** Player's card slot: the chosen card (button to send it back) or the drop hint. */
export function slotHTML(card: BattleCard | null, locked: boolean): string {
  const t = L().battle.arena;
  if (!card) return `<div class="drop-hint">${icon('ball')}<span>${esc(t.dropHint)}</span></div>`;
  const name = getSpecies(card.id).name;
  return `<button class="arena-pick" type="button" data-act="unselect" ${locked ? 'disabled' : ''} aria-label="${esc(t.returnCard(name))}">
    ${cardHTML({ id: card.id, shiny: card.shiny, level: card.level }, { size: 'md', eager: true, animated: false })}</button>`;
}

/** Opponent card, as far as the reveal mode allows. */
export function oppCardHTML(card: BattleCard, reveal: 'card' | 'type' | 'hidden'): string {
  const t = L().battle.arena;
  if (reveal === 'card') return cardHTML({ id: card.id, shiny: card.shiny, level: card.level }, { size: 'md', eager: true });
  if (reveal === 'hidden') return `<div class="mystery-wrap" role="img" aria-label="${esc(t.hiddenCard)}">${cardBackHTML('md')}</div>`;
  const [t1, t2] = card.types;
  return `
    <div class="mystery-card" role="img" aria-label="${esc(card.types.map(type => L().core.types[type]).join(' / '))}"
      style="--t1:${TYPE_COLOR[t1]};--t2:${TYPE_COLOR[t2 ?? t1]}">
      <div class="mystery-frame">
        <span class="mystery-name">???</span>
        <img class="mystery-sprite" src="${esc(staticFront(card))}" alt="" draggable="false">
        <span class="mystery-types">${card.types.map(typeBadge).join('')}</span>
      </div>
    </div>`;
}

export function statsHTML(card: BattleCard | null, side: 'you' | 'opp', opts: { enabled?: boolean; hidden?: boolean } = {}): string {
  const t = L();
  return STAT_IDS.map(id => {
    const labels = `<span class="stat-label"><span class="full">${esc(t.core.stats[id])}</span><span class="short">${esc(t.core.statsShort[id])}</span></span>`;
    if (side === 'opp') {
      const hidden = opts.hidden || !card;
      return `<div class="stat ${hidden ? 'hidden' : ''}" data-stat="${id}">${labels}<b>${hidden ? '???' : fmt(card!.stats[id])}</b></div>`;
    }
    return `<button class="stat" type="button" data-stat="${id}" ${opts.enabled && card ? 'data-pick' : 'disabled'}>
      ${labels}<b>${card ? fmt(card.stats[id]) : '—'}</b></button>`;
  }).join('');
}

/** Hand card button. `edge` marks a type advantage/disadvantage against the current opponent. */
export function handCardHTML(card: BattleCard, i: number, state: { outcome?: RoundOutcome; selected: boolean; disabled: boolean; edge: number | null }): string {
  const t = L().battle.arena;
  const name = getSpecies(card.id).name;
  const label = state.outcome ? t.usedCard(name) : t.pickCard(name, card.level);
  const edge = state.edge == null || state.outcome ? ''
    : state.edge > 0 ? `<span class="hand-edge good" title="${esc(t.advantage)}">${icon('up')}<span class="sr-only">${esc(t.advantage)}</span></span>`
      : state.edge < 0 ? `<span class="hand-edge bad" title="${esc(t.disadvantage)}">${icon('up')}<span class="sr-only">${esc(t.disadvantage)}</span></span>` : '';
  return `
    <button class="hand-card ${state.outcome ? `used ${state.outcome}` : ''} ${state.selected ? 'selected' : ''}" type="button" data-index="${i}"
      ${state.outcome || state.disabled ? 'disabled' : ''} aria-pressed="${state.selected}" aria-label="${esc(label)}">
      ${cardHTML({ id: card.id, shiny: card.shiny, level: card.level }, { size: 'sm', eager: true })}
      ${edge}
      ${state.outcome ? `<span class="hand-mark">${icon(OUTCOME_ICON[state.outcome])}</span>` : ''}
    </button>`;
}

export function trackHTML(opp: BattleCard[], results: RoundResult[], round: number, reveal: 'card' | 'type' | 'hidden'): string {
  const t = L().battle.arena;
  return opp.map((card, i) => {
    const result = results[i];
    if (result) {
      return `<li class="track-item done ${result.outcome}" aria-label="${esc(t.trackDone(i + 1, `${getSpecies(card.id).name}, ${t.outcome[result.outcome]}`))}">
        <img src="${esc(staticFront(card))}" alt="" draggable="false"><span class="track-mark">${icon(OUTCOME_ICON[result.outcome])}</span></li>`;
    }
    if (i === round) {
      const inner = reveal === 'card' ? `<img src="${esc(staticFront(card))}" alt="" draggable="false">`
        : reveal === 'type' ? `<img class="silhouette" src="${esc(staticFront(card))}" alt="" draggable="false">` : icon('ball-color', 'track-ball');
      return `<li class="track-item current" aria-current="step" aria-label="${esc(t.trackCurrent(i + 1))}">${inner}</li>`;
    }
    return `<li class="track-item next" aria-label="${esc(t.trackNext(i + 1))}">${icon('ball-color', 'track-ball')}</li>`;
  }).join('');
}

/** Matchup chip next to a sprite: "×1.3 Super effective" or "?" when unknown. */
export function chipHTML(mult: number | null, against: number | null): string {
  const t = L().battle.arena;
  if (mult == null) return `<span class="chip chip-unknown">? <small>${esc(t.matchupUnknown)}</small></span>`;
  const tone = against != null && mult > against ? 'good' : against != null && mult < against ? 'bad' : mult > 1 ? 'good' : mult < 1 ? 'bad' : 'even';
  return `<span class="chip chip-${tone}"><b>${multText(mult)}</b> <small>${esc(t.effect[mult] ?? '')}</small></span>`;
}

export function introHTML(opts: {
  name: string; title?: string; portrait?: string; line?: string; stage?: string; oppCount: number; team: BattleCard[];
}): string {
  const t = L().battle.arena;
  return `
    <div class="arena-intro" data-act="skip-intro">
      <div class="intro-band intro-opp">
        <div class="intro-info">
          ${opts.stage ? `<span class="intro-stage">${esc(opts.stage)}</span>` : ''}
          ${opts.title ? `<span class="intro-title">${esc(opts.title)}</span>` : ''}
          <h2 class="intro-name">${esc(opts.name)}</h2>
          <ul class="intro-balls" aria-label="${esc(t.intro.theirTeam)}">${Array.from({ length: opts.oppCount }, () => `<li>${icon('ball-color')}</li>`).join('')}</ul>
        </div>
        <div class="intro-portrait">${opts.portrait ? `<img src="${esc(opts.portrait)}" alt="" draggable="false">` : icon('user')}</div>
      </div>
      <div class="intro-vs" aria-hidden="true"><span>VS</span></div>
      ${opts.line ? `<p class="intro-line"><span>${esc(t.intro.challenge(opts.name))}</span>“${esc(opts.line)}”</p>` : `<p class="intro-line"><span>${esc(t.intro.challenge(opts.name))}</span></p>`}
      <div class="intro-band intro-you">
        <ul class="intro-team" aria-label="${esc(t.intro.yourTeam)}">
          ${opts.team.map(c => `<li><img src="${esc(staticFront(c))}" alt="${esc(getSpecies(c.id).name)}" draggable="false"></li>`).join('')}
        </ul>
        <button class="btn btn-primary btn-lg intro-start" type="button" data-act="start">${icon('swords')} ${esc(t.intro.start)}</button>
      </div>
    </div>`;
}

export function endHTML(opts: {
  result: 'win' | 'lose' | 'draw'; score: { you: number; opp: number }; perfect: boolean; tiebreak: boolean;
  totals: { you: number; opp: number }; rounds: RoundResult[]; name: string; portrait?: string; line?: string;
}): string {
  const t = L().battle.arena;
  const core = L().core;
  const crest = opts.result === 'win' ? 'trophy' : opts.result === 'lose' ? 'flag' : 'minus';
  return `
    <div class="arena-end end-${opts.result}" role="alertdialog" aria-modal="true" aria-labelledby="arena-end-title">
      <div class="end-panel">
        <div class="end-crest">${icon(crest)}</div>
        <h2 class="end-title" id="arena-end-title">${esc(t.end[opts.result])}</h2>
        ${opts.perfect ? `<p class="end-perfect">${icon('star')} ${esc(t.end.perfect)} ${icon('star')}</p>` : ''}
        <p class="end-score" aria-label="${esc(`${t.scoreboard}: ${opts.score.you} × ${opts.score.opp}`)}"><b>${opts.score.you}</b><span>×</span><b>${opts.score.opp}</b></p>
        ${opts.tiebreak ? `<p class="end-tiebreak">${esc(t.end.tiebreak(opts.totals.you, opts.totals.opp))}</p>` : ''}
        ${opts.line ? `
          <figure class="end-quote">
            ${opts.portrait ? `<img src="${esc(opts.portrait)}" alt="" draggable="false">` : ''}
            <blockquote><cite>${esc(opts.name)}</cite><p>“${esc(opts.line)}”</p></blockquote>
          </figure>` : ''}
        <details class="end-log">
          <summary>${icon('chevron')} ${esc(t.end.log)}</summary>
          <ol>
            ${opts.rounds.map((r, i) => `
              <li class="log-${r.outcome}">
                <span class="log-round">${i + 1}</span>
                <span class="log-mon"><img src="${esc(staticFront(r.you))}" alt="">${esc(getSpecies(r.you.id).name)}</span>
                <span class="log-stat">${esc(core.statsShort[r.stat as StatId])} <b>${fmt(r.youValue)}</b> × <b>${fmt(r.oppValue)}</b></span>
                <span class="log-mon opp">${esc(getSpecies(r.opp.id).name)}<img src="${esc(staticFront(r.opp))}" alt=""></span>
                <span class="log-mark">${icon(OUTCOME_ICON[r.outcome])}</span>
              </li>`).join('')}
          </ol>
        </details>
        <button class="btn btn-primary btn-lg end-continue" type="button" data-act="continue">${esc(t.end.continue)} ${icon('right')}</button>
      </div>
    </div>`;
}
