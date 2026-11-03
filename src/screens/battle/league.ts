// Pokémon League (#/battle/league): locked panel until 8 badges, then the lobby (entry, prizes, Hall of Fame)
// or the run in progress (next duel card, your path and the 16-slot bracket). It applies each duel's result,
// advances the bracket, and ends the run with the placement rewards or the champion celebration.
// A switch (Kanto, Johto, Hoenn, Sinnoh, Master) picks the league; each keeps its own run, titles and Hall of Fame.
// During a run the registered team is shown with its HP (it carries over between duels), and before each duel after
// the first the player gets 2 Revives and 4 Potions. The Master League has neither: each duel starts
// at full HP with the current team, which the player can change between duels (saved teams one click away).

import { sfx } from '../../audio';
import { itemSprite } from '../../data/items';
import { trainerSpriteUrl } from '../../data/sprites';
import { UNLOCK_BADGES } from '../../game/economy';
import { activeRegion, chapterLeague, nextChapter, WORLD } from '../../game/journey';
import { regionBadges } from '../../game/modes/gyms';
import {
  abandonRun, ALL_LEAGUES, applyHeal, buildBracket, canEnter, CHAMPION, championBoss, duelDifficulty, duelInfo, eliteFour, healPending, healTargets, kitLeft, LEAGUE_DUELS,
  LEAGUE_KIT, leagueFee, leagueRecord, leagueTitles, LEAGUE_REGIONS, leagueUnlocked, MASTER_DAILY_ENTRIES, masterBanned, masterEntriesToday, masterShinyAvailable,
  PLACEMENTS, placementRewards, recordDuel, REVIVE_HP, runBonus, runScale, runTeam, setRunHp, startRun, winRewards, type Bracket,
  type Entrant, type HealKind, type LeagueRegion, type LeagueRun,
} from '../../game/modes/league';
import type { Reward } from '../../game/rewards';
import { toBattleCard, type TeamMember } from '../../game/battle';
import { parseKey } from '../../game/cards';
import { getSpecies, hasSpecies } from '../../data/species';
import { spriteUrl } from '../../data/sprites';
import { TYPE_COLOR } from '../../data/types';
import { hashString } from '../../game/rng';
import { playerScale, playerTeam } from '../../game/teams';
import { fmt, itemName, L, locale } from '../../i18n';
import { grant, recordBattle } from '../../state/actions';
import { on, store, travelTo, update } from '../../state/store';
import { confirmDialog, esc, icon, reducedMotion, shakeCoins, toast } from '../../ui/dom';
import { showRewards } from '../../ui/rewards';
import type { ModeModule } from '../types';
import { runBattle } from './arena';
import { modeHead, portrait, teamReady, teamStrip, typeBadges } from './competition-ui';
import { bracketHTML, entrantName, entrantTitle } from './league-bracket';
import { celebrateChampion, TROPHY_SVG } from './league-fx';
import { chapterLabel, clickedRegion, regionSwitchHTML } from './regions';
import { ensureTeam, teamSummaryHTML } from './team';

let root: HTMLElement | null = null;
let offs: (() => void)[] = [];
let busy = false;
/** Round revealed by the last win (animated once). */
let fresh = -1;
/** League on screen (null: pick the one with a run in progress, else the newest unlocked). */
let region: LeagueRegion | null = null;

const t = () => L().modes.league;
const m = () => t().masterRules;

function shownRegion(): LeagueRegion {
  // A Journey chapter has just its own League.
  const chapter = chapterLeague();
  if (chapter) return chapter;
  if (region) return region;
  const save = store.save;
  const newestFirst = [...ALL_LEAGUES].reverse();
  return newestFirst.find(r => leagueRecord(save, r).run) ?? newestFirst.find(r => leagueUnlocked(save, r)) ?? 'kanto';
}

/** The shown league's progress. */
const rec = () => leagueRecord(store.save, shownRegion());

type RegionText = keyof ReturnType<typeof t>['johto'];
/** Text that differs per league: each later region has its own copy, Kanto uses the base keys. */
function rt<K extends RegionText>(key: K): ReturnType<typeof t>['johto'][K] {
  const shown = shownRegion();
  return shown === 'kanto' ? (t()[key] as ReturnType<typeof t>['johto'][K]) : t()[shown][key];
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
  return regionSwitchHTML(shownRegion(), ALL_LEAGUES.map(r => {
    const open = leagueUnlocked(store.save, r);
    return {
      region: r, locked: !open, done: leagueRecord(store.save, r).titles > 0,
      label: r === 'master' ? m().tab : undefined,
      note: open ? note(r) : r === 'master' ? `${leagueTitles(store.save)}/${LEAGUE_REGIONS.length}` : `${regionBadges(store.save.gyms, r)}/${UNLOCK_BADGES.league}`,
    };
  }), t().region);
}

// --- Rendering ---------------------------------------------------------------------

function render() {
  if (!root) return;
  const shown = shownRegion();
  const check = canEnter(store.save, shown);
  const body = check === 'locked' ? lockedHTML() : rec().run ? runHTML() : lobbyHTML(check);
  root.innerHTML = `<div class="mode league league-${shown}">${modeHead(rt('title'), rt('subtitle'), chapterLeague() ? '' : regionTabs())}${body}</div>`;
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
  const shown = shownRegion();
  const badges = shown === 'master' ? leagueTitles(store.save) : regionBadges(store.save.gyms, shown);
  const needed = shown === 'master' ? LEAGUE_REGIONS.length : UNLOCK_BADGES.league;
  return `
    <section class="league-locked">
      <div class="league-emblem is-locked">${TROPHY_SVG}<span class="league-lock">${icon('lock')}</span></div>
      <h2 class="league-locked-title">${esc(rt('lockedTitle'))}</h2>
      <p class="view-sub">${esc(rt('lockedText')(badges))}</p>
      <ol class="badge-slots" aria-hidden="true">
        ${Array.from({ length: needed }, (_, i) => `<li class="${i < badges ? 'is-earned' : ''}">${icon(i < badges ? 'check' : 'medal')}</li>`).join('')}
      </ol>
      ${shown === 'master' ? '' : `<a class="btn btn-primary" href="#/battle/gyms">${icon('medal')} ${esc(t().goGyms)}</a>`}
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
          <small>${esc(i === bosses.length - 1 ? t().champion : shownRegion() === 'master' ? m().formerChampion : t().eliteFour)}</small>
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

/** The Master League's prizes: each win pays on the spot, and the title adds the day's shiny. */
function masterPrizesHTML() {
  return [...Array(LEAGUE_DUELS).keys()].reverse().map(i => {
    const title = i === LEAGUE_DUELS - 1;
    return `
      <li class="prize${title ? ' is-champion' : ''}">
        <b class="prize-name">${title ? icon('crown') : ''}${esc(title ? t().champion : m().win(i + 1))}</b>
        <span class="prize-chips">${rewardChips(winRewards(i, 'master'))}</span>
        ${title ? `<small class="prize-extra">${icon('sparkle')} ${esc(masterShinyAvailable(store.save) ? m().shinyPrize : m().shinyPrizeTaken)}</small>` : ''}
      </li>`;
  }).join('');
}

/** The team's cards the Master League refuses, by name. */
function bannedNames() {
  return masterBanned(store.save.deck).map(key => {
    const { id, shiny } = parseKey(key);
    const name = hasSpecies(id) ? getSpecies(id).name : key;
    return shiny ? m().shinyName(name) : name;
  }).join(', ');
}

function lobbyHTML(check: ReturnType<typeof canEnter>) {
  const shown = shownRegion();
  const league = rec();
  const fee = leagueFee(shown);
  const bonus = runBonus(league.titles, shown);
  const banned = shown === 'master' ? bannedNames() : '';
  // What this team would meet if it entered now.
  const scale = playerScale(store.save);
  const first = duelDifficulty(0, bonus, shown, scale);
  const last = duelDifficulty(LEAGUE_DUELS - 1, bonus, shown, scale);
  const min = first.levels[0];
  const max = last.ace ?? last.levels[1];
  return `
    <section class="league-hero">
      <div class="league-emblem">${TROPHY_SVG}</div>
      <div class="league-hero-text">
        <span class="label">${esc(rt('plateau'))}</span>
        <h2 class="league-hero-title">${esc(rt('title'))}</h2>
        <p>${esc(activeRegion() ? L().journey.league.hero : rt('heroText'))}</p>
        <div class="league-pills">
          <span class="pill">${icon('coin', 'i-coin')} ${esc(t().fee)}: <b>₽ ${fmt(fee)}</b></span>
          <span class="pill">${icon('bolt')} ${esc(t().levels)}: <b>${esc(L().modes.levelRange(min, max))}</b>${bonus ? ` <small>(${esc(t().bonus(bonus))})</small>` : ''}</span>
          ${first.scaled || last.scaled ? `<span class="pill is-scaled" title="${esc(t().scaledHint)}">${icon('up')} ${esc(t().scaled)}</span>` : ''}
          ${shown === 'master' ? `<span class="pill">${icon('flag')} ${esc(m().entries)}: <b>${fmt(masterEntriesToday(store.save))}/${fmt(MASTER_DAILY_ENTRIES)}</b></span>` : ''}
          ${league.titles ? `<span class="pill is-gold">${icon('crown')} ${esc(t().titles)}: <b>${fmt(league.titles)}</b></span>` : ''}
        </div>
        <button class="btn btn-primary btn-lg" type="button" data-act="enter">${icon('flag')} ${esc(t().enter)} <small class="btn-price">₽ ${fmt(fee)}</small></button>
        ${check === 'coins' ? `<p class="league-warn">${esc(L().core.notEnoughCoins(fee))}</p>` : ''}
        ${check === 'daily' ? `<p class="league-warn">${esc(m().noEntries(MASTER_DAILY_ENTRIES))}</p>` : ''}
        ${banned ? `<p class="league-warn" data-banned>${esc(m().banned(banned))}</p>` : ''}
      </div>
      ${bossesHTML()}
    </section>
    <div class="league-grid">
      <section class="panel prizes" aria-labelledby="prizes-title">
        <h2 class="section-title" id="prizes-title">${icon('gift')} ${esc(t().prizes)}</h2>
        <ol class="prize-list">
          ${shown === 'master' ? masterPrizesHTML() : [...PLACEMENTS.keys()].reverse().map(i => `
            <li class="prize${i === CHAMPION ? ' is-champion' : ''}${league.best === i ? ' is-best' : ''}">
              <b class="prize-name">${i === CHAMPION ? icon('crown') : ''}${esc(placementName(i))}</b>
              <span class="prize-chips">${rewardChips(placementRewards(i, shown))}</span>
              ${i === CHAMPION && league.titles === 0 ? `<small class="prize-extra">${icon('sparkle')} ${esc(activeRegion() ? L().journey.league.prizeFirstTitle : rt('prizeFirstTitle'))}</small>` : ''}
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
  const info = duelInfo(bracket, run, run.duel, store.save.starter, shownRegion(), runScale(store.save, run));
  const opp = info.opponent;
  const kind = opp.kind;
  const master = shownRegion() === 'master';
  const banned = master ? bannedNames() : '';
  return `
    <section class="league-next" data-kind="${kind}">
      <div class="next-portrait">${portrait(opp.sprite, opp.name, 'is-big')}</div>
      <div class="next-info">
        <span class="label">${esc(t().duelOf(run.duel + 1, LEAGUE_DUELS))} · ${esc(t().stages[run.duel])}</span>
        <h2 class="next-name">${esc(opp.name)}</h2>
        <p class="next-title">${kind === 'champion' ? icon('crown') : kind === 'e4' ? icon('star') : ''} ${esc(entrantTitle(opp))}</p>
        <div class="next-meta">${typeBadges(opp.types)}<span class="pill">${esc(L().modes.levelRange(info.levels[0], info.levels[1]))}</span>${info.scaled ? `<span class="pill is-scaled" title="${esc(t().scaledHint)}">${icon('up')} ${esc(info.ace != null ? t().scaledAce(info.ace) : t().scaled)}</span>` : ''}</div>
        <div class="next-team">${teamStrip(info.team)}</div>
        <div class="next-actions">
          ${banned ? `<p class="league-warn" data-banned>${esc(m().banned(banned))}</p>` : healPending(store.save, run, shownRegion()) ? `<p class="heal-first">${icon('sparkle')} ${esc(t().healFirst)}</p>`
            : `<button class="btn btn-primary btn-lg" type="button" data-act="fight">${icon('swords')} ${esc(info.final ? t().finalBattle : t().battle)}</button>`}
          <button class="btn btn-ghost" type="button" data-act="abandon">${icon('flag')} ${esc(t().abandon)}</button>
        </div>
      </div>
      ${pathHTML(bracket, run.duel)}
    </section>
    ${master ? `<section class="master-team"><p class="view-sub">${icon('sparkle')} ${esc(m().teamHint)}</p>${teamSummaryHTML()}</section>` : ''}
    <section class="bracket-section" aria-labelledby="bracket-title">
      <h2 class="section-title" id="bracket-title">${esc(t().bracket)}</h2>
      <div class="bracket-scroll">${bracketHTML(bracket, run.duel, fresh)}</div>
    </section>
    ${master ? '' : runTeamHTML(run)}`;
}

/** The registered team with its HP; before a duel (after the first) it hosts the items. */
function runTeamHTML(run: LeagueRun) {
  const team = runTeam(store.save, run);
  const pending = healPending(store.save, run);
  const targets = pending ? healTargets(store.save, run) : null;
  const left = kitLeft(run);
  const member = (m: ReturnType<typeof runTeam>[number]) => {
    const { id, shiny } = parseKey(m.key);
    const sp = getSpecies(id);
    const level = store.save.cards[m.key]?.level ?? 0;
    const pct = Math.round(m.hp * 100);
    const state = m.hp <= 0 ? 'fainted' : m.hp < 0.35 ? 'low' : m.hp < 1 ? 'hurt' : 'full';
    const heal = !targets ? '' : targets.revive.includes(m.registered)
      ? `<button class="btn btn-sm heal-btn is-revive" type="button" data-heal="revive" data-key="${esc(m.registered)}">${icon('plus')} ${esc(t().revive)}</button>`
      : targets.potion.includes(m.registered)
        ? `<button class="btn btn-sm heal-btn" type="button" data-heal="potion" data-key="${esc(m.registered)}">${icon('plus')} ${esc(t().potion)}</button>` : '';
    return `
      <li class="run-mon is-${state}" style="--tc:${TYPE_COLOR[sp.types[0]]}">
        <img src="${esc(spriteUrl(id, shiny))}" alt="" width="96" height="96" loading="lazy" draggable="false">
        <b>${esc(sp.name)}</b>
        <small>${esc(L().modes.level(level))}</small>
        <span class="run-hp" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${esc(t().hpOf(sp.name, pct))}"><i style="width:${pct}%"></i></span>
        <small class="run-hp-text">${m.hp <= 0 ? esc(t().fainted) : `${pct}%`}</small>
        ${heal}
      </li>`;
  };
  return `
    <section class="league-team run-team${pending ? ' is-healing' : ''}">
      <header class="run-team-head">
        <span class="label">${icon('lock')} ${esc(t().registered)}</span>
        <small>${esc(t().registeredHint)}</small>
      </header>
      ${pending ? `
        <div class="heal-choice">
          <p><b>${esc(t().healTitle(LEAGUE_KIT.revives, LEAGUE_KIT.potions))}</b> ${esc(t().healText(Math.round(REVIVE_HP * 100)))}</p>
          <span class="pill" data-kit-left>${esc(t().revive)}: <b>${fmt(left.revives)}</b> · ${esc(t().potion)}: <b>${fmt(left.potions)}</b></span>
        </div>` : ''}
      <ol class="run-mons">${team.map(member).join('')}</ol>
    </section>`;
}

/** The registered team as battle cards and their starting HP (in the same order). */
function runBattleSetup(run: LeagueRun) {
  const team = runTeam(store.save, run);
  const cards = team.map(m => {
    const { id, shiny } = parseKey(m.key);
    return toBattleCard({ id, shiny, level: store.save.cards[m.key]?.level ?? 1 }, m.key);
  });
  return { cards, hp: team.map(m => m.hp) };
}

/** The registered team, for the Hall of Fame. */
function runTeamMembers(run: LeagueRun): TeamMember[] {
  return runTeam(store.save, run).map(m => {
    const { id, shiny } = parseKey(m.key);
    return { id, shiny, level: store.save.cards[m.key]?.level ?? 1 };
  });
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
  const picked = clickedRegion(event) as LeagueRegion | undefined;
  if (picked && !busy && !chapterLeague()) {
    if (picked !== shownRegion()) {
      sfx('toggle');
      region = picked;
      render();
      root?.querySelector<HTMLElement>(`.region-tab[data-region="${picked}"]`)?.focus();
    }
    return;
  }
  const heal = (event.target as Element).closest<HTMLButtonElement>('[data-heal]');
  if (heal && !busy) return void useHeal(heal.dataset.heal as HealKind, heal.dataset.key!);
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
  if (check === 'daily' || check === 'banned') {
    sfx('error');
    toast(check === 'daily' ? m().noEntries(MASTER_DAILY_ENTRIES) : m().banned(bannedNames()), 'warning');
    return;
  }
  if (check === 'team' || !teamReady()) return;
  if (check !== 'ok') return;
  sfx('open');
  const master = shown === 'master';
  const ok = await confirmDialog({
    title: master ? m().enterTitle : t().enterTitle,
    message: master ? m().enterText(fee, MASTER_DAILY_ENTRIES - masterEntriesToday(store.save) - 1) : t().enterText(fee, LEAGUE_KIT.revives, LEAGUE_KIT.potions),
    confirmText: t().enterConfirm,
  });
  if (!ok) return;
  region = shown;
  if (update(save => startRun(save, undefined, undefined, shown), ['progress'])) sfx('buy');
}

function useHeal(kind: HealKind, target: string) {
  const shown = shownRegion();
  region = shown;
  if (!update(save => applyHeal(save, kind, target, shown), ['progress'])) return;
  sfx(kind === 'revive' ? 'levelUp' : 'candy');
  const name = getSpecies(parseKey(runTeam(store.save, rec().run!).find(m => m.registered === target)?.key ?? target).id).name;
  toast(kind === 'revive' ? t().reviveDone(name) : t().potionDone(name), 'success');
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

/** The first title of a region's League opens the next chapter of the Journey: offers to go there now. */
async function offerNextChapter() {
  const chapter = activeRegion();
  const next = chapter && nextChapter(chapter);
  if (!chapter || !next) return;
  const j = L().journey.complete;
  const name = chapterLabel(next);
  const go = await confirmDialog({
    title: j.title(chapterLabel(chapter)),
    message: next === WORLD ? j.world : j.next(name),
    confirmText: j.go(name),
    cancelText: j.stay,
  });
  if (go) await travelTo(next);
}

async function fight() {
  const shown = shownRegion();
  const run = rec().run;
  if (!run || busy || healPending(store.save, run, shown)) return;
  const master = shown === 'master';
  // The Master League fights with the team of the moment, at full HP.
  if (master && !ensureTeam()) return;
  if (master && masterBanned(store.save.deck).length) {
    sfx('error');
    toast(m().banned(bannedNames()), 'warning');
    return;
  }
  const setup = master ? null : runBattleSetup(run);
  const bracket = currentBracket()!;
  const duel = run.duel;
  const info = duelInfo(bracket, run, duel, store.save.starter, shown, runScale(store.save, run));
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
      music: info.final ? 'champion' : 'league',
      stage: `${rt('title')} · ${t().stages[duel]}`,
      team: setup?.cards,
      startHp: setup?.hp,
    });
    const won = outcome.result === 'win';
    region = shown;
    if (won) update(save => setRunHp(save, outcome.hpLeft, shown));
    const team = master ? playerTeam(store.save) : runTeamMembers(run);
    const result = update(save => recordDuel(save, won, team, undefined, shown), ['progress']);
    recordBattle(outcome.forfeit ? 'forfeit' : outcome.result);
    if (!result) return;

    if (result.kind === 'advance') {
      fresh = result.duel;
      const paid = result.rewards.length ? grant(result.rewards) : [];
      busy = false;
      render();
      if (paid.length) await showRewards(paid, { title: m().winTitle, subtitle: t().advanced(t().stages[result.duel]) });
      else toast(t().advanced(t().stages[result.duel]), 'success');
      return;
    }
    render();
    const applied = grant(result.rewards);
    if (result.kind === 'champion') {
      await celebrateChampion(team, entrantName(opp), rt('championTitle'), rt('title'));
      await showRewards(applied, {
        title: t().championRewards,
        subtitle: result.firstTitle ? (activeRegion() ? L().journey.league.firstTitle : rt('firstTitle')) : t().championSub(opp.name),

        tone: 'champion',
      });
      if (result.firstTitle) await offerNextChapter();
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
