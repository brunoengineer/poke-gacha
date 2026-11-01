// Battle arena: a full-screen layer any mode can open. Intro -> HP battle -> result panel.
// The opponent sends out its first Pokémon and the player chooses who goes in (tap or drag a card to the field,
// with a matchup preview). Each duel then plays out by itself, hit by hit, with the rules of src/game/duel.ts:
// the faster Pokémon strikes first, HP bars drain, the loser faints. When the opponent's Pokémon faints it sends
// the next one and the player may keep the damaged survivor in or switch; when the player's faints, they pick the
// next one. Tap the field (or Esc) to skip a duel; 1×/2× speed. The battle ends when one side has no Pokémon left.
//
// API contract:
//   runBattle(config) -> Promise<BattleOutcome>, resolved when the battle ends (or the player forfeits).
//   The arena records nothing except the post-battle training of one team member (trainTeamAfterBattle, not on
//   forfeits); the calling mode applies rewards and progress from the outcome.

import { playCry, playMusic, sfx } from '../../audio';
import { getSpecies } from '../../data/species';
import { matchup, toBattleCard, type BattleCard, type TeamMember } from '../../game/battle';
import {
  battleWinner, createBattle, firstStriker, playDuel, previewDuel, sendIn, standing, strike, summarizeBattle,
  type BattleState, type DuelLog, type Hit, type HpBattleSummary, type Side,
} from '../../game/duel';
import { DECK_SIZE } from '../../game/economy';
import { BATTLE_LEVELS, type BattleTraining } from '../../game/progression';
import { playerTeam } from '../../game/teams';
import { fmt, L } from '../../i18n';
import { trainTeamAfterBattle } from '../../state/actions';
import { store } from '../../state/store';
import { draggable, dropZone } from '../../ui/dnd';
import { $, $$, confirmDialog, el, esc, fxSpeed, modalOpen, reducedMotion, sleep, toast } from '../../ui/dom';
import { burst, Sequence } from '../../ui/fx';
import { restoreMusic } from '../../ui/shell';
import {
  backSprite, endHTML, frontSprite, handCardHTML, hpBoxHTML, hpTone, introHTML, layoutHTML, promptHTML, sideHTML,
  staticBack, staticFront, teamBallsHTML, trainChoiceHTML, trainingHTML, type Preview,
} from './arena-parts';

export interface Opponent {
  /** Stable id (trainer id, gym id, generated ladder id). */
  id: string;
  name: string;
  /** Subtitle: trainer class, gym name, ladder rank… */
  title?: string;
  /** Portrait URL (trainerSpriteUrl()). */
  portrait?: string;
  team: TeamMember[];
  /** Line shown before the battle. */
  intro?: string;
  /** Lines shown when the opponent wins / loses. */
  winLine?: string;
  loseLine?: string;
}

export interface BattleConfig {
  mode: 'training' | 'competition' | 'gym' | 'league';
  opponent: Opponent;
  music?: 'battle' | 'gym' | 'league' | 'champion';
  /** Small label at the top (e.g. "Quartas de final"). */
  stage?: string;
  /** Accent color for the field and intro (defaults per mode; gyms pass their type color). */
  accent?: string;
  /** Shows the predicted outcome of each matchup while choosing (Training). */
  hints?: boolean;
}

export interface BattleOutcome extends HpBattleSummary {
  forfeit: boolean;
  duels: DuelLog[];
  /** The team member that trained after the battle (null on forfeits). */
  training: BattleTraining | null;
}

type Phase = 'intro' | 'choose' | 'switch' | 'duel' | 'end';

const MODE_ACCENT: Record<BattleConfig['mode'], string> = {
  training: '#4fd18b',
  competition: '#5aa9ff',
  gym: '#d3bc8e',
  league: '#c58cff',
};

const EASE = 'cubic-bezier(.2,.8,.2,1)';
const SPEED_KEY = 'pg-battle-speed';

interface Battle {
  config: BattleConfig;
  state: BattleState;
  hand: BattleCard[];
  opp: BattleCard[];
  phase: Phase;
  /** Card the player is about to send in (choose / switch phases). */
  candidate: number | null;
  /** Resolves the pending choice. */
  pick: ((index: number) => void) | null;
  /** Pokémon drawn on the field (the player's may differ from state.youActive while choosing). */
  fieldYou: number | null;
  fieldOpp: number | null;
  /** Opponent Pokémon sent out so far (the rest show as Poké Balls). */
  seen: number;
  fast: boolean;
  seq: Sequence;
  layer: HTMLElement;
  resolve: (outcome: BattleOutcome) => void;
  inerted: HTMLElement[];
  outcome: BattleOutcome | null;
}

let battle: Battle | null = null;

/** True while a battle layer is open. */
export const battleActive = () => battle !== null;

/** The player's team as battle cards (empty slots skipped). */
export const playerBattleTeam = (): BattleCard[] => playerTeam(store.save).map(m => toBattleCard(m, m.key));

const choosing = (b: Battle) => b.phase === 'choose' || b.phase === 'switch';
const canPick = (b: Battle, index: number) => choosing(b) && (b.state.you[index]?.hp ?? 0) > 0;

// The drop target is registered once; it acts on whichever battle is open.
dropZone('arena-field', {
  accepts: payload => payload.type === 'arena-hand' && !!battle && canPick(battle, Number(payload.index)),
  drop: payload => {
    if (!battle) return false;
    const b = battle;
    select(b, Number(payload.index), true);
    confirm(b);
    return $(b.layer, '.mon-you .mon-body');
  },
});

if (typeof document !== 'undefined') {
  document.addEventListener('dnd:start', event => {
    if (battle && (event as CustomEvent).detail?.type === 'arena-hand') sfx('cardPick');
  });
}

function loadFast() {
  try { return localStorage.getItem(SPEED_KEY) === '2'; } catch { return false; }
}

export function runBattle(config: BattleConfig): Promise<BattleOutcome> {
  if (battle) return Promise.reject(new Error('A battle is already running'));
  const hand = playerBattleTeam();
  if (hand.length < DECK_SIZE) {
    toast(L().battle.hub.blocked, 'warning');
    return Promise.resolve({
      result: 'lose', score: { you: 0, opp: 0 }, perfect: false, totals: { you: 0, opp: 0 }, tiebreak: false,
      forfeit: true, duels: [], training: null,
    });
  }

  return new Promise(resolve => {
    const opp = config.opponent.team.slice(0, DECK_SIZE).map(m => toBattleCard(m));
    const layer = el(`<div class="arena-layer" role="dialog" aria-modal="true" data-mode="${config.mode}"
      aria-label="${esc(L().battle.arena.versus(L().battle.arena.you, config.opponent.name))}"
      style="--accent:${esc(config.accent ?? MODE_ACCENT[config.mode])}"></div>`);

    battle = {
      config, hand, opp, layer, resolve,
      state: createBattle(hand, opp),
      phase: 'intro', candidate: null, pick: null, fieldYou: null, fieldOpp: null, seen: 0, fast: loadFast(),
      seq: new Sequence(), inerted: [], outcome: null,
    };
    preload(hand, opp);
    open(battle);
  });
}

// --- Layer lifecycle ---------------------------------------------------------------

function open(b: Battle) {
  const { config } = b;
  b.layer.innerHTML = layoutHTML({
    stage: [config.stage, config.opponent.name].filter(Boolean).join(' · '),
    opponentName: config.opponent.name,
    fast: b.fast,
  });
  document.body.append(b.layer);
  document.documentElement.classList.add('arena-open');
  for (const node of [...document.body.children] as HTMLElement[]) {
    if (node === b.layer || node.id === 'toasts' || node.inert) continue;
    node.inert = true;
    b.inerted.push(node);
  }

  b.layer.addEventListener('click', onClick);
  b.layer.addEventListener('keydown', onKey);
  draggable($(b.layer, '.hand'), '.hand-card:not(:disabled)', node =>
    battle && canPick(battle, Number(node.dataset.index)) ? { type: 'arena-hand', index: Number(node.dataset.index) } : null);

  playMusic(config.music ?? 'battle');
  renderSide(b, 'you');
  renderSide(b, 'opp');
  renderTeams(b);
  renderHand(b);
  void playIntro(b);
}

function close(b: Battle, outcome: BattleOutcome) {
  if (battle !== b) return;
  battle = null;
  b.seq.skip();
  b.inerted.forEach(node => { node.inert = false; });
  const finish = () => {
    b.layer.remove();
    if (!document.querySelector('.arena-layer')) document.documentElement.classList.remove('arena-open');
  };
  if (reducedMotion()) finish();
  else b.layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' }).finished.then(finish, finish);
  restoreMusic();
  b.resolve(outcome);
}

function preload(hand: BattleCard[], opp: BattleCard[]) {
  for (const c of opp) [frontSprite(c), staticFront(c)].forEach(src => { new Image().src = src; });
  for (const c of hand) [backSprite(c)].forEach(src => { new Image().src = src; });
}

/** A fresh animation sequence at the current battle speed. */
function newSeq(b: Battle) {
  b.seq = new Sequence();
  b.seq.scale = b.fast ? 0.5 : 1;
  return b.seq;
}

// --- Intro ----------------------------------------------------------------------------

async function playIntro(b: Battle) {
  const o = b.config.opponent;
  const intro = el(introHTML({
    name: o.name, title: o.title, portrait: o.portrait, line: o.intro, stage: b.config.stage,
    oppCount: b.opp.length, team: b.hand,
  }));
  b.layer.append(intro);
  const seq = new Sequence();
  b.seq = seq;
  requestAnimationFrame(() => $(intro, '.intro-start').focus({ preventScroll: true }));
  sfx('open');

  const balls = $$(intro, '.intro-balls li');
  const team = $$(intro, '.intro-team li');
  void seq.anim($(intro, '.intro-opp'), [{ transform: 'translateX(60%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: EASE });
  void seq.anim($(intro, '.intro-you'), [{ transform: 'translateX(-60%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: EASE });
  void seq.anim($(intro, '.intro-portrait'), [{ transform: 'translateX(40px) scale(.9)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, delay: 200, easing: EASE });
  void seq.anim($(intro, '.intro-vs'), [{ transform: 'scale(2.6) rotate(-12deg)', opacity: 0 }, { transform: 'scale(1) rotate(-6deg)', opacity: 1 }], { duration: 420, delay: 380, easing: 'cubic-bezier(.3,1.6,.5,1)' });
  balls.forEach((ball, i) => void seq.anim(ball, [{ transform: 'translateY(-14px) scale(.4)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, delay: 520 + i * 70, easing: EASE }));
  team.forEach((mon, i) => void seq.anim(mon, [{ transform: 'translateY(14px) scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 300, delay: 520 + i * 70, easing: EASE }));
  void seq.anim($(intro, '.intro-line'), [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: 760 });
}

function startBattle(b: Battle) {
  if (b.phase !== 'intro') return;
  const intro = $(b.layer, '.arena-intro');
  b.seq.skip();
  sfx('click');
  b.phase = 'duel';
  const done = () => intro?.remove();
  if (reducedMotion() || !intro) done();
  else intro.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(1.04)' }], { duration: 260, easing: 'ease-in', fill: 'forwards' }).finished.then(done, done);
  void run(b);
}

// --- Battle flow ------------------------------------------------------------------------

async function run(b: Battle) {
  const s = b.state;
  await sendOutOpp(b);
  let entered = true;
  while (battle === b && !battleWinner(s)) {
    if (s.youActive == null) {
      // With one Pokémon left there is nothing to choose.
      const left = standing(s.you);
      const index = left.length === 1 && s.duels.length ? left[0] : await choose(b, 'choose');
      if (battle !== b) return;
      sendIn(s, index);
      await goYou(b, index);
    } else if (entered && standing(s.you).length > 1) {
      const index = await choose(b, 'switch');
      if (battle !== b) return;
      if (index !== s.youActive) {
        await withdraw(b);
        sendIn(s, index);
        await goYou(b, index);
      }
    }
    if (battle !== b) return;
    entered = false;
    const before = { you: s.you[s.youActive!].hp, opp: s.opp[s.oppActive].hp };
    const log = playDuel(s)!;
    await playOut(b, log, before);
    if (battle !== b) return;
    if (log.winner === 'you' && s.oppActive >= 0) {
      await sendOutOpp(b);
      entered = true;
    }
  }
  if (battle === b) void showEnd(b);
}

/** Waits for the player to pick a Pokémon. 'switch' starts with the one on the field (keeping it is one tap). */
function choose(b: Battle, phase: 'choose' | 'switch'): Promise<number> {
  b.phase = phase;
  b.candidate = phase === 'switch' ? b.state.youActive : null;
  b.layer.classList.add('choosing');
  if (phase === 'choose') placeMon(b, 'you', null, false);
  renderTeams(b);
  renderPrompt(b);
  renderHand(b);
  requestAnimationFrame(() => {
    const target = phase === 'switch' ? $(b.layer, '.arena-prompt [data-act="confirm"]') : $(b.layer, '.hand-card:not(:disabled)');
    target?.focus({ preventScroll: true });
  });
  return new Promise(resolve => { b.pick = resolve; });
}

function select(b: Battle, index: number, fromDrop = false) {
  if (!canPick(b, index)) return;
  if (b.candidate === index && !fromDrop) return confirm(b);
  b.candidate = index;
  sfx('cardPlace');
  // While choosing (nobody on the field), the candidate steps onto the field right away.
  if (b.phase === 'choose') placeMon(b, 'you', index, true);
  renderPrompt(b);
  renderHand(b);
  if (!fromDrop) requestAnimationFrame(() => $(b.layer, '.arena-prompt [data-act="confirm"]')?.focus({ preventScroll: true }));
}

function confirm(b: Battle) {
  if (!choosing(b) || b.candidate == null || !b.pick) return;
  const pick = b.pick;
  const index = b.candidate;
  b.pick = null;
  b.candidate = null;
  b.phase = 'duel';
  b.layer.classList.remove('choosing');
  sfx('click');
  renderPrompt(b);
  renderHand(b);
  pick(index);
}

function keep(b: Battle) {
  if (b.phase !== 'switch') return;
  b.candidate = b.state.youActive;
  confirm(b);
}

async function goYou(b: Battle, index: number) {
  const seq = newSeq(b);
  if (b.fieldYou !== index) placeMon(b, 'you', index, true);
  renderTeams(b);
  renderHand(b);
  say(b, L().battle.arena.text.go(name(b.hand[index])));
  await seq.wait(450);
}

async function withdraw(b: Battle) {
  const seq = newSeq(b);
  const active = b.state.youActive!;
  say(b, L().battle.arena.text.comeBack(name(b.hand[active])));
  if (!seq.skipped) sfx('ballClick');
  await seq.anim($(ui(b).monYou, '.mon-body'), [
    { transform: 'scale(1)', filter: 'none', opacity: 1 },
    { transform: 'scale(.1)', filter: 'brightness(4)', opacity: 0 },
  ], { duration: 340, easing: 'ease-in', fill: 'forwards' });
}

async function sendOutOpp(b: Battle) {
  const s = b.state;
  const seq = newSeq(b);
  b.seen = Math.max(b.seen, s.oppActive + 1);
  placeMon(b, 'opp', s.oppActive, true);
  renderTeams(b);
  renderHand(b);
  say(b, L().battle.arena.text.sends(b.config.opponent.name, name(b.opp[s.oppActive])));
  await seq.wait(750);
}

// --- Duel playback ------------------------------------------------------------------------

async function playOut(b: Battle, log: DuelLog, before: { you: number; opp: number }) {
  const t = L().battle.arena;
  const u = ui(b);
  const seq = newSeq(b);
  b.phase = 'duel';
  b.layer.classList.add('dueling');
  const cards = { you: b.hand[log.you], opp: b.opp[log.opp] };
  const hp = { ...before };
  const first = log.hits[0]?.attacker ?? 'you';

  const firstBox = first === 'you' ? u.hpYou : u.hpOpp;
  firstBox.classList.add('first');
  say(b, t.text.faster(name(cards[first])));
  if (!seq.skipped) sfx('click');
  await seq.wait(650);

  for (const [i, hit] of log.hits.entries()) {
    if (battle !== b) return;
    if (i > 0) say(b, t.text.attacks(name(cards[hit.attacker]), L().core.stats[hit.stat]));
    const target: Side = hit.attacker === 'you' ? 'opp' : 'you';
    await strikeFx(b, seq, hit, cards[target], hp[target]);
    hp[target] = hit.hpLeft;
    if (hit.ko) {
      await faint(b, seq, target, cards[target]);
    } else {
      await seq.wait(220);
    }
  }
  if (battle !== b) return;
  firstBox.classList.remove('first');
  b.layer.classList.remove('dueling');
  syncAfterDuel(b, log);
}

async function strikeFx(b: Battle, seq: Sequence, hit: Hit, target: BattleCard, from: number) {
  const t = L().battle.arena;
  const u = ui(b);
  const attackerMon = hit.attacker === 'you' ? u.monYou : u.monOpp;
  const targetSide: Side = hit.attacker === 'you' ? 'opp' : 'you';
  const targetMon = targetSide === 'you' ? u.monYou : u.monOpp;
  const targetBody = $(targetMon, '.mon-body');
  const lunge = hit.attacker === 'you' ? 'translate(24%, -18%) scale(1.08)' : 'translate(-20%, 14%) scale(1.08)';

  await seq.anim($(attackerMon, '.mon-body'), [
    { transform: 'none' }, { transform: lunge, offset: 0.45 }, { transform: 'none' },
  ], { duration: 340, easing: 'cubic-bezier(.5,0,.5,1)', fill: 'none' });

  if (!seq.skipped) {
    sfx(hit.mult > 1 ? 'superEffective' : hit.mult < 1 ? 'notEffective' : 'hit');
    burst(targetMon.querySelector('.mon-sprite'), {
      color: hit.mult > 1 ? '#ffd166' : hit.mult < 1 ? '#a6adbb' : '#f4dca3', count: hit.mult > 1 ? 22 : 12, distance: hit.mult > 1 ? 110 : 70, duration: 520,
    });
    if (hit.mult > 1) void seq.anim(u.scene, shakeFrames(hit.mult >= 1.6 ? 9 : 6), { duration: 380, fill: 'none' });
  }
  const dmg = pop(b, targetMon, `-${fmt(hit.damage)}`, `pop-dmg ${hit.mult > 1 ? 'big' : ''}`, L().core.statsShort[hit.stat]);
  void seq.anim(dmg, [
    { transform: 'translate(-50%, 10px) scale(.4)', opacity: 0 },
    { transform: 'translate(-50%, -16px) scale(1.15)', opacity: 1, offset: 0.2 },
    { transform: 'translate(-50%, -22px) scale(1)', opacity: 1, offset: 0.8 },
    { transform: 'translate(-50%, -34px) scale(1)', opacity: 0 },
  ], { duration: 1150, easing: EASE }).then(() => dmg.remove());

  targetMon.classList.add('hit');
  await Promise.all([
    seq.anim(targetBody, [{ opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }], { duration: 360, fill: 'none' }),
    seq.anim(targetBody, shakeFrames(hit.mult > 1 ? 10 : 6), { duration: 360, fill: 'none' }),
    drain(b, seq, targetSide, target, from, hit.hpLeft),
  ]);
  targetMon.classList.remove('hit');

  if (hit.mult !== 1) {
    const text = hit.mult > 1 ? t.superEffective : hit.mult <= 0.5 ? t.noEffect : t.notEffective;
    say(b, text);
    await seq.wait(hit.mult > 1 ? 420 : 320);
  }
}

/** HP bar drains smoothly while the number counts down. */
function drain(b: Battle, seq: Sequence, side: Side, card: BattleCard, from: number, to: number): Promise<void> {
  const box = side === 'you' ? ui(b).hpYou : ui(b).hpOpp;
  const meter = $(box, '.hpbar');
  const bar = $(box, '.hpbar i');
  const num = $(box, '[data-hp]');
  if (!meter || !bar || !num) return Promise.resolve();
  const max = card.stats.hp;
  const fromPct = (from / max) * 100;
  const toPct = (to / max) * 100;
  bar.style.width = `${toPct}%`;
  meter.dataset.tone = hpTone(toPct);
  meter.setAttribute('aria-valuenow', String(to));
  if (seq.skipped) {
    num.textContent = fmt(to);
    return Promise.resolve();
  }
  const duration = 560 * fxSpeed() * seq.scale;
  const start = performance.now();
  const tick = () => {
    const k = seq.skipped ? 1 : Math.min(1, (performance.now() - start) / duration);
    num.textContent = fmt(Math.round(from + (to - from) * k));
    if (k < 1 && num.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return seq.anim(bar, [{ width: `${fromPct}%` }, { width: `${toPct}%` }], { duration: 560, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'none' });
}

async function faint(b: Battle, seq: Sequence, side: Side, card: BattleCard) {
  const mon = side === 'you' ? ui(b).monYou : ui(b).monOpp;
  await seq.wait(260);
  if (!seq.skipped) playCry(card.id);
  await seq.wait(200);
  await seq.anim($(mon, '.mon-body'), [
    { transform: 'none', opacity: 1 }, { transform: 'translateY(45%)', opacity: 0 },
  ], { duration: 480, easing: 'ease-in', fill: 'forwards' });
  mon.classList.add('fainted');
  if (battle !== b) return;
  say(b, L().battle.arena.text.faints(name(card)));
  sfx(side === 'opp' ? 'roundWin' : 'roundLose');
  renderTeams(b, true);
  await seq.wait(700);
}

/** After a duel (played or skipped): the field, HP boxes, panels, strips and hand match the battle state. */
function syncAfterDuel(b: Battle, log: DuelLog) {
  const u = ui(b);
  const loser = log.winner === 'you' ? 'opp' : 'you';
  const loserMon = loser === 'you' ? u.monYou : u.monOpp;
  loserMon.classList.add('fainted');
  u.hpYou.innerHTML = hpBoxHTML(b.state.you[log.you]);
  u.hpOpp.innerHTML = hpBoxHTML(b.state.opp[log.opp]);
  renderSide(b, 'you');
  renderSide(b, 'opp');
  renderTeams(b);
  renderHand(b);
  const fainted = loser === 'you' ? b.hand[log.you] : b.opp[log.opp];
  say(b, L().battle.arena.text.faints(name(fainted)));
}

// --- Events ---------------------------------------------------------------------------

function onClick(event: Event) {
  const b = battle;
  if (!b) return;
  const target = event.target as Element;
  const act = target.closest<HTMLElement>('[data-act]')?.dataset.act;

  if (act === 'start') return startBattle(b);
  if (act === 'skip-intro') {
    if (b.seq.skipped) return;
    return b.seq.skip();
  }
  if (act === 'forfeit') return void forfeit(b);
  if (act === 'speed') return toggleSpeed(b);
  if (act === 'confirm') return confirm(b);
  if (act === 'keep') return keep(b);
  if (act === 'continue') return finishClose(b);

  const hand = target.closest<HTMLButtonElement>('.hand-card');
  if (hand && !hand.disabled) return select(b, Number(hand.dataset.index));

  // Tapping the field while a duel plays out skips to its end.
  if (b.phase === 'duel' && target.closest('.scene')) b.seq.skip();
}

function onKey(event: KeyboardEvent) {
  const b = battle;
  if (!b || event.key !== 'Escape' || modalOpen()) return;
  event.preventDefault();
  if (b.phase === 'intro') startBattle(b);
  else if (b.phase === 'duel') b.seq.skip();
  else if (b.phase !== 'end') void forfeit(b);
}

function toggleSpeed(b: Battle) {
  b.fast = !b.fast;
  b.seq.scale = b.fast ? 0.5 : 1;
  try { localStorage.setItem(SPEED_KEY, b.fast ? '2' : '1'); } catch { /* storage blocked */ }
  const button = $(b.layer, '[data-act="speed"]');
  button.setAttribute('aria-pressed', String(b.fast));
  $(button, '[data-speed]').textContent = b.fast ? '2×' : '1×';
  sfx('toggle');
}

async function forfeit(b: Battle) {
  if (b.phase === 'end') return;
  const t = L().battle.arena;
  const ok = await confirmDialog({ title: t.forfeitTitle, message: t.forfeitText, confirmText: t.forfeitConfirm, cancelText: t.keepPlaying, danger: true });
  if (!ok || battle !== b || (b.phase as Phase) === 'end') return;
  sfx('defeat');
  close(b, { ...summarizeBattle(b.state), result: 'lose', perfect: false, forfeit: true, duels: [...b.state.duels], training: null });
}

// --- Rendering -------------------------------------------------------------------------

const ui = (b: Battle) => ({
  round: $(b.layer, '[data-round]'),
  you: $(b.layer, '.side-you'),
  opp: $(b.layer, '.side-opp'),
  scene: $(b.layer, '.scene'),
  monYou: $(b.layer, '.mon-you'),
  monOpp: $(b.layer, '.mon-opp'),
  hpYou: $(b.layer, '.hpbox-you'),
  hpOpp: $(b.layer, '.hpbox-opp'),
  text: $(b.layer, '.scene-text'),
  prompt: $(b.layer, '.arena-prompt'),
  hand: $(b.layer, '.hand'),
  fx: $(b.layer, '.scene-fx'),
});

const name = (c: BattleCard) => getSpecies(c.id).name;

function say(b: Battle, text: string) {
  const node = ui(b).text;
  if (node.textContent === text) return;
  node.textContent = text;
  if (!reducedMotion() && !b.seq.skipped) node.animate([{ opacity: 0.2, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'ease-out' });
}

/** Puts a Pokémon (or nobody) on one side of the field, with its HP box and side panel. */
function placeMon(b: Battle, side: Side, index: number | null, animate: boolean) {
  const u = ui(b);
  const mon = side === 'you' ? u.monYou : u.monOpp;
  const box = side === 'you' ? u.hpYou : u.hpOpp;
  const fighter = index == null ? null : (side === 'you' ? b.state.you : b.state.opp)[index];
  if (side === 'you') b.fieldYou = index;
  else b.fieldOpp = index;
  resetMon(mon);
  const body = $(mon, '.mon-body');
  body.innerHTML = fighter
    ? side === 'you' ? spriteImg(backSprite(fighter.card), staticBack(fighter.card)) : spriteImg(frontSprite(fighter.card), staticFront(fighter.card))
    : '';
  box.innerHTML = fighter ? hpBoxHTML(fighter) : '';
  renderSide(b, 'you');
  renderSide(b, 'opp');
  if (!choosing(b)) renderPrompt(b);
  if (fighter && animate) {
    playCry(fighter.card.id);
    sendOut(b, mon);
    if (!reducedMotion()) box.animate([{ opacity: 0, transform: `translateX(${side === 'you' ? 24 : -24}px)` }, { opacity: 1, transform: 'none' }], { duration: 320 * fxSpeed(), easing: EASE });
  }
}

/**
 * Clears the previous Pokémon's state from a platform. The faint animation keeps its end frame (invisible) on the
 * reused .mon-body, so it must be cancelled or the next Pokémon would stay hidden.
 */
function resetMon(mon: HTMLElement) {
  mon.classList.remove('fainted', 'hit');
  $(mon, '.mon-body').getAnimations().forEach(animation => animation.cancel());
}

function spriteImg(src: string, fallback: string) {
  return `<img class="mon-sprite" src="${esc(src)}" data-fallback="${esc(fallback)}" alt="" draggable="false" onerror="this.onerror=null;this.src=this.dataset.fallback">`;
}

/** Poké Ball "send out" pop: flash and grow from the platform. */
function sendOut(b: Battle, mon: HTMLElement) {
  void b.seq.anim($(mon, '.mon-body'), [
    { transform: 'scale(.1)', filter: 'brightness(4)', opacity: 0 },
    { transform: 'scale(1.12)', filter: 'brightness(2)', opacity: 1, offset: 0.6 },
    { transform: 'scale(1)', filter: 'none', opacity: 1 },
  ], { duration: 460, easing: 'ease-out', fill: 'none' });
}

/** Side panel for whoever is on that side of the field, with the stat it attacks with against the other. */
function renderSide(b: Battle, side: Side) {
  const s = b.state;
  const you = b.fieldYou == null ? null : s.you[b.fieldYou];
  const opp = b.fieldOpp == null ? null : s.opp[b.fieldOpp];
  const [self, foe] = side === 'you' ? [you, opp] : [opp, you];
  let info = null;
  if (self && foe) {
    const hit = strike(self.card, foe.card);
    const first = side === 'you' ? firstStriker(self.card, foe.card) === 'you' : firstStriker(foe.card, self.card) === 'opp';
    info = { uses: hit.stat, mult: hit.mult, first };
  }
  const node = side === 'you' ? ui(b).you : ui(b).opp;
  node.innerHTML = sideHTML(self, info, side === 'you' && b.phase === 'choose');
}

function renderTeams(b: Battle, animate = false) {
  const s = b.state;
  const t = L().battle.arena;
  $(b.layer, '.team-balls.you').innerHTML = teamBallsHTML(s.you, b.fieldYou, 'you');
  $(b.layer, '.team-balls.opp').innerHTML = teamBallsHTML(s.opp, s.oppActive, 'opp', b.seen);
  ui(b).round.textContent = t.duel(Math.max(1, s.duels.length + (b.phase === 'duel' ? 0 : 1)));
  const score = summarizeBattle(s).score;
  for (const side of ['you', 'opp'] as const) {
    const node = $(b.layer, `[data-score="${side}"]`);
    if (Number(node.textContent) !== score[side]) {
      node.textContent = String(score[side]);
      if (animate && !reducedMotion()) node.animate([{ transform: 'scale(1.8)', color: '#fff' }, { transform: 'scale(1)' }], { duration: 460, easing: EASE });
    }
  }
}

function renderHand(b: Battle) {
  const s = b.state;
  const opp = b.fieldOpp == null ? null : s.opp[b.fieldOpp];
  ui(b).hand.innerHTML = s.you.map((f, i) => {
    let edge: number | null = null;
    if (opp && choosing(b)) {
      const m = matchup(f.card, opp.card);
      edge = Math.sign(m.you.mult - m.opp.mult);
    }
    return handCardHTML(f, i, { active: i === s.youActive || (b.phase === 'duel' && i === b.fieldYou), selected: choosing(b) && b.candidate === i, disabled: !canPick(b, i), edge });
  }).join('');
}

/** Matchup preview of a candidate against the opponent on the field (the outcome only with hints on). */
function preview(b: Battle, index: number): Preview {
  const s = b.state;
  const you = s.you[index];
  const opp = s.opp[s.oppActive];
  const m = matchup(you.card, opp.card);
  const p: Preview = { you: you.card, opp: opp.card, yourMult: m.you.mult, theirMult: m.opp.mult, first: firstStriker(you.card, opp.card) };
  if (b.config.hints) {
    const result = previewDuel(you, opp);
    const winner = result.winner === 'you' ? you : opp;
    const lastOnWinner = result.hits.filter(h => h.attacker !== result.winner).at(-1);
    const left = lastOnWinner ? lastOnWinner.hpLeft : winner.hp;
    p.predict = { winner: result.winner, pct: Math.max(5, Math.round(((left / winner.card.stats.hp) * 100) / 5) * 5) };
  }
  return p;
}

function renderPrompt(b: Battle) {
  const t = L().battle.arena;
  const node = ui(b).prompt;
  const s = b.state;
  if (!choosing(b)) {
    const you = b.fieldYou == null ? null : s.you[b.fieldYou];
    const opp = b.fieldOpp == null ? null : s.opp[b.fieldOpp];
    if (b.phase !== 'duel' || !you || !opp) {
      node.innerHTML = b.phase === 'duel' ? promptHTML({ title: t.versus(t.you, b.config.opponent.name), sub: t.skipHint, idle: true }) : '';
      return;
    }
    const m = matchup(you.card, opp.card);
    node.innerHTML = promptHTML({
      title: t.versus(name(you.card), name(opp.card)),
      sub: t.skipHint,
      preview: { you: you.card, opp: opp.card, yourMult: m.you.mult, theirMult: m.opp.mult, first: firstStriker(you.card, opp.card) },
      idle: true,
    });
    return;
  }
  const c = b.candidate;
  if (b.phase === 'choose') {
    const lost = s.duels.at(-1);
    const title = lost && lost.winner === 'opp' ? t.prompt.next(name(b.hand[lost.you])) : t.prompt.first;
    node.innerHTML = promptHTML(c == null
      ? { title, sub: t.prompt.pickHint }
      : { title, preview: preview(b, c), confirm: t.prompt.go(name(b.hand[c])) });
  } else {
    const active = s.youActive!;
    const pick = c ?? active;
    node.innerHTML = promptHTML({
      title: t.prompt.switchTitle(b.config.opponent.name, name(b.opp[s.oppActive])),
      sub: t.prompt.switchSub(name(b.hand[active])),
      preview: preview(b, pick),
      confirm: pick === active ? t.prompt.keep(name(b.hand[active])) : t.prompt.send(name(b.hand[pick])),
      keep: pick === active ? undefined : t.prompt.keep(name(b.hand[active])),
    });
  }
  if (!reducedMotion() && choosing(b)) node.firstElementChild?.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: EASE });
}

/** Damage number or text popping above a sprite. */
function pop(b: Battle, mon: HTMLElement, text: string, cls: string, small = '') {
  const fx = ui(b).fx;
  const node = el(`<span class="pop ${cls}">${esc(text)}${small ? `<small>${esc(small)}</small>` : ''}</span>`);
  const host = fx.getBoundingClientRect();
  // The sprite is scaled with a transform, so measure the image itself (or the empty body).
  const visual = mon.querySelector('.mon-sprite') ?? $(mon, '.mon-body');
  const r = visual.getBoundingClientRect();
  node.style.left = `${r.left - host.left + r.width / 2}px`;
  node.style.top = `${Math.max(20, r.top - host.top + r.height * 0.2)}px`;
  fx.append(node);
  return node;
}

const shakeFrames = (px: number): Keyframe[] => [
  { transform: 'translateX(0)' }, { transform: `translateX(-${px}px)` }, { transform: `translateX(${px}px)` },
  { transform: `translateX(-${px / 2}px)` }, { transform: `translateX(${px / 2}px)` }, { transform: 'translateX(0)' },
];

// --- End ----------------------------------------------------------------------------

async function showEnd(b: Battle) {
  b.phase = 'end';
  const s = b.state;
  const summary = summarizeBattle(s);
  // A loss trains a random team member right away; after a win the player picks who trains.
  const training = summary.result === 'lose' ? trainTeamAfterBattle('lose', false) : null;
  b.outcome = { ...summary, forfeit: false, duels: [...s.duels], training };
  const o = b.config.opponent;
  const line = summary.result === 'win' ? o.loseLine : o.winLine;
  playMusic(null);
  sfx(summary.result === 'win' ? 'victory' : 'defeat');

  const choice = summary.result === 'win' ? trainChoice(b, summary.perfect) : '';
  const panel = el(endHTML({
    result: summary.result, score: summary.score, perfect: summary.perfect, duels: s.duels,
    you: b.hand, opp: b.opp, name: o.name, portrait: o.portrait, line, training, trainChoice: choice,
  }));
  b.layer.append(panel);
  b.layer.classList.add('ended');
  panel.addEventListener('click', event => {
    const card = (event.target as Element).closest<HTMLElement>('[data-train]');
    if (card) pickTraining(b, card.dataset.train!);
  });
  ($(panel, '.train-card') ?? $(panel, '.end-continue')).focus({ preventScroll: true });
  if (reducedMotion()) {
    if (training) sfx('levelUp');
    return;
  }
  panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
  $(panel, '.end-panel').animate([{ opacity: 0, transform: 'translateY(24px) scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE });
  $(panel, '.end-train-slot').animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 0, transform: 'scale(.94)', offset: 0.45 }, { opacity: 1, transform: 'none' }], { duration: 1000, easing: EASE });
  await sleep(200);
  if (summary.result === 'win') {
    burst($(panel, '.end-crest'), { color: '#f4dca3', count: summary.perfect ? 48 : 32, distance: 220 });
    if (summary.perfect) burst($(panel, '.end-crest'), { color: '#fff', count: 18, distance: 160, shape: 'star' });
  }
  await sleep(450);
  if (training && battle === b) celebrateTraining(panel);
}

/** The team at its current levels, for the post-win training choice. */
function trainChoice(b: Battle, perfect: boolean): string {
  const team = b.state.you.flatMap(f => (f.card.key && store.save.cards[f.card.key]
    ? [{ card: f.card, level: store.save.cards[f.card.key].level, fainted: f.hp <= 0 }] : []));
  return team.length ? trainChoiceHTML(team, perfect ? BATTLE_LEVELS.perfect : BATTLE_LEVELS.win) : '';
}

/** Applies the post-win training to the chosen card (once) and shows the result. */
function pickTraining(b: Battle, key: string) {
  const outcome = b.outcome;
  if (b.phase !== 'end' || !outcome || outcome.result !== 'win' || outcome.training) return;
  const training = trainTeamAfterBattle('win', outcome.perfect, key);
  if (!training) return;
  outcome.training = training;
  const panel = $(b.layer, '.arena-end');
  const slot = $(panel, '.end-train-slot');
  slot.innerHTML = trainingHTML(training, b.hand.find(c => c.key === training.key));
  if (!reducedMotion()) slot.firstElementChild?.animate([{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: EASE });
  celebrateTraining(panel);
  $(panel, '.end-continue').focus({ preventScroll: true });
}

function celebrateTraining(panel: HTMLElement) {
  sfx('levelUp');
  burst(panel.querySelector('.end-training .pcard'), { color: '#7ee0a1', count: 16, distance: 70, duration: 700 });
}

function finishClose(b: Battle) {
  if (b.phase !== 'end' || !b.outcome) return;
  // After a win, training must be chosen first: point back at the choice instead of closing.
  const choice = b.layer.querySelector<HTMLElement>('.end-train-choice');
  if (b.outcome.result === 'win' && !b.outcome.training && choice) {
    sfx('error');
    choice.classList.add('nudge');
    $(choice, '.end-train-hint')?.removeAttribute('hidden');
    if (!reducedMotion()) choice.animate(shakeFrames(6), { duration: 360 });
    $(choice, '.train-card').focus({ preventScroll: true });
    return;
  }
  sfx('close');
  close(b, b.outcome);
}
