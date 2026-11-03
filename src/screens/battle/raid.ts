// Legendary Battle (#/battle/raid): pick a region, pay the fee and fight whichever legendary or mythical shows up. The
// screen shows the region's bosses (the ones not owned yet as silhouettes), the odds and the guaranteed-catch counter.
// Rules live in src/game/modes/raid.ts.

import { sfx } from '../../audio';
import { getSpecies } from '../../data/species';
import { itemSprite } from '../../data/items';
import { spriteUrl } from '../../data/sprites';
import { TYPE_COLOR } from '../../data/types';
import { cardKey } from '../../game/cards';
import {
  canRaid, finishRaid, raidBossCard, raidBossKind, raidLevel, raidPool, raidRecord, raidUnlocked, raidWinRewards, RAID_CATCH_CHANCE, raidFee, RAID_HP_MULT,
  RAID_PITY, RAID_SHINY_CHANCE, startRaid,
} from '../../game/modes/raid';
import { visibleRegions } from '../../game/journey';
import type { RegionId } from '../../game/regions';
import { playerScale } from '../../game/teams';
import { fmt, itemName, L } from '../../i18n';
import { grant, recordBattle } from '../../state/actions';
import { on, store, update } from '../../state/store';
import { confirmDialog, esc, icon, shakeCoins, toast } from '../../ui/dom';
import { showRewards } from '../../ui/rewards';
import type { ModeModule } from '../types';
import { battleActive, runBattle } from './arena';
import { clickedRegion, regionLabel, regionSwitchHTML } from './regions';
import { ensureTeam, teamSummaryHTML } from './team';

let host: HTMLElement | null = null;
let offs: (() => void)[] = [];
/** Region on screen (null: the newest unlocked one of those shown). */
let region: RegionId | null = null;

const t = () => L().battle.raid;

const shownRegion = (): RegionId =>
  region ?? [...visibleRegions()].reverse().find(r => raidUnlocked(store.save, r)) ?? visibleRegions()[0];

export const raidMode: ModeModule = {
  render(container) {
    host = container;
    container.addEventListener('click', onClick);
    offs = [on('deck', render), on('cards', render), on('progress', render), on('coins', render)];
    render();
  },
  dispose() {
    host?.removeEventListener('click', onClick);
    offs.forEach(off => off());
    offs = [];
    host = null;
    region = null;
  },
};

function tabs() {
  if (visibleRegions().length < 2) return '';
  return regionSwitchHTML(shownRegion(), visibleRegions().map(r => {
    const open = raidUnlocked(store.save, r);
    const pool = raidPool(r);
    return {
      region: r,
      locked: !open,
      done: pool.every(s => cardKey(s.id) in store.save.cards),
      note: open ? `${pool.filter(s => cardKey(s.id) in store.save.cards).length}/${pool.length}` : t().noTitle,
    };
  }), t().region);
}

function render() {
  if (!host || battleActive()) return;
  const shown = shownRegion();
  host.innerHTML = `
    <div class="view-head">
      <div>
        <h1 class="view-title">${esc(t().title)}</h1>
        <p class="view-sub">${esc(t().sub)}</p>
      </div>
      ${tabs()}
    </div>
    ${teamSummaryHTML(true)}
    ${raidUnlocked(store.save, shown) ? panelHTML(shown) : lockedHTML(shown)}`;
}

function poolHTML(shown: RegionId) {
  return `
    <ul class="raid-pool" aria-label="${esc(t().pool)}">
      ${raidPool(shown).map(s => {
        const owned = cardKey(s.id) in store.save.cards;
        const shiny = cardKey(s.id, true) in store.save.cards;
        return `
          <li class="raid-boss${owned || shiny ? ' is-owned' : ''}" title="${esc(owned || shiny ? s.name : t().unknown)}">
            <img src="${esc(spriteUrl(s.id, shiny && !owned))}" alt="${esc(owned || shiny ? s.name : t().unknown)}" width="64" height="64" loading="lazy" draggable="false">
            ${shiny ? icon('sparkle') : ''}
          </li>`;
      }).join('')}
    </ul>`;
}

function lockedHTML(shown: RegionId) {
  const name = regionLabel(shown);
  return `
    <section class="raid-panel is-locked">
      <h2 class="raid-title">${icon('lock')} ${esc(t().lockedTitle(name))}</h2>
      <p class="view-sub">${esc(t().lockedText(name))}</p>
      ${poolHTML(shown)}
      <a class="btn btn-primary" href="#/battle/league">${icon('crown')} ${esc(t().goLeague)}</a>
    </section>`;
}

function panelHTML(shown: RegionId) {
  const fee = raidFee(shown);
  const record = raidRecord(store.save, shown);
  const left = RAID_PITY - record.sinceCatch;
  const broke = store.save.coins < fee;
  const [coins, candy] = raidWinRewards(shown);
  return `
    <section class="raid-panel">
      <div class="raid-side">
        <h2 class="raid-title">${esc(t().pool)}</h2>
        <p class="view-sub">${esc(t().poolText)}</p>
        ${poolHTML(shown)}
        <dl class="raid-stats">
          <div><dt class="label">${esc(t().wins)}</dt><dd>${fmt(record.wins)}</dd></div>
          <div><dt class="label">${esc(t().losses)}</dt><dd>${fmt(record.losses)}</dd></div>
        </dl>
      </div>
      <div class="raid-side">
        <div class="league-pills">
          <span class="pill">${icon('coin', 'i-coin')} ${esc(t().fee)}: <b>₽ ${fmt(fee)}</b></span>
          <span class="pill">${icon('bolt')} ${esc(t().level)}: <b>${esc(L().modes.level(raidLevel(shown, playerScale(store.save))))}</b></span>
          <span class="pill">${icon('plus')} ${esc(t().hp(RAID_HP_MULT))}</span>
        </div>
        <ul class="raid-odds">
          <li>${icon('sparkle')}<span>${esc(t().shinyChance)}</span><b>${Math.round(RAID_SHINY_CHANCE * 100)}%</b></li>
          <li>${icon('ball')}<span>${esc(t().catchChance)}</span><b>${Math.round(RAID_CATCH_CHANCE * 100)}%</b></li>
          <li><img src="${esc(itemSprite('master-ball'))}" alt="" width="24" height="24"><span>${esc(t().duplicate(itemName('master-ball')))}</span></li>
          <li>${icon('gift')}<span>${esc(t().everyWin)}</span><b>₽ ${fmt(coins.kind === 'coins' ? coins.amount : 0)} · ${esc(itemName('rare-candy'))} ×${fmt(candy.kind === 'item' ? candy.amount : 0)}</b></li>
        </ul>
        <div class="raid-pity">
          <span class="label">${esc(t().pity(left))}</span>
          <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${RAID_PITY}" aria-valuenow="${record.sinceCatch}" aria-label="${esc(t().pity(left))}"><i style="width:${(record.sinceCatch / RAID_PITY) * 100}%"></i></div>
        </div>
        <button class="btn btn-primary btn-lg" type="button" data-act="raid">${icon('swords')} ${esc(t().go)} <small class="btn-price">₽ ${fmt(fee)}</small></button>
        ${broke ? `<p class="league-warn">${esc(L().core.notEnoughCoins(fee))}</p>` : ''}
      </div>
    </section>`;
}

function onClick(event: Event) {
  const picked = clickedRegion(event) as RegionId | undefined;
  if (picked && visibleRegions().includes(picked)) {
    if (picked !== shownRegion()) {
      sfx('toggle');
      region = picked;
      render();
      host?.querySelector<HTMLElement>(`.region-tab[data-region="${picked}"]`)?.focus();
    }
    return;
  }
  if ((event.target as Element).closest('[data-act="raid"]')) void challenge();
}

async function challenge() {
  const shown = shownRegion();
  const fee = raidFee(shown);
  const check = canRaid(store.save, shown);
  if (battleActive() || check === 'locked') return;
  if (check === 'coins') {
    sfx('error');
    shakeCoins();
    toast(L().core.notEnoughCoins(fee), 'warning');
    return;
  }
  if (!ensureTeam()) return;
  sfx('open');
  const name = regionLabel(shown);
  const ok = await confirmDialog({ title: t().confirmTitle(name), message: t().confirmText(fee), confirmText: L().modes.league.enterConfirm });
  if (!ok) return;
  const boss = update(save => startRaid(save, shown), ['progress']);
  if (boss == null) return;
  sfx('buy');
  region = shown;
  const sp = getSpecies(boss);
  const level = raidLevel(shown, playerScale(store.save));

  const outcome = await runBattle({
    mode: 'raid',
    opponent: {
      id: `raid-${boss}`,
      name: sp.name,
      title: t().kinds[raidBossKind(boss)],
      portrait: spriteUrl(boss),
      team: [{ id: boss, level, shiny: false }],
      cards: [raidBossCard(boss, level)],
      intro: t().intro(sp.name),
    },
    music: 'champion',
    stage: `${t().title} · ${name}`,
    accent: TYPE_COLOR[sp.types[0]],
  });

  const won = !outcome.forfeit && outcome.result === 'win';
  recordBattle(outcome.forfeit ? 'forfeit' : outcome.result);
  const result = update(save => finishRaid(save, shown, boss, won), ['progress']);
  if (won) {
    await showRewards(grant(result.rewards), {
      title: t().result[result.caught](sp.name),
      subtitle: result.caught === 'none' ? t().pity(RAID_PITY - raidRecord(store.save, shown).sinceCatch) : undefined,
      tone: result.caught === 'shiny' || result.caught === 'normal' ? 'champion' : 'default',
    });
  } else {
    toast(t().lost(sp.name), 'info');
  }
  render();
}
