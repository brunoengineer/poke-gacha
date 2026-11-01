import { describe, expect, it } from 'vitest';
import { getSpecies, hasSpecies } from '../../data/species';
import enBattle from '../../i18n/en/battle';
import enModes from '../../i18n/en/modes';
import ptBattle from '../../i18n/pt/battle';
import ptModes from '../../i18n/pt/modes';
import { defaultSave } from '../../state/save';
import { STARTERS } from '../economy';
import { REGION_IDS } from '../regions';
import { seeded } from '../rng';
import { currentGymRegion, gymStatus, gymTeam, REGION_GYMS, regionGymsOpen } from './gyms';
import { championBoss, eliteFour, leagueFee, leagueUnlocked, placementRewards } from './league';
import { FRIENDS, rivalStarter } from './training';

const allBadges = (...regions: (typeof REGION_IDS)[number][]) => regions.flatMap(r => REGION_GYMS[r].map(g => g.badge));

describe('regions', () => {
  it('has eight gyms per region, each tougher than the last', () => {
    let last = 0;
    for (const region of REGION_IDS) {
      const gyms = REGION_GYMS[region];
      expect(gyms).toHaveLength(8);
      for (const gym of gyms) {
        expect(gym.levels[0]).toBeGreaterThanOrEqual(last);
        last = gym.levels[0];
        expect(gym.roster).toHaveLength(6);
        expect(gym.roster.every(hasSpecies)).toBe(true);
        expect(gym.roster.some(id => getSpecies(id).legendary || getSpecies(id).mythical)).toBe(false);
        const team = gymTeam(defaultSave().gyms, gym, seeded(3));
        expect(team.filter(m => getSpecies(m.id).types.includes(gym.type)).length).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('uses unique gym ids and badges across regions', () => {
    const gyms = REGION_IDS.flatMap(r => REGION_GYMS[r]);
    expect(new Set(gyms.map(g => g.id)).size).toBe(gyms.length);
    expect(new Set(gyms.map(g => g.badge)).size).toBe(gyms.length);
  });

  it("opens each region's gyms after the previous region's 8 badges", () => {
    const gyms = defaultSave().gyms;
    expect(regionGymsOpen(gyms, 'kanto')).toBe(true);
    expect(regionGymsOpen(gyms, 'hoenn')).toBe(false);
    gyms.badges = allBadges('kanto', 'johto');
    expect(regionGymsOpen(gyms, 'hoenn')).toBe(true);
    expect(regionGymsOpen(gyms, 'sinnoh')).toBe(false);
    expect(currentGymRegion(gyms)).toBe('hoenn');
    expect(gymStatus(gyms, 0, 'hoenn')).toBe('open');
    expect(gymStatus(gyms, 1, 'hoenn')).toBe('locked');
    gyms.badges = allBadges('kanto', 'johto', 'hoenn');
    expect(gymStatus(gyms, 0, 'sinnoh')).toBe('open');
    gyms.badges = allBadges(...REGION_IDS);
    expect(currentGymRegion(gyms)).toBe('sinnoh');
  });

  it('has a league per region: four Elite Four members and a Champion, unlocked by its own badges', () => {
    const save = defaultSave();
    for (const region of REGION_IDS) {
      expect(eliteFour(region)).toHaveLength(4);
      const bosses = [...eliteFour(region), championBoss(4, region)];
      for (const boss of bosses) {
        expect(boss.roster).toHaveLength(6);
        expect(boss.roster.every(hasSpecies)).toBe(true);
      }
      expect(leagueUnlocked(save, region)).toBe(false);
    }
    save.gyms.badges = allBadges('kanto', 'johto', 'hoenn');
    expect(leagueUnlocked(save, 'hoenn')).toBe(true);
    expect(leagueUnlocked(save, 'sinnoh')).toBe(false);
    expect(REGION_IDS.map(leagueFee)).toEqual([1000, 2500, 4000, 6000]);
  });

  it('scales league prizes with the region', () => {
    expect(placementRewards(0, 'hoenn')[0]).toEqual({ kind: 'coins', amount: 750 });
    expect(placementRewards(0, 'sinnoh')[0]).toEqual({ kind: 'coins', amount: 1000 });
    expect(placementRewards(4, 'sinnoh')).toContainEqual({ kind: 'item', item: 'master-ball', amount: 2 });
  });

  it('has friends in every region, with one rival who counters your starter', () => {
    for (const region of REGION_IDS) {
      const friends = FRIENDS.filter(f => f.region === region);
      expect(friends.length).toBeGreaterThanOrEqual(5);
      expect(friends.filter(f => f.rival)).toHaveLength(1);
      expect(friends.every(f => [...f.pool, ...(f.signature ?? [])].every(hasSpecies))).toBe(true);
    }
    expect(new Set(FRIENDS.map(f => f.id)).size).toBe(FRIENDS.length);
    // Grass player: the rival takes that region's fire starter.
    expect(rivalStarter(1, 'hoenn')).toBe(255);
    expect(rivalStarter(387, 'sinnoh')).toBe(390);
    expect(STARTERS).toHaveLength(REGION_IDS.length * 3);
  });

  it('has texts for every new leader, boss, friend and badge in both languages', () => {
    for (const [battle, modes] of [[ptBattle, ptModes], [enBattle, enModes]] as const) {
      for (const region of REGION_IDS) {
        for (const gym of REGION_GYMS[region]) {
          expect(battle.leaders[gym.id]?.intro, gym.id).toBeTruthy();
          expect(battle.badgeFull[gym.badge], gym.badge).toBeTruthy();
        }
        for (const boss of [...eliteFour(region), championBoss(4, region)]) expect(modes.league.lines[boss.id]?.intro, boss.id).toBeTruthy();
      }
      for (const friend of FRIENDS) expect(battle.friends[friend.id]?.intro, friend.id).toBeTruthy();
      expect(modes.league.hoenn.heroText).toBeTruthy();
      expect(modes.league.sinnoh.heroText).toBeTruthy();
    }
  });
});
