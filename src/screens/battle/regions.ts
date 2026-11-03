// Region switch (Kanto, Johto, Hoenn, Sinnoh) shared by the Gyms and League screens: a small tablist; each mode handles the clicks
// (`[data-region]`) and remembers the region it shows.

import { regionName } from '../../data/generations';
import { WORLD, type ChapterId } from '../../game/journey';
import { REGION_IDS, regionGeneration, type RegionId } from '../../game/regions';
import { L } from '../../i18n';
import { esc, icon } from '../../ui/dom';

export type Region = RegionId;
export const REGIONS: Region[] = REGION_IDS;

export const regionLabel = (region: Region) => regionName(regionGeneration(region));

/** Name of a Journey chapter: its region's, or the World. */
export const chapterLabel = (chapter: ChapterId) => (chapter === WORLD ? L().journey.world : regionLabel(chapter));

export interface RegionTab {
  /** A region, or a league that isn't one (it then brings its own `label`). */
  region: Region | 'master';
  label?: string;
  /** Short status under the name (e.g. "3/8"). */
  note: string;
  locked?: boolean;
  done?: boolean;
}

export function regionSwitchHTML(current: RegionTab['region'], tabs: RegionTab[], label: string): string {
  return `
    <div class="region-switch" role="tablist" aria-label="${esc(label)}">
      ${tabs.map(tab => `
        <button class="region-tab region-${tab.region}${tab.locked ? ' is-locked' : ''}${tab.done ? ' is-done' : ''}" type="button" role="tab"
          aria-selected="${tab.region === current}" data-region="${tab.region}">
          ${icon(tab.locked ? 'lock' : tab.done ? 'crown' : 'medal')}
          <b>${esc(tab.label ?? regionLabel(tab.region as Region))}</b>
          <small>${esc(tab.note)}</small>
        </button>`).join('')}
    </div>`;
}

/** Region of a clicked tab, if any. */
export const clickedRegion = (event: Event) =>
  (event.target as Element).closest<HTMLElement>('[data-region]')?.dataset.region as Region | undefined;
