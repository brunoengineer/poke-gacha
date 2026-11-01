// Rewards shared by every mode: coins, items, cards and badges.

import type { SaveData } from '../state/save';
import { addCopy, addItem, type CopyResult } from './progression';

export type Reward =
  | { kind: 'coins'; amount: number }
  | { kind: 'item'; item: string; amount: number }
  | { kind: 'card'; id: number; shiny?: boolean }
  | { kind: 'badge'; badge: string };

export type AppliedReward = Reward & { copy?: CopyResult; firstBadge?: boolean };

export function applyRewards(save: SaveData, rewards: Reward[], now = Date.now()): AppliedReward[] {
  return rewards.map(reward => {
    switch (reward.kind) {
      case 'coins':
        save.coins += reward.amount;
        save.stats.coinsEarned += reward.amount;
        return reward;
      case 'item':
        addItem(save, reward.item, reward.amount);
        return reward;
      case 'card':
        return { ...reward, copy: addCopy(save, reward.id, !!reward.shiny, now) };
      case 'badge': {
        const firstBadge = !save.gyms.badges.includes(reward.badge);
        if (firstBadge) save.gyms.badges.push(reward.badge);
        return { ...reward, firstBadge };
      }
    }
  });
}

/** Merges rewards of the same coins/item kind (for compact summaries). */
export function mergeRewards(rewards: Reward[]): Reward[] {
  const out: Reward[] = [];
  for (const r of rewards) {
    const same = out.find(o => (o.kind === 'coins' && r.kind === 'coins') || (o.kind === 'item' && r.kind === 'item' && o.item === r.item));
    if (same && same.kind === 'coins' && r.kind === 'coins') same.amount += r.amount;
    else if (same && same.kind === 'item' && r.kind === 'item') same.amount += r.amount;
    else out.push({ ...r });
  }
  return out;
}
