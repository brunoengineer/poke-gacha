// Items the player can hold. Evolution items for later generations (King's Rock, Metal Coat…) are created
// on the fly from their PokeAPI slug, so new generations work without editing this file.

import { itemSpriteUrl } from './sprites';

export type ItemCategory = 'candy' | 'evolution' | 'ball';

export interface ItemDef {
  id: string;
  category: ItemCategory;
  name: { pt: string; en: string };
  description: { pt: string; en: string };
  /** Shop price in Pokédollars (undefined: not sold). */
  price?: number;
  /** PokeAPI sprite slug, when different from the id. */
  sprite?: string;
}

export const LINK_CABLE = 'link-cable';
export const RARE_CANDY = 'rare-candy';

const stone = (id: string, pt: string, en: string, ptType: string, enType: string): ItemDef => ({
  id,
  category: 'evolution',
  name: { pt, en },
  description: { pt: `Faz certos Pokémon evoluírem. Tem a energia do tipo ${ptType}.`, en: `Makes certain Pokémon evolve. It holds ${enType}-type energy.` },
  price: 2500,
});

/** Items held during a trade (Johto): the trade itself is simulated, so they work alone, like the Link Cable. */
const heldTradeItem = (id: string, pt: string, en: string, ptWho: string, enWho: string): ItemDef => ({
  id,
  category: 'evolution',
  name: { pt, en },
  description: { pt: `Faz ${ptWho} evoluírem numa troca simulada.`, en: `Makes ${enWho} evolve in a simulated trade.` },
  price: 3500,
});

export const ITEMS: ItemDef[] = [
  {
    id: RARE_CANDY,
    category: 'candy',
    name: { pt: 'Doce Raro', en: 'Rare Candy' },
    description: { pt: 'Sobe 1 nível de qualquer carta.', en: 'Raises any card by 1 level.' },
    price: 300,
  },
  stone('fire-stone', 'Pedra do Fogo', 'Fire Stone', 'Fogo', 'Fire'),
  stone('water-stone', 'Pedra da Água', 'Water Stone', 'Água', 'Water'),
  stone('thunder-stone', 'Pedra do Trovão', 'Thunder Stone', 'Elétrico', 'Electric'),
  stone('leaf-stone', 'Pedra da Folha', 'Leaf Stone', 'Planta', 'Grass'),
  stone('moon-stone', 'Pedra da Lua', 'Moon Stone', 'Lunar', 'lunar'),
  stone('sun-stone', 'Pedra do Sol', 'Sun Stone', 'Solar', 'solar'),
  {
    id: LINK_CABLE,
    category: 'evolution',
    name: { pt: 'Cabo de Troca', en: 'Link Cable' },
    description: {
      pt: 'Simula uma troca entre amigos: evolui Pokémon que só evoluem por troca.',
      en: 'Simulates a trade with a friend: evolves Pokémon that only evolve by trading.',
    },
    price: 3000,
    sprite: 'linking-cord',
  },
  heldTradeItem('kings-rock', "Pedra do Rei", "King's Rock", 'Poliwhirl e Slowpoke', 'Poliwhirl and Slowpoke'),
  heldTradeItem('metal-coat', 'Revestimento Metálico', 'Metal Coat', 'Onix e Scyther', 'Onix and Scyther'),
  heldTradeItem('dragon-scale', 'Escama de Dragão', 'Dragon Scale', 'Seadra', 'Seadra'),
  heldTradeItem('up-grade', 'Melhoria', 'Up-Grade', 'Porygon', 'Porygon'),
  {
    id: 'great-ball',
    category: 'ball',
    name: { pt: 'Great Ball', en: 'Great Ball' },
    description: { pt: 'Uma captura grátis na Great Ball.', en: 'One free Great Ball capture.' },
  },
  {
    id: 'ultra-ball',
    category: 'ball',
    name: { pt: 'Ultra Ball', en: 'Ultra Ball' },
    description: { pt: 'Uma captura grátis na Ultra Ball.', en: 'One free Ultra Ball capture.' },
  },
  {
    id: 'master-ball',
    category: 'ball',
    name: { pt: 'Master Ball', en: 'Master Ball' },
    description: { pt: 'Captura garantida de um Pokémon Lendário ou Mítico.', en: 'Guaranteed capture of a Legendary or Mythical Pokémon.' },
  },
];

const byId = new Map(ITEMS.map(item => [item.id, item]));

const titleCase = (slug: string) => slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

export function getItem(id: string): ItemDef {
  return byId.get(id) ?? {
    id,
    category: 'evolution',
    name: { pt: titleCase(id), en: titleCase(id) },
    description: { pt: 'Item de evolução.', en: 'Evolution item.' },
  };
}

export const itemSprite = (id: string) => itemSpriteUrl(getItem(id).sprite ?? id);
