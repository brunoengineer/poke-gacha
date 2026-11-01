// First-run onboarding: the professor's welcome, the starter choice (Bulbasaur, Charmander or Squirtle),
// a small celebration, then four quick tips that end on the Capture screen.
// API contract: maybeOnboard() resolves once the player has a starter (immediately if they already do).

import { playCry, playMusic, sfx } from '../audio';
import { animatedSpriteUrl, spriteUrl, trainerSpriteUrl } from '../data/sprites';
import { evolutionsOf, getSpecies } from '../data/species';
import { TYPE_COLOR } from '../data/types';
import { STARTER_LEVEL, STARTERS, STARTING_COINS } from '../game/economy';
import { BANNERS } from '../game/gacha';
import { L } from '../i18n';
import { chooseStarter } from '../state/actions';
import { store } from '../state/store';
import { cardHTML, typeBadge } from '../ui/card';
import { esc, icon, openModal, reducedMotion, type Modal } from '../ui/dom';
import { burst } from '../ui/fx';
import { ballHTML } from './capture/common';

type Scene = 'intro' | 'choose' | 'picked' | 'tips';

export function maybeOnboard(): Promise<void> {
  if (store.save.starter != null) return Promise.resolve();
  return new Promise(resolve => {
    const t = L().capture.onboarding;
    playMusic('title');
    const modal = openModal({
      className: 'fx-overlay onboard',
      label: t.label,
      dismissable: false,
      html: '<div class="onb-scene" aria-live="polite"></div>',
      onClose: () => resolve(),
    });
    new Onboarding(modal).start();
  });
}

class Onboarding {
  private scene: Scene = 'intro';
  private line = 0;
  private slide = 0;
  private picked: number | null = null;
  private typing: ReturnType<typeof setInterval> | null = null;
  private readonly host: HTMLElement;

  constructor(private modal: Modal) {
    this.host = modal.root.querySelector('.onb-scene')!;
    modal.root.addEventListener('click', event => this.onClick(event));
    modal.root.addEventListener('keydown', event => this.onKey(event));
  }

  start() {
    this.show('intro');
  }

  private show(scene: Scene) {
    this.scene = scene;
    this.stopTyping();
    const html = { intro: () => this.introHTML(), choose: () => this.chooseHTML(), picked: () => this.pickedHTML(), tips: () => this.tipsHTML() }[scene]();
    this.host.innerHTML = `<div class="onb-step onb-${scene}">${html}</div>`;
    this.host.firstElementChild!.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: reducedMotion() ? 0 : 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    if (scene === 'intro') this.typeLine();
    if (scene === 'picked') this.celebrate();
    requestAnimationFrame(() => this.host.querySelector<HTMLElement>('[data-focus]')?.focus({ preventScroll: true }));
  }

  // --- Scenes -----------------------------------------------------------------------

  private introHTML() {
    const t = L().capture.onboarding;
    return `
      <div class="onb-prof">
        <span class="onb-prof-halo" aria-hidden="true"></span>
        <img class="onb-prof-img" src="${esc(trainerSpriteUrl('oak'))}" alt="" width="160" height="160" onerror="this.style.visibility='hidden'">
      </div>
      <div class="onb-bubble">
        <p class="onb-speaker">${esc(t.professor)}</p>
        <p class="onb-line"><span class="sr-only" data-full></span><span aria-hidden="true" data-typed></span><i class="onb-caret" aria-hidden="true"></i></p>
        <div class="onb-dots" aria-hidden="true">${t.intro.map((_, i) => `<i class="${i === this.line ? 'on' : ''}"></i>`).join('')}</div>
      </div>
      <button class="btn btn-primary btn-lg onb-next" type="button" data-next data-focus>${esc(t.next)} ${icon('right')}</button>`;
  }

  private chooseHTML() {
    const t = L().capture.onboarding;
    return `
      <h2 class="fx-title">${esc(t.chooseTitle)}</h2>
      <p class="onb-sub">${esc(t.chooseSub)}</p>
      <div class="onb-starters" role="radiogroup" aria-label="${esc(t.chooseTitle)}">
        ${STARTERS.map((id, i) => {
          const s = getSpecies(id);
          const color = TYPE_COLOR[s.types[0]];
          return `
            <button class="onb-starter" type="button" role="radio" aria-checked="${this.picked === id}" tabindex="${(this.picked ?? STARTERS[0]) === id ? 0 : -1}"
              data-starter="${id}" style="--tc:${color};--i:${i}" ${i === 0 && this.picked == null ? 'data-focus' : this.picked === id ? 'data-focus' : ''}>
              <span class="onb-starter-stage" aria-hidden="true">
                <img src="${esc(animatedSpriteUrl(id) ?? spriteUrl(id))}" alt="" width="96" height="96">
              </span>
              <b class="onb-starter-name">${esc(s.name)}</b>
              <span class="onb-starter-types">${s.types.map(typeBadge).join('')}</span>
              <span class="onb-starter-line">${esc(t.starters[id] ?? '')}</span>
              <span class="onb-check" aria-hidden="true">${icon('check')}</span>
            </button>`;
        }).join('')}
      </div>
      <button class="btn btn-primary btn-lg onb-confirm" type="button" data-confirm ${this.picked == null ? 'disabled' : ''}>
        ${this.picked == null ? esc(t.next) : esc(t.choose(getSpecies(this.picked).name))}
      </button>`;
  }

  private pickedHTML() {
    const t = L().capture.onboarding;
    const id = this.picked!;
    return `
      <div class="onb-reveal" style="--tc:${TYPE_COLOR[getSpecies(id).types[0]]}">
        <span class="onb-rays" aria-hidden="true"></span>
        ${cardHTML({ id, level: STARTER_LEVEL }, { size: 'sm', animated: true, eager: true })}
      </div>
      <h2 class="fx-title">${esc(t.picked(getSpecies(id).name))}</h2>
      <p class="onb-sub">${esc(t.pickedSub)}</p>
      <button class="btn btn-primary btn-lg" type="button" data-to-tips data-focus>${esc(t.next)} ${icon('right')}</button>`;
  }

  private tipsHTML() {
    const t = L().capture.onboarding;
    const slide = t.slides[this.slide];
    const last = this.slide === t.slides.length - 1;
    return `
      <p class="onb-count">${esc(t.slideOf(this.slide + 1, t.slides.length))}</p>
      <div class="onb-art" aria-hidden="true">${this.tipArt(this.slide)}</div>
      <h2 class="fx-title onb-tip-title">${esc(slide.title)}</h2>
      <p class="onb-tip-text">${esc(slide.text)}</p>
      ${slide.secret ? `<p class="onb-secret">${icon('sparkle')}${esc(slide.secret)}</p>` : ''}
      ${this.slide === 3 ? this.modesHTML() : ''}
      <div class="onb-pager" aria-hidden="true">${t.slides.map((_, i) => `<i class="${i === this.slide ? 'on' : ''}"></i>`).join('')}</div>
      <div class="onb-nav">
        ${this.slide > 0 ? `<button class="btn btn-ghost btn-lg" type="button" data-tip="-1">${icon('left')} ${esc(t.back)}</button>` : ''}
        ${last
          ? `<button class="btn btn-red btn-lg onb-finish" type="button" data-finish data-focus>${icon('ball')} ${esc(t.finish)}</button>`
          : `<button class="btn btn-primary btn-lg" type="button" data-tip="1" data-focus>${esc(t.next)} ${icon('right')}</button>`}
      </div>
      ${last ? `<p class="onb-note">${icon('coin', 'i-coin')}${esc(t.finishNote(L().core.coins(STARTING_COINS), Math.floor(STARTING_COINS / BANNERS.poke.cost!)))}</p>` : ''}`;
  }

  private modesHTML() {
    const m = L().capture.onboarding.modes;
    const chip = (iconName: string, label: string) => `<li>${icon(iconName)}<span>${esc(label)}</span></li>`;
    return `<ul class="onb-modes">${chip('users', m.training)}${chip('trophy', m.competition)}${chip('medal', m.gyms)}${chip('crown', m.league)}</ul>`;
  }

  private tipArt(index: number) {
    const id = this.picked ?? STARTERS[0];
    const t = L();
    switch (index) {
      case 0:
        return `
          <div class="art-balls">
            ${[0, 1, 2].map(i => `<span style="--i:${i}">${ballHTML('poke', 64)}</span>`).join('')}
            <span class="art-price">${icon('coin', 'i-coin')}10</span>
          </div>`;
      case 1:
        return `
          <div class="art-dupe">
            <div class="art-card">${cardHTML({ id, level: STARTER_LEVEL }, { size: 'sm', eager: true })}</div>
            <span class="art-plus">+</span>
            <div class="art-card">${cardHTML({ id, level: STARTER_LEVEL }, { size: 'sm', eager: true })}</div>
            <span class="art-arrow">${icon('right')}</span>
            <span class="cap-tag" data-tag="level">${icon('up')}${esc(t.capture.pull.tagLevel(STARTER_LEVEL, STARTER_LEVEL + 1))}</span>
          </div>`;
      case 2: {
        const line = [id];
        let next = evolutionsOf(id)[0]?.to;
        while (next != null && line.length < 3) {
          line.push(next);
          next = evolutionsOf(next)[0]?.to;
        }
        return `
          <div class="art-evo">
            ${line.map((mon, i) => `${i ? `<span class="art-arrow">${icon('right')}</span>` : ''}<img src="${esc(spriteUrl(mon))}" alt="" width="80" height="80" class="${i === 0 ? 'is-base' : ''}">`).join('')}
            <span class="art-infinity">∞</span>
          </div>`;
      }
      default:
        return `
          <div class="art-battle">
            <img src="${esc(spriteUrl(id))}" alt="" width="96" height="96">
            <span class="art-vs">VS</span>
            <img src="${esc(trainerSpriteUrl('blue'))}" alt="" width="96" height="96" onerror="this.style.visibility='hidden'">
          </div>`;
    }
  }

  // --- Behavior ----------------------------------------------------------------------

  private typeLine() {
    const text = L().capture.onboarding.intro[this.line];
    const typed = this.host.querySelector<HTMLElement>('[data-typed]')!;
    this.host.querySelector<HTMLElement>('[data-full]')!.textContent = text;
    if (reducedMotion()) {
      typed.textContent = text;
      return;
    }
    let i = 0;
    typed.textContent = '';
    this.host.querySelector('.onb-line')!.classList.add('is-typing');
    this.typing = setInterval(() => {
      i += 1;
      typed.textContent = text.slice(0, i);
      if (i % 3 === 0 && text[i - 1] !== ' ') sfx('click');
      if (i >= text.length) this.stopTyping();
    }, 24 * (store.save.settings.fastFx ? 0.5 : 1));
  }

  private stopTyping() {
    if (this.typing) clearInterval(this.typing);
    this.typing = null;
    const typed = this.host.querySelector<HTMLElement>('[data-typed]');
    if (typed && this.scene === 'intro') typed.textContent = L().capture.onboarding.intro[this.line];
    this.host.querySelector('.onb-line')?.classList.remove('is-typing');
  }

  private nextLine() {
    if (this.typing) return this.stopTyping();
    sfx('click');
    const lines = L().capture.onboarding.intro;
    if (this.line < lines.length - 1) {
      this.line += 1;
      this.show('intro');
    } else {
      this.show('choose');
    }
  }

  private select(id: number) {
    if (this.picked !== id) {
      this.picked = id;
      sfx('cardPick');
      playCry(id);
    }
    const t = L().capture.onboarding;
    this.host.querySelectorAll<HTMLElement>('[data-starter]').forEach(node => {
      const on = Number(node.dataset.starter) === id;
      node.setAttribute('aria-checked', String(on));
      node.tabIndex = on ? 0 : -1;
    });
    const confirm = this.host.querySelector<HTMLButtonElement>('[data-confirm]')!;
    confirm.disabled = false;
    confirm.textContent = t.choose(getSpecies(id).name);
  }

  private celebrate() {
    const id = this.picked!;
    const reveal = this.host.querySelector<HTMLElement>('.onb-reveal')!;
    const card = reveal.querySelector<HTMLElement>('.pcard')!;
    sfx('newCard');
    playCry(id);
    if (!reducedMotion()) {
      card.animate([
        { transform: 'scale(.3) rotateY(180deg)', opacity: 0 },
        { transform: 'scale(1.08) rotateY(0)', opacity: 1, offset: 0.7 },
        { transform: 'scale(1)', opacity: 1 },
      ], { duration: 800, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    const color = TYPE_COLOR[getSpecies(id).types[0]];
    setTimeout(() => {
      burst(reveal, { color, count: 40, distance: 220, duration: 1100 });
      burst(reveal, { color: '#f4dca3', count: 14, distance: 160, shape: 'star' });
    }, 350);
  }

  private onClick(event: MouseEvent) {
    const target = event.target as Element;
    if (this.scene === 'intro') {
      if (target.closest('[data-next], .onb-bubble')) this.nextLine();
      return;
    }
    const starter = target.closest<HTMLElement>('[data-starter]');
    if (starter) return this.select(Number(starter.dataset.starter));
    if (target.closest('[data-confirm]') && this.picked != null) {
      chooseStarter(this.picked);
      return this.show('picked');
    }
    if (target.closest('[data-to-tips]')) {
      sfx('click');
      return this.show('tips');
    }
    const tip = target.closest<HTMLElement>('[data-tip]');
    if (tip) {
      sfx('click');
      this.slide = Math.max(0, Math.min(L().capture.onboarding.slides.length - 1, this.slide + Number(tip.dataset.tip)));
      return this.show('tips');
    }
    if (target.closest('[data-finish]')) {
      sfx('ballThrow');
      playMusic('capture');
      location.hash = '#/capture';
      this.modal.close();
    }
  }

  private onKey(event: KeyboardEvent) {
    if (this.scene === 'choose' && (event.key.startsWith('Arrow'))) {
      const current = STARTERS.indexOf(this.picked ?? STARTERS[0]);
      const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
      const next = STARTERS[(current + step + STARTERS.length) % STARTERS.length];
      event.preventDefault();
      this.select(next);
      this.host.querySelector<HTMLElement>(`[data-starter="${next}"]`)?.focus();
    }
  }
}
