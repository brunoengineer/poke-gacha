// Public audio names shared by the API (index.ts) and the implementation files.

export type SfxName =
  // UI
  | 'click' | 'tab' | 'open' | 'close' | 'error' | 'toggle'
  // Economy
  | 'coin' | 'buy' | 'daily'
  // Captures
  | 'ballThrow' | 'ballWobble' | 'ballClick' | 'ballOpen' | 'reveal' | 'revealRare' | 'revealEpic' | 'revealLegendary' | 'shiny'
  // Collection
  | 'newCard' | 'levelUp' | 'candy' | 'deckAdd' | 'deckRemove' | 'flip'
  // Evolution
  | 'evolveStart' | 'evolveCharge' | 'evolveDone'
  // Battle
  | 'cardPick' | 'cardPlace' | 'statReveal' | 'hit' | 'superEffective' | 'notEffective'
  | 'roundWin' | 'roundLose' | 'roundDraw' | 'victory' | 'defeat'
  // Progression
  | 'badge' | 'rankUp' | 'champion';

export type MusicTrack = 'title' | 'menu' | 'capture' | 'battle' | 'gym' | 'league' | 'champion';
