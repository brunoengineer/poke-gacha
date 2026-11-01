// Shared strings (header, login, types, stats, rarities, common actions).
import type pt from '../pt/core';

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

const core: typeof pt = {
  appName: 'Poké Gacha',
  tagline: 'Catch, evolve and battle with all 151 Kanto Pokémon.',
  loading: 'Loading…',
  loadError: 'Could not load the game. Check your connection and reload the page.',

  nav: {
    collection: 'Collection',
    capture: 'Capture',
    battle: 'Battle',
    main: 'Main navigation',
    home: 'Home',
  },

  login: {
    signIn: 'Sign in with Google',
    guest: 'Play as guest',
    guestNote: 'As a guest, progress is saved in this browser only.',
    notConfigured: 'Google sign-in is not configured on this site.',
    failed: 'Could not sign in. Please try again.',
    cloudLoad: "We couldn't load your cloud save. Check your connection and try again.",
    cloudDenied: 'Firestore denied access to the save (permission-denied). Check that the pokegacha_saves rule is published in the right project.',
    cloudUnreachable: 'Firestore did not respond. It may be the connection, an ad blocker or a privacy shield: allow this site and try again.',
    cloudCode: (code: string) => `Error code: ${code}`,
    connecting: 'Connecting to your Google account…',
    signedIn: (name: string) => `Signed in with Google as ${name}.`,
  },

  account: {
    menu: 'Menu',
    signedInAs: (name: string) => `Signed in as ${name}`,
    guest: 'Guest',
    signIn: 'Sign in with Google to save in the cloud',
    signOut: 'Sign out',
    sync: { local: 'Saved in this browser', saving: 'Saving…', saved: 'Saved in the cloud', error: 'Cloud save failed' },
    language: 'Language',
    settings: 'Settings',
    reset: 'Restart game',
    resetTitle: 'Start over?',
    resetText: 'Your collection, items, badges and all progress will be erased. This cannot be undone.',
    resetConfirm: 'Erase everything',
    github: 'Bruno Peres on GitHub',
    mute: 'Mute',
    unmute: 'Unmute',
  },

  currency: 'Pokédollars',
  coins: (n: number) => `₽ ${n.toLocaleString('en-US')}`,
  notEnoughCoins: (n: number) => `Not enough Pokédollars! You need ₽ ${n.toLocaleString('en-US')}.`,

  actions: {
    confirm: 'Confirm',
    cancel: 'Cancel',
    close: 'Close',
    continue: 'Continue',
    back: 'Back',
    skip: 'Tap to skip',
    retry: 'Try again',
    yes: 'Yes',
    no: 'No',
  },

  card: {
    level: 'Lv.',
    levelFull: (n: number) => `Level ${n}`,
    power: 'CP',
    powerFull: 'Combat Power',
    shiny: 'Shiny',
    uncapped: 'No level cap',
    maxLevel: 'Max level',
    notCaught: 'Not caught',
    copies: (n: number) => plural(n, 'copy', 'copies'),
    dex: (id: number) => `No. ${String(id).padStart(3, '0')}`,
  },

  stats: { hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed' },
  statsShort: { hp: 'HP', atk: 'ATK', def: 'DEF', spa: 'SPA', spd: 'SPD', spe: 'SPE' },

  types: {
    normal: 'Normal', fire: 'Fire', water: 'Water', electric: 'Electric', grass: 'Grass', ice: 'Ice',
    fighting: 'Fighting', poison: 'Poison', ground: 'Ground', flying: 'Flying', psychic: 'Psychic', bug: 'Bug',
    rock: 'Rock', ghost: 'Ghost', dragon: 'Dragon', dark: 'Dark', steel: 'Steel', fairy: 'Fairy',
  },

  rarity: { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', mythical: 'Mythical' },

  rewards: {
    title: 'Rewards',
    coins: (n: number) => `₽ ${n.toLocaleString('en-US')}`,
    item: (name: string, n: number) => `${name} ×${n}`,
    badge: (name: string) => `${name} Badge`,
    newCard: 'New!',
    levelUp: (from: number, to: number) => `Lv. ${from} → ${to}`,
    maxed: 'Max level: turned into Rare Candy',
  },

  plural,
};

export default core;
