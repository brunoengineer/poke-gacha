// Card details modal: large animated card with tilt, Pokédex info, level and cap, stats, type matchups,
// evolution family with requirements, and actions (team, Rare Candy, evolve or pass the level to an owned evolved
// form, shiny/normal switch).
// Arrows (buttons or keyboard) move through the list the modal was opened from.

import { sfx } from '../../audio';
import { descendants, evolutionsOf, familyOf, getSpecies, preEvolution, type Species } from '../../data/species';
import { spriteUrl } from '../../data/sprites';
import { effectiveness, TYPE_COLOR, TYPES, type PokemonType } from '../../data/types';
import {
  cardKey, cardPower, isUncapped, levelCap, parseKey, rarity, requiredItem, requiredLevel, STAT_IDS, statsAt, type CardKey,
} from '../../game/cards';
import { DECK_SIZE } from '../../game/economy';
import { CHAIN_MAX, entryFee, huntBlock, shinyOdds } from '../../game/modes/hunt';
import { evolutionOptions, previewEvolution, transferTargets, type EvolutionOption } from '../../game/progression';
import { fmt, getLang, L } from '../../i18n';
import { inDeck } from '../../state/actions';
import { on, store } from '../../state/store';
import { bindTilt, cardHTML, rarityPips, typeBadge } from '../../ui/card';
import { esc, icon, isTopModal, openModal } from '../../ui/dom';
import { huntSpecies } from '../battle/hunt';
import { candyHTML, feedCandy } from './candy';
import { evolveFlow, requirementHTML, transferFlow } from './evolution';
import { toggleTeam } from './team';

type State = 'owned' | 'registered' | 'locked';

const s = () => store.save;

function stateOf(key: CardKey): State {
  if (key in s().cards) return 'owned';
  const { id, shiny } = parseKey(key);
  return !shiny && s().caught[id] ? 'registered' : 'locked';
}

/** Opens the details of `key` (owned or not). `list` enables previous/next navigation. */
export function openDetails(key: CardKey, list: CardKey[] = []) {
  let current = key;
  let untilt = () => {};
  const offs: (() => void)[] = [];
  const modal = openModal({
    className: 'modal-dex',
    label: L().collection.details.label,
    html: '<div class="dx"></div>',
    onClose: () => {
      offs.forEach(off => off());
      untilt();
    },
  });
  const root = modal.root.querySelector<HTMLElement>('.dx')!;

  const render = () => {
    const focused = root.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null;
    const focusSelector = focused?.dataset.act
      ? `[data-act="${focused.dataset.act}"]${focused.dataset.n ? `[data-n="${focused.dataset.n}"]` : ''}${focused.dataset.to ? `[data-to="${focused.dataset.to}"]` : ''}`
      : null;
    untilt();
    root.innerHTML = template(current, list);
    untilt = bindTilt(root.querySelector<HTMLElement>('.dx-art')!);
    if (focusSelector) {
      const target = root.querySelector<HTMLElement>(`${focusSelector}:not([disabled])`) ?? root.querySelector<HTMLElement>('.modal-x');
      target?.focus({ preventScroll: true });
    }
  };

  const go = (step: number) => {
    if (list.length < 2) return;
    const index = list.indexOf(current);
    current = list[(index + step + list.length) % list.length];
    sfx('flip');
    render();
  };

  root.addEventListener('click', async event => {
    const target = event.target as Element;
    const jump = target.closest<HTMLElement>('[data-go]');
    if (jump) {
      current = jump.dataset.go!;
      sfx('click');
      return render();
    }
    const button = target.closest<HTMLElement>('[data-act]');
    if (!button) return;
    switch (button.dataset.act) {
      case 'prev': return go(-1);
      case 'next': return go(1);
      case 'team': return toggleTeam(current);
      case 'candy': return void feedCandy(root, current, button.dataset.n!);
      case 'evolve': {
        const result = await evolveFlow(current, Number(button.dataset.to));
        if (result && !modal.root.classList.contains('closing')) {
          current = result.toKey;
          render();
        }
        return;
      }
      case 'transfer': {
        const result = await transferFlow(current, Number(button.dataset.to));
        if (result && !modal.root.classList.contains('closing')) {
          current = result.toKey;
          render();
        }
        return;
      }
      case 'hunt': {
        if (await huntSpecies(parseKey(current).id)) modal.close();
        return;
      }
      case 'capture': return modal.close();
    }
  });

  const onKey = (event: KeyboardEvent) => {
    if (!isTopModal(modal) || (event.target as Element).closest?.('input, select, textarea')) return;
    if (event.key === 'ArrowLeft') go(-1);
    if (event.key === 'ArrowRight') go(1);
  };
  document.addEventListener('keydown', onKey);
  offs.push(() => document.removeEventListener('keydown', onKey), on('cards', render), on('deck', render), on('items', render));
  render();
}

// --- Template -------------------------------------------------------------------------

function template(key: CardKey, list: CardKey[]): string {
  const t = L().collection.details;
  const { id, shiny } = parseKey(key);
  const sp = getSpecies(id);
  const state = stateOf(key);
  const card = s().cards[key];
  const nav = list.length > 1;
  const otherKey = cardKey(id, !shiny);
  const r = rarity(id);

  return `
    <button class="modal-x" type="button" data-close aria-label="${esc(L().core.actions.close)}">${icon('x')}</button>
    <div class="dx-media">
      <div class="dx-stage">
        ${nav ? `<button class="nav-arrow prev" type="button" data-act="prev" aria-label="${esc(t.prev)}">${icon('left')}</button>` : ''}
        <div class="dx-art">
          ${cardHTML(state === 'owned' ? { id, shiny, level: card.level } : state === 'registered' ? { id } : { id, locked: true }, { size: 'lg', eager: true, animated: state !== 'locked', live: true })}
          <div class="fx-particles dx-particles"></div>
        </div>
        ${nav ? `<button class="nav-arrow next" type="button" data-act="next" aria-label="${esc(t.next)}">${icon('right')}</button>` : ''}
      </div>
      ${otherKey in s().cards ? `
        <button class="btn btn-sm dx-variant ${shiny ? '' : 'is-shiny'}" type="button" data-go="${esc(otherKey)}">
          ${icon('star')} ${esc(shiny ? t.showNormal : t.showShiny)}
        </button>` : ''}
    </div>
    <div class="dx-info">
      <div class="dx-meta">
        ${state === 'locked' ? '' : `<span class="rarity-tag" data-rarity="${r}">${rarityPips(r, 'chip-pips')}${esc(L().core.rarity[r])}</span>`}
        <span class="badge badge-muted">${esc(L().core.card.dex(id))}</span>
        ${shiny ? `<span class="badge badge-shiny">${icon('star')} ${esc(L().core.card.shiny)}</span>` : ''}
        ${state === 'owned' && inDeck(key) ? `<span class="badge badge-gold">${icon('check')} ${esc(t.inTeam)}</span>` : ''}
        ${state === 'owned' ? `<span class="badge">${esc(L().core.card.copies(card.copies))}</span>` : ''}
        ${state === 'registered' ? `<span class="badge badge-muted">${icon('check')} ${esc(L().collection.tile.registered)}</span>` : ''}
        ${state === 'locked' ? `<span class="badge badge-muted">${icon('lock')} ${esc(L().core.card.notCaught)}</span>` : ''}
      </div>
      <h2 class="dx-name">${state === 'locked' ? '???' : esc(sp.name)}</h2>
      ${state === 'locked' ? lockedHTML() : `
        <div class="dx-types">${sp.types.map(typeBadge).join('')}${getLang() === 'en' ? `<span class="dx-genus">${esc(sp.genus)}</span>` : ''}</div>
        ${getLang() === 'en' && sp.flavor ? `<p class="dx-flavor">${esc(sp.flavor)}</p>` : ''}
        <p class="dx-size">${esc(t.size(sp.height / 10, sp.weight / 10))}</p>
        ${state === 'owned' ? levelHTML(key) : registeredHTML(sp)}
        ${statsHTML(sp, state === 'owned' ? card.level : null, shiny)}
        ${state === 'owned' ? actionsHTML(key) : ''}
        ${huntHTML(id)}
        ${familyHTML(sp, key)}
        ${matchupsHTML(sp.types)}`}
    </div>`;
}

function lockedHTML() {
  const t = L().collection.details;
  return `
    <p class="dx-note">${esc(t.lockedText)}</p>
    <a class="btn btn-red" href="#/capture" data-act="capture">${icon('ball')} ${esc(t.goCapture)}</a>`;
}

function registeredHTML(sp: Species) {
  const t = L().collection.details;
  const evolved = descendants(sp.id).map(d => cardKey(d)).find(k => k in s().cards);
  return `
    <div class="dx-panel dx-registered">
      <p>${esc(evolved ? t.registeredEvolved(sp.name, getSpecies(parseKey(evolved).id).name) : t.registeredText(sp.name))}</p>
      ${evolved ? `<button class="btn btn-sm btn-secondary" type="button" data-go="${esc(evolved)}">${icon('right')} ${esc(t.openCard(getSpecies(parseKey(evolved).id).name))}</button>` : ''}
    </div>`;
}

function levelHTML(key: CardKey) {
  const t = L().collection.details;
  const { id, shiny } = parseKey(key);
  const level = s().cards[key].level;
  const cap = levelCap(id, shiny);
  const uncapped = isUncapped(id, shiny);
  const note = shiny ? t.capShiny : level >= cap ? t.capMaxed(cap) : t.capNormal(cap);

  return `
    <div class="dx-panel dx-level ${uncapped ? 'is-uncapped' : ''}">
      <div class="dx-level-row">
        <div class="dx-level-main">
          <small>${esc(t.level)}</small>
          <b data-level>${fmt(level)}</b>
          <span class="dx-cap">${uncapped ? `<span class="dx-inf" title="${esc(L().core.card.uncapped)}">∞</span>` : `/ ${fmt(cap)}`}</span>
        </div>
        <div class="dx-power">
          <small>${esc(L().core.card.powerFull)}</small>
          <b>${fmt(cardPower(id, level, shiny))}</b>
        </div>
      </div>
      ${uncapped ? '' : `<div class="progress dx-level-bar" aria-hidden="true"><i style="width:${Math.min(100, (level / cap) * 100)}%"></i></div>`}
      <p class="dx-cap-note">${uncapped ? icon('sparkle') : ''}${esc(note)}</p>
    </div>`;
}

function statsHTML(sp: Species, level: number | null, shiny: boolean) {
  const t = L().collection.details;
  const values = level != null ? statsAt(sp, level, shiny) : sp.stats;
  return `
    <section class="dx-section">
      <h3 class="label">${esc(level != null ? t.statsAt(level) : t.baseStats)}</h3>
      <div class="dx-stats">
        ${STAT_IDS.map(stat => `
          <div class="dx-stat" title="${esc(L().core.stats[stat])}">
            <span>${esc(L().core.statsShort[stat])}</span>
            <span class="dx-bar"><i style="width:${Math.min(100, (sp.stats[stat] / 180) * 100).toFixed(1)}%;--tc:${TYPE_COLOR[sp.types[0]]}"></i></span>
            <b>${fmt(values[stat])}</b>
          </div>`).join('')}
      </div>
    </section>`;
}

function actionsHTML(key: CardKey) {
  const t = L().collection.details;
  const { id, shiny } = parseKey(key);
  const isIn = inDeck(key);
  const full = s().deck.length >= DECK_SIZE;
  const options = evolutionOptions(s(), key);
  const transfers = transferTargets(s(), key);
  const canEver = evolutionsOf(id).length > 0;

  const evolveRow = (o: EvolutionOption) => `
    <div class="dx-evo-opt ${o.ready ? 'ready' : ''}" style="--tc:${TYPE_COLOR[getSpecies(o.to).types[0]]}">
      <img src="${esc(spriteUrl(o.to))}" alt="" width="96" height="96">
      <div class="dx-evo-text">
        <b>${esc(getSpecies(o.to).name)}</b>
        <span class="dx-evo-reqs">${requirementHTML(o)}</span>
      </div>
      <button class="btn btn-evolve btn-sm" type="button" data-act="evolve" data-to="${o.to}" ${o.ready ? '' : 'disabled'}
        aria-label="${esc(t.evolveTo(getSpecies(o.to).name))}">${icon('up')} ${esc(L().collection.evolution.evolve)}</button>
    </div>`;
  // An evolved form already owned: the level can be passed to it with no requirements (instead of evolving).
  const transferRow = (to: number) => `
    <div class="dx-evo-opt ready" style="--tc:${TYPE_COLOR[getSpecies(to).types[0]]}">
      <img src="${esc(spriteUrl(to))}" alt="" width="96" height="96">
      <div class="dx-evo-text">
        <b>${esc(getSpecies(to).name)}</b>
        <span class="dx-evo-reqs"><span class="evo-req ok">${icon('cards')}${esc(t.transferInfo(s().cards[cardKey(to)].level, previewEvolution(s(), key, to).level))}</span></span>
      </div>
      <button class="btn btn-evolve btn-sm" type="button" data-act="transfer" data-to="${to}"
        aria-label="${esc(t.transferTo(getSpecies(to).name))}">${icon('up')} ${esc(t.transfer)}</button>
    </div>`;
  const rows = [
    ...options.map(o => (transfers.includes(o.to) ? transferRow(o.to) : evolveRow(o))),
    ...transfers.filter(to => !options.some(o => o.to === to)).map(transferRow),
  ];

  const teamButton = isIn
    ? `<button class="btn btn-danger" type="button" data-act="team">${icon('minus')} ${esc(t.removeTeam)}</button>`
    : `<button class="btn btn-primary" type="button" data-act="team" ${full ? `disabled title="${esc(t.teamFull)}"` : ''}>${icon('plus')} ${esc(t.addTeam)}</button>`;

  return `
    <section class="dx-section dx-actions-wrap">
      <div class="dx-actions">${teamButton}</div>
      ${full && !isIn ? `<p class="hint">${esc(t.teamFullHint)}</p>` : ''}
      ${candyHTML(key)}
      ${rows.length ? `
        <div class="dx-evolve">
          <h3 class="label">${esc(t.evolveTitle)}</h3>
          ${rows.join('')}
        </div>` : canEver && shiny ? `<p class="hint">${esc(t.shinyNoEvolve)}</p>` : ''}
    </section>`;
}

/** Shiny Hunt entry for a caught species (legendaries get a note instead of the button). */
function huntHTML(id: number) {
  const t = L().collection.details;
  const block = huntBlock(id, s().caught);
  if (block === 'not-caught') return '';
  const hunt = s().hunt;
  const current = hunt.target === id;
  const text = block ? t.huntLegendary : current ? t.huntCurrent(hunt.chain, shinyOdds(hunt.chain)) : t.huntText(shinyOdds(0), shinyOdds(CHAIN_MAX));
  return `
    <section class="dx-section dx-hunt">
      <div class="dx-hunt-text">
        <h3 class="label">${icon('sparkle')} ${esc(t.huntTitle)}</h3>
        <p>${esc(text)}</p>
      </div>
      ${block ? '' : `<button class="btn btn-secondary" type="button" data-act="hunt">${icon('search')} ${esc(current ? t.huntContinue : t.hunt)}
        <small class="dx-hunt-fee">₽ ${fmt(entryFee(id))}</small></button>`}
    </section>`;
}

/** Steps from the family's root, babies included (Pichu 0, Pikachu 1, Raichu 2), unlike stage(). */
const familyDepth = (id: number): number => {
  const from = preEvolution(id);
  return from == null ? 0 : familyDepth(from) + 1;
};

function familyHTML(sp: Species, key: CardKey) {
  const t = L().collection.details;
  const family = familyOf(sp.id);
  if (family.length < 2) return '';
  const columns = new Map<number, Species[]>();
  for (const member of family) {
    const depth = familyDepth(member.id);
    columns.set(depth, [...(columns.get(depth) ?? []), member]);
  }
  const currentId = parseKey(key).id;

  const member = (m: Species) => {
    const state = stateOf(cardKey(m.id));
    const level = s().cards[cardKey(m.id)]?.level;
    const from = preEvolution(m.id);
    const evo = from != null ? evolutionsOf(from).find(e => e.to === m.id) : undefined;
    const req = evo ? requirementHTML({ level: requiredLevel(evo), item: requiredItem(evo), missing: {} }, { status: false }) : '';
    const name = state === 'locked' ? '???' : m.name;
    return `
      <button class="dx-fam ${state} ${m.id === currentId ? 'current' : ''}" type="button" data-go="${esc(cardKey(m.id))}"
        style="--tc:${TYPE_COLOR[m.types[0]]}" aria-label="${esc(`${name}${level != null ? `, ${L().core.card.levelFull(level)}` : ''}`)}"
        ${m.id === currentId ? 'aria-current="true"' : ''}>
        <span class="dx-fam-sprite"><img src="${esc(spriteUrl(m.id))}" alt="" width="96" height="96" loading="lazy"></span>
        ${m.baby ? `<i class="dx-fam-baby" title="${esc(t.babyHint)}">${esc(t.baby)}</i>` : ''}
        <b>${esc(name)}</b>
        <small>${level != null ? esc(`${L().core.card.level} ${fmt(level)}`) : state === 'registered' ? icon('check') : '&nbsp;'}</small>
        ${req ? `<span class="dx-fam-req">${req}</span>` : ''}
      </button>`;
  };

  return `
    <section class="dx-section">
      <h3 class="label">${esc(t.family)}</h3>
      <div class="dx-family">
        ${[...columns.entries()].sort(([a], [b]) => a - b).map(([, members], i) => `
          ${i ? `<span class="dx-fam-arrow" aria-hidden="true">${icon('right')}</span>` : ''}
          <div class="dx-fam-col ${members.length > 2 ? 'is-branch' : ''}" style="--n:${members.length}">${members.map(member).join('')}</div>`).join('')}
      </div>
    </section>`;
}

function matchupsHTML(types: PokemonType[]) {
  const t = L().collection.details;
  const groups: { label: string; items: [PokemonType, number][] }[] = [
    { label: t.weak, items: [] },
    { label: t.resist, items: [] },
    { label: t.immune, items: [] },
  ];
  for (const attack of TYPES) {
    const m = effectiveness(attack, types);
    if (m > 1) groups[0].items.push([attack, m]);
    else if (m === 0) groups[2].items.push([attack, m]);
    else if (m < 1) groups[1].items.push([attack, m]);
  }
  const mult = (m: number) => (m === 0.5 ? '½' : m === 0.25 ? '¼' : String(m));
  return `
    <section class="dx-section">
      <h3 class="label">${esc(t.matchups)}</h3>
      <div class="dx-matchups">
        ${groups.filter(g => g.items.length).map(g => `
          <div class="dx-match">
            <span class="dx-match-label">${esc(g.label)}</span>
            <div class="dx-match-list">
              ${g.items.sort((a, b) => b[1] - a[1]).map(([type, m]) => `<span class="dx-mult ${m >= 4 || (m > 0 && m <= 0.25) ? 'strong' : ''}">${typeBadge(type)}<b>×${mult(m)}</b></span>`).join('')}
            </div>
          </div>`).join('')}
      </div>
    </section>`;
}
