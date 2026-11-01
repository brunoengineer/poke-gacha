// Settings modal: sound effects, music and cries (toggles + live volume sliders), faster animations, language.
// API contract: openSettings() opens the modal.

import { isMuted, onMuteChange, playCry, previewSfx, setMuted, sfx } from '../audio';
import { getLang, L, setLang, type Lang } from '../i18n';
import { setSetting } from '../state/actions';
import type { Settings } from '../state/save';
import { store } from '../state/store';
import { $, $$, esc, icon, openModal } from './dom';

type ToggleKey = 'sound' | 'music' | 'cries' | 'fastFx';
type RangeKey = 'volume' | 'musicVolume';

const settings = () => store.save.settings;
const pct = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 100);

function toggleRow(key: ToggleKey, ico: string, label: string, hint: string) {
  return `
    <div class="settings-row">
      <span class="settings-ico">${icon(ico)}</span>
      <label class="settings-label" for="set-${key}"><b>${esc(label)}</b><small>${esc(hint)}</small></label>
      <button id="set-${key}" class="switch" type="button" role="switch" aria-checked="${settings()[key]}" data-toggle="${key}">
        <span class="switch-knob"></span>
      </button>
    </div>`;
}

function rangeRow(key: RangeKey, label: string, enabledBy: ToggleKey) {
  const value = pct(settings()[key]);
  const off = !settings()[enabledBy];
  return `
    <div class="settings-range-row${off ? ' is-off' : ''}" data-range-row="${enabledBy}">
      <label for="set-${key}">${esc(label)}</label>
      <input id="set-${key}" class="settings-range" type="range" min="0" max="100" step="1" value="${value}"
        data-range="${key}" style="--val:${value}%" ${off ? 'disabled' : ''}>
      <output for="set-${key}">${value}%</output>
    </div>`;
}

export function openSettings(): void {
  const t = L().audio;
  const lang = getLang();
  let unsubscribe = () => {};
  const modal = openModal({
    className: 'modal-settings',
    label: t.title,
    onClose: () => unsubscribe(),
    html: `
      <button class="modal-x" type="button" data-close aria-label="${esc(t.close)}">${icon('x')}</button>
      <h2 class="settings-title">${icon('gear')} ${esc(t.title)}</h2>
      <div class="settings-muted" data-muted hidden>
        ${icon('mute')}<span>${esc(t.muted)}</span>
        <button class="btn btn-sm btn-primary" type="button" data-unmute>${esc(t.unmute)}</button>
      </div>
      <section class="settings-group">
        <h3 class="settings-group-title">${esc(t.sectionAudio)}</h3>
        ${toggleRow('sound', 'volume', t.sound, t.soundHint)}
        ${rangeRow('volume', t.volume, 'sound')}
        ${toggleRow('music', 'music', t.music, t.musicHint)}
        ${rangeRow('musicVolume', t.musicVolume, 'music')}
        ${toggleRow('cries', 'ball', t.cries, t.criesHint)}
      </section>
      <section class="settings-group">
        <h3 class="settings-group-title">${esc(t.sectionGame)}</h3>
        ${toggleRow('fastFx', 'bolt', t.fastFx, t.fastFxHint)}
        <div class="settings-row">
          <span class="settings-ico">${icon('globe')}</span>
          <span class="settings-label"><b>${esc(t.language)}</b><small>${esc(t.languageHint)}</small></span>
          <span class="lang-switch" role="group" aria-label="${esc(t.language)}">
            ${(['pt', 'en'] as Lang[]).map(l => `<button type="button" data-lang="${l}" aria-pressed="${lang === l}">${l === 'pt' ? 'Português' : 'English'}</button>`).join('')}
          </span>
        </div>
      </section>
      <div class="settings-actions">
        <button class="btn btn-primary" type="button" data-close autofocus>${esc(t.done)}</button>
      </div>`,
  });
  const root = modal.root;

  const refreshMuted = () => { $(root, '[data-muted]').hidden = !isMuted(); };
  refreshMuted();
  unsubscribe = onMuteChange(refreshMuted);

  root.addEventListener('click', event => {
    const target = event.target as Element;
    const toggle = target.closest<HTMLElement>('[data-toggle]');
    if (toggle) {
      const key = toggle.dataset.toggle as ToggleKey;
      const value = !settings()[key];
      setSetting(key, value as Settings[ToggleKey]);
      toggle.setAttribute('aria-checked', String(value));
      $$<HTMLElement>(root, `[data-range-row="${key}"]`).forEach(row => {
        row.classList.toggle('is-off', !value);
        $<HTMLInputElement>(row, 'input').disabled = !value;
      });
      sfx('toggle');
      if (key === 'cries' && value) playCry(store.save.starter ?? 25);
      return;
    }
    const nextLang = target.closest<HTMLElement>('[data-lang]')?.dataset.lang as Lang | undefined;
    if (nextLang && nextLang !== lang) return setLang(nextLang);
    if (target.closest('[data-unmute]')) {
      setMuted(false);
      sfx('toggle');
    }
  });

  let lastPreview = 0;
  root.addEventListener('input', event => {
    const input = (event.target as Element).closest<HTMLInputElement>('[data-range]');
    if (!input) return;
    const key = input.dataset.range as RangeKey;
    const value = Number(input.value);
    setSetting(key, value / 100);
    input.style.setProperty('--val', `${value}%`);
    input.parentElement!.querySelector('output')!.textContent = `${value}%`;
    // Effects volume: a short blip so the new level can be heard; the music follows its slider live.
    const now = performance.now();
    if (key === 'volume' && now - lastPreview > 140) {
      lastPreview = now;
      previewSfx();
    }
  });
}
