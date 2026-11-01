// HTML pieces of the battle arena (src/screens/battle/arena.ts): layout, team strips, HP boxes, side panels,
// hand, choice prompt, intro and result panels. Pure templates: no state, no listeners.

import { animatedBackSpriteUrl, animatedSpriteUrl, backSpriteUrl, spriteUrl } from '../../data/sprites';
import { getSpecies } from '../../data/species';
import type { BattleCard } from '../../game/battle';
import { STAT_IDS } from '../../game/cards';
import type { DuelLog, Fighter, Side } from '../../game/duel';
import type { BattleTraining } from '../../game/progression';
import { fmt, getLang, L } from '../../i18n';
import { cardHTML } from '../../ui/card';
import { esc, icon } from '../../ui/dom';

export const frontSprite = (c: Pick<BattleCard, 'id' | 'shiny'>) => animatedSpriteUrl(c.id, c.shiny) ?? spriteUrl(c.id, c.shiny);
export const backSprite = (c: Pick<BattleCard, 'id' | 'shiny'>) => animatedBackSpriteUrl(c.id, c.shiny) ?? backSpriteUrl(c.id, c.shiny);
export const staticFront = (c: Pick<BattleCard, 'id' | 'shiny'>) => spriteUrl(c.id, c.shiny);
export const staticBack = (c: Pick<BattleCard, 'id' | 'shiny'>) => backSpriteUrl(c.id, c.shiny);

const monName = (c: BattleCard) => getSpecies(c.id).name;

/** Multiplier as shown to the player: ×1,3 (pt) / ×1.3 (en). */
export const multText = (mult: number) => `×${getLang() === 'pt' ? String(mult).replace('.', ',') : String(mult)}`;

/** HP as a percentage of max, and the bar color band. */
export const hpPct = (f: Fighter) => Math.max(0, Math.min(100, (f.hp / f.card.stats.hp) * 100));
export const hpTone = (pct: number) => (pct > 50 ? 'high' : pct > 20 ? 'mid' : 'low');

export function layoutHTML(opts: { stage: string; opponentName: string; fast: boolean }): string {
  const t = L().battle.arena;
  return `
    <div class="arena">
      <header class="arena-bar">
        <button class="btn btn-ghost btn-sm arena-forfeit" type="button" data-act="forfeit">${icon('flag')}<span>${esc(t.forfeit)}</span></button>
        <div class="arena-info">
          <span class="arena-stage">${esc(opts.stage)}</span>
          <span class="arena-round" data-round></span>
        </div>
        <button class="btn btn-ghost btn-sm arena-speed" type="button" data-act="speed" aria-pressed="${opts.fast}" aria-label="${esc(t.speed)}">
          ${icon('bolt')}<b data-speed>${opts.fast ? '2×' : '1×'}</b></button>
      </header>
      <div class="arena-teams">
        <ol class="team-balls you" aria-label="${esc(t.yourTeam)}"></ol>
        <div class="scoreboard" role="group" aria-label="${esc(t.scoreboard)}">
          <span class="score you"><small>${esc(t.you)}</small><b data-score="you">0</b></span>
          <span class="score-sep" aria-hidden="true">:</span>
          <span class="score opp"><b data-score="opp">0</b><small>${esc(opts.opponentName)}</small></span>
        </div>
        <ol class="team-balls opp" aria-label="${esc(t.theirTeam(opts.opponentName))}"></ol>
      </div>
      <div class="arena-main">
        <section class="side side-you" aria-label="${esc(t.you)}"></section>
        <section class="scene" data-drop="arena-field" aria-label="${esc(t.label)}">
          <div class="scene-bg" aria-hidden="true"><i class="scene-sun"></i><i class="scene-hill"></i></div>
          <div class="mon mon-opp"><i class="platform" aria-hidden="true"></i><div class="mon-body"></div></div>
          <div class="mon mon-you"><i class="platform" aria-hidden="true"></i><div class="mon-body"></div></div>
          <div class="hpbox hpbox-opp"></div>
          <div class="hpbox hpbox-you"></div>
          <div class="scene-fx" aria-hidden="true"><div class="fx-particles"></div></div>
          <p class="scene-text" aria-live="polite"></p>
        </section>
        <section class="side side-opp" aria-label="${esc(opts.opponentName)}"></section>
      </div>
      <div class="arena-dock">
        <div class="arena-prompt"></div>
        <div class="hand-wrap">
          <div class="hand-head">
            <span class="label">${esc(t.hand)}</span>
            <span class="hand-tip">${esc(t.handTip)}</span>
          </div>
          <div class="hand"></div>
        </div>
      </div>
    </div>`;
}

/** One side's six Poké Balls. The opponent's Pokémon show their sprite once sent out. */
export function teamBallsHTML(fighters: Fighter[], active: number | null, side: Side, seen = fighters.length): string {
  const t = L().battle.arena;
  return fighters.map((f, i) => {
    const state = side === 'opp' && i >= seen ? 'unseen' : f.hp <= 0 ? 'fainted' : i === active ? 'active' : 'standing';
    const name = state === 'unseen' ? '???' : monName(f.card);
    const inner = side === 'opp' && state !== 'unseen'
      ? `<img src="${esc(staticFront(f.card))}" alt="" draggable="false">`
      : icon('ball-color', 'tb-ball');
    return `<li class="tb tb-${state}" aria-label="${esc(t.ballLabel(i + 1, name, t.ball[state]))}">${inner}${state === 'fainted' ? `<span class="tb-x">${icon('x')}</span>` : ''}</li>`;
  }).join('');
}

/** Name, level and HP bar next to a Pokémon on the field. */
export function hpBoxHTML(f: Fighter): string {
  const pct = hpPct(f);
  const max = f.card.stats.hp;
  return `
    <div class="hpbox-name"><b>${esc(monName(f.card))}</b><small>${esc(L().core.card.level)} ${fmt(f.card.level)}</small></div>
    <div class="hpbar" data-tone="${hpTone(pct)}" role="meter" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${f.hp}"
      aria-label="${esc(L().core.stats.hp)}"><span class="hpbar-label">${esc(L().core.statsShort.hp)}</span><i style="width:${pct}%"></i></div>
    <span class="hpbox-num"><b data-hp>${fmt(f.hp)}</b>/${fmt(max)}</span>`;
}

/** Side panel: the Pokémon's card and stats. Against a foe, marks the stat it attacks with. */
export function sideHTML(f: Fighter | null, foe: { uses: 'atk' | 'spa'; mult: number } | null, dropHint = false): string {
  const t = L().battle.arena;
  const core = L().core;
  if (!f) {
    return dropHint
      ? `<div class="side-card" data-drop="arena-field"><div class="drop-hint">${icon('ball')}<span>${esc(t.dropHint)}</span></div></div>`
      : '<div class="side-card"><div class="side-empty">' + icon('ball-color') + '</div></div>';
  }
  const c = f.card;
  const rows = STAT_IDS.map(id => {
    const uses = foe?.uses === id;
    const value = id === 'hp' ? `${fmt(f.hp)}<small>/${fmt(c.stats.hp)}</small>` : fmt(c.stats[id]);
    const mark = uses ? ` <em class="stat-mult ${foe!.mult > 1 ? 'up' : foe!.mult < 1 ? 'down' : ''}">${multText(foe!.mult)}</em>` : '';
    return `<div class="stat ${uses ? 'uses' : ''}" data-stat="${id}" ${uses ? `title="${esc(t.usesStat)}"` : ''}>
      <span class="stat-label"><span class="full">${esc(core.stats[id])}</span><span class="short">${esc(core.statsShort[id])}</span></span>
      <b>${value}${mark}</b></div>`;
  }).join('');
  return `
    <div class="side-card ${f.hp <= 0 ? 'fainted' : ''}">${cardHTML({ id: c.id, shiny: c.shiny, level: c.level }, { size: 'md', eager: true })}</div>
    <div class="stats">${rows}</div>`;
}

/** Hand card: the card, its HP bar, and its state (on the field, fainted, chosen). */
export function handCardHTML(f: Fighter, i: number, state: { active: boolean; selected: boolean; disabled: boolean; edge: number | null }): string {
  const t = L().battle.arena;
  const c = f.card;
  const fainted = f.hp <= 0;
  const pct = hpPct(f);
  const label = fainted ? t.faintedCard(monName(c)) : t.pickCard(monName(c), c.level, `${f.hp}/${c.stats.hp}`);
  const edge = state.edge == null || fainted ? ''
    : state.edge > 0 ? `<span class="hand-edge good" title="${esc(t.advantage)}">${icon('up')}<span class="sr-only">${esc(t.advantage)}</span></span>`
      : state.edge < 0 ? `<span class="hand-edge bad" title="${esc(t.disadvantage)}">${icon('up')}<span class="sr-only">${esc(t.disadvantage)}</span></span>` : '';
  return `
    <button class="hand-card ${fainted ? 'fainted' : ''} ${state.active ? 'active' : ''} ${state.selected ? 'selected' : ''}" type="button" data-index="${i}"
      ${fainted || state.disabled ? 'disabled' : ''} aria-pressed="${state.selected}" aria-label="${esc(label)}">
      ${cardHTML({ id: c.id, shiny: c.shiny, level: c.level }, { size: 'sm', eager: true })}
      ${edge}
      ${state.active && !fainted ? `<span class="hand-tag">${esc(t.inField)}</span>` : ''}
      ${fainted ? `<span class="hand-mark">${icon('x')}</span>` : ''}
      <span class="hand-hp" data-tone="${hpTone(pct)}" aria-hidden="true"><i style="width:${pct}%"></i></span>
    </button>`;
}

/** Type multiplier chip: "×1.3 Super effective". */
export function chipHTML(mult: number, against: number, label: string): string {
  const tone = mult > against ? 'good' : mult < against ? 'bad' : mult > 1 ? 'good' : mult < 1 ? 'bad' : 'even';
  return `<span class="chip chip-${tone}"><small class="chip-label">${esc(label)}</small><b>${multText(mult)}</b><small>${esc(L().battle.arena.effect[mult] ?? '')}</small></span>`;
}

export interface Preview {
  you: BattleCard;
  opp: BattleCard;
  yourMult: number;
  theirMult: number;
}

export function previewHTML(p: Preview): string {
  const t = L().battle.arena.preview;
  return `
    <div class="preview">
      ${chipHTML(p.yourMult, p.theirMult, t.yours)}
      ${chipHTML(p.theirMult, p.yourMult, t.theirs)}
    </div>`;
}

/** The choice bar above the hand: what to do, the matchup preview and the confirm buttons. */
export function promptHTML(opts: {
  title: string; sub?: string; preview?: Preview; confirm?: string; keep?: string; idle?: boolean;
}): string {
  return `
    <div class="prompt ${opts.idle ? 'idle' : ''}">
      <div class="prompt-text">
        <strong>${esc(opts.title)}</strong>
        ${opts.sub ? `<span>${esc(opts.sub)}</span>` : ''}
      </div>
      ${opts.preview ? previewHTML(opts.preview) : ''}
      <div class="prompt-actions">
        ${opts.keep ? `<button class="btn btn-ghost" type="button" data-act="keep">${esc(opts.keep)}</button>` : ''}
        ${opts.confirm ? `<button class="btn btn-primary" type="button" data-act="confirm">${icon('ball')} ${esc(opts.confirm)}</button>` : ''}
      </div>
    </div>`;
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
          ${opts.team.map(c => `<li><img src="${esc(staticFront(c))}" alt="${esc(monName(c))}" draggable="false"></li>`).join('')}
        </ul>
        <button class="btn btn-primary btn-lg intro-start" type="button" data-act="start">${icon('swords')} ${esc(t.intro.start)}</button>
      </div>
    </div>`;
}

export function trainingHTML(training: BattleTraining, card: BattleCard | undefined): string {
  const t = L().battle.arena.end;
  if (!card) return '';
  const name = monName(card);
  return `
    <div class="end-training">
      ${cardHTML({ id: card.id, shiny: card.shiny, level: training.to }, { size: 'xs', eager: true })}
      <div class="end-training-text">
        <strong>${icon('up')} ${esc(t.trained(name))}</strong>
        ${training.to > training.from ? `<span class="end-levels">${esc(t.levels(training.from, training.to))}</span>` : ''}
        ${training.candy ? `<span class="end-candy">${esc(t.candy(training.candy))}</span>` : ''}
      </div>
    </div>`;
}

/** After a win the player picks who trains: the team's cards at their current levels (capped ones disabled). */
export function trainChoiceHTML(team: { card: BattleCard; level: number; fainted: boolean; maxed: boolean }[], levels: number): string {
  const t = L().battle.arena.end;
  return `
    <div class="end-train-choice" role="group" aria-labelledby="end-train-title">
      <strong id="end-train-title">${icon('up')} ${esc(t.chooseTrain(levels))}</strong>
      <span class="end-train-hint" hidden>${esc(t.chooseFirst)}</span>
      <div class="train-cards">
        ${team.map(({ card, level, fainted, maxed }) => `
          <button class="train-card ${fainted ? 'fainted' : ''} ${maxed ? 'maxed' : ''}" type="button" data-train="${esc(card.key ?? '')}"
            ${maxed ? `disabled title="${esc(t.maxed)}"` : ''} aria-label="${esc(maxed ? `${monName(card)}: ${t.maxed}` : t.trainCard(monName(card), level))}">
            ${cardHTML({ id: card.id, shiny: card.shiny, level }, { size: 'xs', eager: true })}
            <span class="train-lv">${esc(maxed ? t.maxedShort : `${L().core.card.level} ${fmt(level)}`)}</span>
          </button>`).join('')}
      </div>
    </div>`;
}

export function endHTML(opts: {
  result: 'win' | 'lose'; score: { you: number; opp: number }; perfect: boolean; duels: DuelLog[];
  you: BattleCard[]; opp: BattleCard[]; name: string; portrait?: string; line?: string;
  /** The training result, or the choice HTML (after a win, before the player picks). */
  training: BattleTraining | null;
  trainChoice?: string;
}): string {
  const t = L().battle.arena;
  const trainedCard = opts.training ? opts.you.find(c => c.key === opts.training!.key) : undefined;
  const sprite = (c: BattleCard) => `<img src="${esc(staticFront(c))}" alt="" draggable="false">`;
  return `
    <div class="arena-end end-${opts.result}" role="alertdialog" aria-modal="true" aria-labelledby="arena-end-title">
      <div class="end-panel">
        <div class="end-crest">${icon(opts.result === 'win' ? 'trophy' : 'flag')}</div>
        <h2 class="end-title" id="arena-end-title">${esc(t.end[opts.result])}</h2>
        ${opts.perfect ? `<p class="end-perfect">${icon('star')} ${esc(t.end.perfect)} ${icon('star')}</p>` : ''}
        <p class="end-score" aria-label="${esc(`${t.scoreboard}: ${opts.score.you} × ${opts.score.opp}`)}">
          <small>${esc(t.you)}</small><b>${opts.score.you}</b><span>×</span><b>${opts.score.opp}</b><small>${esc(opts.name)}</small></p>
        <div class="end-train-slot">${opts.training ? trainingHTML(opts.training, trainedCard) : opts.trainChoice ?? ''}</div>
        ${opts.line ? `
          <figure class="end-quote">
            ${opts.portrait ? `<img src="${esc(opts.portrait)}" alt="" draggable="false">` : ''}
            <blockquote><cite>${esc(opts.name)}</cite><p>“${esc(opts.line)}”</p></blockquote>
          </figure>` : ''}
        ${opts.duels.length ? `
        <details class="end-log">
          <summary>${icon('chevron')} ${esc(t.end.log)}</summary>
          <ol>
            ${opts.duels.map((d, i) => {
              const you = opts.you[d.you];
              const opp = opts.opp[d.opp];
              const won = d.winner === 'you';
              const dealt = (side: Side) => d.hits.filter(h => h.attacker === side);
              const sum = (side: Side) => dealt(side).reduce((s, h) => s + h.damage, 0);
              return `
              <li class="log-${won ? 'win' : 'lose'}" title="${esc(won ? t.end.beat(monName(you), monName(opp)) : t.end.beat(monName(opp), monName(you)))}">
                <span class="log-round">${i + 1}</span>
                <span class="log-mon ${won ? 'winner' : ''}">${sprite(you)}${esc(monName(you))}</span>
                <span class="log-vs">${icon('swords')}</span>
                <span class="log-mon opp ${won ? '' : 'winner'}">${esc(monName(opp))}${sprite(opp)}</span>
                <span class="log-mark">${icon(won ? 'check' : 'x')}</span>
                <span class="log-hits">
                  <span class="you">${esc(t.end.hits(dealt('you').length, sum('you')))}</span>
                  <span class="opp">${esc(t.end.hits(dealt('opp').length, sum('opp')))}</span>
                </span>
              </li>`;
            }).join('')}
          </ol>
        </details>` : ''}
        <button class="btn btn-primary btn-lg end-continue" type="button" data-act="continue">${esc(t.end.continue)} ${icon('right')}</button>
      </div>
    </div>`;
}
