// Training lobby: pick a difficulty and a friend (grouped by region), battle, collect coins (plus the daily
// Rare Candy and the odd gift). Rules and roster live in src/game/modes/training.ts.

import { sfx } from '../../audio';
import { spriteUrl, trainerSpriteUrl } from '../../data/sprites';
import { RARE_CANDY, itemSprite } from '../../data/items';
import {
  averageLevel, DIFFICULTIES, DIFFICULTY, firstWinToday, FRIENDS, getFriend, levelRange, recordTraining, rivalStarter, trainingRewards,
  trainingTeam, winCoins, type Difficulty, type Friend, type FriendRegion,
} from '../../game/modes/training';
import { playerLevels } from '../../game/teams';
import { itemName, L } from '../../i18n';
import { grant, recordBattle } from '../../state/actions';
import { on, store, update } from '../../state/store';
import { typeBadge } from '../../ui/card';
import { $, esc, icon } from '../../ui/dom';
import { showRewards } from '../../ui/rewards';
import type { ModeModule } from '../types';
import { battleActive, runBattle } from './arena';
import { regionLabel } from './regions';
import { ensureTeam, teamSummaryHTML } from './team';

let host: HTMLElement | null = null;
let unsubscribe: (() => void)[] = [];

const difficulty = (): Difficulty => store.save.training.difficulty ?? 'normal';

export const trainingMode: ModeModule = {
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
  const t = L().battle.training;
  const diff = difficulty();
  const avg = playerLevels(store.save).team;
  const [lo, hi] = levelRange(avg, diff);
  const def = DIFFICULTY[diff];
  host.innerHTML = `
    <div class="view-head">
      <div>
        <h1 class="view-title">${esc(t.title)}</h1>
        <p class="view-sub">${esc(t.sub)}</p>
      </div>
    </div>
    ${teamSummaryHTML(true)}
    <div class="diff-bar">
      <div class="diff-seg" role="radiogroup" aria-label="${esc(t.difficulty)}">
        ${DIFFICULTIES.map(d => {
          const [a, b] = levelRange(avg, d);
          return `<button class="diff-opt diff-${d}" type="button" role="radio" aria-checked="${d === diff}" data-diff="${d}">
            <b>${esc(L().battle.difficulty[d])}</b><small>${esc(t.levels(a, b))}</small></button>`;
        }).join('')}
      </div>
      <div class="diff-info">
        <span>${icon('coin', 'i-coin')} ${esc(t.coins(winCoins(diff, Math.round((lo + hi) / 2))))}</span>
        <span>${icon('gift')} ${esc(def.giftChance ? t.gift(Math.round(def.giftChance * 100)) : t.noGift)}</span>
        <span><img src="${esc(itemSprite(RARE_CANDY))}" alt="" width="24" height="24"> ${esc(t.firstWin)}</span>
      </div>
    </div>
    ${(['kanto', 'johto'] as FriendRegion[]).map(region => {
      const friends = FRIENDS.filter(f => f.region === region);
      return `
        <section class="friend-group" aria-label="${esc(t.group(regionLabel(region)))}">
          <h2 class="section-title">${esc(t.group(regionLabel(region)))} <small>${friends.length}</small></h2>
          <div class="friend-grid">${friends.map(friendHTML).join('')}</div>
        </section>`;
    }).join('')}`;
}

function friendHTML(friend: Friend): string {
  const t = L().battle.training;
  const tx = L().battle.friends[friend.id];
  const record = store.save.training.records[friend.id];
  const candy = firstWinToday(record);
  const signature = friend.rival ? [rivalStarter(store.save.starter, friend.region)] : friend.signature ?? [];
  const preview = [...signature, ...friend.pool].slice(0, 4);
  return `
    <button class="friend-card" type="button" data-friend="${friend.id}" style="--fc:${friend.color}" aria-label="${esc(t.challenge(friend.name))}">
      <span class="friend-portrait"><img src="${esc(trainerSpriteUrl(friend.sprite))}" alt="" loading="lazy" draggable="false"></span>
      <span class="friend-info">
        <span class="friend-title">${esc(tx.title)}</span>
        <span class="friend-name">${esc(friend.name)}</span>
        <span class="friend-types">${friend.types.map(typeBadge).join('')}</span>
        <span class="friend-mons" aria-hidden="true">${preview.map(id => `<img src="${esc(spriteUrl(id))}" alt="" loading="lazy" draggable="false">`).join('')}</span>
      </span>
      <span class="friend-foot">
        <span class="friend-record">${esc(record ? t.record(record.wins, record.losses) : t.noRecord)}</span>
        <span class="friend-candy ${candy ? '' : 'done'}" title="${esc(candy ? t.firstWin : t.doneToday)}">
          <img src="${esc(itemSprite(RARE_CANDY))}" alt="" width="22" height="22">${esc(candy ? t.firstWinShort : t.doneToday)}
        </span>
        <span class="friend-go">${icon('swords')} ${esc(t.battle)}</span>
      </span>
    </button>`;
}

function onClick(event: Event) {
  const target = event.target as Element;
  const diff = target.closest<HTMLElement>('[data-diff]')?.dataset.diff as Difficulty | undefined;
  if (diff && diff !== difficulty()) {
    sfx('toggle');
    update(s => { s.training.difficulty = diff; });
    render();
    $(host!, `[data-diff="${diff}"]`)?.focus();
    return;
  }
  const id = target.closest<HTMLElement>('[data-friend]')?.dataset.friend;
  const friend = id ? getFriend(id) : undefined;
  if (friend) void challenge(friend);
}

async function challenge(friend: Friend) {
  if (battleActive() || !ensureTeam()) return;
  sfx('click');
  const t = L().battle.training;
  const tx = L().battle.friends[friend.id];
  const diff = difficulty();
  const team = trainingTeam(friend, playerLevels(store.save).team, diff, Math.random, store.save.starter);
  const level = averageLevel(team);
  const firstWin = firstWinToday(store.save.training.records[friend.id]);

  const outcome = await runBattle({
    mode: 'training',
    opponent: {
      id: friend.id, name: friend.name, title: tx.title, portrait: trainerSpriteUrl(friend.sprite), team,
      intro: tx.intro, winLine: tx.win, loseLine: tx.lose,
    },
    stage: `${t.stage} · ${L().battle.difficulty[diff]}`,
    accent: friend.color,
    hints: true,
  });

  const result = outcome.forfeit ? 'forfeit' : outcome.result;
  recordBattle(result);
  update(s => recordTraining(s.training, friend.id, result === 'win'), ['progress']);
  const rewards = trainingRewards({ difficulty: diff, result, level, firstWin });
  if (rewards.length) {
    const applied = grant(rewards);
    const gift = rewards.find(r => r.kind === 'item' && r.item !== RARE_CANDY);
    const won = result === 'win';
    await showRewards(applied, {
      title: won ? t.winTitle : t.loseTitle,
      subtitle: won ? (gift && gift.kind === 'item' ? `${t.giftFrom(friend.name)} (${itemName(gift.item)})` : undefined) : t.loseSub,
    });
  }
  render();
}
