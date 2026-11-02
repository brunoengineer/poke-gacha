// Infinity Tower lobby: the next floor's trainer and team, the floors around it as a climbing column, and the
// best floor reached. Rules live in src/game/modes/tower.ts.

import { sfx } from '../../audio';
import { itemSprite } from '../../data/items';
import { spriteUrl, trainerSpriteUrl } from '../../data/sprites';
import {
  floorLevel, floorRewards, isBossFloor, nextFloor, recordTower, TOWER_UNLOCK_BADGES, towerFloor, towerUnlocked,
} from '../../game/modes/tower';
import type { Reward } from '../../game/rewards';
import { fmt, itemName, L } from '../../i18n';
import { grant, recordBattle } from '../../state/actions';
import { on, store, update } from '../../state/store';
import { esc, icon, toast } from '../../ui/dom';
import { showRewards } from '../../ui/rewards';
import type { ModeModule } from '../types';
import { battleActive, runBattle } from './arena';
import { ensureTeam, teamSummaryHTML } from './team';

let host: HTMLElement | null = null;
let unsubscribe: (() => void)[] = [];

export const towerMode: ModeModule = {
  render(container) {
    host = container;
    container.addEventListener('click', onClick);
    unsubscribe = [on('deck', render), on('cards', render), on('progress', render)];
    render();
  },
  dispose() {
    host?.removeEventListener('click', onClick);
    unsubscribe.forEach(off => off());
    unsubscribe = [];
    host = null;
  },
};

export const towerOpen = () => towerUnlocked(store.save.gyms.badges.length);

function rewardChips(rewards: Reward[]): string {
  return rewards.map(r => {
    if (r.kind === 'coins') return `<span class="gym-reward-chip">${icon('coin', 'i-coin')} ₽ ${fmt(r.amount)}</span>`;
    if (r.kind === 'item') return `<span class="gym-reward-chip"><img src="${esc(itemSprite(r.item))}" alt="" width="22" height="22">${esc(itemName(r.item))}${r.amount > 1 ? ` ×${r.amount}` : ''}</span>`;
    return '';
  }).join('');
}

function render() {
  if (!host || battleActive()) return;
  const t = L().battle.tower;
  const tower = store.save.tower;
  const next = nextFloor(tower);
  host.innerHTML = `
    <div class="view-head">
      <div>
        <h1 class="view-title">${esc(t.title)}</h1>
        <p class="view-sub">${esc(t.sub)}</p>
      </div>
      <div class="tower-best">
        <small>${esc(t.best)}</small>
        <b>${tower.best ? esc(t.floorShort(tower.best)) : '—'}</b>
        <span>${esc(t.record(tower.wins, tower.losses))}</span>
      </div>
    </div>
    ${teamSummaryHTML(true)}
    ${towerOpen() ? `
      <div class="tower-layout">
        ${nextFloorHTML(next)}
        <ol class="tower-column" aria-label="${esc(t.column)}">${columnHTML(next)}</ol>
      </div>` : `
      <section class="region-locked">
        <span class="region-locked-icon">${icon('lock')}</span>
        <div>
          <h2>${esc(t.lockedTitle)}</h2>
          <p>${esc(t.locked(TOWER_UNLOCK_BADGES))}</p>
        </div>
      </section>`}`;
}

function nextFloorHTML(n: number): string {
  const t = L().battle.tower;
  const floor = towerFloor(n);
  return `
    <section class="tower-next ${floor.boss ? 'is-boss' : ''}" aria-label="${esc(t.floor(n))}">
      <header class="tower-next-head">
        <span class="tower-floor-num"><small>${esc(t.floorLabel)}</small>${fmt(n)}</span>
        <span class="tower-next-level">${esc(t.level(floor.level))}</span>
        ${floor.boss ? `<span class="tower-boss-tag">${icon('crown')} ${esc(t.boss)}</span>` : ''}
      </header>
      <div class="tower-trainer">
        <img class="tower-portrait" src="${esc(trainerSpriteUrl(floor.sprite))}" alt="" draggable="false">
        <div>
          <span class="tower-trainer-title">${esc(floor.boss ? t.bossTitle : t.trainerTitle)}</span>
          <h2 class="tower-trainer-name">${esc(floor.name)}</h2>
          <span class="tower-team" aria-hidden="true">${floor.team.map(m => `<img src="${esc(spriteUrl(m.id))}" alt="" loading="lazy" draggable="false">`).join('')}</span>
        </div>
      </div>
      <div class="tower-next-foot">
        <span class="gym-rewards"><small>${esc(t.reward)}</small>${rewardChips(floorRewards(n))}</span>
        <button class="btn btn-primary btn-lg" type="button" data-act="climb">${icon('swords')} ${esc(t.challenge)}</button>
      </div>
    </section>`;
}

/** The floors around the next one: three ahead (top), the next, and the last two cleared. */
function columnHTML(next: number): string {
  const t = L().battle.tower;
  const floors = [next + 3, next + 2, next + 1, next, next - 1, next - 2].filter(f => f >= 1);
  return floors.map(f => {
    const state = f > next ? 'ahead' : f === next ? 'current' : 'cleared';
    return `
      <li class="tower-step ${state} ${isBossFloor(f) ? 'is-boss' : ''}">
        <span class="tower-step-num">${fmt(f)}</span>
        <span class="tower-step-level">${esc(t.level(floorLevel(f)))}</span>
        <span class="tower-step-mark">${state === 'cleared' ? icon('check') : state === 'current' ? icon('swords') : isBossFloor(f) ? icon('crown') : ''}</span>
      </li>`;
  }).join('');
}

function onClick(event: Event) {
  if ((event.target as Element).closest('[data-act="climb"]')) void climb();
}

async function climb() {
  if (battleActive() || !towerOpen() || !ensureTeam()) return;
  sfx('click');
  const t = L().battle.tower;
  const n = nextFloor(store.save.tower);
  const floor = towerFloor(n);

  const outcome = await runBattle({
    mode: 'tower',
    opponent: {
      id: `tower-${n}`, name: floor.name, title: floor.boss ? t.bossTitle : t.trainerTitle,
      portrait: trainerSpriteUrl(floor.sprite), team: floor.team,
      intro: floor.boss ? t.bossIntro(n) : t.intro(n), winLine: t.winLine, loseLine: t.loseLine,
    },
    music: floor.boss ? 'champion' : 'battle',
    stage: t.floor(n),
  });

  const won = !outcome.forfeit && outcome.result === 'win';
  recordBattle(outcome.forfeit ? 'forfeit' : outcome.result);
  update(s => recordTower(s.tower, won), ['progress']);
  if (won) {
    const applied = grant(floorRewards(n));
    await showRewards(applied, { title: t.clearedTitle(n), subtitle: t.clearedSub(n + 1, floorLevel(n + 1)) });
  } else if (!outcome.forfeit) {
    toast(t.lost(n), 'info');
  }
  render();
}
