// Online ranking (#/battle/online): three boards, the player's place and the nickname they chose. Guests can read the
// boards; joining needs a Google account. Names and scores come from other players: readEntry() cleans them, and
// everything is escaped here. Rules in src/game/leaderboard.ts, network side in src/state/leaderboard.ts.

import { sfx } from '../../audio';
import { BOARDS, cleanNickname, statsFromSave, validNickname, type Board, type LeaderboardEntry } from '../../game/leaderboard';
import { fmt, L } from '../../i18n';
import {
  canJoinLeaderboard, fetchPosition, fetchTop, hasJoinedLeaderboard, joinLeaderboard, leaderboardAvailable, leaveLeaderboard, myEntry, syncLeaderboard,
} from '../../state/leaderboard';
import { signIn, store } from '../../state/store';
import { confirmDialog, esc, icon, toast } from '../../ui/dom';
import type { ModeModule } from '../types';
import { modeHead } from './competition-ui';

const ICONS: Record<Board, string> = { tower: 'tower', power: 'bolt', caught: 'cards' };
/** The boards don't change that fast: reopening within this time uses what was already read. */
const CACHE_MS = 3 * 60_000;

interface Loaded { at: number; top: LeaderboardEntry[]; position: number | null }
const cache = new Map<string, Loaded>();

let root: HTMLElement | null = null;
let board: Board = 'tower';
let status: 'loading' | 'ready' | 'error' = 'loading';
let data: Loaded = { at: 0, top: [], position: null };
let editing = false;
/** The latest load: an older one finishing later is ignored. */
let loadId = 0;

const t = () => L().modes.online;

export const onlineMode: ModeModule = {
  render(container) {
    root = container;
    editing = false;
    container.addEventListener('click', onClick);
    container.addEventListener('submit', onSubmit);
    void load();
  },
  dispose() {
    root?.removeEventListener('click', onClick);
    root?.removeEventListener('submit', onSubmit);
    root = null;
    loadId++;
  },
};

async function load(force = false) {
  const id = ++loadId;
  if (!leaderboardAvailable()) {
    render();
    return;
  }
  const me = myEntry();
  const key = `${board}:${me?.uid ?? '-'}:${me?.[board] ?? '-'}`;
  const hit = cache.get(key);
  if (hit && !force && Date.now() - hit.at < CACHE_MS) {
    data = hit;
    status = 'ready';
    render();
    return;
  }
  status = 'loading';
  render();
  try {
    // Publish first, so the player's own row matches the place shown.
    if (me) await syncLeaderboard();
    const top = await fetchTop(board);
    const position = me && me[board] > 0 ? await fetchPosition(board, me[board]) : null;
    if (id !== loadId) return;
    data = { at: Date.now(), top, position };
    cache.set(key, data);
    status = 'ready';
  } catch (error) {
    if (id !== loadId) return;
    console.warn('Leaderboard load failed', error);
    status = 'error';
  }
  render();
}

// --- Rendering ---------------------------------------------------------------------

function render() {
  if (!root) return;
  root.innerHTML = `
    <div class="mode online">
      ${modeHead(t().title, t().subtitle)}
      ${leaderboardAvailable() ? `${youHTML()}${tabsHTML()}${listHTML()}` : `<p class="online-state">${esc(t().unavailable)}</p>`}
    </div>`;
}

const scoreText = (entry: Pick<LeaderboardEntry, Board>, b: Board) =>
  (b === 'tower' ? t().floor(entry.tower) : b === 'power' ? t().power(entry.power) : t().caught(entry.caught));

function nicknameForm() {
  return `
    <form class="online-form" data-join novalidate>
      <label class="sr-only" for="online-name">${esc(t().nickname)}</label>
      <input id="online-name" class="online-input" type="text" maxlength="16" autocomplete="off" spellcheck="false"
        placeholder="${esc(t().nickname)}" value="${esc(store.save.online.nickname ?? '')}">
      <button class="btn btn-primary" type="submit">${icon('check')} ${esc(hasJoinedLeaderboard() ? t().saveName : t().join)}</button>
      ${editing ? `<button class="btn btn-ghost" type="button" data-act="cancel-name">${esc(L().core.actions.cancel)}</button>` : ''}
    </form>
    <p class="online-rule">${esc(t().nicknameRule)}</p>`;
}

function youHTML() {
  if (!canJoinLeaderboard()) {
    return `
      <section class="online-you">
        <div><h2>${esc(t().guestTitle)}</h2><p>${esc(t().guestText)}</p></div>
        <button class="btn btn-primary" type="button" data-act="sign-in">${icon('google')} ${esc(t().signIn)}</button>
      </section>`;
  }
  if (!hasJoinedLeaderboard()) {
    const stats = statsFromSave(store.save);
    return `
      <section class="online-you">
        <div><h2>${esc(t().joinTitle)}</h2><p>${esc(t().joinText(scoreText(stats, 'tower'), scoreText(stats, 'power'), scoreText(stats, 'caught')))}</p></div>
        ${nicknameForm()}
      </section>`;
  }
  const me = myEntry()!;
  return `
    <section class="online-you is-joined">
      <div class="online-me">
        <span class="label">${esc(t().yourPlace)}</span>
        <b class="online-place">${data.position != null && status === 'ready' ? `#${fmt(data.position)}` : '—'}</b>
        <span>${esc(me.name)} · ${esc(scoreText(me, board))}</span>
      </div>
      ${editing ? nicknameForm() : `
        <div class="online-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-act="edit-name">${esc(t().changeName)}</button>
          <button class="btn btn-ghost btn-sm" type="button" data-act="leave">${esc(t().leave)}</button>
        </div>`}
    </section>`;
}

function tabsHTML() {
  return `
    <div class="online-tabs" role="tablist" aria-label="${esc(t().boards)}">
      ${BOARDS.map(b => `
        <button class="online-tab" type="button" role="tab" aria-selected="${b === board}" data-board="${b}">
          ${icon(ICONS[b])} ${esc(t().board[b])}
        </button>`).join('')}
      <button class="btn btn-ghost btn-sm online-refresh" type="button" data-act="refresh" aria-label="${esc(t().refresh)}" title="${esc(t().refresh)}">${icon('reset')}</button>
    </div>`;
}

function listHTML() {
  if (status === 'loading') return `<p class="online-state">${esc(t().loading)}</p>`;
  if (status === 'error') return `<p class="online-state is-error">${esc(t().error)}</p>`;
  if (!data.top.length) return `<p class="online-state">${esc(t().empty)}</p>`;
  const meUid = myEntry()?.uid;
  // Players tied on a score share the same place.
  let place = 0;
  let previous: number | null = null;
  const rows = data.top.map((entry, i) => {
    if (entry[board] !== previous) place = i + 1;
    previous = entry[board];
    return `
      <li class="online-row${entry.uid === meUid ? ' is-you' : ''}"${place <= 3 ? ` data-podium="${place}"` : ''}>
        <b class="online-pos">${place <= 3 ? icon('crown') : ''}${fmt(place)}</b>
        <span class="online-name">${esc(entry.name)}${entry.uid === meUid ? ` <span class="you-tag">${esc(L().modes.you)}</span>` : ''}</span>
        <span class="online-score">${esc(scoreText(entry, board))}</span>
      </li>`;
  }).join('');
  return `<ol class="online-list">${rows}</ol>`;
}

// --- Actions -------------------------------------------------------------------------

function onClick(event: Event) {
  const target = event.target as Element;
  const tab = target.closest<HTMLElement>('[data-board]');
  if (tab) {
    const next = tab.dataset.board as Board;
    if (next !== board) {
      board = next;
      sfx('toggle');
      void load();
    }
    return;
  }
  switch (target.closest<HTMLElement>('[data-act]')?.dataset.act) {
    case 'refresh':
      sfx('click');
      void load(true);
      break;
    case 'sign-in':
      void signIn();
      break;
    case 'edit-name':
      editing = true;
      render();
      root?.querySelector<HTMLInputElement>('.online-input')?.select();
      break;
    case 'cancel-name':
      editing = false;
      render();
      break;
    case 'leave':
      void leave();
      break;
  }
}

function onSubmit(event: Event) {
  event.preventDefault();
  const input = root?.querySelector<HTMLInputElement>('.online-input');
  if (input) void join(input.value);
}

async function join(raw: string) {
  if (!validNickname(raw)) {
    sfx('error');
    toast(t().nicknameRule, 'warning');
    return;
  }
  if (!(await joinLeaderboard(cleanNickname(raw)))) {
    sfx('error');
    toast(t().saveFailed, 'error');
    return;
  }
  sfx('buy');
  editing = false;
  toast(t().joined(cleanNickname(raw)), 'success');
  await load(true);
}

async function leave() {
  const ok = await confirmDialog({ title: t().leaveTitle, message: t().leaveText, confirmText: t().leave, danger: true });
  if (!ok) return;
  if (!(await leaveLeaderboard())) {
    sfx('error');
    toast(t().saveFailed, 'error');
    return;
  }
  await load(true);
}
