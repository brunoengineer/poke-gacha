// Battle tab: a hub with the player's team and the modes, routed as #/battle/<mode>.
// Each mode is a ModeModule rendered under a small header with a back button; battles themselves run in
// the full-screen arena (arena.ts), opened by the modes.

import { sfx } from '../../audio';
import { playerRank } from '../../game/modes/competition';
import { currentGymRegion, GYM_REGIONS, REGION_GYMS, regionBadges, regionGymsOpen } from '../../game/modes/gyms';
import { huntTargetHere } from '../../game/modes/hunt';
import { LEAGUE_REGIONS, leagueRecord, leagueUnlocked, type LeagueRegion } from '../../game/modes/league';
import { anyRaidUnlocked, raidPool, raidUnlocked } from '../../game/modes/raid';
import { cardKey } from '../../game/cards';
import { chapterLeague, inWorld, isJourney, modeInChapter, visibleRegions } from '../../game/journey';
import { FRIENDS } from '../../game/modes/training';
import { getSpecies } from '../../data/species';
import { trainerSpriteUrl } from '../../data/sprites';
import { L } from '../../i18n';
import { on, store } from '../../state/store';
import { $, esc, icon, toast } from '../../ui/dom';
import { navigate } from '../../ui/shell';
import type { ModeModule, ViewModule } from '../types';
import { badgeSVG } from './badges';
import { regionLabel } from './regions';
import { competitionMode } from './competition';
import { gymsMode } from './gyms';
import { huntMode } from './hunt';
import { leagueMode } from './league';
import { raidMode } from './raid';
import { leagueOpen, teamSummaryHTML } from './team';
import { towerOpen, towerMode } from './tower';
import { trainingMode } from './training';

type ModeId = 'training' | 'competition' | 'gyms' | 'hunt' | 'tower' | 'league' | 'raid';

const MODES: Record<ModeId, { module: ModeModule; icon: string; art: string[]; color: string }> = {
  training: { module: trainingMode, icon: 'users', art: ['youngster', 'oak', 'lass'], color: '#4fd18b' },
  competition: { module: competitionMode, icon: 'trophy', art: ['acetrainerf', 'acetrainer'], color: '#5aa9ff' },
  gyms: { module: gymsMode, icon: 'medal', art: ['misty', 'brock', 'whitney'], color: '#f5b84b' },
  hunt: { module: huntMode, icon: 'sparkle', art: ['pokemonrangerf', 'pokemaniac', 'pokemonranger'], color: '#7fdcff' },
  tower: { module: towerMode, icon: 'tower', art: ['veteranf', 'acetrainer', 'veteran'], color: '#ff8a5c' },
  league: { module: leagueMode, icon: 'crown', art: ['karen', 'lance', 'blue'], color: '#c58cff' },
  raid: { module: raidMode, icon: 'bolt', art: ['pokemonranger', 'cynthia', 'veteran'], color: '#ff5c8a' },
};
const ORDER: ModeId[] = ['training', 'competition', 'gyms', 'hunt', 'tower', 'league', 'raid'];

/** A Legendary Battle opens with a title in the League of any region shown here. */
/** Friends of the regions shown here (all of them in Classic and in the World). */
const shownFriends = () => FRIENDS.filter(f => visibleRegions().includes(f.region));

let section: HTMLElement;
let current: ModeId | null = null;
let visible = false;

export const battleView: ViewModule = {
  mount(node) {
    section = node;
    section.classList.add('battle-view');
    section.addEventListener('click', onClick);
    const refresh = () => { if (visible && !current) renderHub(); };
    on('deck', refresh);
    on('cards', refresh);
    on('progress', refresh);
  },
  show(arg) {
    // The ranking started out as a mode here: links to it keep working.
    if (arg === 'online') return void location.replace('#/ranking');
    visible = true;
    const mode = (ORDER as string[]).includes(arg) ? (arg as ModeId) : null;
    // Replace (not push) the locked league's entry, so Back doesn't bounce straight back here.
    if (mode === 'league' && !leagueOpen()) return void location.replace('#/battle');
    if (mode === 'raid' && !anyRaidUnlocked(store.save)) return void location.replace('#/battle');
    // Modes of another chapter are teasers on the hub only.
    if (mode && !modeInChapter(mode)) return void location.replace('#/battle');
    if (mode && mode === current) return;
    leaveMode();
    if (mode) renderMode(mode);
    else renderHub();
  },
  hide() {
    visible = false;
    leaveMode();
  },
};

function leaveMode() {
  if (current) MODES[current].module.dispose?.();
  current = null;
}

function onClick(event: Event) {
  const target = event.target as Element;
  const mode = target.closest<HTMLElement>('[data-mode]');
  if (mode && !current) {
    const id = mode.dataset.mode as ModeId;
    if (!modeInChapter(id)) {
      sfx('error');
      toast(inWorld() ? L().journey.locked.gymsToast : L().journey.locked.worldToast, 'warning');
      return;
    }
    if (id === 'league' && !leagueOpen()) {
      sfx('error');
      toast(L().battle.hub.leagueLocked, 'warning');
      return;
    }
    if (id === 'tower' && !towerOpen()) {
      sfx('error');
      toast(L().battle.hub.towerLocked, 'warning');
      return;
    }
    if (id === 'raid' && !anyRaidUnlocked(store.save)) {
      sfx('error');
      toast(L().battle.hub.raidLocked, 'warning');
      return;
    }
    sfx('open');
    navigate(`battle/${id}`);
  }
  if (target.closest('[data-act="hub"]')) {
    sfx('close');
    navigate('battle');
  }
}

// --- Hub -------------------------------------------------------------------------------

function renderHub() {
  const t = L().battle.hub;
  section.innerHTML = `
    <div class="view-head">
      <div>
        <h1 class="view-title">${esc(t.title)}</h1>
        <p class="view-sub">${esc(t.sub)}</p>
      </div>
    </div>
    ${teamSummaryHTML()}
    <h2 class="section-title">${esc(t.modesTitle)}</h2>
    <div class="mode-grid">${ORDER.map(modeCardHTML).join('')}</div>`;
}

/** A mode's description: in the Journey, Gyms and League talk about the chapter, not every region. */
function modeDesc(id: ModeId): string {
  const j = L().journey.hub;
  if (isJourney() && id === 'gyms') return j.gyms;
  if (isJourney() && id === 'league') return inWorld() ? j.leagueWorld : j.league;
  return L().battle.hub.modes[id].desc;
}

function modeCardHTML(id: ModeId): string {
  const t = L().battle.hub;
  const m = MODES[id];
  const s = store.save;
  const away = !modeInChapter(id);
  const locked = away || (id === 'league' && !leagueOpen()) || (id === 'tower' && !towerOpen()) || (id === 'raid' && !anyRaidUnlocked(s));
  let status = '';
  if (id === 'training') status = `<span class="mode-pill">${icon('users')} ${esc(t.friendsCount(shownFriends().length))}</span>`;
  if (id === 'competition') {
    const rank = playerRank(s);
    status = `<span class="mode-pill">${icon('trophy')} ${esc(rank == null ? t.unranked : t.rank(rank))}</span>`;
  }
  if (id === 'gyms') {
    // One pill per region (open ones, plus the next locked one) and the badge row of the region in progress.
    const shown = REGION_GYMS[currentGymRegion(s.gyms)];
    const here = visibleRegions();
    const regions = GYM_REGIONS.filter((r, i) => here.includes(r) && (i === 0 || here.length === 1 || regionGymsOpen(s.gyms, GYM_REGIONS[i - 1])));
    status = regions.map(r => {
      const open = regionGymsOpen(s.gyms, r);
      return `<span class="mode-pill${open ? '' : ' locked'}">${icon(open ? 'medal' : 'lock')} ${esc(t.regionBadges(regionLabel(r), regionBadges(s.gyms, r)))}</span>`;
    }).join('') + `
      <span class="mode-badges">${shown.map(g => badgeSVG(g.badge, { earned: s.gyms.badges.includes(g.badge), label: false })).join('')}</span>`;
  }
  if (id === 'hunt') {
    const { chain } = s.hunt;
    const target = huntTargetHere(s.hunt);
    status = `<span class="mode-pill">${icon('sparkle')} ${esc(target != null ? t.huntStatus(getSpecies(target).name, chain) : t.huntNone)}</span>`
      + (s.hunt.shinies ? `<span class="mode-pill">${esc(t.huntFound(s.hunt.shinies))}</span>` : '');
  }
  if (id === 'tower') {
    status = locked ? `<span class="mode-pill locked">${icon('lock')} ${esc(t.towerLocked)}</span>`
      : `<span class="mode-pill">${icon('tower')} ${esc(s.tower.best ? t.towerBest(s.tower.best) : t.towerNever)}</span>`;
  }
  if (id === 'league') {
    const best = (region: LeagueRegion) => {
      const league = leagueRecord(s, region);
      return league.best >= 0 ? t.placements[league.best] ?? '' : t.leagueNever;
    };
    // Unlocked leagues, then the next locked one. A region has only its own League; the World, only the Master League.
    const chapter = chapterLeague();
    const leagues = chapter ? LEAGUE_REGIONS.filter(r => r === chapter) : LEAGUE_REGIONS;
    const open = leagues.filter(r => leagueUnlocked(s, r));
    const nextLocked = chapter ? undefined : leagues.find(r => !leagueUnlocked(s, r));
    status = locked ? `<span class="mode-pill locked">${icon('lock')} ${esc(t.leagueLocked)}</span>`
      : open.map(r => `<span class="mode-pill">${icon('crown')} ${esc(t.regionStatus(regionLabel(r), best(r)))}</span>`).join('')
        + (nextLocked ? `<span class="mode-pill locked">${icon('lock')} ${esc(t.regionStatus(regionLabel(nextLocked), t.leagueRegionLocked))}</span>` : '')
        + ((!chapter || chapter === 'master') && leagueUnlocked(s, 'master') ? `<span class="mode-pill">${icon('crown')} ${esc(t.regionStatus(L().modes.league.masterRules.tab, best('master')))}</span>` : '');
  }

  if (id === 'raid') {
    const pool = visibleRegions().filter(r => raidUnlocked(s, r)).flatMap(r => raidPool(r));
    status = locked ? `<span class="mode-pill locked">${icon('lock')} ${esc(t.raidLocked)}</span>`
      : `<span class="mode-pill">${icon('bolt')} ${esc(t.raidCaught(pool.filter(sp => cardKey(sp.id) in s.cards).length, pool.length))}</span>`;
  }

  // A mode of another chapter is a locked teaser saying where it opens.
  if (away) status = `<span class="mode-pill locked">${icon('lock')} ${esc(inWorld() ? L().journey.locked.gymsInRegions : L().journey.locked.world)}</span>`;

  return `
    <button class="mode-card ${locked ? 'locked' : ''}" type="button" data-mode="${id}" style="--mc:${m.color}" ${locked ? 'aria-disabled="true"' : ''}>
      <span class="mode-art" aria-hidden="true">
        <span class="mode-ball"></span>
        ${m.art.map((name, i) => `<img src="${esc(trainerSpriteUrl(name))}" alt="" loading="lazy" draggable="false" style="--i:${i}">`).join('')}
      </span>
      <span class="mode-body">
        <span class="mode-name">${icon(m.icon)} ${esc(t.modes[id].name)}</span>
        <span class="mode-desc">${esc(modeDesc(id))}</span>
        <span class="mode-status">${status}</span>
      </span>
      <span class="mode-go" aria-hidden="true">${icon(locked ? 'lock' : 'right')}</span>
    </button>`;
}

// --- Mode screens --------------------------------------------------------------------

function renderMode(id: ModeId) {
  const t = L().battle.hub;
  current = id;
  section.innerHTML = `
    <div class="mode-screen" data-screen="${id}">
      <nav class="mode-nav">
        <button class="btn btn-ghost btn-sm" type="button" data-act="hub">${icon('left')} ${esc(t.back)}</button>
      </nav>
      <div class="mode-host"></div>
    </div>`;
  MODES[id].module.render($(section, '.mode-host'));
}
