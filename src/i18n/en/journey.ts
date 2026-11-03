// Region Journey: game choice, the chapter map, what each chapter locks and the moments between chapters.
import type pt from '../pt/journey';

const journey: typeof pt = {
  name: 'Region Journey',
  world: 'World',

  track: {
    label: 'Game mode',
    journey: { name: 'Region Journey', desc: 'Region by region, like the anime: a new starter, a new team and only that generation\'s Pokémon.' },
    classic: { name: 'Classic', desc: 'Every Pokémon open from the start. The game as always, with your progress as always.' },
    separate: 'Each mode has its own progress: switching modes erases nothing.',
    switchTo: (name: string) => `Play ${name}`,
    switchTitle: (name: string) => `Switch to ${name}?`,
    switchText: 'Your progress in this mode stays saved and continues where you left off when you come back.',
    switchConfirm: 'Switch mode',
  },

  map: {
    nav: 'Journey',
    title: 'Your journey',
    sub: 'Win a region\'s League to open the next one. You can go back to earlier regions anytime to train and earn money.',
    label: 'Journey chapters',
    here: 'You are here',
    cleared: 'Champion',
    inProgress: 'In progress',
    notStarted: 'Ready to begin',
    lockedBy: (previous: string) => `Win the ${previous} League to open`,
    start: (name: string) => `Start ${name}`,
    travel: (name: string) => `Travel to ${name}`,
    badges: (count: number, total: number) => `${count}/${total} badges`,
    dex: (caught: number, total: number) => `Pokédex ${caught}/${total}`,
    titles: (count: number) => (count === 1 ? '1 title' : `${count} titles`),
    starter: 'Starter',
    worldDesc: 'Every Pokédex together, with everything that only exists here:',
    worldUnlocks: ['Master League', 'Infinity Tower', 'Ranked with Ash', 'All Pokémon on one team'],
    shared: 'Travels with you: money, items and cards. Stays in each region: the team, saved teams and starter.',
    traveling: (name: string) => `Traveling to ${name}…`,
    runBlocked: "You're in the middle of a League: finish it or give up to travel.",
    failed: 'Could not travel right now. Try again.',
  },

  chip: (name: string) => `Current region: ${name}. Open the journey`,

  complete: {
    title: (name: string) => `${name} Champion!`,
    next: (name: string) => `${name} is open. You start over there: a new starter, a new team and only ${name} Pokémon. Your money and items come with you.`,
    world: 'The World is open: every Pokédex together, the Master League, the Infinity Tower and Ranked with Ash.',
    go: (name: string) => `Go to ${name}`,
    stay: 'Stay here for now',
  },

  onboarding: {
    intro: (name: string, total: number) => [
      `Ah, a new face at the lab! Every great journey starts with a partner, and yours starts in ${name}.`,
      `Around here, every Poké Ball could bring any of the ${total} Pokémon of ${name}. Win the League and the rest of the world opens up.`,
    ],
    introNext: (name: string, total: number) => [
      `Welcome to ${name}! Your Pokémon are in good hands while you start over here.`,
      `In this region you only find and use the ${total} Pokémon of ${name}. Choose a partner and head for the first badge.`,
    ],
    chooseSub: (name: string) => `Three partners from ${name}. It starts at level 5 and becomes the first member of your new team.`,
    // Later chapters skip the tips: the player already knows the game.
    capturesTip: (price: string) => ({
      title: 'Every capture counts',
      text: `A Poké Ball costs ${price}, and the region opens little by little: every badge brings new Pokémon. Train, win gyms and come back to catch more.`,
    }),
    pickedSubNext: 'New region, new duo. Ready to capture the rest of the team?',
  },

  locked: {
    world: 'Opens in the World',
    worldToast: 'This only exists in the World: win every region\'s League to get there.',
    gymsInRegions: 'Gyms are in the regions',
    gymsToast: 'The World has no gyms: travel to a region to challenge its leaders.',
  },

  hub: {
    gyms: "Take on the region's Gym Leaders, in order.",
    gymsSub: "The region's Gym Leaders, in order. Each badge unlocks the next challenge.",
    league: "Four knockout duels for the region's Champion title.",
    leagueWorld: 'The Master League: normal cards only at Lv. 100, for those who won every League.',
  },

  league: {
    hero: 'An elite trainer, two Elite Four members and the Champion. The title opens the next chapter of your journey.',
    prizeFirstTitle: 'First title: your own shiny starter, with no level cap',
    firstTitle: 'First title! Your shiny starter has arrived, with no level cap.',
  },

  capture: {
    regionFixed: (name: string, open: number, total: number) => (open < total
      ? `In ${name}, captures bring ${open} of the region's ${total} Pokémon. Every badge opens more.`
      : `In ${name}, captures bring all of the region's ${total} Pokémon.`),
  },

  collection: {
    regionDex: (name: string) => `${name} Pokédex`,
    laterChapter: 'This evolution is from another region: it shows up in the World.',
  },

  hunt: {
    otherRegion: 'This species is from another region: travel there to hunt it.',
    targetAway: (name: string) => `Your hunt for ${name} continues in its region.`,
  },
};

export default journey;
