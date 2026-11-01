// Gyms lobby: the badge case and the eight Kanto leaders in order. A first win plays the badge celebration;
// rematches are harder and pay Rare Candy. Rules and rosters live in src/game/modes/gyms.ts.

import { sfx } from '../../audio';
import { itemSprite } from '../../data/items';
import { spriteUrl, trainerSpriteUrl } from '../../data/sprites';
import { TYPE_COLOR } from '../../data/types';
import { UNLOCK_BADGES } from '../../game/economy';
import {
  getGym, gymLevels, gymRewards, gymStatus, gymTeam, GYMS, recordGym, rematchBonus, type Gym,
} from '../../game/modes/gyms';
import type { Reward } from '../../game/rewards';
import { seeded } from '../../game/rng';
import { evolveForLevel } from '../../game/teams';
import { fmt, itemName, L } from '../../i18n';
import { grant, recordBattle } from '../../state/actions';
import { on, store, update } from '../../state/store';
import { typeBadge } from '../../ui/card';
import { esc, icon, openModal, toast } from '../../ui/dom';
import { burst, Sequence } from '../../ui/fx';
import { showRewards } from '../../ui/rewards';
import type { ModeModule } from '../types';
import { battleActive, runBattle } from './arena';
import { badgeDataUrl, badgeSVG } from './badges';
import { ensureTeam, teamSummaryHTML } from './team';

let host: HTMLElement | null = null;
let unsubscribe: (() => void)[] = [];

export const gymsMode: ModeModule = {
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

function render() {
  if (!host || battleActive()) return;
  const t = L().battle.gyms;
  const badges = store.save.gyms.badges;
  host.innerHTML = `
    <div class="view-head">
      <div>
        <h1 class="view-title">${esc(t.title)}</h1>
        <p class="view-sub">${esc(t.sub)}</p>
      </div>
    </div>
    ${teamSummaryHTML(true)}
    <section class="badge-case" aria-label="${esc(t.badgeCase)}">
      <header class="badge-case-head">
        <span class="label">${esc(t.badgeCase)}</span>
        <span class="badge-count">${esc(t.badges(badges.length))}</span>
      </header>
      <ol class="badge-grid">
        ${GYMS.map(g => `
          <li class="badge-cell ${badges.includes(g.badge) ? 'earned' : ''}">
            ${badgeSVG(g.badge, { earned: badges.includes(g.badge) })}
            <span>${esc(L().battle.badgeFull[g.badge])}</span>
          </li>`).join('')}
      </ol>
      ${badges.length >= GYMS.length ? `<p class="badge-case-done">${icon('crown')} ${esc(t.allDone)}</p>` : ''}
    </section>
    <ol class="gym-list">${GYMS.map(gymHTML).join('')}</ol>`;
}

function rewardChips(rewards: Reward[]): string {
  return rewards.map(r => {
    if (r.kind === 'coins') return `<span class="gym-reward-chip">${icon('coin', 'i-coin')} ₽ ${fmt(r.amount)}</span>`;
    if (r.kind === 'item') return `<span class="gym-reward-chip"><img src="${esc(itemSprite(r.item))}" alt="" width="22" height="22">${esc(itemName(r.item))}${r.amount > 1 ? ` ×${r.amount}` : ''}</span>`;
    if (r.kind === 'badge') return `<span class="gym-reward-chip badge-chip">${badgeSVG(r.badge, { label: false })}${esc(L().battle.badgeFull[r.badge])}</span>`;
    return '';
  }).join('');
}

function gymHTML(gym: Gym, index: number): string {
  const t = L().battle.gyms;
  const tx = L().battle.leaders[gym.id];
  const gyms = store.save.gyms;
  const status = gymStatus(gyms, index);
  const [lo, hi] = gymLevels(gyms, gym);
  const record = gyms.records[gym.id];
  const bonus = rematchBonus(gyms, gym);
  const rng = seeded(index + 1);
  const roster = gym.roster.map(id => evolveForLevel(id, lo, rng));
  const locked = status === 'locked';
  const previous = index > 0 ? GYMS[index - 1].leader : '';
  return `
    <li class="gym-card gym-${status}" style="--gc:${TYPE_COLOR[gym.type]}">
      <div class="gym-portrait">
        <img src="${esc(trainerSpriteUrl(gym.sprite))}" alt="" loading="lazy" draggable="false">
        <span class="gym-num">${index + 1}</span>
      </div>
      <div class="gym-info">
        <span class="gym-city">${esc(t.gymNumber(index + 1))} · ${esc(tx.city)}</span>
        <h3 class="gym-leader">${esc(gym.leader)}</h3>
        <span class="gym-meta">${typeBadge(gym.type)}<span class="gym-levels">${esc(t.levels(lo, hi))}</span>
          ${record ? `<span class="gym-record">${esc(t.record(record.wins, record.losses))}</span>` : ''}</span>
        <span class="gym-roster" aria-hidden="true">${roster.map(id => `<img class="${locked ? 'silhouette' : ''}" src="${esc(spriteUrl(id))}" alt="" loading="lazy" draggable="false">`).join('')}</span>
        <span class="gym-rewards">
          <small>${esc(status === 'beaten' ? t.rematchReward : t.firstReward)}</small>
          ${rewardChips(gymRewards(gyms, gym))}
        </span>
      </div>
      <div class="gym-side">
        ${badgeSVG(gym.badge, { earned: status === 'beaten', className: 'gym-badge' })}
        ${locked ? `<span class="gym-lock-note">${icon('lock')} ${esc(t.locked(previous))}</span>`
          : `<button class="btn ${status === 'open' ? 'btn-primary' : 'btn-secondary'}" type="button" data-gym="${gym.id}">
              ${icon(status === 'open' ? 'swords' : 'reset')} ${esc(status === 'open' ? t.challenge : t.rematch)}</button>
             ${status === 'beaten' ? `<small class="gym-bonus">${esc(t.rematchLevel(bonus))}</small>` : ''}`}
      </div>
    </li>`;
}

function onClick(event: Event) {
  const id = (event.target as Element).closest<HTMLElement>('[data-gym]')?.dataset.gym;
  const gym = id ? getGym(id) : undefined;
  if (gym) void challenge(gym);
}

async function challenge(gym: Gym) {
  const index = GYMS.indexOf(gym);
  const status = gymStatus(store.save.gyms, index);
  if (status === 'locked' || battleActive() || !ensureTeam()) return;
  sfx('click');
  const t = L().battle.gyms;
  const tx = L().battle.leaders[gym.id];
  const rematch = status === 'beaten';
  const team = gymTeam(store.save.gyms, gym);

  const outcome = await runBattle({
    mode: 'gym',
    opponent: {
      id: gym.id, name: gym.leader, title: t.leaderOf(tx.city), portrait: trainerSpriteUrl(gym.sprite), team,
      intro: tx.intro, winLine: tx.win, loseLine: tx.lose,
    },
    music: 'gym',
    stage: rematch ? `${t.gymNumber(index + 1)} · ${t.rematch}` : t.gymNumber(index + 1),
    accent: TYPE_COLOR[gym.type],
  });

  const won = !outcome.forfeit && outcome.result === 'win';
  recordBattle(outcome.forfeit ? 'forfeit' : outcome.result);
  const rewards = won ? gymRewards(store.save.gyms, gym) : [];
  update(s => recordGym(s.gyms, gym.id, won), ['progress']);

  if (won) {
    const applied = grant(rewards);
    const firstBadge = applied.some(r => r.kind === 'badge' && r.firstBadge);
    if (firstBadge) await celebrateBadge(gym);
    await showRewards(applied, {
      title: firstBadge ? t.winTitle : t.rematchTitle,
      subtitle: firstBadge ? t.earnedSub(gym.leader) : undefined,
      badgeNames: L().battle.badgeName,
      badgeImages: { [gym.badge]: badgeDataUrl(gym.badge) },
    });
  } else if (!outcome.forfeit) {
    toast(`${t.loseTitle}: ${t.loseText}`, 'info');
  }
  render();
}

/** Full-screen badge reveal after a first win. */
function celebrateBadge(gym: Gym): Promise<void> {
  const t = L().battle.gyms;
  const count = store.save.gyms.badges.length;
  const unlock = count === UNLOCK_BADGES.great ? t.unlocks.great : count === UNLOCK_BADGES.ultra ? t.unlocks.ultra
    : count === UNLOCK_BADGES.league ? t.unlocks.league : '';
  const name = L().battle.badgeFull[gym.badge];
  return new Promise(resolve => {
    const modal = openModal({
      className: 'fx-overlay badge-fx',
      label: t.earned(name),
      onClose: () => resolve(),
      html: `
        <div class="badge-stage" style="--gc:${TYPE_COLOR[gym.type]}">
          <div class="badge-rays" aria-hidden="true"></div>
          ${badgeSVG(gym.badge, { className: 'badge-xl' })}
          <div class="fx-particles"></div>
        </div>
        <h2 class="fx-title">${esc(t.earned(name))}</h2>
        <p class="badge-fx-sub">${esc(t.earnedSub(gym.leader))}</p>
        ${unlock ? `<p class="badge-fx-unlock">${icon('lock')} ${esc(unlock)}</p>` : ''}
        <button class="btn btn-primary btn-lg" type="button" data-close autofocus>${esc(L().core.actions.continue)}</button>`,
    });
    sfx('badge');
    const seq = new Sequence();
    const art = modal.root.querySelector('.badge-xl')!;
    void seq.anim(art, [
      { transform: 'scale(.2) rotateY(720deg)', opacity: 0, filter: 'brightness(3)' },
      { transform: 'scale(1.15) rotateY(0deg)', opacity: 1, filter: 'brightness(1.6)', offset: 0.7 },
      { transform: 'scale(1) rotateY(0deg)', opacity: 1, filter: 'none' },
    ], { duration: 1100, easing: 'cubic-bezier(.2,.8,.2,1)' }).then(() => {
      const particles = modal.root.querySelector('.badge-stage .fx-particles');
      burst(particles, { color: TYPE_COLOR[gym.type], count: 36, distance: 220 });
      burst(particles, { color: '#fff6d0', count: 20, distance: 180, shape: 'star' });
    });
  });
}
