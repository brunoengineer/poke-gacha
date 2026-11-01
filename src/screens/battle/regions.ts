// Kanto / Johto switch shared by the Gyms and League screens: a small tablist; each mode handles the clicks
// (`[data-region]`) and remembers the region it shows.

import { regionName } from '../../data/generations';
import { esc, icon } from '../../ui/dom';

export type Region = 'kanto' | 'johto';
export const REGIONS: Region[] = ['kanto', 'johto'];

export const regionLabel = (region: Region) => regionName(region === 'kanto' ? 1 : 2);

export interface RegionTab {
  region: Region;
  /** Short status under the name (e.g. "3/8"). */
  note: string;
  locked?: boolean;
  done?: boolean;
}

export function regionSwitchHTML(current: Region, tabs: RegionTab[], label: string): string {
  return `
    <div class="region-switch" role="tablist" aria-label="${esc(label)}">
      ${tabs.map(tab => `
        <button class="region-tab region-${tab.region}${tab.locked ? ' is-locked' : ''}${tab.done ? ' is-done' : ''}" type="button" role="tab"
          aria-selected="${tab.region === current}" data-region="${tab.region}">
          ${icon(tab.locked ? 'lock' : tab.done ? 'crown' : 'medal')}
          <b>${esc(regionLabel(tab.region))}</b>
          <small>${esc(tab.note)}</small>
        </button>`).join('')}
    </div>`;
}

/** Region of a clicked tab, if any. */
export const clickedRegion = (event: Event) =>
  (event.target as Element).closest<HTMLElement>('[data-region]')?.dataset.region as Region | undefined;
