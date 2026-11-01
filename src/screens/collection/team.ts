// Team helpers shared by the Pokédex grid, the dock and the details modal: add/remove with feedback, card power.

import { sfx } from '../../audio';
import { cardPower, parseKey, type CardKey } from '../../game/cards';
import { DECK_SIZE } from '../../game/economy';
import { L, speciesName } from '../../i18n';
import { addToDeck, autoFillDeck, clearDeck, inDeck, removeFromDeck } from '../../state/actions';
import { store } from '../../state/store';
import { toast } from '../../ui/dom';

/** Combat Power of an owned card (0 when not owned). */
export function keyPower(key: CardKey): number {
  const card = store.save.cards[key];
  if (!card) return 0;
  const { id, shiny } = parseKey(key);
  return cardPower(id, card.level, shiny);
}

export const teamPower = () => store.save.deck.reduce((sum, key) => sum + keyPower(key), 0);

export function cardLabel(key: CardKey): string {
  const { id, shiny } = parseKey(key);
  return `${speciesName(id)}${shiny ? ' ★' : ''}`;
}

/** Shows the right message for an addToDeck() result. Returns true when the card entered the team. */
export function reportAdd(result: ReturnType<typeof addToDeck>, key: CardKey): boolean {
  const t = L().collection.team;
  if (result === 'full') toast(t.full(DECK_SIZE), 'warning');
  else if (result === 'duplicate') toast(t.duplicate(cardLabel(key)), 'warning');
  else if (result === 'not-owned') toast(t.notOwned, 'warning');
  const ok = result === 'added' || result === 'replaced';
  sfx(ok ? 'deckAdd' : 'error');
  return ok;
}

export function toggleTeam(key: CardKey, { notify = false } = {}) {
  const t = L().collection.team;
  if (inDeck(key)) {
    removeFromDeck(key);
    sfx('deckRemove');
    if (notify) toast(t.removed(cardLabel(key)));
    return;
  }
  if (reportAdd(addToDeck(key), key) && notify) toast(t.added(cardLabel(key)), 'success');
}

/** Rebuilds the team with the strongest cards by Combat Power. */
export function autoTeam() {
  const t = L().collection.team;
  if (!Object.keys(store.save.cards).length) return toast(t.noCards, 'warning');
  const before = store.save.deck.join();
  clearDeck();
  autoFillDeck(keyPower);
  sfx('deckAdd');
  toast(store.save.deck.join() === before ? t.autoSame : t.autoDone, 'success');
}
