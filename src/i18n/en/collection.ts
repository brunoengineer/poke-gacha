// English strings for the "collection" namespace. Must have exactly the same keys as ../pt/collection.ts.
import type pt from '../pt/collection';

const n = (value: number) => value.toLocaleString('en-US');

const collection: typeof pt = {
  title: 'Pokédex',
  stats: (caught: string, total: string, shinies: string) =>
    `<b>${caught}</b>/${total} caught · <b>${shinies}</b> ${shinies === '1' ? 'shiny' : 'shinies'}`,
  caughtLabel: 'Pokédex progress',
  search: 'Search Pokémon or no.…',
  filterLabel: 'Filter',
  modes: { all: 'All', owned: 'Owned', missing: 'Missing', evolve: 'Evolve', shiny: 'Shinies' },
  rarityLabel: 'Filter by rarity',
  regionLabel: 'Region',
  allRegions: 'All regions',
  typeLabel: 'Type',
  allTypes: 'All types',
  sortLabel: 'Sort by',
  sortBy: (label: string) => `Sort: ${label}`,
  sorts: { dex: 'Pokédex no.', name: 'Name', level: 'Level', power: 'Power (CP)', rarity: 'Rarity', recent: 'Recent' },
  showing: (count: string) => `${count} Pokémon match these filters`,
  empty: 'No Pokémon match these filters.',
  clearFilters: 'Clear filters',
  tip: 'Tip: drag a card onto your team (on phones, press and hold). Right-click or press T to add or remove it.',

  onboard: {
    title: 'Your Pokédex is empty!',
    text: 'Open Poké Balls to catch your first Pokémon, then build a team of 6.',
    cta: 'Go catch',
  },

  tile: {
    inTeam: 'On your team',
    shinyOwned: 'You own the shiny version',
    registered: 'Registered',
    evolve: (name: string) => `Evolve ${name}`,
    evolveShort: 'Can evolve',
    canEvolve: 'can evolve',
  },

  team: {
    full: (size: number) => `Team is full (${size}/${size}). Drop the card on a slot to swap.`,
    duplicate: (name: string) => `${name} is already on your team.`,
    notOwned: "You don't own this card yet.",
    added: (name: string) => `${name} joined the team.`,
    removed: (name: string) => `${name} left the team.`,
    noCards: 'Catch some Pokémon first!',
    autoDone: 'Team built with your strongest Pokémon.',
    autoSame: 'Your team is already the strongest it can be!',
  },

  dock: {
    title: 'Team',
    powerTitle: 'Total Combat Power of the team',
    clear: 'Clear team',
    clearTitle: 'Clear the team?',
    clearText: 'Every Pokémon leaves the team (they stay in your collection).',
    auto: 'Auto',
    autoTitle: 'Build the team with your 6 strongest',
    battle: 'Battle',
    needFull: (size: number) => `Build a team of ${size} Pokémon to battle.`,
    hintEmpty: (missing: number) => `Drag cards here · ${missing} to go`,
    hintFull: 'Team complete! Drop a card on a slot to swap.',
    hintDrop: 'Drop on a team slot',
    hintReplace: 'Drop on a Pokémon to replace it',
    hintRemove: 'Drop outside the team to remove',
    slotLabel: (slot: number, name: string, level: number) => `Slot ${slot}: ${name}, level ${n(level)}. Enter opens details, Delete removes, Alt + arrows moves.`,
    remove: (name: string) => `Remove ${name} from the team`,
  },

  details: {
    label: 'Pokémon details',
    prev: 'Previous',
    next: 'Next',
    showShiny: 'Show shiny',
    showNormal: 'Show normal',
    inTeam: 'On your team',
    size: (height: number, weight: number) =>
      `Height ${height.toLocaleString('en-US', { maximumFractionDigits: 1 })} m · Weight ${weight.toLocaleString('en-US', { maximumFractionDigits: 1 })} kg`,
    lockedText: "You haven't caught this Pokémon yet. Who could it be? Try your luck in the Capture tab!",
    goCapture: 'Go catch',
    registeredText: (name: string) => `${name} is registered in your Pokédex, but you don't hold its card right now.`,
    registeredEvolved: (name: string, evolved: string) =>
      `${name} is registered in your Pokédex: your card evolved into ${evolved}. New ${name} copies go straight to it.`,
    openCard: (name: string) => `Open ${name}`,
    level: 'Level',
    capNormal: (max: number) => `Grows up to Lv. ${max}. Each duplicate and Rare Candy gives +1 level.`,
    capMaxed: 'Max level! New copies turn into Rare Candy.',
    capBase: (name: string) =>
      `Trainer secret: as long as ${name} never evolves, it has no level cap. With patience it can even outgrow its own final evolution!`,
    capBeyond: (name: string, level: number) =>
      `Lv. ${n(level)} and climbing! ${name} is past the cap evolved forms have. Evolving now would bring it down to Lv. 100.`,
    capShiny: 'Shiny cards never evolve, so they have no level cap. How far can you take it?',
    statsAt: (level: number) => `Stats at Lv. ${n(level)}`,
    baseStats: 'Base stats',
    addTeam: 'Add to team',
    removeTeam: 'Remove from team',
    teamFull: 'Team is full',
    teamFullHint: 'Team is full: remove someone or drag this card onto a team slot.',
    evolveTitle: 'Evolution',
    evolveTo: (name: string) => `Evolve into ${name}`,
    shinyNoEvolve: "Shiny cards don't evolve (in exchange, they have no level cap).",
    family: 'Evolution family',
    matchups: 'Defense against types',
    weak: 'Weak to',
    resist: 'Resists',
    immune: 'Immune to',
  },

  candy: {
    use: 'Use Rare Candy',
    useN: (count: number) => `Use ${n(count)} Rare ${count === 1 ? 'Candy' : 'Candies'}`,
    max: 'Max',
    atCap: 'This card is at its max level.',
    none: 'No Rare Candy. Win battles or buy some at the Mart.',
    confirmTitle: 'Use every candy?',
    confirmText: (count: number, name: string) => `${n(count)} Rare Candies will be used on ${name}.`,
    done: (name: string, level: number) => `${name} grew to Lv. ${n(level)}!`,
    levelUp: (count: number) => `+${n(count)} Lv.`,
  },

  evolution: {
    evolve: 'Evolve',
    levelReq: (level: number) => `Lv. ${n(level)}`,
    needLevel: (level: number) => `Needs to reach Lv. ${n(level)} to evolve.`,
    needItem: (item: string) => `Needs a ${item} to evolve.`,
    failed: "Couldn't evolve right now.",
    confirmTitle: (name: string) => `Evolve ${name}?`,
    chooseBranch: 'Choose what it will become:',
    consumes: (item: string) => `Uses 1 ${item}.`,
    clampWarning: (name: string, level: number, to: number) =>
      `${name} is Lv. ${n(level)} with no cap. The evolved form has a cap: the card will drop to Lv. ${n(to)}.`,
    mergeNote: (name: string, level: number) => `You already own ${name}: both cards merge into one, at Lv. ${n(level)}.`,
    animLabel: 'Evolution',
    intro: (name: string) => `${name} is glowing with a strange new energy…`,
    done: (from: string, to: string) => `${from} became ${to}!`,
    newEntry: 'New Pokédex entry!',
    mergedDone: 'Cards merged',
    clampedDone: (from: number, to: number) => `Lv. ${n(from)} → ${n(to)}`,
  },
};

export default collection;
