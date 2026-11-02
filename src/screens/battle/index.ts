// Battle tab: a hub with the player's team and the modes, routed as #/battle/<mode>.
// Each mode is a ModeModule rendered under a small header with a back button; battles themselves run in
// the full-screen arena (arena.ts), opened by the modes.

import { sfx } from '../../audio';
import { playerRank } from '../../game/modes/competition';
import { currentGymRegion, GYM_REGIONS, REGION_GYMS, regionBadges, regionGymsOpen } from '../../game/modes/gyms';
import { LEAGUE_REGIONS, leagueRecord, leagueUnlocked, type LeagueRegion } from '../../game/modes/league';
import { FRIENDS } from '../../game/modes/training';
import { getSpecies } from '../../data/species';
import { trainerSpriteUrl } from '../../data/sprites';
import { L } from '../../i18n';
import { hasJoinedLeaderboard } from '../../state/leaderboard';
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
import { onlineMode } from './online';
import { leagueOpen, teamSummaryHTML } from './team';
import { towerOpen, towerMode } from './tower';
import { trainingMode } from './training';

type ModeId = 'training' | 'competition' | 'gyms' | 'hunt' | 'tower' | 'league' | 'online';

const MODES: Record<ModeId, { module: ModeModule; icon: string; art: string[]; color: string }> = {
  training: { module: trainingMode, icon: 'users', art: ['youngster', 'oak', 'lass'], color: '#4fd18b' },
  competition: { module: competitionMode, icon: 'trophy', art: ['acetrainerf', 'acetrainer'], color: '#5aa9ff' },
  gyms: { module: gymsMode, icon: 'medal', art: ['misty', 'brock', 'whitney'], color: '#f5b84b' },
  hunt: { module: huntMode, icon: 'sparkle', art: ['pokemonrangerf', 'pokemaniac', 'pokemonranger'], color: '#7fdcff' },
  tower: { module: towerMode, icon: 'tower', art: ['veteranf', 'acetrainer', 'veteran'], color: '#ff8a5c' },
  league: { module: leagueMode, icon: 'crown', art: ['karen', 'lance', 'blue'], color: '#c58cff' },
  online: { module: onlineMode, icon: 'globe', art: ['cynthia', 'steven', 'red'], color: '#ffd166' },
};
const ORDER: ModeId[] = ['training', 'competition', 'gyms', 'hunt', 'tower', 'league', 'online'];

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
    visible = true;
    const mode = (ORDER as string[]).includes(arg) ? (arg as ModeId) : null;
    // Replace (not push) the locked league's entry, so Back doesn't bounce straight back here.
    if (mode === 'league' && !leagueOpen()) return void location.replace('#/battle');
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

function modeCardHTML(id: ModeId): string {
  const t = L().battle.hub;
  const m = MODES[id];
  const s = store.save;
  const locked = (id === 'league' && !leagueOpen()) || (id === 'tower' && !towerOpen());
  let status = '';
  if (id === 'training') status = `<span class="mode-pill">${icon('users')} ${esc(t.friendsCount(FRIENDS.length))}</span>`;
  if (id === 'competition') {
    const rank = playerRank(s);
    status = `<span class="mode-pill">${icon('trophy')} ${esc(rank == null ? t.unranked : t.rank(rank))}</span>`;
  }
  if (id === 'gyms') {
    // One pill per region (open ones, plus the next locked one) and the badge row of the region in progress.
    const shown = REGION_GYMS[currentGymRegion(s.gyms)];
    const regions = GYM_REGIONS.filter((_, i) => i === 0 || regionGymsOpen(s.gyms, GYM_REGIONS[i - 1]));
    status = regions.map(r => {
      const open = regionGymsOpen(s.gyms, r);
      return `<span class="mode-pill${open ? '' : ' locked'}">${icon(open ? 'medal' : 'lock')} ${esc(t.regionBadges(regionLabel(r), regionBadges(s.gyms, r)))}</span>`;
    }).join('') + `
      <span class="mode-badges">${shown.map(g => badgeSVG(g.badge, { earned: s.gyms.badges.includes(g.badge), label: false })).join('')}</span>`;
  }
  if (id === 'hunt') {
    const { target, chain } = s.hunt;
    status = `<span class="mode-pill">${icon('sparkle')} ${esc(target != null ? t.huntStatus(getSpecies(target).name, chain) : t.huntNone)}</span>`
      + (s.hunt.shinies ? `<span class="mode-pill">${esc(t.huntFound(s.hunt.shinies))}</span>` : '');
  }
  if (id === 'online') {
    status = `<span class="mode-pill">${icon('globe')} ${esc(hasJoinedLeaderboard() ? t.onlineJoined(s.online.nickname!) : t.onlineNotJoined)}</span>`;
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
    // Unlocked leagues, then the next locked one.
    const open = LEAGUE_REGIONS.filter(r => leagueUnlocked(s, r));
    const nextLocked = LEAGUE_REGIONS.find(r => !leagueUnlocked(s, r));
    status = locked ? `<span class="mode-pill locked">${icon('lock')} ${esc(t.leagueLocked)}</span>`
      : open.map(r => `<span class="mode-pill">${icon('crown')} ${esc(t.regionStatus(regionLabel(r), best(r)))}</span>`).join('')
        + (nextLocked ? `<span class="mode-pill locked">${icon('lock')} ${esc(t.regionStatus(regionLabel(nextLocked), t.leagueRegionLocked))}</span>` : '');
  }

  return `
    <button class="mode-card ${locked ? 'locked' : ''}" type="button" data-mode="${id}" style="--mc:${m.color}" ${locked ? 'aria-disabled="true"' : ''}>
      <span class="mode-art" aria-hidden="true">
        <span class="mode-ball"></span>
        ${m.art.map((name, i) => `<img src="${esc(trainerSpriteUrl(name))}" alt="" loading="lazy" draggable="false" style="--i:${i}">`).join('')}
      </span>
      <span class="mode-body">
        <span class="mode-name">${icon(m.icon)} ${esc(t.modes[id].name)}</span>
        <span class="mode-desc">${esc(t.modes[id].desc)}</span>
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
