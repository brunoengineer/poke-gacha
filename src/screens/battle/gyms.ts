// Gyms lobby: a region switch (Kanto, Johto, Hoenn, Sinnoh), the region's badge case and its eight leaders in order. A first win plays
// the badge celebration; rematches are harder and pay Rare Candy. Rules and rosters live in src/game/modes/gyms.ts.

import { sfx } from '../../audio';
import { itemSprite } from '../../data/items';
import { spriteUrl, trainerSpriteUrl } from '../../data/sprites';
import { TYPE_COLOR } from '../../data/types';
import { UNLOCK_BADGES } from '../../game/economy';
import {
  currentGymRegion, getGym, gymDifficulty, GYM_REGIONS, gymRegion, gymRewards, gymStatus, gymTeam, recordGym, REGION_GYMS, regionBadges,
  regionGymsOpen, rematchBonus, type Gym, type GymRegion,
} from '../../game/modes/gyms';
import type { Reward } from '../../game/rewards';
import { seeded } from '../../game/rng';
import { previousRegion, REGION_IDS } from '../../game/regions';
import { MAX_LEVEL } from '../../game/cards';
import { evolveForLevel, playerScale } from '../../game/teams';
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
import { clickedRegion, regionLabel, regionSwitchHTML } from './regions';
import { ensureTeam, teamSummaryHTML } from './team';

let host: HTMLElement | null = null;
let unsubscribe: (() => void)[] = [];
/** Region on screen: the one in progress, unless the player picked one. */
let region: GymRegion | null = null;

const shownRegion = (): GymRegion => region ?? currentGymRegion(store.save.gyms);

/** The region after this one, if any (for "what's next" texts). */
const nextRegion = (r: GymRegion): GymRegion | null => REGION_IDS[REGION_IDS.indexOf(r) + 1] ?? null;

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
    region = null;
  },
};

function render() {
  if (!host || battleActive()) return;
  const t = L().battle.gyms;
  const gyms = store.save.gyms;
  const shown = shownRegion();
  const list = REGION_GYMS[shown];
  const badges = gyms.badges;
  const count = regionBadges(gyms, shown);
  const open = regionGymsOpen(gyms, shown);
  const before = previousRegion(shown);
  const done = count >= list.length;
  const next = nextRegion(shown);
  host.innerHTML = `
    <div class="view-head gyms-head">
      <div>
        <h1 class="view-title">${esc(t.title)}</h1>
        <p class="view-sub">${esc(t.sub)}</p>
      </div>
      ${regionSwitchHTML(shown, GYM_REGIONS.map(r => ({
        region: r, note: t.badges(regionBadges(gyms, r)), locked: !regionGymsOpen(gyms, r), done: regionBadges(gyms, r) >= REGION_GYMS[r].length,
      })), t.region)}
    </div>
    ${teamSummaryHTML(true)}
    ${!open && before ? `
      <section class="region-locked">
        <span class="region-locked-icon">${icon('lock')}</span>
        <div>
          <h2>${esc(t.regionLockedTitle(regionLabel(shown)))}</h2>
          <p>${esc(t.regionLocked(regionLabel(shown), regionLabel(before), regionBadges(gyms, before)))}</p>
        </div>
        <button class="btn btn-secondary btn-sm" type="button" data-region="${before}">${icon('medal')} ${esc(t.goRegion(regionLabel(before)))}</button>
      </section>` : ''}
    ${shinyNoteHTML(shown)}
    <section class="badge-case badge-case-${shown}" aria-label="${esc(t.badgeCaseOf(regionLabel(shown)))}">
      <header class="badge-case-head">
        <span class="label">${esc(t.badgeCaseOf(regionLabel(shown)))}</span>
        <span class="badge-count">${esc(t.badges(count))}</span>
      </header>
      <ol class="badge-grid">
        ${list.map(g => `
          <li class="badge-cell ${badges.includes(g.badge) ? 'earned' : ''}">
            ${badgeSVG(g.badge, { earned: badges.includes(g.badge) })}
            <span>${esc(L().battle.badgeFull[g.badge])}</span>
          </li>`).join('')}
      </ol>
      ${done ? `<p class="badge-case-done">${icon('crown')} ${esc(t.allDone(regionLabel(shown), next && regionLabel(next)))}</p>` : ''}
    </section>
    <ol class="gym-list">${list.map((g, i) => gymHTML(g, i, shown)).join('')}</ol>`;
}

/** Regions whose leaders go past the Lv. 100 cap of normal cards say so, pointing at the Shiny Hunt. */
function shinyNoteHTML(shown: GymRegion): string {
  const max = Math.max(...REGION_GYMS[shown].map(g => g.levels[1]));
  if (max <= MAX_LEVEL) return '';
  const t = L().battle.gyms;
  return `
    <section class="region-locked shiny-note">
      <span class="region-locked-icon">${icon('sparkle')}</span>
      <div><p>${esc(t.shinyNote(max))}</p></div>
      <a class="btn btn-secondary btn-sm" href="#/battle/hunt">${icon('search')} ${esc(t.goHunt)}</a>
    </section>`;
}

function rewardChips(rewards: Reward[]): string {
  return rewards.map(r => {
    if (r.kind === 'coins') return `<span class="gym-reward-chip">${icon('coin', 'i-coin')} ₽ ${fmt(r.amount)}</span>`;
    if (r.kind === 'item') return `<span class="gym-reward-chip"><img src="${esc(itemSprite(r.item))}" alt="" width="22" height="22">${esc(itemName(r.item))}${r.amount > 1 ? ` ×${r.amount}` : ''}</span>`;
    if (r.kind === 'badge') return `<span class="gym-reward-chip badge-chip">${badgeSVG(r.badge, { label: false })}${esc(L().battle.badgeFull[r.badge])}</span>`;
    return '';
  }).join('');
}

function gymHTML(gym: Gym, index: number, shown: GymRegion): string {
  const t = L().battle.gyms;
  const tx = L().battle.leaders[gym.id];
  const gyms = store.save.gyms;
  const list = REGION_GYMS[shown];
  const status = gymStatus(gyms, index, shown);
  const { levels: [lo, hi], ace, scaled } = gymDifficulty(gyms, gym, playerScale(store.save));
  const record = gyms.records[gym.id];
  const bonus = rematchBonus(gyms, gym);
  const rng = seeded(index + 1);
  const roster = gym.exact ? gym.roster : gym.roster.map(id => evolveForLevel(id, lo, rng));
  const locked = status === 'locked';
  const before = previousRegion(shown);
  const lockNote = index > 0 ? t.locked(list[index - 1].leader) : before ? t.lockedRegion(regionLabel(before)) : '';
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
          ${scaled ? `<span class="gym-scaled" title="${esc(t.scaledHint)}">${icon('up')} ${esc(ace != null ? t.scaledAce(ace) : t.scaled)}</span>` : ''}
          ${record ? `<span class="gym-record">${esc(t.record(record.wins, record.losses))}</span>` : ''}</span>
        <span class="gym-roster" aria-hidden="true">${roster.map(id => `<img class="${locked ? 'silhouette' : ''}" src="${esc(spriteUrl(id))}" alt="" loading="lazy" draggable="false">`).join('')}</span>
        <span class="gym-rewards">
          <small>${esc(status === 'beaten' ? t.rematchReward : t.firstReward)}</small>
          ${rewardChips(gymRewards(gyms, gym))}
        </span>
      </div>
      <div class="gym-side">
        ${badgeSVG(gym.badge, { earned: status === 'beaten', className: 'gym-badge' })}
        ${locked ? `<span class="gym-lock-note">${icon('lock')} ${esc(lockNote)}</span>`
          : `<button class="btn ${status === 'open' ? 'btn-primary' : 'btn-secondary'}" type="button" data-gym="${gym.id}">
              ${icon(status === 'open' ? 'swords' : 'reset')} ${esc(status === 'open' ? t.challenge : t.rematch)}</button>
             ${status === 'beaten' ? `<small class="gym-bonus">${esc(t.rematchLevel(bonus))}</small>` : ''}`}
      </div>
    </li>`;
}

function onClick(event: Event) {
  const picked = clickedRegion(event);
  if (picked) {
    if (picked !== shownRegion()) {
      sfx('toggle');
      region = picked;
      render();
      host?.querySelector<HTMLElement>(`.region-tab[data-region="${picked}"]`)?.focus();
    }
    return;
  }
  const id = (event.target as Element).closest<HTMLElement>('[data-gym]')?.dataset.gym;
  const gym = id ? getGym(id) : undefined;
  if (gym) void challenge(gym);
}

async function challenge(gym: Gym) {
  const gymsRegion = gymRegion(gym);
  const index = REGION_GYMS[gymsRegion].indexOf(gym);
  const status = gymStatus(store.save.gyms, index, gymsRegion);
  if (status === 'locked' || battleActive() || !ensureTeam()) return;
  sfx('click');
  const t = L().battle.gyms;
  const tx = L().battle.leaders[gym.id];
  const rematch = status === 'beaten';
  const team = gymTeam(store.save.gyms, gym, undefined, playerScale(store.save));
  const stage = `${regionLabel(gymsRegion)} · ${t.gymNumber(index + 1)}`;

  const outcome = await runBattle({
    mode: 'gym',
    opponent: {
      id: gym.id, name: gym.leader, title: t.leaderOf(tx.city), portrait: trainerSpriteUrl(gym.sprite), team,
      intro: tx.intro, winLine: tx.win, loseLine: tx.lose,
    },
    music: 'gym',
    stage: rematch ? `${stage} · ${t.rematch}` : stage,
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

/** What a new badge unlocks: banners count every badge; a league (and the next region's gyms) its region's 8. */
function unlockText(gym: Gym): string {
  const t = L().battle.gyms.unlocks;
  const total = store.save.gyms.badges.length;
  const inRegion = regionBadges(store.save.gyms, gymRegion(gym));
  const r = gymRegion(gym);
  const next = nextRegion(r);
  if (inRegion === UNLOCK_BADGES.league) return t.league(regionLabel(r), next && regionLabel(next));
  if (total === UNLOCK_BADGES.great) return t.great;
  if (total === UNLOCK_BADGES.ultra) return t.ultra;
  return '';
}

/** Full-screen badge reveal after a first win. */
function celebrateBadge(gym: Gym): Promise<void> {
  const t = L().battle.gyms;
  const unlock = unlockText(gym);
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
