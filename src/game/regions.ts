// The regions with gyms, a league and friends, in story order. Each one opens after the previous region's 8 badges.
// Adding a region: add its id here (its generation is the position + 1), then its content in src/game/modes/.

export type RegionId = 'kanto' | 'johto' | 'hoenn' | 'sinnoh';
export const REGION_IDS: RegionId[] = ['kanto', 'johto', 'hoenn', 'sinnoh'];

/** Generation of a region's Pokédex (Kanto 1, Johto 2…). */
export const regionGeneration = (region: RegionId) => REGION_IDS.indexOf(region) + 1;

/** The region before this one (null for Kanto). */
export const previousRegion = (region: RegionId): RegionId | null => REGION_IDS[REGION_IDS.indexOf(region) - 1] ?? null;
