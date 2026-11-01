// Battle tab: a hub with the player's team and the four modes, routed as #/battle/<mode>.
// Each mode is a ModeModule rendered under a small header with a back button; battles themselves run in
// the full-screen arena (arena.ts), opened by the modes.

import { sfx } from '../../audio';
import { playerRank } from '../../game/modes/competition';
import { johtoGymsOpen, REGION_GYMS, regionBadges } from '../../game/modes/gyms';
import { leagueRecord, leagueUnlocked, type LeagueRegion } from '../../game/modes/league';
import { FRIENDS } from '../../game/modes/training';
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
import { leagueMode } from './league';
import { leagueOpen, teamSummaryHTML } from './team';
import { trainingMode } from './training';

type ModeId = 'training' | 'competition' | 'gyms' | 'league';

const MODES: Record<ModeId, { module: ModeModule; icon: string; art: string[]; color: string }> = {
  training: { module: trainingMode, icon: 'users', art: ['youngster', 'oak', 'lass'], color: '#4fd18b' },
  competition: { module: competitionMode, icon: 'trophy', art: ['acetrainerf', 'acetrainer'], color: '#5aa9ff' },
  gyms: { module: gymsMode, icon: 'medal', art: ['misty', 'brock', 'whitney'], color: '#f5b84b' },
  league: { module: leagueMode, icon: 'crown', art: ['karen', 'lance', 'blue'], color: '#c58cff' },
};
const ORDER: ModeId[] = ['training', 'competition', 'gyms', 'league'];

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
  const locked = id === 'league' && !leagueOpen();
  let status = '';
  if (id === 'training') status = `<span class="mode-pill">${icon('users')} ${esc(t.friendsCount(FRIENDS.length))}</span>`;
  if (id === 'competition') {
    const rank = playerRank(s);
    status = `<span class="mode-pill">${icon('trophy')} ${esc(rank == null ? t.unranked : t.rank(rank))}</span>`;
  }
  if (id === 'gyms') {
    // Badge row of the region in progress: Kanto until its gyms are done, then Johto.
    const johtoOpen = johtoGymsOpen(s.gyms);
    const shown = REGION_GYMS[johtoOpen ? 'johto' : 'kanto'];
    status = `
      <span class="mode-pill">${icon('medal')} ${esc(t.regionBadges(regionLabel('kanto'), regionBadges(s.gyms, 'kanto')))}</span>
      <span class="mode-pill${johtoOpen ? '' : ' locked'}">${icon(johtoOpen ? 'medal' : 'lock')} ${esc(t.regionBadges(regionLabel('johto'), regionBadges(s.gyms, 'johto')))}</span>
      <span class="mode-badges">${shown.map(g => badgeSVG(g.badge, { earned: s.gyms.badges.includes(g.badge), label: false })).join('')}</span>`;
  }
  if (id === 'league') {
    const best = (region: LeagueRegion) => {
      const league = leagueRecord(s, region);
      return league.best >= 0 ? t.placements[league.best] ?? '' : t.leagueNever;
    };
    const johto = leagueUnlocked(s, 'johto')
      ? `<span class="mode-pill">${icon('crown')} ${esc(t.regionStatus(regionLabel('johto'), best('johto')))}</span>`
      : `<span class="mode-pill locked">${icon('lock')} ${esc(t.regionStatus(regionLabel('johto'), t.johtoLocked))}</span>`;
    status = locked ? `<span class="mode-pill locked">${icon('lock')} ${esc(t.leagueLocked)}</span>`
      : `<span class="mode-pill">${icon('crown')} ${esc(t.regionStatus(regionLabel('kanto'), best('kanto')))}</span>${johto}`;
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
