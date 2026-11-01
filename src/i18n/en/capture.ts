// English strings for the "capture" namespace. Must have exactly the same keys as ../pt/capture.ts.
import type pt from '../pt/capture';

const n = (value: number) => value.toLocaleString('en-US');
const plural = (value: number, one: string, many: string) => `${n(value)} ${value === 1 ? one : many}`;

const capture: typeof pt = {
  title: 'Capture',
  subtitle: 'Throw Poké Balls and see who shows up. Every duplicate raises its card by one level.',

  tabs: {
    label: 'Capture sections',
    capture: 'Captures',
    mart: 'Poké Mart',
  },

  banners: {
    poke: {
      name: 'Poké Ball',
      kicker: 'The classic',
      text: 'Cheap and quick: perfect for filling the Pokédex and leveling up duplicates.',
    },
    safari: {
      name: 'Safari Zone',
      kicker: 'Today\'s highlights',
      text: '40% of captures come from today\'s three featured families. Great for focusing on one evolution line.',
    },
    great: {
      name: 'Great Ball',
      kicker: 'Rare guaranteed',
      text: 'More balanced odds, plus a Rare or better Pokémon every 10 captures.',
    },
    ultra: {
      name: 'Ultra Ball',
      kicker: 'Epic guaranteed',
      text: 'Evolved forms and legendaries show up for real. An Epic or better every 10 captures.',
    },
    master: {
      name: 'Master Ball',
      kicker: 'Legendary guaranteed',
      text: 'It never fails: every capture is a Legendary or Mythical Pokémon.',
    },
  },

  region: {
    title: 'Capture region',
    all: 'All',
    hintAll: (count: number) =>
      `All ${n(count)} Pokémon can show up. Focus on one region: with fewer species in the draw, each one appears more often and duplicates level up faster.`,
    hintOne: (region: string, count: number) =>
      `Only the ${n(count)} Pokémon of ${region}, on every ball. Each one shows up more often, so duplicates level up faster.`,
  },

  featuredToday: 'Featured today',
  showcase: 'May appear',
  shinyRate: (odds: number) => `Shiny 1/${n(odds)}`,
  pity: (left: number, rarity: string) => (left <= 1 ? `Next capture: ${rarity} guaranteed` : `${rarity} guaranteed in ${plural(left, 'capture', 'captures')}`),
  owned: (count: number) => `You have ${n(count)}`,
  payCoins: 'With Pokédollars',
  payBalls: (name: string, count: number) => `With ${name}s (you have ${n(count)})`,
  pullLabel: (count: number, banner: string, cost: string) => `Capture ${n(count)} with ${banner} for ${cost}`,
  ballCost: (count: number, name: string) => `${n(count)} ${name}${count === 1 ? '' : 's'}`,
  locked: (badges: number) => `Beat ${plural(badges, 'Gym Leader', 'Gym Leaders')} to unlock`,
  lockedProgress: (have: number, need: number) => `${n(have)}/${n(need)} badges`,
  goGyms: 'Go to the Gyms',
  masterHint: 'Master Balls are prizes from Competition and the Pokémon League.',
  notEnoughBalls: (name: string) => `You don't have enough ${name}s.`,
  bannerLocked: 'This capture is still locked.',

  odds: {
    title: 'Odds',
    pick: 'Choose a capture',
    byRarity: 'By rarity',
    shiny: 'Shiny chance',
    species: (count: number) => `See all ${n(count)} possible Pokémon`,
    pityNote: (every: number, rarity: string) => `After ${n(every - 1)} captures in a row without a ${rarity} or better, the next one is guaranteed.`,
    safariNote: '40% of captures come from today\'s featured families; the table below doesn\'t include that boost.',
    masterNote: 'Only Legendary and Mythical Pokémon.',
    regionNote: (region: string) => `Odds with ${region} Pokémon only (the region picked above).`,
  },

  history: {
    title: 'Recent captures',
    empty: 'Your latest captures show up here.',
  },

  pull: {
    label: 'Capture result',
    revealAll: 'Reveal all',
    again: (count: number) => `Capture ×${n(count)} again`,
    revealCard: (index: number) => `Reveal card ${n(index)}`,
    tagNew: 'NEW!',
    tagLevel: (from: number, to: number) => `Lv. ${n(from)} → ${n(to)}`,
    tagRoute: (name: string) => `→ ${name}`,
    tagCandy: '+1 Rare Candy',
    newSpecies: 'New Pokédex entry!',
    shiny: 'Shiny!',
    legendary: 'Legendary!',
    mythical: 'Mythical!',
    canEvolve: (name: string) => `${name} can evolve now!`,
    canEvolveMany: (count: number) => `${n(count)} cards can evolve now!`,
    seeCollection: 'See in Collection',
  },

  summary: {
    title: (count: number) => `${n(count)} captures!`,
    subtitle: (banner: string) => `${banner} summary`,
    newSpecies: 'New species',
    levels: 'Levels gained',
    candies: 'Rare Candies',
    shinies: 'Shinies',
    highlights: 'Highlights',
    levelUps: 'Leveled up',
    newCard: 'New',
    copies: (count: number) => `×${n(count)}`,
    candyNote: (count: number) => `${plural(count, 'copy of a max-level card', 'copies of max-level cards')} turned into Rare Candy.`,
    nothingNew: 'No highlights this time, but every level counts!',
  },

  mart: {
    title: 'Poké Mart',
    subtitle: 'Rare Candy levels up any card; stones, the Link Cable and trade items make Pokémon evolve.',
    buy: 'Buy',
    buyTotal: (cost: string) => `Buy · ${cost}`,
    inBag: (count: number) => `In bag: ${n(count)}`,
    quantity: 'Quantity',
    less: 'Fewer',
    more: 'More',
    bought: (name: string, count: number) => `You bought ${name} ×${n(count)}!`,
  },

  bag: {
    title: 'Bag',
    empty: 'Your bag is empty. Items from battles, gifts and the Mart show up here.',
    categories: { ball: 'Poké Balls', candy: 'Candy', evolution: 'Evolution items' },
    use: 'Use',
    useInCollection: 'Use in Collection',
  },

  daily: {
    title: 'Daily gift',
    ready: 'Today\'s gift is waiting for you!',
    claim: 'Open gift',
    day: (day: number) => `Day ${n(day)}`,
    streak: (days: number) => `${plural(days, 'day', 'days')} streak`,
    ballEvery: 'Come back every day: every 7th day in a row brings a Great Ball.',
    claimedTitle: 'Gift claimed',
    tomorrow: (coins: string) => `Tomorrow: ${coins}`,
    gotTitle: (day: number) => (day > 1 ? `${n(day)} days in a row!` : 'Daily gift!'),
    gotText: 'Come back tomorrow to keep the streak going.',
    trackLabel: (day: number) => `Weekly progress: day ${n(day)} of 7`,
  },

  onboarding: {
    label: 'Welcome',
    professor: 'Professor Oak',
    intro: [
      'Ah, a new face at the lab! I was hoping someone would stop by today. I study Pokémon cards, and I could use a hand.',
      'Around here, every Poké Ball you throw could bring any of the 251 Pokémon of Kanto and Johto. But every great journey starts with a partner.',
    ],
    next: 'Continue',
    back: 'Back',
    chooseTitle: 'Choose your first Pokémon',
    chooseSub: 'Three partners from Kanto and three from Johto. It starts at level 5 and becomes the first member of your team.',
    chooseHint: 'Tap a Pokémon to get to know it.',
    starters: {
      1: 'Calm and sturdy. The seed on its back grows along with your friendship.',
      4: 'Brave and full of energy. The flame on its tail shows everything it feels.',
      7: 'Clever and playful. It hides in its shell and answers with jets of water.',
      152: 'Gentle and cheerful. It loves sunbathing and waves the leaf on its head when it\'s happy.',
      155: 'Shy at first, but once it gets excited, the flames on its back flare up all at once.',
      158: 'Restless and fearless. It nibbles everything out of curiosity, your cap included.',
    },
    choose: (name: string) => `Choose ${name}`,
    picked: (name: string) => `${name} joined your team!`,
    pickedSub: 'What a duo. Now, a few quick tips before you set off.',
    slides: [
      {
        title: 'Captures are cheap',
        text: 'A Poké Ball costs just ₽5. Throw dozens, hundreds: that\'s how a collection is born.',
      },
      {
        title: 'Duplicate = +1 level',
        text: 'Caught a Pokémon you already have? Its card goes up a level. If you evolved it already, the level goes to the evolved form.',
      },
      {
        title: 'Evolving is optional',
        text: 'Evolved forms are stronger, but they stop at level 100. Rumor has it that base forms that never evolved, and the ultra-rare shinies, have no limit at all…',
        secret: 'But let\'s keep that between us.',
      },
      {
        title: 'Time to battle',
        text: 'Build a team of 6 cards and pick your challenge:',
      },
    ],
    modes: { training: 'Training with friends', competition: 'Competition', gyms: '8 Gyms', league: 'Pokémon League' },
    slideOf: (index: number, total: number) => `Tip ${n(index)} of ${n(total)}`,
    finish: 'Go capture!',
    finishNote: (coins: string, balls: number) => `You start with ${coins}: enough for ${balls} Poké Balls.`,
  },
};

export default capture;
