import { describe, expect, it } from 'vitest';
import { defaultSave } from '../../state/save';
import { seeded } from '../rng';
import {
  applyLadderBattle, challengeable, claimMilestones, pendingMilestones, displayRank, generateLadder, ladderLevel, LADDER_SIZE, playerRank, rankForRating,
  reputationAt, winCoins,
} from './competition';

describe('competition ladder', () => {
  it('generates the same 100 trainers for the same seed', () => {
    const a = generateLadder(42);
    const b = generateLadder(42);
    expect(a).toHaveLength(LADDER_SIZE);
    expect(a.map(t => t.name)).toEqual(b.map(t => t.name));
    expect(generateLadder(43).map(t => t.name + t.classId)).not.toEqual(a.map(t => t.name + t.classId));
  });

  it('gives every trainer a full team near its level, stronger at the top', () => {
    const ladder = generateLadder(7);
    for (const t of ladder) {
      expect(t.team).toHaveLength(6);
      expect(t.types.length).toBeGreaterThan(0);
      expect(new Set(t.team.map(m => m.id)).size).toBe(6);
    }
    expect(ladderLevel(100)).toBe(4);
    expect(ladderLevel(1)).toBe(63);
    expect(ladder[0].elite).toBe(true);
    expect(ladder[10].elite).toBe(false);
    const avg = (i: number) => ladder[i].team.reduce((s, m) => s + m.level, 0) / 6;
    expect(avg(0)).toBeGreaterThan(avg(99) + 50);
  });

  it('ranks the player by reputation, unranked at 0', () => {
    const save = defaultSave();
    expect(playerRank(save)).toBeNull();
    expect(rankForRating(0)).toBe(LADDER_SIZE + 1);
    save.ladder.rating = 900;
    expect(playerRank(save)).toBe(56);
    save.ladder.rating = reputationAt(1) + 1;
    expect(playerRank(save)).toBe(1);
  });

  it('lets the player challenge the five trainers directly above', () => {
    expect(challengeable(0)).toEqual([96, 97, 98, 99, 100]);
    expect(challengeable(900)).toEqual([51, 52, 53, 54, 55]);
    expect(challengeable(reputationAt(3) + 1)).toEqual([1, 2]);
    expect(challengeable(reputationAt(1) + 1)).toEqual([1, 2, 3, 4, 5]);
    expect(displayRank(50, 56)).toBe(50);
    expect(displayRank(56, 56)).toBe(57);
  });

  it('takes the beaten trainer place and pays coins by level', () => {
    const save = defaultSave();
    const result = applyLadderBattle(save.ladder, 98, 'win');
    expect(result.before).toBe(LADDER_SIZE + 1);
    expect(result.after).toBe(98);
    expect(result.coins).toBe(winCoins(ladderLevel(98)));
    expect(save.ladder.wins).toBe(1);
    expect(save.ladder.best).toBe(98);
  });

  it('costs reputation on a loss (never below zero) and pays 15, nothing on forfeit', () => {
    const save = defaultSave();
    save.ladder.rating = 5;
    const loss = applyLadderBattle(save.ladder, 99, 'lose');
    expect(save.ladder.rating).toBe(0);
    expect(loss.rewards).toEqual([{ kind: 'coins', amount: 15 }]);
    expect(applyLadderBattle(save.ladder, 99, 'lose', true).rewards).toEqual([]);
    expect(save.ladder.losses).toBe(2);
  });

  it('grants each milestone once, including skipped ones', () => {
    const save = defaultSave();
    save.ladder.rating = reputationAt(52) + 1; // rank 52
    const result = applyLadderBattle(save.ladder, 48, 'win', false, seeded(1));
    expect(result.milestones.map(m => m.id)).toEqual(['top75', 'top50']);
    expect(result.rewards).toContainEqual({ kind: 'item', item: 'great-ball', amount: 3 });
    expect(result.rewards).toContainEqual({ kind: 'item', item: 'rare-candy', amount: 10 });
    const again = applyLadderBattle(save.ladder, 47, 'win');
    expect(again.milestones).toEqual([]);
    save.ladder.rating = reputationAt(2) + 1;
    const top = applyLadderBattle(save.ladder, 1, 'win', false, seeded(2));
    expect(top.after).toBe(1);
    expect(top.milestones.map(m => m.id)).toEqual(['top25', 'top10', 'top1']);
    expect(top.rewards).toContainEqual({ kind: 'item', item: 'master-ball', amount: 1 });
  });

  it('lets older saves claim milestones they already qualify for', () => {
    const save = defaultSave();
    save.ladder.rating = 900; // rank 56, nothing claimed yet
    expect(pendingMilestones(save.ladder).map(m => m.id)).toEqual(['top75']);
    expect(claimMilestones(save.ladder).rewards).toEqual([{ kind: 'item', item: 'great-ball', amount: 3 }]);
    expect(pendingMilestones(save.ladder)).toEqual([]);
  });
});
