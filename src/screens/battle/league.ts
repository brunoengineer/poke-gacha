// Pokémon League (#/battle/league): locked panel until 8 badges, then the lobby (entry, prizes, Hall of Fame)
// or the run in progress (next duel card, your path and the 16-slot bracket). It applies each duel's result,
// advances the bracket, and ends the run with the placement rewards or the champion celebration.
// A Kanto / Johto switch picks the league; each keeps its own run, titles and Hall of Fame.

import { sfx } from '../../audio';
import { itemSprite } from '../../data/items';
import { trainerSpriteUrl } from '../../data/sprites';
import { JOHTO_UNLOCK_BADGES, UNLOCK_BADGES } from '../../game/economy';
import { regionBadges } from '../../game/modes/gyms';
import {
  abandonRun, buildBracket, canEnter, CHAMPION, championBoss, duelInfo, eliteFour, LEAGUE_DUELS, leagueFee, leagueRecord,
  leagueUnlocked, PLACEMENTS, placementRewards, recordDuel, startRun, titleBonus, duelLevels, type Bracket, type Entrant,
  type LeagueRegion,
} from '../../game/modes/league';
import type { Reward } from '../../game/rewards';
import { hashString } from '../../game/rng';
import { fmt, itemName, L, locale } from '../../i18n';
import { grant, recordBattle } from '../../state/actions';
import { on, store, update } from '../../state/store';
import { confirmDialog, esc, icon, reducedMotion, shakeCoins, toast } from '../../ui/dom';
import { showRewards } from '../../ui/rewards';
import type { ModeModule } from '../types';
import { runBattle } from './arena';
import { modeHead, myTeam, portrait, teamReady, teamStrip, typeBadges } from './competition-ui';
import { bracketHTML, entrantName, entrantTitle } from './league-bracket';
import { celebrateChampion, TROPHY_SVG } from './league-fx';
import { clickedRegion, regionSwitchHTML } from './regions';

let root: HTMLElement | null = null;
let offs: (() => void)[] = [];
let busy = false;
/** Round revealed by the last win (animated once). */
let fresh = -1;
/** League on screen (null: pick the one with a run in progress, else the newest unlocked). */
let region: LeagueRegion | null = null;

const t = () => L().modes.league;

function shownRegion(): LeagueRegion {
  if (region) return region;
  const save = store.save;
  if (leagueRecord(save, 'johto').run) return 'johto';
  if (save.league.run) return 'kanto';
  return leagueUnlocked(save, 'johto') ? 'johto' : 'kanto';
}

/** The shown league's progress. */
const rec = () => leagueRecord(store.save, shownRegion());

type RegionText = keyof ReturnType<typeof t>['johto'];
/** Text that differs per league: Johto has its own copy, Kanto uses the base keys. */
function rt<K extends RegionText>(key: K): ReturnType<typeof t>['johto'][K] {
  return shownRegion() === 'johto' ? t().johto[key] : (t()[key] as ReturnType<typeof t>['johto'][K]);
}

/** Display name of a placement index (0 = Top 16 … 4 = Champion). */
export const placementName = (index: number) => t().placements[PLACEMENTS[Math.max(0, Math.min(CHAMPION, index))]];

export const leagueMode: ModeModule = {
  render(container) {
    leagueMode.dispose?.();
    root = container;
    container.addEventListener('click', onClick);
    offs.push(on('progress', () => { if (!busy) render(); }), on('deck', () => { if (!busy) render(); }), on('coins', () => { if (!busy) render(); }));
    render();
  },
  dispose() {
    root?.removeEventListener('click', onClick);
    offs.forEach(off => off());
    offs = [];
    root = null;
    region = null;
  },
};

function currentBracket(): Bracket | null {
  const run = rec().run;
  return run ? buildBracket(store.save.ladder.seed, run.seed, store.save.starter, shownRegion()) : null;
}

function regionTabs() {
  const note = (r: LeagueRegion) => {
    const league = leagueRecord(store.save, r);
    if (league.run) return t().duelOf(league.run.duel + 1, LEAGUE_DUELS);
    return league.best >= 0 ? placementName(league.best) : t().never;
  };
  const johtoOpen = leagueUnlocked(store.save, 'johto');
  return regionSwitchHTML(shownRegion(), [
    { region: 'kanto', note: note('kanto'), done: store.save.league.titles > 0 },
    {
      region: 'johto', locked: !johtoOpen, done: leagueRecord(store.save, 'johto').titles > 0,
      note: johtoOpen ? note('johto') : `${regionBadges(store.save.gyms, 'johto')}/${JOHTO_UNLOCK_BADGES.league}`,
    },
  ], t().region);
}

// --- Rendering ---------------------------------------------------------------------

function render() {
  if (!root) return;
  const shown = shownRegion();
  const check = canEnter(store.save, shown);
  const body = check === 'locked' ? lockedHTML() : rec().run ? runHTML() : lobbyHTML(check);
  root.innerHTML = `<div class="mode league league-${shown}">${modeHead(rt('title'), rt('subtitle'), regionTabs())}${body}</div>`;
  if (rec().run) {
    const next = root.querySelector<HTMLElement>('.bk-match.is-next');
    const scroller = root.querySelector<HTMLElement>('.bracket-scroll');
    if (next && scroller && scroller.scrollWidth > scroller.clientWidth) {
      const box = scroller.getBoundingClientRect();
      const at = next.getBoundingClientRect();
      const offset = scroller.scrollLeft + at.left - box.left - box.width / 2 + at.width / 2;
      scroller.scrollTo({ left: offset, behavior: fresh >= 0 && !reducedMotion() ? 'smooth' : 'auto' });
    }
  }
  fresh = -1;
}

function lockedHTML() {
  const johto = shownRegion() === 'johto';
  const badges = regionBadges(store.save.gyms, shownRegion());
  const needed = johto ? JOHTO_UNLOCK_BADGES.league : UNLOCK_BADGES.league;
  return `
    <section class="league-locked">
      <div class="league-emblem is-locked">${TROPHY_SVG}<span class="league-lock">${icon('lock')}</span></div>
      <h2 class="league-locked-title">${esc(rt('lockedTitle'))}</h2>
      <p class="view-sub">${esc(rt('lockedText')(badges))}</p>
      <ol class="badge-slots" aria-hidden="true">
        ${Array.from({ length: needed }, (_, i) => `<li class="${i < badges ? 'is-earned' : ''}">${icon(i < badges ? 'check' : 'medal')}</li>`).join('')}
      </ol>
      <a class="btn btn-primary" href="#/battle/gyms">${icon('medal')} ${esc(t().goGyms)}</a>
      ${bossesHTML()}
    </section>`;
}

function bossesHTML() {
  const bosses = [...eliteFour(shownRegion()), championBoss(store.save.starter, shownRegion())];
  return `
    <ul class="league-bosses">
      ${bosses.map((b, i) => `
        <li class="boss${i === bosses.length - 1 ? ' is-champion' : ''}">
          ${portrait(b.sprite, b.name)}
          <b>${esc(b.name)}</b>
          <small>${esc(i === bosses.length - 1 ? t().champion : t().eliteFour)}</small>
        </li>`).join('')}
    </ul>`;
}

function rewardChips(rewards: Reward[]) {
  return rewards.map(r => {
    if (r.kind === 'coins') return `<span class="prize-chip is-coins">${icon('coin', 'i-coin')}${fmt(r.amount)}</span>`;
    if (r.kind === 'item') return `<span class="prize-chip" title="${esc(itemName(r.item))}"><img src="${esc(itemSprite(r.item))}" alt="" width="30" height="30" loading="lazy">×${fmt(r.amount)}<span class="sr-only">${esc(itemName(r.item))}</span></span>`;
    return '';
  }).join('');
}

function lobbyHTML(check: ReturnType<typeof canEnter>) {
  const shown = shownRegion();
  const league = rec();
  const fee = leagueFee(shown);
  const bonus = titleBonus(league.titles);
  const [min] = duelLevels(0, bonus, shown);
  const [, max] = duelLevels(LEAGUE_DUELS - 1, bonus, shown);
  return `
    <section class="league-hero">
      <div class="league-emblem">${TROPHY_SVG}</div>
      <div class="league-hero-text">
        <span class="label">${esc(rt('plateau'))}</span>
        <h2 class="league-hero-title">${esc(rt('title'))}</h2>
        <p>${esc(rt('heroText'))}</p>
        <div class="league-pills">
          <span class="pill">${icon('coin', 'i-coin')} ${esc(t().fee)}: <b>₽ ${fmt(fee)}</b></span>
          <span class="pill">${icon('bolt')} ${esc(t().levels)}: <b>${esc(L().modes.levelRange(min, max))}</b>${bonus ? ` <small>(${esc(t().bonus(bonus))})</small>` : ''}</span>
          ${league.titles ? `<span class="pill is-gold">${icon('crown')} ${esc(t().titles)}: <b>${fmt(league.titles)}</b></span>` : ''}
        </div>
        <button class="btn btn-primary btn-lg" type="button" data-act="enter">${icon('flag')} ${esc(t().enter)} <small class="btn-price">₽ ${fmt(fee)}</small></button>
        ${check === 'coins' ? `<p class="league-warn">${esc(L().core.notEnoughCoins(fee))}</p>` : ''}
      </div>
      ${bossesHTML()}
    </section>
    <div class="league-grid">
      <section class="panel prizes" aria-labelledby="prizes-title">
        <h2 class="section-title" id="prizes-title">${icon('gift')} ${esc(t().prizes)}</h2>
        <ol class="prize-list">
          ${[...PLACEMENTS.keys()].reverse().map(i => `
            <li class="prize${i === CHAMPION ? ' is-champion' : ''}${league.best === i ? ' is-best' : ''}">
              <b class="prize-name">${i === CHAMPION ? icon('crown') : ''}${esc(placementName(i))}</b>
              <span class="prize-chips">${rewardChips(placementRewards(i, shown))}</span>
              ${i === CHAMPION && league.titles === 0 ? `<small class="prize-extra">${icon('sparkle')} ${esc(rt('prizeFirstTitle'))}</small>` : ''}
            </li>`).join('')}
        </ol>
      </section>
      ${hallHTML()}
    </div>`;
}

function hallHTML() {
  const league = rec();
  const hall = league.hall ?? [];
  const date = (at: number) => new Date(at).toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' });
  return `
    <section class="panel hall" aria-labelledby="hall-title">
      <h2 class="section-title" id="hall-title">${icon('trophy')} ${esc(t().hall)}</h2>
      <dl class="hall-stats">
        <div><dt class="label">${esc(t().titles)}</dt><dd>${fmt(league.titles)}</dd></div>
        <div><dt class="label">${esc(t().best)}</dt><dd>${league.best >= 0 ? esc(placementName(league.best)) : esc(t().never)}</dd></div>
        <div><dt class="label">${esc(t().runs)}</dt><dd>${fmt(league.runs)}</dd></div>
        <div><dt class="label">${esc(t().duelsWon)}</dt><dd>${fmt(league.duelsWon ?? 0)}</dd></div>
      </dl>
      ${hall.length ? `
        <ol class="hall-list">
          ${hall.map((entry, i) => `
            <li class="hall-entry${i === 0 ? ' is-latest' : ''}">
              <span class="hall-when">${icon('crown')} ${esc(t().hallEntry(league.titles - i, date(entry.at)))}</span>
              ${teamStrip(entry.team)}
            </li>`).join('')}
        </ol>` : `<p class="hall-empty">${esc(t().hallEmpty)}</p>`}
    </section>`;
}

function runHTML() {
  const run = rec().run!;
  const bracket = currentBracket()!;
  const info = duelInfo(bracket, run, run.duel, store.save.starter, shownRegion());
  const opp = info.opponent;
  const kind = opp.kind;
  return `
    <section class="league-next" data-kind="${kind}">
      <div class="next-portrait">${portrait(opp.sprite, opp.name, 'is-big')}</div>
      <div class="next-info">
        <span class="label">${esc(t().duelOf(run.duel + 1, LEAGUE_DUELS))} · ${esc(t().stages[run.duel])}</span>
        <h2 class="next-name">${esc(opp.name)}</h2>
        <p class="next-title">${kind === 'champion' ? icon('crown') : kind === 'e4' ? icon('star') : ''} ${esc(entrantTitle(opp))}</p>
        <div class="next-meta">${typeBadges(opp.types)}<span class="pill">${esc(L().modes.levelRange(info.levels[0], info.levels[1]))}</span></div>
        <div class="next-team">${teamStrip(info.team, { hidden: info.final })}</div>
        ${info.final ? `<p class="next-note">${icon('sparkle')} ${esc(t().hiddenTeam)} ${esc(t().revealType)}</p>` : ''}
        <div class="next-actions">
          <button class="btn btn-primary btn-lg" type="button" data-act="fight">${icon('swords')} ${esc(info.final ? t().finalBattle : t().battle)}</button>
          <button class="btn btn-ghost" type="button" data-act="abandon">${icon('flag')} ${esc(t().abandon)}</button>
        </div>
      </div>
      ${pathHTML(bracket, run.duel)}
    </section>
    <section class="bracket-section" aria-labelledby="bracket-title">
      <h2 class="section-title" id="bracket-title">${esc(t().bracket)}</h2>
      <div class="bracket-scroll">${bracketHTML(bracket, run.duel, fresh)}</div>
    </section>
    <section class="league-team">
      <span class="label">${esc(L().modes.yourTeam)}</span>
      ${teamStrip(myTeam())}
      <a class="btn btn-ghost btn-sm" href="#/collection">${icon('cards')} ${esc(L().modes.editTeam)}</a>
    </section>`;
}

function pathHTML(bracket: Bracket, won: number) {
  return `
    <ol class="league-path" aria-label="${esc(t().path)}">
      ${bracket.path.map((e: Entrant, i) => {
        const state = i < won ? 'done' : i === won ? 'current' : 'upcoming';
        return `
          <li class="path-step" data-state="${state}" data-kind="${e.kind}">
            <span class="path-pic">${portrait(e.sprite)}${state === 'done' ? `<span class="path-check">${icon('check')}</span>` : ''}</span>
            <span class="path-text"><small>${esc(t().stagesShort[i])}</small><b>${esc(e.name)}</b></span>
          </li>`;
      }).join('')}
      <li class="path-step path-goal" data-state="upcoming"><span class="path-pic">${icon('crown')}</span><span class="path-text"><small>${esc(t().champion)}</small><b>${esc(L().modes.you)}</b></span></li>
    </ol>`;
}

// --- Actions -------------------------------------------------------------------------

function onClick(event: Event) {
  const picked = clickedRegion(event);
  if (picked && !busy) {
    if (picked !== shownRegion()) {
      sfx('toggle');
      region = picked;
      render();
      root?.querySelector<HTMLElement>(`.region-tab[data-region="${picked}"]`)?.focus();
    }
    return;
  }
  const button = (event.target as Element).closest<HTMLElement>('[data-act]');
  if (!button || busy) return;
  const act = button.dataset.act;
  if (act === 'enter') void enter();
  else if (act === 'fight') void fight();
  else if (act === 'abandon') void abandon();
}

async function enter() {
  const shown = shownRegion();
  const fee = leagueFee(shown);
  const check = canEnter(store.save, shown);
  if (check === 'coins') {
    shakeCoins();
    toast(L().core.notEnoughCoins(fee), 'warning');
    return;
  }
  if (check !== 'ok' || !teamReady()) return;
  sfx('open');
  const ok = await confirmDialog({ title: t().enterTitle, message: t().enterText(fee), confirmText: t().enterConfirm });
  if (!ok) return;
  region = shown;
  if (update(save => startRun(save, undefined, undefined, shown), ['progress'])) sfx('buy');
}

async function abandon() {
  const shown = shownRegion();
  const run = rec().run;
  if (!run) return;
  const ok = await confirmDialog({ title: t().abandonTitle, message: t().abandonText(placementName(run.duel)), confirmText: t().abandon, danger: true });
  if (!ok || !leagueRecord(store.save, shown).run) return;
  const stage = t().stages[run.duel];
  const result = update(save => abandonRun(save, shown), ['progress']);
  if (!result) return;
  const applied = grant(result.rewards);
  await showRewards(applied, { title: t().outTitle(placementName(result.placement)), subtitle: t().abandonSub(stage), crest: 'medal', tone: 'lose' });
}

const ELITE_LINES = () => L().modes.competition;

function opponentLines(e: Entrant) {
  const boss = t().lines[e.id];
  if (boss) return { intro: boss.intro, winLine: boss.win, loseLine: boss.lose };
  const c = ELITE_LINES();
  const at = (list: string[], salt: string) => list[hashString(`${e.id}-${salt}`) % list.length];
  return { intro: at(c.eliteIntro, 'intro'), winLine: at(c.winLine, 'win'), loseLine: at(c.loseLine, 'lose') };
}

async function fight() {
  const shown = shownRegion();
  const run = rec().run;
  if (!run || busy || !teamReady()) return;
  const bracket = currentBracket()!;
  const duel = run.duel;
  const info = duelInfo(bracket, run, duel, store.save.starter, shown);
  const opp = info.opponent;
  busy = true;
  sfx('click');
  try {
    const outcome = await runBattle({
      mode: 'league',
      opponent: {
        id: `league-${opp.id}`,
        name: opp.name,
        title: entrantTitle(opp),
        portrait: trainerSpriteUrl(opp.sprite),
        team: info.team,
        ...opponentLines(opp),
      },
      reveal: info.final ? 'type' : 'card',
      music: info.final ? 'champion' : 'league',
      stage: `${rt('title')} · ${t().stages[duel]}`,
    });
    const won = outcome.result === 'win';
    const team = myTeam();
    region = shown;
    const result = update(save => recordDuel(save, won, team, undefined, shown), ['progress']);
    recordBattle(outcome.forfeit ? 'forfeit' : outcome.result);
    if (!result) return;

    if (result.kind === 'advance') {
      fresh = result.duel;
      busy = false;
      render();
      toast(t().advanced(t().stages[result.duel]), 'success');
      return;
    }
    render();
    const applied = grant(result.rewards);
    if (result.kind === 'champion') {
      await celebrateChampion(team, entrantName(opp), rt('championTitle'), rt('title'));
      await showRewards(applied, {
        title: t().championRewards,
        subtitle: result.firstTitle ? rt('firstTitle') : t().championSub(opp.name),

        tone: 'champion',
      });
    } else {
      await showRewards(applied, {
        title: t().outTitle(placementName(result.placement)),
        subtitle: t().outSub(opp.name, t().stages[duel]),
        crest: 'medal',
        tone: 'lose',
      });
    }
  } finally {
    busy = false;
    render();
  }
}
