// Shiny Hunt screen: the target species, its chain meter and odds, and the paid "hunt" button that starts a battle
// against a wild horde. Targets are picked from the Pokédex (card details -> Hunt), see huntSpecies().
// Rules live in src/game/modes/hunt.ts.

import { sfx } from '../../audio';
import { getSpecies } from '../../data/species';
import { spriteUrl } from '../../data/sprites';
import { TYPE_COLOR } from '../../data/types';
import { cardKey } from '../../game/cards';
import {
  CHAIN_MAX, COPY_CHANCE, entryFee, hordeTeam, huntBlock, huntRewards, LEVEL_SPREAD, recordHunt, setTarget, shinyOdds,
} from '../../game/modes/hunt';
import { MIN_LEVEL } from '../../game/modes/training';
import { playerLevels } from '../../game/teams';
import { fmt, L } from '../../i18n';
import { grant, recordBattle } from '../../state/actions';
import { on, store, update } from '../../state/store';
import { typeBadge } from '../../ui/card';
import { confirmDialog, esc, icon, shakeCoins, toast } from '../../ui/dom';
import { showRewards } from '../../ui/rewards';
import { navigate } from '../../ui/shell';
import type { ModeModule } from '../types';
import { battleActive, runBattle } from './arena';
import { ensureTeam, teamSummaryHTML } from './team';

let host: HTMLElement | null = null;
let unsubscribe: (() => void)[] = [];

export const huntMode: ModeModule = {
  render(container) {
    host = container;
    container.addEventListener('click', onClick);
    unsubscribe = [on('deck', render), on('cards', render), on('progress', render), on('coins', render)];
    render();
  },
  dispose() {
    host?.removeEventListener('click', onClick);
    unsubscribe.forEach(off => off());
    unsubscribe = [];
    host = null;
  },
};

/**
 * Makes `id` the hunt target and opens the hunt screen. Switching away from a running chain asks first.
 * Resolves false when the species can't be hunted or the player cancelled.
 */
export async function huntSpecies(id: number): Promise<boolean> {
  const t = L().battle.hunt;
  const block = huntBlock(id, store.save.caught);
  if (block) {
    sfx('error');
    toast(block === 'legendary' ? t.legendary : t.notCaught, 'warning');
    return false;
  }
  const { target, chain } = store.save.hunt;
  if (target != null && target !== id && chain > 0) {
    const ok = await confirmDialog({
      title: t.switchTitle,
      message: t.switchText(getSpecies(target).name, chain, getSpecies(id).name),
      confirmText: t.switchConfirm,
      danger: true,
    });
    if (!ok) return false;
  }
  update(s => setTarget(s.hunt, id), ['progress']);
  sfx('open');
  navigate('battle/hunt');
  return true;
}

function render() {
  if (!host || battleActive()) return;
  const t = L().battle.hunt;
  const hunt = store.save.hunt;
  host.innerHTML = `
    <div class="view-head">
      <div>
        <h1 class="view-title">${esc(t.title)}</h1>
        <p class="view-sub">${esc(t.sub)}</p>
      </div>
      <div class="hunt-totals">
        <span><small>${esc(t.bestChain)}</small><b>${fmt(hunt.bestChain)}</b></span>
        <span><small>${esc(t.found)}</small><b>${icon('sparkle')} ${fmt(hunt.shinies)}</b></span>
      </div>
    </div>
    ${teamSummaryHTML(true)}
    ${hunt.target != null && !huntBlock(hunt.target, store.save.caught) ? targetHTML(hunt.target) : `
      <section class="hunt-empty">
        <span class="hunt-empty-icon">${icon('search')}</span>
        <div>
          <h2>${esc(t.emptyTitle)}</h2>
          <p>${esc(t.emptyText)}</p>
        </div>
        <a class="btn btn-primary" href="#/collection">${icon('cards')} ${esc(t.pick)}</a>
      </section>`}`;
}

function targetHTML(id: number): string {
  const t = L().battle.hunt;
  const hunt = store.save.hunt;
  const sp = getSpecies(id);
  const fee = entryFee(id);
  const avg = playerLevels(store.save).team;
  const [lo, hi] = [Math.max(MIN_LEVEL, avg - LEVEL_SPREAD), Math.max(MIN_LEVEL, avg + LEVEL_SPREAD)];
  const card = store.save.cards[cardKey(id)];
  const shinyOwned = cardKey(id, true) in store.save.cards;
  const fill = Math.min(1, hunt.chain / CHAIN_MAX);
  const broke = store.save.coins < fee;
  return `
    <section class="hunt-panel" style="--tc:${TYPE_COLOR[sp.types[0]]}">
      <div class="hunt-target">
        <div class="hunt-sprites">
          <img class="hunt-sprite" src="${esc(spriteUrl(id))}" alt="" draggable="false">
          <span class="hunt-goal" title="${esc(t.goal)}">
            <img src="${esc(spriteUrl(id, true))}" alt="" draggable="false">
            ${icon('sparkle')}
          </span>
        </div>
        <div class="hunt-target-info">
          <span class="hunt-label">${esc(t.target)}</span>
          <h2 class="hunt-name">${esc(sp.name)}</h2>
          <span class="hunt-types">${sp.types.map(typeBadge).join('')}</span>
          <span class="hunt-owned">${esc(card ? t.owned(card.level) : t.registered)}</span>
          ${shinyOwned ? `<span class="hunt-owned">${icon('sparkle')} ${esc(t.shinyOwned)}</span>` : ''}
          <button class="btn btn-ghost btn-sm" type="button" data-act="change">${icon('reset')} ${esc(t.change)}</button>
        </div>
      </div>
      <div class="hunt-chain">
        <div class="hunt-chain-head">
          <span class="hunt-label">${esc(t.chain)}</span>
          <b class="hunt-chain-num">${fmt(hunt.chain)}</b>
        </div>
        <div class="hunt-meter" role="meter" aria-valuemin="0" aria-valuemax="${CHAIN_MAX}" aria-valuenow="${Math.min(hunt.chain, CHAIN_MAX)}" aria-label="${esc(t.chain)}">
          <i style="width:${(fill * 100).toFixed(1)}%"></i>
          ${[10, 25, CHAIN_MAX].map(n => `<span class="hunt-tick ${hunt.chain >= n ? 'on' : ''}" style="left:${(n / CHAIN_MAX) * 100}%"><em>${n}</em></span>`).join('')}
        </div>
        <ul class="hunt-odds">
          <li class="hunt-odd-shiny">${icon('sparkle')}<span>${esc(t.shinyChance)}</span><b>${esc(t.oneIn(shinyOdds(hunt.chain)))}</b></li>
          <li><img src="${esc(spriteUrl(id))}" alt="" width="28" height="28"><span>${esc(t.copyChance)}</span><b>${Math.round(COPY_CHANCE * 100)}%</b></li>
          <li>${icon('swords')}<span>${esc(t.horde)}</span><b>${esc(t.levels(lo, hi))}</b></li>
        </ul>
        <p class="hunt-rule">${esc(hunt.chain >= CHAIN_MAX ? t.maxed : t.rule)}</p>
        <button class="btn btn-primary btn-lg hunt-go" type="button" data-act="hunt" ${broke ? 'aria-disabled="true"' : ''}>
          ${icon('search')} ${esc(t.go)} <span class="hunt-fee">${icon('coin', 'i-coin')} ₽ ${fmt(fee)}</span>
        </button>
        ${broke ? `<p class="hunt-broke">${esc(t.broke(fee))}</p>` : ''}
      </div>
    </section>`;
}

function onClick(event: Event) {
  const act = (event.target as Element).closest<HTMLElement>('[data-act]')?.dataset.act;
  if (act === 'hunt') void hunt();
  if (act === 'change') {
    sfx('click');
    navigate('collection');
  }
}

async function hunt() {
  const t = L().battle.hunt;
  const id = store.save.hunt.target;
  if (id == null || battleActive() || huntBlock(id, store.save.caught)) return;
  const fee = entryFee(id);
  if (store.save.coins < fee) {
    sfx('error');
    shakeCoins();
    toast(t.broke(fee), 'warning');
    return;
  }
  if (!ensureTeam()) return;
  sfx('click');
  const sp = getSpecies(id);
  const chain = store.save.hunt.chain;
  update(s => { s.coins -= fee; });

  const outcome = await runBattle({
    mode: 'hunt',
    opponent: {
      id: `hunt-${id}`, name: t.hordeName(sp.name), title: t.wild, portrait: spriteUrl(id),
      team: hordeTeam(id, playerLevels(store.save).team), intro: t.intro(sp.name),
    },
    stage: t.stage(chain),
    accent: TYPE_COLOR[sp.types[0]],
  });

  const won = !outcome.forfeit && outcome.result === 'win';
  recordBattle(outcome.forfeit ? 'forfeit' : outcome.result);
  const rewards = won ? huntRewards(id, chain) : [];
  const foundShiny = rewards.some(r => r.kind === 'card' && r.shiny);
  update(s => recordHunt(s.hunt, won, foundShiny), ['progress']);

  if (won && rewards.length) {
    await showRewards(grant(rewards), {
      title: foundShiny ? t.shinyTitle(sp.name) : t.winTitle,
      subtitle: t.chainNow(store.save.hunt.chain),
    });
  } else if (won) {
    toast(t.noDrop(store.save.hunt.chain), 'info');
  } else if (!outcome.forfeit || chain > 0) {
    toast(chain > 0 ? t.chainBroken(chain) : t.lost, 'info');
  }
  render();
}
