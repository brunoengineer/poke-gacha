// Journey map (#/journey, Region Journey only): the chapters in story order along a path, with what each one is (here,
// cleared, in progress, ready, locked) and how to get there. Traveling restarts the app in the chosen chapter
// (travelTo in src/state/store.ts). Chapters come from CHAPTERS, so a new region shows up here on its own.

import { sfx } from '../audio';
import { GENERATIONS } from '../data/generations';
import { speciesList } from '../data/species';
import { trainerSpriteUrl } from '../data/sprites';
import { CHAPTERS, WORLD, activeChapter, chapterCleared, chapterOpen, leagueRunBlocksTravel, type ChapterId } from '../game/journey';
import { REGION_GYMS, regionBadges } from '../game/modes/gyms';
import { leagueRecord } from '../game/modes/league';
import { regionGeneration } from '../game/regions';
import { L } from '../i18n';
import { on, store, travelTo } from '../state/store';
import { spriteImg } from '../ui/card';
import { esc, icon, toast } from '../ui/dom';
import { chapterLabel } from './battle/regions';
import type { ViewModule } from './types';

type Status = 'here' | 'cleared' | 'progress' | 'ready' | 'locked';

let root: HTMLElement | null = null;
let visible = false;
/** The chapter being traveled to: a second click meanwhile does nothing. */
let traveling: ChapterId | null = null;

const t = () => L().journey.map;

export const journeyView: ViewModule = {
  mount(section) {
    root = section;
    section.addEventListener('click', onClick);
    for (const event of ['progress', 'cards'] as const) on(event, () => visible && render());
  },
  show() {
    visible = true;
    render();
  },
  hide() {
    visible = false;
  },
};

/** The starter shown for a chapter: the live one for the chapter being played, the stored one for the others. */
function starterOf(chapter: ChapterId): number | null {
  const save = store.save;
  return chapter === activeChapter() ? save.starter : save.journey?.slots[chapter]?.starter ?? null;
}

function statusOf(chapter: ChapterId): Status {
  const save = store.save;
  if (chapter === activeChapter()) return 'here';
  if (!chapterOpen(save, chapter)) return 'locked';
  if (chapterCleared(save, chapter)) return 'cleared';
  return save.journey?.slots[chapter] || starterOf(chapter) != null ? 'progress' : 'ready';
}

/** Caught species of a chapter's Pokédex, and how many it has. */
function dexOf(chapter: ChapterId): [number, number] {
  const caught = Object.keys(store.save.caught).map(Number);
  if (chapter === WORLD) return [caught.length, speciesList.length];
  const range = GENERATIONS.find(g => g.id === regionGeneration(chapter))?.range;
  if (!range) return [0, 0];
  return [caught.filter(id => id >= range[0] && id <= range[1]).length, range[1] - range[0] + 1];
}

const titlesOf = (chapter: ChapterId) => leagueRecord(store.save, chapter === WORLD ? 'master' : chapter).titles;

function statusLabel(status: Status, chapter: ChapterId) {
  const m = t();
  if (status === 'locked') return m.lockedBy(chapterLabel(CHAPTERS[CHAPTERS.indexOf(chapter) - 1]));
  return { here: m.here, cleared: m.cleared, progress: m.inProgress, ready: m.notStarted }[status];
}

const STATUS_ICON: Record<Status, string> = { here: 'flag', cleared: 'crown', progress: 'sparkle', ready: 'sparkle', locked: 'lock' };

function artHTML(chapter: ChapterId, status: Status) {
  if (chapter === WORLD) return `<img class="jc-ash" src="${esc(trainerSpriteUrl('ash'))}" alt="" width="80" height="80" loading="lazy" decoding="async" draggable="false">`;
  const starter = starterOf(chapter);
  if (starter != null && status !== 'locked') return spriteImg(starter, false, { alt: t().starter });
  return icon(status === 'locked' ? 'lock' : 'medal', 'jc-art-icon');
}

function statsHTML(chapter: ChapterId, status: Status) {
  const m = t();
  if (status === 'locked') return '';
  const [caught, total] = dexOf(chapter);
  const items = [`${icon('cards')} ${esc(m.dex(caught, total))}`];
  if (chapter !== WORLD) items.unshift(`${icon('medal')} ${esc(m.badges(regionBadges(store.save.gyms, chapter), REGION_GYMS[chapter].length))}`);
  const titles = titlesOf(chapter);
  if (titles) items.push(`${icon('crown')} ${esc(m.titles(titles))}`);
  return `<ul class="jc-stats">${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
}

function actionHTML(chapter: ChapterId, status: Status) {
  if (status === 'here' || status === 'locked') return '';
  const name = chapterLabel(chapter);
  const busy = traveling === chapter;
  const label = busy ? t().traveling(name) : status === 'ready' ? t().start(name) : t().travel(name);
  return `<button class="btn btn-primary jc-go" type="button" data-travel="${chapter}"${traveling || leagueRunBlocksTravel(store.save) ? ' disabled' : ''}${busy ? ' aria-busy="true"' : ''}>${icon('globe')} ${esc(label)}</button>`;
}

function cardHTML(chapter: ChapterId, index: number) {
  const status = statusOf(chapter);
  const world = chapter === WORLD;
  const teaser = world ? `
          <p class="jc-desc">${esc(t().worldDesc)}</p>
          <ul class="jc-unlocks">${t().worldUnlocks.map(item => `<li>${icon(status === 'locked' ? 'lock' : 'check')} ${esc(item)}</li>`).join('')}</ul>` : '';
  return `
    <li class="jc-step">
      <article class="jc-card jc-${chapter}${world ? ' is-world' : ''} is-${status}" data-chapter="${chapter}" data-status="${status}"${status === 'here' ? ' aria-current="step"' : ''}>
        <span class="jc-art">${artHTML(chapter, status)}</span>
        <div class="jc-body">
          <h2 class="jc-name"><span class="jc-num" aria-hidden="true">${index + 1}</span>${esc(chapterLabel(chapter))}</h2>
          <p class="jc-status">${icon(STATUS_ICON[status])} ${esc(statusLabel(status, chapter))}</p>${teaser}
          ${statsHTML(chapter, status)}
        </div>
        ${actionHTML(chapter, status)}
      </article>
    </li>`;
}

function render() {
  if (!root) return;
  const m = t();
  root.innerHTML = `
    <div class="mode journey-map">
      <div class="view-head">
        <div>
          <h1 class="view-title">${esc(m.title)}</h1>
          <p class="view-sub">${esc(m.sub)}</p>
        </div>
      </div>
      ${leagueRunBlocksTravel(store.save) ? `<p class="jc-blocked" role="status">${icon('crown')} ${esc(m.runBlocked)}</p>` : ''}
      <ol class="jc-path" aria-label="${esc(m.label)}">${CHAPTERS.map(cardHTML).join('')}</ol>
      <p class="jc-foot">${icon('coin')} ${esc(m.shared)}</p>
    </div>`;
}

async function onClick(event: Event) {
  const button = (event.target as Element).closest<HTMLElement>('[data-travel]');
  if (!button || traveling) return;
  const chapter = button.dataset.travel as ChapterId;
  traveling = chapter;
  sfx('click');
  render();
  let went = false;
  try {
    went = await travelTo(chapter);
  } catch (error) {
    console.warn('Travel failed', error);
  }
  // Going there reloads the page: only a failure comes back here.
  if (!went) {
    traveling = null;
    toast(t().failed, 'error');
    render();
  }
}
