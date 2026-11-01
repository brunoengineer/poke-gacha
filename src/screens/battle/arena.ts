// Battle arena: a full-screen layer any mode can open. Intro -> 6 rounds -> result panel.
// Each round the opponent's card appears (as much as `reveal` allows), the player answers with a card from
// their hand (tap or drag to the field), sees the type matchup, picks a stat, and the round is resolved with
// the shared rules in src/game/battle.ts and staged on a Pokémon-style field (platforms, sprites, cries).
//
// API contract:
//   runBattle(config) -> Promise<BattleOutcome>, resolved when the battle ends (or the player forfeits).
//   The arena records nothing: the calling mode applies rewards and progress from the outcome.

import { playCry, playMusic, sfx } from '../../audio';
import { getSpecies } from '../../data/species';
import {
  matchup, resolveRound, summarize, toBattleCard,
  type BattleCard, type BattleSummary, type RoundOutcome, type RoundResult, type TeamMember,
} from '../../game/battle';
import type { StatId } from '../../game/cards';
import { DECK_SIZE } from '../../game/economy';
import { playerTeam } from '../../game/teams';
import { fmt, L } from '../../i18n';
import { store } from '../../state/store';
import { draggable, dropZone } from '../../ui/dnd';
import { $, $$, confirmDialog, el, esc, modalOpen, reducedMotion, sleep, toast } from '../../ui/dom';
import { burst, Sequence } from '../../ui/fx';
import { restoreMusic } from '../../ui/shell';
import {
  backSprite, chipHTML, endHTML, frontSprite, handCardHTML, introHTML, layoutHTML, multText, oppCardHTML, slotHTML,
  staticBack, staticFront, statsHTML, trackHTML,
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
  /** How much of the opponent's next card is visible before the player commits: the card (default), only its type, or nothing. */
  reveal?: 'card' | 'type' | 'hidden';
  music?: 'battle' | 'gym' | 'league' | 'champion';
  /** Small label at the top (e.g. "Quartas de final"). */
  stage?: string;
  /** Accent color for the field and intro (defaults per mode; gyms pass their type color). */
  accent?: string;
}

export interface BattleOutcome extends BattleSummary {
  forfeit: boolean;
  rounds: RoundResult[];
}

type Phase = 'intro' | 'pick' | 'busy' | 'resolved' | 'end';
type Reveal = NonNullable<BattleConfig['reveal']>;

const MODE_ACCENT: Record<BattleConfig['mode'], string> = {
  training: '#4fd18b',
  competition: '#5aa9ff',
  gym: '#d3bc8e',
  league: '#c58cff',
};

const EASE = 'cubic-bezier(.2,.8,.2,1)';

interface Battle {
  config: BattleConfig;
  reveal: Reveal;
  hand: BattleCard[];
  opp: BattleCard[];
  used: Map<number, RoundOutcome>;
  results: RoundResult[];
  round: number;
  selected: number | null;
  phase: Phase;
  /** The current opponent card was fully revealed (type/hidden modes reveal it when the round resolves). */
  revealed: boolean;
  seq: Sequence;
  layer: HTMLElement;
  resolve: (outcome: BattleOutcome) => void;
  inerted: HTMLElement[];
}

let battle: Battle | null = null;

/** True while a battle layer is open. */
export const battleActive = () => battle !== null;

/** The player's team as battle cards (empty slots skipped). */
export const playerBattleTeam = (): BattleCard[] => playerTeam(store.save).map(m => toBattleCard(m, m.key));

// The drop target is registered once; it acts on whichever battle is open.
dropZone('arena-slot', {
  accepts: payload => payload.type === 'arena-hand' && battle?.phase === 'pick' && !battle.used.has(Number(payload.index)),
  drop: payload => {
    if (!battle) return false;
    select(Number(payload.index), true);
    return $(battle.layer, '.side-you .side-card');
  },
});

if (typeof document !== 'undefined') {
  document.addEventListener('dnd:start', event => {
    if (battle && (event as CustomEvent).detail?.type === 'arena-hand') sfx('cardPick');
  });
}

export function runBattle(config: BattleConfig): Promise<BattleOutcome> {
  if (battle) return Promise.reject(new Error('A battle is already running'));
  const hand = playerBattleTeam();
  if (hand.length < DECK_SIZE) {
    toast(L().battle.hub.blocked, 'warning');
    return Promise.resolve({ ...summarize([]), result: 'lose', forfeit: true, rounds: [] });
  }

  return new Promise(resolve => {
    const reveal = config.reveal ?? 'card';
    const opp = config.opponent.team.slice(0, DECK_SIZE).map(m => toBattleCard(m));
    const layer = el(`<div class="arena-layer" role="dialog" aria-modal="true" data-mode="${config.mode}" data-reveal="${reveal}"
      aria-label="${esc(L().battle.arena.versus(L().battle.arena.you, config.opponent.name))}"
      style="--accent:${esc(config.accent ?? MODE_ACCENT[config.mode])}"></div>`);

    battle = {
      config, reveal, hand, opp, layer, resolve,
      used: new Map(), results: [], round: 0, selected: null, phase: 'intro', revealed: reveal === 'card',
      seq: new Sequence(), inerted: [],
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
    forfeitLabel: L().battle.arena.forfeit,
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
  const stats = $(b.layer, '.side-you .stats');
  stats.addEventListener('pointerover', e => peek((e.target as Element).closest<HTMLElement>('.stat')?.dataset.stat));
  stats.addEventListener('pointerleave', () => peek(undefined));
  stats.addEventListener('focusin', e => peek((e.target as Element).closest<HTMLElement>('.stat')?.dataset.stat));
  stats.addEventListener('focusout', () => peek(undefined));
  draggable($(b.layer, '.hand'), '.hand-card:not(:disabled)', node =>
    battle?.phase === 'pick' ? { type: 'arena-hand', index: Number(node.dataset.index) } : null);

  playMusic(config.music ?? 'battle');
  renderRound(false);
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
  b.phase = 'pick';
  b.seq = new Sequence();
  const done = () => intro?.remove();
  if (reducedMotion() || !intro) done();
  else intro.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(1.04)' }], { duration: 260, easing: 'ease-in', fill: 'forwards' }).finished.then(done, done);
  renderRound(true);
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
  if (act === 'next') return next(b);
  if (act === 'continue') return finishClose(b);
  if (act === 'unselect' && b.phase === 'pick' && b.selected != null) return select(b.selected);

  const hand = target.closest<HTMLButtonElement>('.hand-card');
  if (hand && !hand.disabled) return select(Number(hand.dataset.index));

  const stat = target.closest<HTMLElement>('.stat[data-pick]');
  if (stat) return void fight(b, stat.dataset.stat as StatId);

  // Tapping the field while a round plays out skips its animation.
  if (b.phase === 'busy' && target.closest('.scene')) b.seq.skip();
}

function onKey(event: KeyboardEvent) {
  const b = battle;
  if (!b || event.key !== 'Escape' || modalOpen()) return;
  event.preventDefault();
  if (b.phase === 'intro') startBattle(b);
  else if (b.phase === 'busy') b.seq.skip();
  else if (b.phase !== 'end') void forfeit(b);
}

async function forfeit(b: Battle) {
  if (b.phase === 'end') return;
  const t = L().battle.arena;
  const ok = await confirmDialog({ title: t.forfeitTitle, message: t.forfeitText, confirmText: t.forfeitConfirm, cancelText: t.keepPlaying, danger: true });
  if (!ok || battle !== b || (b.phase as Phase) === 'end') return;
  sfx('defeat');
  close(b, { ...summarize(b.results), result: 'lose', perfect: false, forfeit: true, rounds: [...b.results] });
}

// --- Rendering -------------------------------------------------------------------------

const ui = (b: Battle) => ({
  round: $(b.layer, '[data-round]'),
  track: $(b.layer, '.arena-track'),
  you: $(b.layer, '.side-you'),
  opp: $(b.layer, '.side-opp'),
  youCard: $(b.layer, '.side-you .side-card'),
  oppCard: $(b.layer, '.side-opp .side-card'),
  youStats: $(b.layer, '.side-you .stats'),
  oppStats: $(b.layer, '.side-opp .stats'),
  scene: $(b.layer, '.scene'),
  monYou: $(b.layer, '.mon-you'),
  monOpp: $(b.layer, '.mon-opp'),
  text: $(b.layer, '.scene-text'),
  result: $(b.layer, '.round-result'),
  hand: $(b.layer, '.hand'),
  fx: $(b.layer, '.scene-fx'),
});

const name = (c: BattleCard) => getSpecies(c.id).name;
const typesText = (c: BattleCard) => c.types.map(type => L().core.types[type]).join('/');

function say(b: Battle, text: string) {
  const node = ui(b).text;
  node.textContent = text;
  if (!reducedMotion()) node.animate([{ opacity: 0.2, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
}

/** Draws the current round: opponent card (per reveal), empty slot, hand and track. */
function renderRound(animate: boolean) {
  const b = battle!;
  const u = ui(b);
  const t = L().battle.arena;
  const opp = b.opp[b.round];
  b.revealed = b.reveal === 'card';
  u.round.textContent = t.round(b.round + 1, b.opp.length);
  b.layer.classList.remove('resolving');
  for (const side of [u.you, u.opp]) side.classList.remove('winner', 'loser', 'tie');
  u.result.innerHTML = '';
  u.fx.querySelectorAll('.pop').forEach(n => n.remove());

  u.oppCard.innerHTML = oppCardHTML(opp, b.reveal);
  u.oppStats.innerHTML = statsHTML(opp, 'opp', { hidden: true });
  renderOppMon(b, animate);
  renderPlayer(b);
  renderTrack(b);
  renderHand(b);

  const trainer = b.config.opponent.name;
  say(b, b.reveal === 'card' ? t.text.sends(trainer, name(opp)) : b.reveal === 'type' ? t.text.sendsType(trainer, typesText(opp)) : t.text.sendsHidden(trainer));

  if (animate && !reducedMotion()) {
    u.oppCard.firstElementChild?.animate([
      { transform: 'translateY(-30px) rotateY(90deg)', opacity: 0 },
      { transform: 'none', opacity: 1 },
    ], { duration: 520, easing: EASE });
  }
}

/** Opponent's sprite on its platform: the Pokémon, its silhouette (type reveal) or a Poké Ball (hidden). */
function renderOppMon(b: Battle, animate: boolean) {
  const u = ui(b);
  const opp = b.opp[b.round];
  const body = $(u.monOpp, '.mon-body');
  resetMon(u.monOpp);
  $(u.monOpp, '.mon-tag').innerHTML = '';
  if (!b.revealed && b.reveal === 'hidden') {
    body.innerHTML = `<span class="mon-ball" aria-hidden="true"><svg class="i"><use href="#i-ball-color"></use></svg></span>`;
  } else {
    body.innerHTML = spriteImg(frontSprite(opp), staticFront(opp), !b.revealed);
    if (b.revealed && animate) playCry(opp.id);
  }
  if (animate) sendOut(b, u.monOpp);
}

/**
 * Clears the previous Pokémon's state from a platform. The faint animation keeps its end frame (invisible) on the
 * reused .mon-body, so it must be cancelled or the next Pokémon would stay hidden.
 */
function resetMon(mon: HTMLElement) {
  mon.classList.remove('fainted', 'hit');
  $(mon, '.mon-body').getAnimations().forEach(animation => animation.cancel());
}

function spriteImg(src: string, fallback: string, silhouette = false) {
  return `<img class="mon-sprite ${silhouette ? 'silhouette' : ''}" src="${esc(src)}" data-fallback="${esc(fallback)}" alt="" draggable="false" onerror="this.onerror=null;this.src=this.dataset.fallback">`;
}

/** Poké Ball "send out" pop: flash and grow from the platform. */
function sendOut(b: Battle, mon: HTMLElement) {
  const body = $(mon, '.mon-body');
  void b.seq.anim(body, [
    { transform: 'scale(.1)', filter: 'brightness(4)', opacity: 0 },
    { transform: 'scale(1.12)', filter: 'brightness(2)', opacity: 1, offset: 0.6 },
    { transform: 'scale(1)', filter: 'none', opacity: 1 },
  ], { duration: 460, easing: 'ease-out', fill: 'none' });
}

function renderPlayer(b: Battle, fromRect: DOMRect | null = null) {
  const u = ui(b);
  const index = b.selected;
  const card = index == null ? null : b.hand[index];
  const locked = b.phase !== 'pick';
  u.youCard.innerHTML = slotHTML(card, locked);
  u.youStats.innerHTML = statsHTML(card, 'you', { enabled: b.phase === 'pick' });

  const body = $(u.monYou, '.mon-body');
  resetMon(u.monYou);
  body.innerHTML = card ? spriteImg(backSprite(card), staticBack(card)) : '';
  renderChips(b);

  if (fromRect && card && !reducedMotion()) {
    const fc = u.youCard.firstElementChild as HTMLElement;
    const to = fc.getBoundingClientRect();
    fc.animate([
      { transformOrigin: 'top left', transform: `translate(${fromRect.left - to.left}px, ${fromRect.top - to.top}px) scale(${fromRect.width / to.width})` },
      { transformOrigin: 'top left', transform: 'none' },
    ], { duration: 380, easing: EASE });
  }
}

/** Matchup chips over both sprites, and the scene text prompt. */
function renderChips(b: Battle) {
  const u = ui(b);
  const t = L().battle.arena;
  const youTag = $(u.monYou, '.mon-tag');
  const oppTag = $(u.monOpp, '.mon-tag');
  const card = b.selected == null ? null : b.hand[b.selected];
  if (!card || b.phase !== 'pick') {
    youTag.innerHTML = '';
    oppTag.innerHTML = '';
    if (b.phase === 'pick' && !card && b.results.length === b.round) say(b, t.text.choose);
    return;
  }
  if (b.reveal === 'hidden') {
    youTag.innerHTML = chipHTML(null, null);
    oppTag.innerHTML = chipHTML(null, null);
  } else {
    const m = matchup(card, b.opp[b.round]);
    youTag.innerHTML = chipHTML(m.you.mult, m.opp.mult);
    oppTag.innerHTML = chipHTML(m.opp.mult, m.you.mult);
  }
  say(b, t.text.chooseStat(name(card)));
}

function renderTrack(b: Battle) {
  // While a round plays out, its result stays off the track (no spoilers before the clash).
  const shown = b.phase === 'busy' ? b.results.slice(0, b.round) : b.results;
  ui(b).track.innerHTML = trackHTML(b.opp, shown, b.round, b.revealed ? 'card' : b.reveal);
}

function renderHand(b: Battle) {
  const opp = b.opp[b.round];
  ui(b).hand.innerHTML = b.hand.map((card, i) => {
    let edge: number | null = null;
    if (b.reveal !== 'hidden' && b.phase === 'pick') {
      const m = matchup(card, opp);
      edge = Math.sign(m.you.mult - m.opp.mult);
    }
    return handCardHTML(card, i, { outcome: b.used.get(i), selected: b.selected === i, disabled: b.phase !== 'pick', edge });
  }).join('');
}

function peek(stat: string | undefined) {
  const b = battle;
  if (!b || b.phase !== 'pick') return;
  ui(b).oppStats.querySelectorAll<HTMLElement>('.stat').forEach(row => row.classList.toggle('peek', row.dataset.stat === stat));
}

function select(index: number, fromDrop = false) {
  const b = battle;
  if (!b || b.phase !== 'pick' || b.used.has(index)) return;
  const handCard = $(ui(b).hand, `[data-index="${index}"]`);
  const fromRect = fromDrop ? null : handCard?.getBoundingClientRect() ?? null;
  const deselect = b.selected === index && !fromDrop;
  b.selected = deselect ? null : index;
  renderPlayer(b, deselect ? null : fromRect);
  renderHand(b);
  if (b.selected != null) {
    sfx('cardPlace');
    playCry(b.hand[b.selected].id);
    sendOut(b, ui(b).monYou);
    requestAnimationFrame(() => $(ui(b).youStats, '.stat[data-pick]')?.focus({ preventScroll: true }));
  } else {
    sfx('cardPick');
    requestAnimationFrame(() => $(ui(b).hand, `[data-index="${index}"]`)?.focus({ preventScroll: true }));
  }
}

// --- Round resolution ------------------------------------------------------------------

async function fight(b: Battle, stat: StatId) {
  if (b.phase !== 'pick' || b.selected == null) return;
  const t = L().battle.arena;
  const u = ui(b);
  const handIndex = b.selected;
  const you = b.hand[handIndex];
  const opp = b.opp[b.round];
  const result = resolveRound(you, opp, stat);

  // The round is decided now; everything below only shows it.
  b.results[b.round] = result;
  b.phase = 'busy';
  b.seq = new Sequence();
  const seq = b.seq;
  b.layer.classList.add('resolving');
  u.youCard.querySelector<HTMLButtonElement>('.arena-pick')?.setAttribute('disabled', '');
  u.youStats.querySelectorAll<HTMLButtonElement>('.stat').forEach(row => {
    row.disabled = true;
    row.removeAttribute('data-pick');
    row.classList.toggle('chosen', row.dataset.stat === stat);
  });
  peek(undefined);
  ui(b).oppStats.querySelectorAll('.peek').forEach(n => n.classList.remove('peek'));
  $(u.monYou, '.mon-tag').innerHTML = '';
  $(u.monOpp, '.mon-tag').innerHTML = '';
  renderHand(b);
  say(b, t.text.uses(name(you), L().core.stats[stat]));
  sfx('click');

  if (!b.revealed) await revealOpponent(b, seq);
  if (battle !== b) return;
  await revealStats(b, seq, stat);
  if (battle !== b) return;
  await clash(b, seq, result);
  if (battle !== b) return;
  showResolved(b, true);
}

/** Type/hidden modes: flips the opponent's card and reveals its sprite. */
async function revealOpponent(b: Battle, seq: Sequence) {
  const u = ui(b);
  const opp = b.opp[b.round];
  b.revealed = true;
  await seq.anim(u.oppCard, [{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)' }], { duration: 180, easing: 'ease-in', fill: 'none' });
  u.oppCard.innerHTML = oppCardHTML(opp, 'card');
  sfx('flip');
  const body = $(u.monOpp, '.mon-body');
  body.innerHTML = spriteImg(frontSprite(opp), staticFront(opp));
  playCry(opp.id);
  say(b, L().battle.arena.text.reveal(name(opp)));
  renderTrack(b);
  burst($(u.oppCard, '.pcard'), { color: '#f4dca3', count: 18, distance: 110, duration: 600 });
  void seq.anim(body, [{ filter: 'brightness(0)', transform: 'scale(.9)' }, { filter: 'brightness(3)', transform: 'scale(1.1)', offset: 0.5 }, { filter: 'none', transform: 'none' }], { duration: 420, fill: 'none' });
  await seq.anim(u.oppCard, [{ transform: 'rotateY(-90deg)' }, { transform: 'rotateY(0)' }], { duration: 220, easing: 'ease-out', fill: 'none' });
  await seq.wait(250);
}

async function revealStats(b: Battle, seq: Sequence, chosen: StatId) {
  const u = ui(b);
  const card = b.opp[b.round];
  const rows = [...u.oppStats.querySelectorAll<HTMLElement>('.stat')];
  const reveal = (row: HTMLElement) => {
    $(row, 'b').textContent = fmt(card.stats[row.dataset.stat as StatId]);
    row.classList.remove('hidden');
    row.classList.toggle('chosen', row.dataset.stat === chosen);
  };
  const flip = async (row: HTMLElement, delay: number) => {
    await seq.wait(delay);
    await seq.anim(row, [{ transform: 'rotateX(0)' }, { transform: 'rotateX(90deg)' }], { duration: 130, easing: 'ease-in', fill: 'none' });
    reveal(row);
    await seq.anim(row, [{ transform: 'rotateX(-90deg)' }, { transform: 'rotateX(0)' }], { duration: 170, easing: 'ease-out', fill: 'none' });
  };
  sfx('statReveal');
  await Promise.all(rows.filter(r => r.dataset.stat !== chosen).map((row, i) => flip(row, i * 60)));
  await seq.wait(160);
  const target = rows.find(r => r.dataset.stat === chosen)!;
  sfx('statReveal');
  await flip(target, 0);
  rows.forEach(r => { if (r.classList.contains('hidden')) reveal(r); });
  await seq.wait(220);
}

/** Damage-style number or effect text popping above a sprite. */
function pop(b: Battle, mon: HTMLElement, text: string, cls: string) {
  const fx = ui(b).fx;
  const node = el(`<span class="pop ${cls}">${esc(text)}</span>`);
  const host = fx.getBoundingClientRect();
  // The sprite is scaled with a transform, so measure the image itself (or the Poké Ball, or the empty body).
  const visual = mon.querySelector('.mon-sprite, .mon-ball') ?? $(mon, '.mon-body');
  const r = visual.getBoundingClientRect();
  node.style.left = `${r.left - host.left + r.width / 2}px`;
  node.style.top = `${Math.max(16, r.top - host.top + r.height * 0.12)}px`;
  fx.append(node);
  return node;
}

async function clash(b: Battle, seq: Sequence, r: RoundResult) {
  const u = ui(b);
  const t = L().battle.arena;
  const youBody = $(u.monYou, '.mon-body');
  const oppBody = $(u.monOpp, '.mon-body');
  const youCard = $(u.youCard, '.pcard');
  const oppCard = $(u.oppCard, '.pcard');
  const hit = { duration: 420, easing: 'cubic-bezier(.5,0,.5,1)', fill: 'none' as FillMode };

  // Both sides charge: cards bump toward the field, sprites lunge at each other.
  await Promise.all([
    youCard && seq.anim(youCard, [{ transform: 'none' }, { transform: 'translateX(14%) rotate(3deg) scale(1.04)', offset: 0.45 }, { transform: 'none' }], hit),
    oppCard && seq.anim(oppCard, [{ transform: 'none' }, { transform: 'translateX(-14%) rotate(-3deg) scale(1.04)', offset: 0.45 }, { transform: 'none' }], hit),
    seq.anim(youBody, [{ transform: 'none' }, { transform: 'translate(22%, -16%) scale(1.06)', offset: 0.45 }, { transform: 'none' }], hit),
    seq.anim(oppBody, [{ transform: 'none' }, { transform: 'translate(-18%, 12%) scale(1.06)', offset: 0.45 }, { transform: 'none' }], hit),
    seq.wait(180).then(() => {
      if (seq.skipped) return;
      sfx('hit');
      burst($(u.fx, '.fx-particles'), { color: r.outcome === 'win' ? '#f4dca3' : r.outcome === 'lose' ? '#f06a6a' : '#a6adbb', count: 26, distance: 120, duration: 700 });
    }),
  ]);

  // Values pop over each sprite: the winner's big and gold.
  const youWins = r.outcome === 'win';
  const oppWins = r.outcome === 'lose';
  const pops = [
    pop(b, u.monYou, fmt(r.youValue), youWins ? 'pop-win' : oppWins ? 'pop-lose' : 'pop-draw'),
    pop(b, u.monOpp, fmt(r.oppValue), oppWins ? 'pop-win' : youWins ? 'pop-lose' : 'pop-draw'),
  ];
  pops.forEach(p => void seq.anim(p, [
    { transform: 'translate(-50%, 10px) scale(.4)', opacity: 0 },
    { transform: 'translate(-50%, -14px) scale(1.15)', opacity: 1, offset: 0.35 },
    { transform: 'translate(-50%, -18px) scale(1)', opacity: 1 },
  ], { duration: 520, easing: EASE }));

  if (r.outcome === 'draw') {
    sfx('roundDraw');
    await Promise.all([shake(seq, youBody, 4), shake(seq, oppBody, 4)]);
    say(b, t.text.tie);
  } else {
    const loserMon = youWins ? u.monOpp : u.monYou;
    const mult = youWins ? r.matchup.you.mult : r.matchup.opp.mult;
    // The winner strikes; the loser flashes and shakes.
    await seq.anim(youWins ? youBody : oppBody, [
      { transform: 'none' },
      { transform: youWins ? 'translate(34%, -26%) scale(1.08)' : 'translate(-30%, 22%) scale(1.08)', offset: 0.4 },
      { transform: 'none' },
    ], { duration: 360, easing: 'cubic-bezier(.5,0,.5,1)', fill: 'none' });
    sfx(mult > 1 ? 'superEffective' : mult < 1 ? 'notEffective' : 'hit');
    loserMon.classList.add('hit');
    const loserBody = $(loserMon, '.mon-body');
    await Promise.all([
      seq.anim(loserBody, [{ opacity: 1 }, { opacity: 0.15 }, { opacity: 1 }, { opacity: 0.15 }, { opacity: 1 }], { duration: 420, fill: 'none' }),
      shake(seq, loserBody, 10),
    ]);
    if (mult !== 1) {
      const node = pop(b, youWins ? u.monOpp : u.monYou, mult > 1 ? t.superEffective : mult <= 0.5 ? t.noEffect : t.notEffective, mult > 1 ? 'pop-effect super' : 'pop-effect weak');
      void seq.anim(node, [{ transform: 'translate(-50%, 0) scale(.6)', opacity: 0 }, { transform: 'translate(-50%, -46px) scale(1)', opacity: 1, offset: 0.3 }, { transform: 'translate(-50%, -52px) scale(1)', opacity: 1 }], { duration: 900, easing: EASE });
      say(b, mult > 1 ? t.superEffective : mult <= 0.5 ? t.noEffect : t.notEffective);
      await seq.wait(650);
    }
    // Faint.
    playCry((youWins ? r.opp : r.you).id);
    await seq.wait(120);
    loserMon.classList.add('fainted');
    await seq.anim(loserBody, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(40%)', opacity: 0 }], { duration: 420, easing: 'ease-in', fill: 'forwards' });
    say(b, t.text.faints(name(youWins ? r.opp : r.you)));
    sfx(youWins ? 'roundWin' : 'roundLose');
  }
  if (seq.skipped) {
    // Skipped: make sure the end state is visible.
    if (r.outcome === 'win') u.monOpp.classList.add('fainted');
    if (r.outcome === 'lose') u.monYou.classList.add('fainted');
  }
  await seq.wait(250);
}

const shake = (seq: Sequence, node: Element, px: number) => seq.anim(node, [
  { transform: 'translateX(0)' }, { transform: `translateX(-${px}px)` }, { transform: `translateX(${px}px)` },
  { transform: `translateX(-${px / 2}px)` }, { transform: `translateX(${px / 2}px)` }, { transform: 'translateX(0)' },
], { duration: 380, fill: 'none' });

/** Round played: highlights the winner, updates score/track and shows "Next". */
function showResolved(b: Battle, animate: boolean) {
  const u = ui(b);
  const t = L().battle.arena;
  const r = b.results[b.round];
  b.phase = 'resolved';
  if (b.selected != null) b.used.set(b.selected, r.outcome);
  renderHand(b);
  const score = summarize(b.results).score;

  u.you.classList.add(r.outcome === 'win' ? 'winner' : r.outcome === 'lose' ? 'loser' : 'tie');
  u.opp.classList.add(r.outcome === 'lose' ? 'winner' : r.outcome === 'win' ? 'loser' : 'tie');
  if (r.outcome === 'win') u.monOpp.classList.add('fainted');
  if (r.outcome === 'lose') u.monYou.classList.add('fainted');
  for (const side of ['you', 'opp'] as const) {
    const node = $(b.layer, `[data-score="${side}"]`);
    if (Number(node.textContent) !== score[side]) {
      node.textContent = String(score[side]);
      if (animate && !reducedMotion()) node.animate([{ transform: 'scale(1.8)', color: '#fff' }, { transform: 'scale(1)' }], { duration: 460, easing: EASE });
    }
  }
  renderTrack(b);

  const statLabel = L().core.stats[r.stat];
  const multTag = (mult: number) => (mult !== 1 ? ` <small class="rr-mult ${mult > 1 ? 'up' : 'down'}">${multText(mult)}</small>` : '');
  const last = b.round === b.opp.length - 1;
  const icons = { win: 'check', lose: 'x', draw: 'minus' } as const;
  u.result.innerHTML = `
    <div class="rr rr-${r.outcome}">
      <div class="rr-text">
        <strong><svg class="i" aria-hidden="true"><use href="#i-${icons[r.outcome]}"></use></svg> ${esc(t.outcome[r.outcome])}</strong>
        <span>${esc(statLabel)}: <b>${fmt(r.youValue)}</b>${multTag(r.matchup.you.mult)} <i>vs</i> <b>${fmt(r.oppValue)}</b>${multTag(r.matchup.opp.mult)}</span>
      </div>
      <button class="btn btn-primary" type="button" data-act="next">${esc(last ? t.seeResult : t.next)} <svg class="i" aria-hidden="true"><use href="#i-right"></use></svg></button>
    </div>`;
  if (animate && !reducedMotion()) {
    u.result.firstElementChild!.animate([{ opacity: 0, transform: 'translateY(12px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: EASE });
  }
  $(u.result, '[data-act="next"]').focus({ preventScroll: true });
}

function next(b: Battle) {
  if (b.phase !== 'resolved') return;
  sfx('click');
  b.round++;
  b.selected = null;
  if (b.round >= b.opp.length) return void showEnd(b);
  b.phase = 'pick';
  b.seq = new Sequence();
  renderRound(true);
  requestAnimationFrame(() => $(ui(b).hand, '.hand-card:not(:disabled)')?.focus({ preventScroll: true }));
}

// --- End ----------------------------------------------------------------------------

let endOutcome: BattleOutcome | null = null;

async function showEnd(b: Battle) {
  b.phase = 'end';
  const summary = summarize(b.results);
  const outcome: BattleOutcome = { ...summary, forfeit: false, rounds: [...b.results] };
  endOutcome = outcome;
  const o = b.config.opponent;
  const line = summary.result === 'win' ? o.loseLine : summary.result === 'lose' ? o.winLine : undefined;
  playMusic(null);
  sfx(summary.result === 'win' ? 'victory' : 'defeat');

  const panel = el(endHTML({ ...summary, rounds: b.results, name: o.name, portrait: o.portrait, line }));
  b.layer.append(panel);
  b.layer.classList.add('ended');
  $(panel, '.end-continue').focus({ preventScroll: true });
  if (reducedMotion()) return;
  panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
  $(panel, '.end-panel').animate([{ opacity: 0, transform: 'translateY(24px) scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE });
  await sleep(200);
  if (summary.result === 'win') {
    burst($(panel, '.end-crest'), { color: '#f4dca3', count: summary.perfect ? 48 : 32, distance: 220 });
    if (summary.perfect) burst($(panel, '.end-crest'), { color: '#fff', count: 18, distance: 160, shape: 'star' });
  }
}

function finishClose(b: Battle) {
  if (b.phase !== 'end' || !endOutcome) return;
  sfx('close');
  const outcome = endOutcome;
  endOutcome = null;
  close(b, outcome);
}
