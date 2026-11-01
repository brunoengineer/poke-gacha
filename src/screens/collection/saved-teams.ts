// Saved teams UI: the "Teams" panel (opened from the Collection dock and every Battle team strip) and the one-click
// chips on the Battle hub. Any element with [data-open-teams] opens the panel; [data-load-team="<id>"] loads a preset.
// Rules (evolution, missing cards) live in src/game/saved-teams.ts.

import { sfx } from '../../audio';
import { spriteUrl } from '../../data/sprites';
import { parseKey } from '../../game/cards';
import { DECK_SIZE } from '../../game/economy';
import { activeSavedTeam, MAX_SAVED_TEAMS, resolveTeam, TEAM_NAME_MAX, type SavedTeam } from '../../game/saved-teams';
import { L } from '../../i18n';
import { deleteTeam, loadTeam, overwriteTeam, renameTeam, saveTeam } from '../../state/actions';
import { on, store } from '../../state/store';
import { confirmDialog, esc, icon, openModal, toast } from '../../ui/dom';

const s = () => store.save;

/** Loads a preset into the team, with feedback. Returns true when it loaded. */
export function applySavedTeam(id: string): boolean {
  const t = L().collection.savedTeams;
  const team = s().teams.find(x => x.id === id);
  if (!team) return false;
  if (activeSavedTeam(s())?.id === id) {
    toast(t.alreadyInUse(team.name));
    return true;
  }
  const result = loadTeam(id);
  if (!result) {
    sfx('error');
    toast(t.nothingLeft(team.name), 'warning');
    return false;
  }
  sfx('deckAdd');
  const short = s().deck.length < DECK_SIZE;
  toast(result.missing ? t.loadedMissing(team.name, result.missing) : short ? t.loadedShort(team.name, s().deck.length) : t.loaded(team.name),
    result.missing || short ? 'warning' : 'success');
  return true;
}

/** One-click chips for the Battle hub's team strip (empty when nothing is saved). */
export function savedTeamChipsHTML(): string {
  const teams = s().teams;
  if (!teams.length) return '';
  const active = activeSavedTeam(s())?.id;
  return `
    <div class="st-chips" role="group" aria-label="${esc(L().collection.savedTeams.title)}">
      ${teams.map(team => `
        <button class="st-chip ${team.id === active ? 'is-active' : ''}" type="button" data-load-team="${esc(team.id)}"
          ${team.id === active ? 'aria-pressed="true"' : 'aria-pressed="false"'}>
          ${team.id === active ? icon('check') : ''}${esc(team.name)}
        </button>`).join('')}
    </div>`;
}

const minis = (keys: string[]) => Array.from({ length: DECK_SIZE }, (_, i) => {
  const key = keys[i];
  if (!key) return '<span class="st-mon empty"></span>';
  const { id, shiny } = parseKey(key);
  return `<span class="st-mon ${shiny ? 'shiny' : ''}"><img src="${esc(spriteUrl(id, shiny))}" alt="" loading="lazy" draggable="false"></span>`;
}).join('');

function rowHTML(team: SavedTeam, activeId: string | undefined): string {
  const t = L().collection.savedTeams;
  const { keys, missing } = resolveTeam(s(), team);
  const active = team.id === activeId;
  return `
    <li class="st-row ${active ? 'is-active' : ''}" data-team="${esc(team.id)}">
      <input class="st-name" type="text" value="${esc(team.name)}" maxlength="${TEAM_NAME_MAX}" aria-label="${esc(t.rename)}" spellcheck="false">
      <button class="st-mons" type="button" data-act="load" aria-label="${esc(t.loadNamed(team.name))}">${minis(keys)}</button>
      <div class="st-actions">
        <button class="btn ${active ? 'btn-ghost' : 'btn-primary'} btn-sm" type="button" data-act="load" ${active ? 'disabled' : ''}>
          ${icon(active ? 'check' : 'right')} ${esc(active ? t.inUse : t.load)}</button>
        <button class="btn btn-ghost btn-sm st-icon" type="button" data-act="overwrite" title="${esc(t.overwrite)}" aria-label="${esc(t.overwrite)}"
          ${s().deck.length ? '' : 'disabled'}>${icon('reset')}</button>
        <button class="btn btn-ghost btn-sm st-icon" type="button" data-act="delete" title="${esc(t.delete)}" aria-label="${esc(t.delete)}">${icon('trash')}</button>
      </div>
      ${missing ? `<small class="st-note">${icon('flag')} ${esc(t.missing(missing))}</small>` : ''}
    </li>`;
}

/** Opens the saved teams panel. */
export function openSavedTeams() {
  const t = L().collection.savedTeams;
  sfx('open');
  let off = () => {};
  const modal = openModal({
    className: 'modal-dialog modal-teams',
    label: t.title,
    onClose: () => off(),
    html: `
      <button class="modal-x" type="button" data-close aria-label="${esc(L().core.actions.close)}">${icon('x')}</button>
      <h2 class="dialog-title">${icon('layers')} ${esc(t.title)}</h2>
      <p class="dialog-text">${esc(t.sub(MAX_SAVED_TEAMS))}</p>
      <div class="st-body"></div>`,
  });
  const body = modal.root.querySelector<HTMLElement>('.st-body')!;

  const render = () => {
    const teams = s().teams;
    const activeId = activeSavedTeam(s())?.id;
    const full = teams.length >= MAX_SAVED_TEAMS;
    body.innerHTML = `
      <div class="st-save">
        <span class="st-current">${minis(s().deck)}</span>
        <button class="btn btn-secondary" type="button" data-act="save" ${!s().deck.length || full ? 'disabled' : ''}>${icon('plus')} ${esc(t.save)}</button>
      </div>
      ${full ? `<p class="hint">${esc(t.full(MAX_SAVED_TEAMS))}</p>` : !s().deck.length ? `<p class="hint">${esc(t.emptyDeck)}</p>` : ''}
      ${teams.length ? `<ol class="st-list">${teams.map(team => rowHTML(team, activeId)).join('')}</ol>`
        : `<p class="st-empty">${esc(t.none)}</p>`}`;
  };
  off = on('deck', render);
  render();

  body.addEventListener('click', async event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-act]');
    if (!button || button.disabled) return;
    const id = button.closest<HTMLElement>('[data-team]')?.dataset.team;
    switch (button.dataset.act) {
      case 'save': {
        const team = saveTeam(t.defaultName(s().teams.length + 1));
        if (team) {
          sfx('deckAdd');
          toast(t.saved(team.name), 'success');
          // Focus the new name so it can be typed right away.
          body.querySelector<HTMLInputElement>(`[data-team="${team.id}"] .st-name`)?.select();
        }
        return;
      }
      case 'load':
        if (id && applySavedTeam(id)) modal.close();
        return;
      case 'overwrite': {
        const team = s().teams.find(x => x.id === id);
        if (team && overwriteTeam(team.id)) {
          sfx('deckAdd');
          toast(t.overwritten(team.name), 'success');
        }
        return;
      }
      case 'delete': {
        const team = s().teams.find(x => x.id === id);
        if (!team) return;
        const ok = await confirmDialog({ title: t.deleteTitle, message: t.deleteText(team.name), confirmText: t.delete, danger: true });
        if (ok && deleteTeam(team.id)) sfx('deckRemove');
        return;
      }
    }
  });
  body.addEventListener('change', event => {
    const input = (event.target as Element).closest<HTMLInputElement>('.st-name');
    const id = input?.closest<HTMLElement>('[data-team]')?.dataset.team;
    if (input && id) renameTeam(id, input.value);
  });
  body.addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.target as Element).classList?.contains('st-name')) (event.target as HTMLInputElement).blur();
  });
}

// One listener for the whole app: buttons that open the panel and the hub's quick chips.
if (typeof document !== 'undefined') {
  document.addEventListener('click', event => {
    const target = event.target as Element;
    if (target.closest('[data-open-teams]')) {
      event.preventDefault();
      openSavedTeams();
      return;
    }
    const chip = target.closest<HTMLElement>('[data-load-team]');
    if (chip) applySavedTeam(chip.dataset.loadTeam!);
  });
}
