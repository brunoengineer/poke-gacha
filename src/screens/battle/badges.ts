// The Kanto and Johto badges, drawn as inline SVG (no external images). Used by the badge case, the Battle hub,
// the badge celebration and the rewards modal (as data URLs).

import { L } from '../../i18n';
import { esc } from '../../ui/dom';

let uid = 0;

/** Badge artwork on a 64×64 canvas. `g` is a unique prefix for gradient ids. */
const ART: Record<string, (g: string) => string> = {
  boulder: g => `
    <defs><linearGradient id="${g}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3e6ea"/><stop offset=".55" stop-color="#9aa1aa"/><stop offset="1" stop-color="#5d636c"/></linearGradient></defs>
    <path d="M22 6h20l16 16v20L42 58H22L6 42V22z" fill="url(#${g}a)" stroke="#3b4048" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M24 14h16l10 10v16L40 50H24L14 40V24z" fill="#b9bfc7" stroke="#6b717a" stroke-width="1.5"/>
    <path d="M24 14h16l-8 18zM50 24v16l-18-8zM40 50H24l8-18zM14 40V24l18 8z" fill="#8c939c" opacity=".7"/>
    <path d="M22 9h19" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>`,
  cascade: g => `
    <defs><linearGradient id="${g}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe8ff"/><stop offset=".5" stop-color="#4fa8ee"/><stop offset="1" stop-color="#1d5fb5"/></linearGradient></defs>
    <path d="M32 4C40 18 52 28 52 40a20 20 0 0 1-40 0C12 28 24 18 32 4z" fill="url(#${g}a)" stroke="#123f7a" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M32 18c5 8 11 14 11 22a11 11 0 0 1-22 0c0-8 6-14 11-22z" fill="#8fd0ff" stroke="#2f78c9" stroke-width="1.5"/>
    <path d="M22 36c0-5 3-9 6-13" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".8"/>`,
  thunder: g => `
    <defs><radialGradient id="${g}a"><stop offset="0" stop-color="#ffe680"/><stop offset="1" stop-color="#f08a1c"/></radialGradient></defs>
    <path d="M32 3l6 13 13-6-6 13 13 6-13 6 6 13-13-6-6 13-6-13-13 6 6-13L6 29l13-6-6-13 13 6z" fill="url(#${g}a)" stroke="#a24e0c" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M25 22h14l7 7v6l-7 7H25l-7-7v-6z" fill="#ffd23a" stroke="#c46a10" stroke-width="1.6"/>
    <path d="M34 22l-6 11h6l-4 9" fill="none" stroke="#a24e0c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  rainbow: () => {
    const colors = ['#ff5a6e', '#ffa53a', '#ffe14d', '#5fd36b', '#4fa8ee', '#a77bff'];
    const petals = colors.map((c, i) =>
      `<ellipse cx="32" cy="15" rx="8.5" ry="12" fill="${c}" stroke="#3a2a52" stroke-width="1.8" transform="rotate(${i * 60} 32 32)"/>`).join('');
    return `<path d="M32 50c-6 6-14 8-20 8 2-6 8-11 16-12z" fill="#4caf50" stroke="#1f5e24" stroke-width="1.6"/>
      ${petals}<circle cx="32" cy="32" r="8" fill="#fff4b0" stroke="#b08a1e" stroke-width="2"/><circle cx="30" cy="30" r="2.5" fill="#fff"/>`;
  },
  soul: g => `
    <defs><linearGradient id="${g}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffc2dc"/><stop offset=".5" stop-color="#f05a9a"/><stop offset="1" stop-color="#a51e5c"/></linearGradient></defs>
    <path d="M32 56C14 44 5 33 5 21A13 13 0 0 1 32 15a13 13 0 0 1 27 6c0 12-9 23-27 35z" fill="url(#${g}a)" stroke="#6e0f3b" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M32 46C21 38 15 31 15 23a7 7 0 0 1 13-3l4 5 4-5a7 7 0 0 1 13 3c0 8-6 15-17 23z" fill="#ff8fc0" stroke="#c23477" stroke-width="1.5"/>
    <path d="M12 20a8 8 0 0 1 8-7" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".8"/>`,
  marsh: g => `
    <defs><radialGradient id="${g}a" cx=".4" cy=".35"><stop offset="0" stop-color="#fff2b0"/><stop offset=".6" stop-color="#f0c02a"/><stop offset="1" stop-color="#a87412"/></radialGradient></defs>
    <circle cx="32" cy="32" r="26" fill="url(#${g}a)" stroke="#6e4a08" stroke-width="2.5"/>
    <circle cx="32" cy="32" r="16" fill="none" stroke="#8c5f0c" stroke-width="3"/>
    <circle cx="32" cy="32" r="7" fill="#ffe680" stroke="#8c5f0c" stroke-width="2"/>
    <path d="M17 22a18 18 0 0 1 10-8" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".8"/>`,
  volcano: g => `
    <defs><linearGradient id="${g}a" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#8e1414"/><stop offset=".5" stop-color="#e8402a"/><stop offset="1" stop-color="#ffb347"/></linearGradient></defs>
    <path d="M32 4l9 14 13-4-5 14 11 8-13 5 2 15-14-8-3 12-3-12-14 8 2-15-13-5 11-8-5-14 13 4z" fill="url(#${g}a)" stroke="#5c0a0a" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M32 18c5 6 9 11 9 17a9 9 0 0 1-18 0c0-6 4-11 9-17z" fill="#ffd36b" stroke="#c4421c" stroke-width="1.6"/>
    <path d="M32 30c2 3 3 5 3 7a3 3 0 0 1-6 0c0-2 1-4 3-7z" fill="#fff4c4"/>`,
  earth: g => `
    <defs><linearGradient id="${g}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b8f0a0"/><stop offset=".5" stop-color="#4cb04c"/><stop offset="1" stop-color="#1f6a2a"/></linearGradient></defs>
    <path d="M32 3c14 10 22 24 18 38-3 9-10 15-18 19-8-4-15-10-18-19C10 27 18 13 32 3z" fill="url(#${g}a)" stroke="#123f19" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M32 12v44M32 26l-9-7M32 26l9-7M32 38l-11-8M32 38l11-8" stroke="#1f6a2a" stroke-width="2.2" stroke-linecap="round" fill="none"/>
    <path d="M21 20c2-4 5-8 9-11" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".75"/>`,
  // Johto
  zephyr: g => `
    <defs><linearGradient id="${g}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1f6fc"/><stop offset=".55" stop-color="#a3b7cf"/><stop offset="1" stop-color="#56698a"/></linearGradient></defs>
    <path d="M6 42C13 24 30 10 58 6c-6 8-9 14-11 20 4 0 7-1 11-3-4 9-10 15-18 18 3 1 6 1 10 0-8 9-20 15-34 15C11 56 7 51 6 42z" fill="url(#${g}a)" stroke="#2c3a50" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M15 46c10-4 20-12 29-24M19 51c10-2 18-6 25-12" stroke="#5f7393" stroke-width="2" stroke-linecap="round" fill="none"/>
    <path d="M12 37c4-8 10-14 18-20" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".8"/>`,
  hive: g => `
    <defs><radialGradient id="${g}a" cx=".35" cy=".35"><stop offset="0" stop-color="#ffa394"/><stop offset=".6" stop-color="#e0362c"/><stop offset="1" stop-color="#8a1611"/></radialGradient></defs>
    <circle cx="32" cy="36" r="24" fill="url(#${g}a)" stroke="#4a0b08" stroke-width="2.5"/>
    <path d="M13 26a20 15 0 0 1 38 0z" fill="#2a2a33" stroke="#111118" stroke-width="2" stroke-linejoin="round"/>
    <path d="M32 26v34" stroke="#4a0b08" stroke-width="2.5"/>
    <circle cx="21" cy="36" r="4.5" fill="#2a2a33"/><circle cx="43" cy="36" r="4.5" fill="#2a2a33"/>
    <circle cx="24" cy="49" r="3.5" fill="#2a2a33"/><circle cx="40" cy="49" r="3.5" fill="#2a2a33"/>
    <circle cx="25" cy="20" r="2" fill="#fff"/><circle cx="39" cy="20" r="2" fill="#fff"/>
    <path d="M14 38a18 18 0 0 1 4-8" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".75"/>`,
  plain: g => `
    <defs><linearGradient id="${g}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6c2"/><stop offset=".5" stop-color="#f3c63c"/><stop offset="1" stop-color="#a8760f"/></linearGradient></defs>
    <path d="M32 4l8 20 20 8-20 8-8 20-8-20-20-8 20-8z" fill="url(#${g}a)" stroke="#6b4a06" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M32 16l4 12 12 4-12 4-4 12-4-12-12-4 12-4z" fill="#ffe27a" stroke="#b8860b" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="32" cy="32" r="4" fill="#fff8d6"/>
    <path d="M27 18l3-8" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".8"/>`,
  fog: g => `
    <defs><radialGradient id="${g}a" cx=".4" cy=".3"><stop offset="0" stop-color="#ecdcff"/><stop offset=".6" stop-color="#8a5cc9"/><stop offset="1" stop-color="#3d2266"/></radialGradient></defs>
    <path d="M32 5c13 0 22 10 22 24v24l-6-5-6 6-5-6-5 6-5-6-5 6-6-6-6 5V29C10 15 19 5 32 5z" fill="url(#${g}a)" stroke="#2a1648" stroke-width="2.5" stroke-linejoin="round"/>
    <ellipse cx="24" cy="28" rx="5" ry="7" fill="#2a1648"/><ellipse cx="40" cy="28" rx="5" ry="7" fill="#2a1648"/>
    <circle cx="25.5" cy="25.5" r="2" fill="#fff"/><circle cx="41.5" cy="25.5" r="2" fill="#fff"/>
    <path d="M16 21a17 17 0 0 1 9-10" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".75"/>`,
  storm: g => `
    <defs><linearGradient id="${g}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd2a1"/><stop offset=".5" stop-color="#d9823a"/><stop offset="1" stop-color="#7c3f12"/></linearGradient></defs>
    <path d="M12 25a6 6 0 0 1 10-4 6 6 0 0 1 10-2 6 6 0 0 1 10 2 6 6 0 0 1 10 4v17c0 10-8 16-20 16S12 52 12 42z" fill="url(#${g}a)" stroke="#4a230a" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M22 21v9M32 19v11M42 21v9" stroke="#4a230a" stroke-width="2" stroke-linecap="round"/>
    <path d="M12 36c7-3 13-1 17 5" stroke="#4a230a" stroke-width="2.2" stroke-linecap="round" fill="none"/>
    <path d="M16 26a5 5 0 0 1 4-3" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".8"/>`,
  mineral: g => `
    <defs><linearGradient id="${g}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#b9c3cf"/><stop offset="1" stop-color="#66717f"/></linearGradient></defs>
    <path d="M32 4l24 14v28L32 60 8 46V18z" fill="url(#${g}a)" stroke="#2f3742" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M32 16l13 8v16l-13 8-13-8V24z" fill="#e2e8ef" stroke="#7d8896" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M32 4v12M56 18l-11 6M56 46l-11-6M32 60V48M8 46l11-6M8 18l11 6" stroke="#7d8896" stroke-width="1.5"/>
    <path d="M14 21l13-8" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".85"/>`,
  glacier: g => `
    <defs><linearGradient id="${g}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2fdff"/><stop offset=".5" stop-color="#8fd8f0"/><stop offset="1" stop-color="#2f86b5"/></linearGradient></defs>
    <path d="M32 3l9 15 17-1-8 15 8 15-17-1-9 15-9-15-17 1 8-15-8-15 17 1z" fill="url(#${g}a)" stroke="#164a6b" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M32 14v36M16.4 23l31.2 18M16.4 41l31.2-18" stroke="#2f86b5" stroke-width="2" stroke-linecap="round"/>
    <circle cx="32" cy="32" r="5" fill="#e8fbff" stroke="#2f86b5" stroke-width="1.5"/>
    <path d="M27 12l4-6" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".85"/>`,
  rising: g => `
    <defs><linearGradient id="${g}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8f1ff"/><stop offset=".5" stop-color="#4a8fe0"/><stop offset="1" stop-color="#26357f"/></linearGradient></defs>
    <path d="M32 4l7 14 19-8-6 20 8 6-14 4-6 20-8-10-8 10-6-20-14-4 8-6-6-20 19 8z" fill="url(#${g}a)" stroke="#141c4a" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M32 20c5 4 7 9 7 14a7 7 0 0 1-14 0c0-5 2-10 7-14z" fill="#f2c94c" stroke="#8a6418" stroke-width="1.6"/>
    <path d="M32 29c2 2 3 4 3 5.5a3 3 0 0 1-6 0c0-1.5 1-3.5 3-5.5z" fill="#fff4c4"/>
    <path d="M14 15l9 5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".75"/>`,
};


const svg = (id: string, attrs: string) => {
  const g = `bdg${++uid}`;
  return `<svg viewBox="0 0 64 64" ${attrs}>${(ART[id] ?? ART.boulder)(g)}</svg>`;
};

/** Inline badge SVG. `earned: false` draws it as an empty slot. */
export function badgeSVG(id: string, { earned = true, label = true, className = '' } = {}): string {
  const name = L().battle.badgeFull[id] ?? id;
  return `<span class="badge-art ${earned ? 'earned' : 'missing'} ${className}" data-badge="${esc(id)}" ${label ? `role="img" aria-label="${esc(name)}"` : 'aria-hidden="true"'}>
    ${svg(id, 'aria-hidden="true" focusable="false"')}</span>`;
}

/** Badge as an image URL (for the shared rewards modal, which takes image URLs). */
export function badgeDataUrl(id: string): string {
  const markup = svg(id, 'xmlns="http://www.w3.org/2000/svg" width="128" height="128"');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}
