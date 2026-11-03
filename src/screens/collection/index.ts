// Collection screen (#/collection): the Pokédex grid with search, filters (region included) and sort, per-region
// progress, plus the team dock.
// Grid tiles live in grid.ts, the dock in dock.ts, the card details modal in details.ts.

import { sfx } from '../../audio';
import { GENERATIONS, regionName } from '../../data/generations';
import { hasSpecies } from '../../data/species';
import { TYPES, type PokemonType } from '../../data/types';
import { parseKey, RARITIES, type CardKey, type Rarity } from '../../game/cards';
import { activeRegion, playerCanUse } from '../../game/journey';
import { fmt, L } from '../../i18n';
import { on, store } from '../../state/store';
import { trackLocalKey } from '../../state/track';
import { bindTiltGroup, rarityPips } from '../../ui/card';
import { draggable } from '../../ui/dnd';
import { esc, icon } from '../../ui/dom';
import { regionLabel } from '../battle/regions';
import type { ViewModule } from '../types';
import { openDetails } from './details';
import { initDock, setDockVisible } from './dock';
import { openAutoPass, syncAutoPass } from './auto-pass';
import { evolveFlow } from './evolution';
import { applyFilters, counts, mountGrid, normalize, updateFlags, updateTiles, type Filters, type Mode, type SortId } from './grid';
import { toggleTeam } from './team';

const FILTERS_KEY = () => trackLocalKey('pg-collection-filters');
const MODES: Mode[] = ['all', 'owned', 'missing', 'evolve', 'shiny'];
const SORTS: SortId[] = ['dex', 'name', 'level', 'power', 'rarity', 'recent'];

const filters: Filters = { mode: 'all', region: 0, type: '', rarities: [], sort: 'dex', query: '' };
let view: HTMLElement;
let gridEl: HTMLElement;
let visibleKeys: CardKey[] = [];
let lastPointer = 'mouse';
let dirty = false;
/** Region filter saved in Classic or the World, kept untouched while a region chapter ignores it. */
let savedRegion = 0;
/** Whether the region dropdown and progress chips exist: not in a region chapter, where the Pokédex is that one region. */
const regionFilters = () => GENERATIONS.length > 1 && !activeRegion();

export const collectionView: ViewModule = {
  mount(section) {
    view = section;
    loadFilters();
    render();
    initDock();
    on('cards', keys => {
      updateTiles(Array.isArray(keys) ? (keys as CardKey[]) : undefined);
      refresh(true);
    });
    on('deck', () => {
      updateFlags();
      refresh(filters.mode === 'evolve');
    });
    on('items', () => {
      updateFlags();
      refresh(filters.mode === 'evolve');
    });
  },
  show(arg) {
    setDockVisible(true);
    if (dirty) refresh(true);
    // #/collection/25 (or 25s) opens that card's details.
    if (/^\d+s?$/.test(arg) && hasSpecies(parseKey(arg).id) && playerCanUse(parseKey(arg).id)) {
      history.replaceState(null, '', '#/collection');
      openDetails(arg, visibleKeys);
    }
  },
  hide() {
    setDockVisible(false);
  },
};

function render() {
  const t = L().collection;
  view.innerHTML = `
    <div class="view-head dex-head">
      <div>
        <h1 class="view-title">${esc(t.title)}</h1>
        <p class="view-sub" data-stats></p>
      </div>
      <div class="dex-progress" data-progress-box>
        <div class="dex-progress-label"><span data-region-name></span><b data-progress-count></b></div>
        <div class="progress" role="progressbar" aria-valuemin="0" data-progressbar><i data-progress></i></div>
        ${regionFilters() ? `
          <div class="dex-regions" role="group" aria-label="${esc(t.regionProgress)}">
            ${GENERATIONS.map(g => `
              <button type="button" class="dex-region" data-region-pick="${g.id}" aria-pressed="false">
                <span>${esc(g.region)}</span><b data-region-count></b><i aria-hidden="true"><i data-region-bar></i></i>
              </button>`).join('')}
          </div>` : ''}
      </div>
    </div>
    <div class="dex-onboard" data-onboarding hidden>
      <span class="dex-onboard-ball">${icon('ball-color')}</span>
      <div>
        <strong>${esc(t.onboard.title)}</strong>
        <p>${esc(t.onboard.text)}</p>
      </div>
      <a class="btn btn-red" href="#/capture">${icon('ball')} ${esc(t.onboard.cta)}</a>
    </div>
    <div class="dex-toolbar">
      <label class="dex-search">
        ${icon('search')}
        <input type="search" placeholder="${esc(t.search)}" aria-label="${esc(t.search)}" data-search autocomplete="off" spellcheck="false">
      </label>
      <div class="dex-seg" role="group" aria-label="${esc(t.filterLabel)}">
        ${MODES.map(m => `<button type="button" class="seg" data-mode="${m}" aria-pressed="false">${m === 'shiny' ? icon('star') : ''}${esc(t.modes[m])}${m === 'evolve' || m === 'shiny' ? ' <span class="count" data-count="' + m + '"></span>' : ''}</button>`).join('')}
      </div>
      <div class="dex-rarity" role="group" aria-label="${esc(t.rarityLabel)}">
        ${RARITIES.map(r => `<button type="button" class="rarity-chip" data-rarity-filter="${r}" data-rarity="${r}" aria-pressed="false" title="${esc(L().core.rarity[r])}" aria-label="${esc(L().core.rarity[r])}">${rarityPips(r, 'chip-pips')}</button>`).join('')}
      </div>
      <div class="dex-selects">
        ${regionFilters() ? `
          <label class="select"><span class="sr-only">${esc(t.regionLabel)}</span>
            <select data-region>
              <option value="0">${esc(t.allRegions)}</option>
              ${GENERATIONS.map(g => `<option value="${g.id}">${esc(g.region)}</option>`).join('')}
            </select>
          </label>` : ''}
        <label class="select"><span class="sr-only">${esc(t.typeLabel)}</span>
          <select data-type-filter>
            <option value="">${esc(t.allTypes)}</option>
            ${TYPES.map(type => `<option value="${type}">${esc(L().core.types[type])}</option>`).join('')}
          </select>
        </label>
        <label class="select"><span class="sr-only">${esc(t.sortLabel)}</span>
          <select data-sort>${SORTS.map(id => `<option value="${id}">${esc(t.sortBy(t.sorts[id]))}</option>`).join('')}</select>
        </label>
      </div>
    </div>
    <div class="dex-autopass" data-autopass hidden>
      <span class="dex-autopass-icon">${icon('up')}</span>
      <p data-autopass-text></p>
      <button class="btn btn-evolve btn-sm" type="button" data-autopass-open>${icon('up')} ${esc(t.autoPass.button)}</button>
    </div>
    <div class="dex-active" data-active hidden></div>
    <div class="dex-grid" data-grid></div>
    <div class="empty dex-empty" data-empty hidden>
      <p>${esc(t.empty)}</p>
      <button class="btn btn-ghost btn-sm" type="button" data-clear-filters>${icon('reset')} ${esc(t.clearFilters)}</button>
    </div>
    <p class="tip">${icon('sparkle')} ${esc(t.tip)}</p>`;

  gridEl = view.querySelector('[data-grid]')!;
  mountGrid(gridEl);
  bindToolbar();
  bindGrid();
  syncControls();
  refresh(true);
}

function bindToolbar() {
  const search = view.querySelector<HTMLInputElement>('[data-search]')!;
  let timer = 0;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      filters.query = normalize(search.value.trim());
      refresh(true);
    }, 120);
  });

  view.querySelector('.dex-seg')!.addEventListener('click', event => {
    const mode = (event.target as Element).closest<HTMLElement>('[data-mode]')?.dataset.mode as Mode | undefined;
    if (!mode) return;
    filters.mode = mode;
    sfx('toggle');
    refresh(true);
  });

  view.querySelector('.dex-rarity')!.addEventListener('click', event => {
    const r = (event.target as Element).closest<HTMLElement>('[data-rarity-filter]')?.dataset.rarityFilter as Rarity | undefined;
    if (!r) return;
    filters.rarities = filters.rarities.includes(r) ? filters.rarities.filter(x => x !== r) : [...filters.rarities, r];
    sfx('toggle');
    refresh(true);
  });

  const type = view.querySelector<HTMLSelectElement>('[data-type-filter]')!;
  const sort = view.querySelector<HTMLSelectElement>('[data-sort]')!;
  const region = view.querySelector<HTMLSelectElement>('[data-region]');
  type.addEventListener('change', () => { filters.type = type.value as PokemonType | ''; refresh(true); });
  sort.addEventListener('change', () => { filters.sort = sort.value as SortId; refresh(true); });
  region?.addEventListener('change', () => { filters.region = Number(region.value); refresh(true); });

  // Region progress chips double as a quick region filter (pressing the active one goes back to every region).
  view.querySelector('.dex-regions')?.addEventListener('click', event => {
    const chip = (event.target as Element).closest<HTMLElement>('[data-region-pick]');
    if (!chip) return;
    const id = Number(chip.dataset.regionPick);
    filters.region = filters.region === id ? 0 : id;
    sfx('toggle');
    syncControls();
    refresh(true);
  });

  view.querySelector('[data-autopass-open]')!.addEventListener('click', openAutoPass);

  view.querySelector('[data-clear-filters]')!.addEventListener('click', () => {
    Object.assign(filters, { mode: 'all', region: 0, type: '', rarities: [], query: '' });
    search.value = '';
    syncControls();
    refresh(true);
  });
}

function bindGrid() {
  gridEl.addEventListener('pointerdown', event => { lastPointer = event.pointerType; });

  gridEl.addEventListener('click', event => {
    const tile = (event.target as Element).closest<HTMLElement>('.dex-tile');
    if (!tile) return;
    if ((event.target as Element).closest('.dex-evolve')) {
      void evolveFlow(tile.dataset.key!);
      return;
    }
    sfx('open');
    openDetails(tile.dataset.key!, visibleKeys);
  });

  gridEl.addEventListener('keydown', event => {
    const tile = (event.target as Element).closest<HTMLElement>('.dex-tile');
    if (!tile || event.target !== tile) return;
    const key = tile.dataset.key!;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      sfx('open');
      openDetails(key, visibleKeys);
    } else if ((event.key === 't' || event.key === 'T') && key in store.save.cards) {
      toggleTeam(key, { notify: true });
    } else if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      moveFocus(tile, event.key);
    }
  });

  // Right click: quick add/remove (on touch, a long press starts a drag instead).
  gridEl.addEventListener('contextmenu', event => {
    const tile = (event.target as Element).closest<HTMLElement>('.dex-tile');
    if (!tile) return;
    event.preventDefault();
    if (lastPointer === 'touch' || !(tile.dataset.key! in store.save.cards)) return;
    toggleTeam(tile.dataset.key!, { notify: true });
  });

  draggable(gridEl, '.dex-tile[data-state="owned"]', tile => ({ type: 'card', key: tile.dataset.key! }));
  bindTiltGroup(gridEl, { selector: '.dex-tile[data-state="owned"] .pcard' });
}

/** Arrow-key navigation between visible tiles. */
function moveFocus(tile: HTMLElement, key: string) {
  const items = [...gridEl.children] as HTMLElement[];
  const columns = getComputedStyle(gridEl).gridTemplateColumns.split(' ').length || 1;
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[key] ?? 0;
  const next = items[items.indexOf(tile) + step];
  next?.focus();
  next?.scrollIntoView({ block: 'nearest' });
}

function syncControls() {
  const type = view.querySelector<HTMLSelectElement>('[data-type-filter]')!;
  const sort = view.querySelector<HTMLSelectElement>('[data-sort]')!;
  const region = view.querySelector<HTMLSelectElement>('[data-region]');
  type.value = filters.type;
  sort.value = filters.sort;
  if (region) region.value = String(filters.region);
}

/** Updates counters; with `regrid`, re-applies filters and sort (deferred to the next show while hidden). */
function refresh(regrid: boolean) {
  if (!view) return;
  if (view.hidden) {
    // Counters (e.g. "Evolve" after buying a stone) are stale too, so any change refreshes on show.
    dirty = true;
    return;
  }
  const t = L().collection;
  if (regrid) {
    dirty = false;
    visibleKeys = applyFilters(filters);
    view.querySelector<HTMLElement>('[data-empty]')!.hidden = visibleKeys.length > 0;
    saveFilters();
  }

  view.querySelectorAll<HTMLElement>('[data-mode]').forEach(button => {
    const active = button.dataset.mode === filters.mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  view.querySelectorAll<HTMLElement>('[data-rarity-filter]').forEach(chip => {
    const pressed = filters.rarities.includes(chip.dataset.rarityFilter as Rarity);
    chip.classList.toggle('active', pressed);
    chip.setAttribute('aria-pressed', String(pressed));
  });

  const c = counts(filters.region);
  const region = GENERATIONS.find(g => g.id === filters.region);
  view.querySelector('[data-stats]')!.innerHTML = t.stats(fmt(c.caught), fmt(c.total), fmt(c.shinies));
  const fixed = activeRegion();
  view.querySelector('[data-region-name]')!.textContent = fixed
    ? L().journey.collection.regionDex(regionLabel(fixed))
    : region ? region.region : GENERATIONS.length > 1 ? t.allRegions : GENERATIONS[0].region;
  view.querySelector('[data-progress-count]')!.textContent = `${Math.round((c.caught / Math.max(1, c.total)) * 100)}%`;
  const bar = view.querySelector<HTMLElement>('[data-progressbar]')!;
  bar.setAttribute('aria-valuemax', String(c.total));
  bar.setAttribute('aria-valuenow', String(c.caught));
  bar.setAttribute('aria-label', t.caughtLabel);
  view.querySelector<HTMLElement>('[data-progress]')!.style.width = `${(c.caught / Math.max(1, c.total)) * 100}%`;
  view.querySelectorAll<HTMLElement>('[data-region-pick]').forEach(chip => {
    const id = Number(chip.dataset.regionPick);
    const rc = id === filters.region ? c : counts(id);
    chip.setAttribute('aria-pressed', String(id === filters.region));
    chip.setAttribute('aria-label', t.regionCaught(regionName(id), fmt(rc.caught), fmt(rc.total)));
    chip.querySelector('[data-region-count]')!.textContent = `${fmt(rc.caught)}/${fmt(rc.total)}`;
    chip.querySelector<HTMLElement>('[data-region-bar]')!.style.width = `${(rc.caught / Math.max(1, rc.total)) * 100}%`;
  });
  view.querySelector<HTMLElement>('[data-onboarding]')!.hidden = c.cards > 0;
  view.querySelector('[data-count="evolve"]')!.textContent = c.evolvable ? fmt(c.evolvable) : '';
  view.querySelector('[data-count="shiny"]')!.textContent = c.shinies ? fmt(c.shinies) : '';
  syncAutoPass(view.querySelector<HTMLElement>('[data-autopass]')!);

  const active = view.querySelector<HTMLElement>('[data-active]')!;
  active.hidden = !regrid && active.hidden;
  if (regrid) {
    const shown = visibleKeys.length;
    const filtered = filters.mode !== 'all' || filters.type || filters.rarities.length || filters.query || filters.region;
    active.hidden = !filtered;
    active.textContent = t.showing(fmt(shown));
  }
}

function loadFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem(FILTERS_KEY()) ?? '{}') as Partial<Filters>;
    if (MODES.includes(saved.mode as Mode)) filters.mode = saved.mode!;
    if (SORTS.includes(saved.sort as SortId)) filters.sort = saved.sort!;
    if (TYPES.includes(saved.type as PokemonType)) filters.type = saved.type!;
    if (Array.isArray(saved.rarities)) filters.rarities = saved.rarities.filter(r => RARITIES.includes(r));
    if (GENERATIONS.some(g => g.id === saved.region)) savedRegion = saved.region!;
    if (!activeRegion()) filters.region = savedRegion;
  } catch { /* defaults */ }
}

function saveFilters() {
  try {
    const { query, ...persisted } = filters;
    void query;
    if (activeRegion()) persisted.region = savedRegion;
    localStorage.setItem(FILTERS_KEY(), JSON.stringify(persisted));
  } catch { /* storage blocked */ }
}
