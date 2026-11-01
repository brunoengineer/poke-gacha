// Image and sound URLs. Sprites are the Black/White (Generation 5) pixel art from the PokeAPI sprites repository
// (the same art shown on pokemondb.net/sprites); later generations fall back to the newest pixel sprites available.

const REPO = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites';
const BW = `${REPO}/pokemon/versions/generation-v/black-white`;
const LAST_BW = 649;

export function spriteUrl(id: number, shiny = false): string {
  if (id <= LAST_BW) return `${BW}${shiny ? '/shiny' : ''}/${id}.png`;
  return `${REPO}/pokemon${shiny ? '/shiny' : ''}/${id}.png`;
}

/** Animated idle sprite (Black/White only; null for later generations). */
export function animatedSpriteUrl(id: number, shiny = false): string | null {
  if (id > LAST_BW) return null;
  return `${BW}/animated${shiny ? '/shiny' : ''}/${id}.gif`;
}

/** Back sprite, used for the player's side in battle. */
export function backSpriteUrl(id: number, shiny = false): string {
  if (id <= LAST_BW) return `${BW}/back${shiny ? '/shiny' : ''}/${id}.png`;
  return `${REPO}/pokemon/back${shiny ? '/shiny' : ''}/${id}.png`;
}

/** Animated back sprite (Black/White only; null for later generations). */
export function animatedBackSpriteUrl(id: number, shiny = false): string | null {
  if (id > LAST_BW) return null;
  return `${BW}/animated/back${shiny ? '/shiny' : ''}/${id}.gif`;
}

export const itemSpriteUrl = (item: string) => `${REPO}/items/${item}.png`;

/** Trainer portraits (Pokémon Showdown's sprite set). */
export const trainerSpriteUrl = (name: string) => `https://play.pokemonshowdown.com/sprites/trainers/${name}.png`;

const CRIES = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon';

/** Classic (8-bit style) cry; `latestCryUrl` is the fallback for species without one. */
export const cryUrl = (id: number) => `${CRIES}/legacy/${id}.ogg`;
export const latestCryUrl = (id: number) => `${CRIES}/latest/${id}.ogg`;

/** Hosts whose responses the service worker caches. */
export const ASSET_HOSTS = ['raw.githubusercontent.com', 'play.pokemonshowdown.com'];
