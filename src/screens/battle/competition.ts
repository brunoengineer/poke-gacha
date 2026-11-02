// Ranked lobby (#/battle/competition): your rank card, the milestone track, Ash once you reach No. 1, and the
// leaderboard centered on you, with the five trainers above you open for a challenge (they train against your team's
// average). After a battle it applies the ladder result, celebrates a rank-up and shows the rewards.

import { sfx } from '../../audio';
import { itemSprite } from '../../data/items';
import { spriteUrl, trainerSpriteUrl } from '../../data/sprites';
import {
  applyLadderBattle, challengeable, claimMilestones, pendingMilestones, displayRank, generateLadder, LADDER_SIZE, LOSS_REPUTATION, MILESTONES, milestonePreview,
  rankedLevel, rankedTeam, rankForRating, winCoins, ELITE_RANKS, type LadderTrainer,
} from '../../game/modes/competition';
import {
  ASH_AVERAGE_BOOST, ashTeam, ashTeamLevel, ashUnlocked, ashWait, finishAshBattle, pikachuLevel, PIKACHU, startAshBattle,
} from '../../game/modes/ash';
import { playerScale } from '../../game/teams';
import type { Reward } from '../../game/rewards';
import { hashString } from '../../game/rng';
import { fmt, itemName, L } from '../../i18n';
import { grant, recordBattle } from '../../state/actions';
import { on, store, update } from '../../state/store';
import { animateNumber, esc, icon, openModal, reducedMotion, toast } from '../../ui/dom';
import { burst, Sequence } from '../../ui/fx';
import { showRewards } from '../../ui/rewards';
import type { ModeModule } from '../types';
import { runBattle } from './arena';
import { classTitle, modeHead, myTeam, PLAYER_SPRITE, portrait, scoutModal, teamReady, teamStrip, typeBadges } from './competition-ui';

let root: HTMLElement | null = null;
let offs: (() => void)[] = [];
let showAll = false;
let busy = false;
/** Keeps Ash's countdown current while the screen is open. */
let ashTimer: ReturnType<typeof setInterval> | undefined;

const t = () => L().modes.competition;
const ladder = () => generateLadder(store.save.ladder.seed);
const position = () => rankForRating(store.save.ladder.rating);
const rankLabel = (rank: number) => (rank > LADDER_SIZE ? '—' : `#${rank}`);
const teamAverage = () => playerScale(store.save).average;
/** A trainer as challenged now: the level and team it brings against the player's team. */
function opponent(tr: LadderTrainer) {
  const level = rankedLevel(tr.rank, position(), teamAverage());
  return { level, team: rankedTeam(tr, level, store.save.ladder.seed) };
}

export const competitionMode: ModeModule = {
  render(container) {
    competitionMode.dispose?.();
    root = container;
    container.addEventListener('click', onClick);
    offs.push(on('progress', () => { if (!busy) render(); }), on('deck', () => { if (!busy) render(); }));
    render();
    requestAnimationFrame(() => scrollToYou('auto'));
    ashTimer = setInterval(refreshAsh, 20_000);
  },
  dispose() {
    clearInterval(ashTimer);
    root?.removeEventListener('click', onClick);
    offs.forEach(off => off());
    offs = [];
    root = null;
  },
};

// --- Rendering ---------------------------------------------------------------------

function render() {
  if (!root) return;
  const save = store.save;
  const pos = position();
  const targets = new Set(challengeable(save.ladder.rating));
  root.innerHTML = `
    <div class="mode comp">
      ${modeHead(t().title, t().subtitle)}
      ${heroHTML(pos)}
      ${milestonesHTML(pos)}
      ${ashHTML()}
      <section class="ladder" aria-labelledby="ladder-title">
        <div class="ladder-head">
          <h2 class="section-title" id="ladder-title">${esc(t().ladder)}</h2>
          <p class="ladder-hint">${icon(pos === 1 ? 'crown' : 'up')} ${esc(pos === 1 ? t().topHint : t().climbHint)}</p>
          <button class="btn btn-ghost btn-sm" type="button" data-act="toggle" aria-expanded="${showAll}">
            ${icon(showAll ? 'user' : 'users')} ${esc(showAll ? t().showNear : t().showAll)}
          </button>
        </div>
        <ol class="ladder-list">${rowsHTML(pos, targets)}</ol>
        <p class="tip">${icon('crown')} ${esc(t().eliteHint)}</p>
      </section>
    </div>`;
}

/** Ash: a teaser until the player reaches No. 1, then the challenge with its countdown. */
function ashHTML() {
  const a = t().ash;
  const ladder = store.save.ladder;
  if (!ashUnlocked(ladder)) {
    return `
      <section class="ash-card is-locked">
        <span class="ash-portrait">${portrait('ash')}</span>
        <div class="ash-text"><h2>${icon('lock')} ${esc(a.lockedTitle)}</h2><p>${esc(a.lockedText)}</p></div>
      </section>`;
  }
  const scale = playerScale(store.save);
  const wait = ashWait(ladder);
  const record = ladder.ash;
  return `
    <section class="ash-card" data-ash>
      <span class="ash-portrait">${portrait('ash')}</span>
      <div class="ash-text">
        <h2>${esc(a.name)}</h2>
        <p>${esc(a.text(Math.round((ASH_AVERAGE_BOOST - 1) * 100)))}</p>
        <div class="ash-meta">
          <span class="pill">${icon('users')} ${esc(L().modes.level(ashTeamLevel(scale)))}</span>
          <span class="pill"><img src="${esc(spriteUrl(PIKACHU))}" alt="" width="28" height="28"> ${esc(L().modes.level(pikachuLevel(scale)))}</span>
          <span class="pill is-gold"><img src="${esc(itemSprite('master-ball'))}" alt="" width="24" height="24"> ${esc(a.prize)}</span>
          ${record ? `<span class="pill">${esc(a.record(record.wins, record.losses))}</span>` : ''}
        </div>
      </div>
      ${wait > 0
        ? `<span class="ash-wait">${icon('lock')} ${esc(a.wait(Math.ceil(wait / 60_000)))}</span>`
        : `<button class="btn btn-primary btn-lg" type="button" data-act="ash">${icon('swords')} ${esc(a.challenge)}</button>`}
    </section>`;
}

function refreshAsh() {
  if (busy) return;
  const card = root?.querySelector('[data-ash]');
  if (card) card.outerHTML = ashHTML();
}

function heroHTML(pos: number) {
  const { ladder: lad } = store.save;
  const ranked = pos <= LADDER_SIZE;
  const tier = !ranked ? 'none' : pos === 1 ? 'top' : pos <= ELITE_RANKS ? 'elite' : pos <= 25 ? 'gold' : pos <= 50 ? 'silver' : 'bronze';
  return `
    <section class="comp-hero" data-tier="${tier}">
      <div class="comp-rank">
        <span class="comp-rank-emblem">${icon(pos === 1 ? 'crown' : pos <= ELITE_RANKS ? 'star' : 'medal')}</span>
        <div class="comp-rank-text">
          <span class="label">${esc(t().yourRank)}</span>
          <b class="comp-rank-num" data-rank>${ranked ? `#${pos}` : esc(t().unranked)}</b>
          <small>${esc(ranked ? t().of(LADDER_SIZE) : t().unrankedHint)}</small>
        </div>
      </div>
      <dl class="comp-stats">
        <div><dt class="label">${esc(t().reputation)}</dt><dd>${esc(t().points(lad.rating))}</dd></div>
        <div><dt class="label">${esc(t().record)}</dt><dd><span class="win">${fmt(lad.wins)}</span> / <span class="loss">${fmt(lad.losses)}</span></dd></div>
        <div><dt class="label">${esc(t().best)}</dt><dd>${ranked ? `#${Math.min(lad.best ?? pos, pos)}` : '—'}</dd></div>
      </dl>
      <div class="comp-team">
        <span class="label">${esc(L().modes.yourTeam)}</span>
        ${teamStrip(myTeam())}
        <a class="btn btn-ghost btn-sm" href="#/collection">${icon('cards')} ${esc(L().modes.editTeam)}</a>
      </div>
    </section>`;
}

function rewardChip(r: Reward) {
  if (r.kind !== 'item') return '';
  const stone = r.item === 'stone';
  const name = stone ? t().randomStone : itemName(r.item);
  const sprite = stone ? itemSprite('thunder-stone') : itemSprite(r.item);
  return `<span class="ms-reward" title="${esc(`${name} ×${r.amount}`)}"><img src="${esc(sprite)}" alt="" width="30" height="30" loading="lazy">${r.amount > 1 ? `<b>×${fmt(r.amount)}</b>` : ''}<span class="sr-only">${esc(`${name} ×${r.amount}`)}</span></span>`;
}

/** Position of the progress fill along the track (nodes sit at 10%, 30% … 90%). */
function trackFill(pos: number) {
  const ranks = MILESTONES.map(m => m.rank);
  if (pos > ranks[0]) return (10 * Math.max(0, LADDER_SIZE + 1 - pos)) / (LADDER_SIZE + 1 - ranks[0]);
  for (let i = 0; i < ranks.length - 1; i++) {
    if (pos > ranks[i + 1]) return 10 + 20 * (i + (ranks[i] - pos) / (ranks[i] - ranks[i + 1]));
  }
  return 90;
}

function milestonesHTML(pos: number) {
  const claimed = store.save.ladder.milestones;
  const pending = new Set(pendingMilestones(store.save.ladder).map(m => m.id));
  const next = MILESTONES.find(m => !claimed.includes(m.id) && !pending.has(m.id));
  return `
    <section class="milestones" aria-labelledby="ms-title">
      <h2 class="section-title" id="ms-title">${esc(t().milestones)}</h2>
      <ol class="ms-track" style="--fill:${trackFill(pos).toFixed(1)}%">
        ${MILESTONES.map(m => {
          const state = claimed.includes(m.id) ? 'done' : pending.has(m.id) ? 'ready' : m === next ? 'next' : 'locked';
          const node = { done: 'check', ready: 'gift', next: 'flag', locked: m.rank === 1 ? 'crown' : 'lock' }[state];
          const note = state === 'done' ? `<small class="ms-state">${esc(t().milestoneDone)}</small>`
            : state === 'ready' ? `<button class="btn btn-primary btn-sm ms-claim" type="button" data-act="claim">${icon('gift')} ${esc(t().claim)}</button>`
            : `<small class="ms-state">${state === 'next' ? esc(t().milestoneLeft(pos - m.rank)) : ''}</small>`;
          return `
            <li class="ms" data-state="${state}">
              <span class="ms-node">${icon(node)}</span>
              <b class="ms-label">${esc(t().milestone(m.rank))}</b>
              <span class="ms-rewards">${milestonePreview(m).map(rewardChip).join('')}</span>
              ${note}
            </li>`;
        }).join('')}
      </ol>
    </section>`;
}

function rowsHTML(pos: number, targets: Set<number>) {
  const trainers = ladder();
  // Display positions 1..101: trainers keep their slot above the player and shift down one below.
  const total = LADDER_SIZE + 1;
  const youAt = Math.min(pos, total);
  let positions: number[];
  if (showAll) positions = Array.from({ length: total }, (_, i) => i + 1);
  else {
    const start = Math.max(1, Math.min(youAt - 7, total - 10));
    const end = Math.min(total, start + 10);
    positions = [];
    if (start > 1) positions.push(...[1, 2, 3].filter(p => p < start));
    for (let p = start; p <= end; p++) positions.push(p);
  }
  const out: string[] = [];
  let prev = 0;
  for (const p of positions) {
    if (prev && p > prev + 1) out.push('<li class="ladder-gap" aria-hidden="true"><span></span><span></span><span></span></li>');
    prev = p;
    if (p === youAt) out.push(youRowHTML(pos));
    else {
      const slot = p < youAt ? p : p - 1;
      out.push(trainerRowHTML(trainers[slot - 1], p, targets.has(slot)));
    }
  }
  return out.join('');
}

function trainerRowHTML(tr: LadderTrainer, shown: number, target: boolean) {
  const podium = shown <= 3 ? ` data-podium="${shown}"` : '';
  const title = classTitle(tr.classId);
  const defend = position() === 1;
  // Only the trainers open for a challenge have a known level: it depends on where the player stands.
  const faced = target ? opponent(tr) : null;
  return `
    <li class="lrow${tr.elite ? ' is-elite' : ''}${target ? ' is-target' : ''}" data-slot="${tr.rank}"${podium}>
      <span class="lrow-pos">${shown <= 3 ? icon('crown') : ''}<b>${shown}</b></span>
      <span class="lrow-art">${portrait(tr.sprite)}</span>
      <span class="lrow-who">
        <b class="lrow-name">${esc(tr.name)}${tr.elite ? ` <span class="elite-tag">${esc(t().elite)}</span>` : ''}</b>
        <small class="lrow-class">${esc(title)}</small>
        <span class="lrow-types">${typeBadges(tr.types)}</span>
      </span>
      ${faced ? `<button class="lrow-team" type="button" data-act="scout" data-slot="${tr.rank}" aria-label="${esc(t().scout(tr.name))}">${teamStrip(faced.team)}</button>` : '<span class="lrow-team-empty"></span>'}
      <span class="lrow-level">${faced ? esc(L().modes.level(faced.level)) : ''}</span>
      <span class="lrow-rep">${esc(t().points(tr.reputation))}</span>
      ${faced ? `
        <button class="btn btn-primary btn-sm lrow-go" type="button" data-act="challenge" data-slot="${tr.rank}">
          ${icon('swords')} ${esc(defend ? t().defend : t().challenge)}
          <small>${icon('coin', 'i-coin')}${fmt(winCoins(faced.level))}</small>
        </button>` : '<span class="lrow-go-empty"></span>'}
    </li>`;
}

function youRowHTML(pos: number) {
  const ranked = pos <= LADDER_SIZE;
  const name = store.player?.name ?? L().modes.you;
  return `
    <li class="lrow is-you" aria-current="true">
      <span class="lrow-pos">${pos <= 3 ? icon('crown') : ''}<b>${ranked ? pos : '—'}</b></span>
      <span class="lrow-art">${portrait(PLAYER_SPRITE)}</span>
      <span class="lrow-who">
        <b class="lrow-name">${esc(name)} <span class="you-tag">${esc(L().modes.you)}</span></b>
        <small class="lrow-class">${esc(ranked ? t().yourRank : t().unrankedHint)}</small>
      </span>
      <span class="lrow-team">${teamStrip(myTeam())}</span>
      <span class="lrow-level"></span>
      <span class="lrow-rep">${esc(t().points(store.save.ladder.rating))}</span>
      <span class="lrow-go-empty"></span>
    </li>`;
}

function scrollToYou(behavior: ScrollBehavior) {
  const row = root?.querySelector<HTMLElement>('.lrow.is-you');
  if (!row || !showAll) return;
  row.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : behavior });
}

// --- Actions -------------------------------------------------------------------------

function onClick(event: Event) {
  const button = (event.target as Element).closest<HTMLElement>('[data-act]');
  if (!button || busy) return;
  const slot = Number(button.dataset.slot);
  switch (button.dataset.act) {
    case 'toggle':
      showAll = !showAll;
      sfx('click');
      render();
      scrollToYou('smooth');
      break;
    case 'scout': {
      const tr = ladder()[slot - 1];
      const faced = opponent(tr);
      sfx('open');
      void scoutModal({
        name: tr.name,
        title: `${classTitle(tr.classId)} · #${displayRank(tr.rank, position())}`,
        sprite: tr.sprite,
        types: tr.types,
        team: faced.team,
        info: `${icon('coin', 'i-coin')} ${esc(t().prize(winCoins(faced.level)))}`,
        action: position() === 1 ? t().defend : t().challenge,
      }).then(go => { if (go) void challenge(slot); });
      break;
    }
    case 'challenge':
      void challenge(slot);
      break;
    case 'claim':
      void claim();
      break;
    case 'ash':
      void fightAsh();
      break;
  }
}

async function claim() {
  const result = update(save => claimMilestones(save.ladder), ['progress']);
  if (!result.milestones.length) return;
  const last = result.milestones.at(-1)!;
  await showRewards(grant(result.rewards), { title: t().milestoneTitle(t().milestone(last.rank)), crest: last.rank === 1 ? 'crown' : 'medal' });
}

async function fightAsh() {
  if (busy || !teamReady()) return;
  // The hour starts now: leaving the battle doesn't give another try.
  if (!update(save => startAshBattle(save.ladder), ['progress'])) return;
  const a = t().ash;
  busy = true;
  sfx('click');
  try {
    const outcome = await runBattle({
      mode: 'competition',
      opponent: {
        id: 'ash', name: a.name, title: a.title, portrait: trainerSpriteUrl('ash'),
        team: ashTeam(playerScale(store.save)), intro: a.intro, winLine: a.winLine, loseLine: a.loseLine,
      },
      music: 'champion',
      stage: a.stage,
    });
    const won = !outcome.forfeit && outcome.result === 'win';
    recordBattle(outcome.forfeit ? 'forfeit' : outcome.result);
    const prize = update(save => finishAshBattle(save.ladder, won), ['progress']);
    if (won) await showRewards(grant(prize), { title: a.winTitle, subtitle: a.winSub, crest: 'crown' });
    else toast(a.lost, 'info');
  } finally {
    busy = false;
    render();
  }
}

const lineFor = (list: string[], tr: LadderTrainer, salt: string) => list[hashString(`${tr.id}-${salt}`) % list.length];

async function challenge(slot: number) {
  if (busy || !challengeable(store.save.ladder.rating).includes(slot) || !teamReady()) return;
  const tr = ladder()[slot - 1];
  const shown = displayRank(slot, position());
  const faced = opponent(tr);
  busy = true;
  sfx('click');
  try {
    const outcome = await runBattle({
      mode: 'competition',
      opponent: {
        id: tr.id,
        name: tr.name,
        title: `${classTitle(tr.classId)} · #${shown}`,
        portrait: trainerSpriteUrl(tr.sprite),
        team: faced.team,
        intro: lineFor(tr.elite ? t().eliteIntro : t().intro, tr, 'intro'),
        winLine: lineFor(t().winLine, tr, 'win'),
        loseLine: lineFor(t().loseLine, tr, 'lose'),
      },
      music: 'battle',
      stage: t().stage(shown),
    });
    const result = update(save => applyLadderBattle(save.ladder, slot, outcome.result, outcome.forfeit, undefined, faced.level), ['progress']);
    recordBattle(outcome.forfeit ? 'forfeit' : outcome.result);
    // Grant right away: the milestones are already marked as claimed, so leaving during the rank-up can't lose them.
    const applied = result.rewards.length ? grant(result.rewards) : [];
    render();

    if (result.after < result.before) await celebrateRankUp(result.before, result.after);
    const milestone = result.milestones.at(-1);
    if (outcome.result === 'win') {
      await showRewards(applied, {
        title: milestone ? t().milestoneTitle(t().milestone(milestone.rank)) : t().winTitle,
        subtitle: result.before === 1 ? t().defendSub(tr.name) : t().winSub(tr.name, result.after),
        crest: milestone ? (milestone.rank === 1 ? 'crown' : 'medal') : 'trophy',
      });
    } else if (outcome.forfeit) {
      toast(t().forfeit(result.ratingBefore - result.ratingAfter), 'warning');
      if (milestone) await showRewards(applied, { title: t().milestoneTitle(t().milestone(milestone.rank)), crest: 'medal' });
    } else {
      await showRewards(applied, {
        title: t().loseTitle,
        subtitle: t().loseSub(Math.min(LOSS_REPUTATION, result.ratingBefore)),
        tone: 'lose',
      });
    }
  } finally {
    busy = false;
    render();
  }
}

/** Full-screen rank-up moment: the rank number counts up to the new position. Tap to skip. */
export function celebrateRankUp(before: number, after: number): Promise<void> {
  const enteredElite = after <= ELITE_RANKS && before > ELITE_RANKS;
  const title = after === 1 ? t().numberOne : before > LADDER_SIZE ? t().enterTop : enteredElite ? t().enterElite : t().rankUp;
  const climbed = Math.min(before, LADDER_SIZE + 1) - after;
  const seq = new Sequence();
  sfx('rankUp');
  return new Promise(resolve => {
    const modal = openModal({
      className: `fx-overlay rankup-overlay${after <= ELITE_RANKS ? ' is-elite' : ''}`,
      label: title,
      onClose: () => { seq.skip(); resolve(); },
      html: `
        <div class="rankup" data-close>
          <span class="rankup-rays" aria-hidden="true"></span>
          <p class="label">${esc(t().newRank)}</p>
          <div class="rankup-badge">
            <span class="rankup-icon">${icon(after === 1 ? 'crown' : after <= ELITE_RANKS ? 'star' : 'up')}</span>
            <b class="rankup-num">${rankLabel(before)}</b>
          </div>
          <h2 class="fx-title">${esc(title)}</h2>
          <p class="rankup-from"><span>${rankLabel(before)}</span>${icon('right')}<b>${rankLabel(after)}</b><em>${esc(t().places(climbed))}</em></p>
          <button class="btn btn-primary rankup-continue" type="button" data-close autofocus>${esc(L().core.actions.continue)}</button>
        </div>`,
    });
    const badge = modal.root.querySelector<HTMLElement>('.rankup-badge')!;
    const num = modal.root.querySelector<HTMLElement>('.rankup-num')!;
    void (async () => {
      await seq.anim(badge, [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 500, easing: 'cubic-bezier(.2,.9,.3,1.3)' });
      const from = Math.min(before, LADDER_SIZE + 1);
      if (seq.skipped) num.textContent = `#${after}`;
      else animateNumber(num, from, after, 900, value => (value > LADDER_SIZE ? '—' : `#${value}`));
      await seq.wait(900);
      burst(badge, { color: after <= ELITE_RANKS ? '#e3c4ff' : '#f4dca3', count: 36, distance: 220 });
      burst(badge, { color: '#fff4c2', count: 12, distance: 160, shape: 'star' });
      void seq.anim(badge, [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 380 });
    })();
  });
}
