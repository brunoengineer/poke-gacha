// The Kanto, Johto, Hoenn and Sinnoh badges, drawn as inline SVG (no external images). Used by the badge case,
// the Battle hub, the badge celebration and the rewards modal (as data URLs).

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
  // Hoenn
  stone: g => `
    <defs><linearGradient id="${g}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0d6b8"/><stop offset=".55" stop-color="#b07a4a"/><stop offset="1" stop-color="#6a4222"/></linearGradient></defs>
    <path d="M18 8h22l16 14-6 26-18 10-20-12L6 24z" fill="url(#${g}a)" stroke="#3e2410" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M26 24h16l-10 34z" fill="#d9a877" opacity=".7"/>
    <path d="M18 8l8 16h16l-2-16M26 24H6M42 24l14-2M26 24l6 34 10-34M26 24L12 46M42 24l8 24" stroke="#7a4e2a" stroke-width="1.5" fill="none" stroke-linejoin="round"/>
    <path d="M20 12l5 9" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".8"/>`,
  knuckle: g => `
    <defs><linearGradient id="${g}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d6e4f5"/><stop offset=".5" stop-color="#5a7fb5"/><stop offset="1" stop-color="#2a3f6e"/></linearGradient></defs>
    <path d="M32 4l24 8v18c0 14-10 24-24 30C18 54 8 44 8 30V12z" fill="url(#${g}a)" stroke="#16243f" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M17 33c5 6 25 6 30 0v6c-5 6-25 6-30 0z" fill="#e8823a" stroke="#16243f" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="20" cy="27" r="5" fill="none" stroke="#16243f" stroke-width="3"/><circle cx="28" cy="24" r="5" fill="none" stroke="#16243f" stroke-width="3"/>
    <circle cx="36" cy="24" r="5" fill="none" stroke="#16243f" stroke-width="3"/><circle cx="44" cy="27" r="5" fill="none" stroke="#16243f" stroke-width="3"/>
    <path d="M14 15l12-5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".8"/>`,
  dynamo: g => {
    const teeth = Array.from({ length: 8 }, (_, i) =>
      `<rect x="27" y="3" width="10" height="12" rx="2" transform="rotate(${i * 45} 32 32)"/>`).join('');
    return `
    <defs><radialGradient id="${g}a" cx=".4" cy=".35"><stop offset="0" stop-color="#fff3a0"/><stop offset=".6" stop-color="#f2c21b"/><stop offset="1" stop-color="#a8760f"/></radialGradient></defs>
    <g fill="url(#${g}a)" stroke="#5a3d06" stroke-width="2.2">${teeth}</g>
    <circle cx="32" cy="32" r="21" fill="url(#${g}a)" stroke="#5a3d06" stroke-width="2.5"/>
    <circle cx="32" cy="32" r="13" fill="#3b3f48" stroke="#5a3d06" stroke-width="2"/>
    <path d="M35 21l-9 13h6l-3 10 9-14h-6z" fill="#fff6c2" stroke="#5a3d06" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M17 26a16 16 0 0 1 8-9" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".8"/>`;
  },
  heat: g => `
    <defs><radialGradient id="${g}a" cx=".5" cy=".7"><stop offset="0" stop-color="#ffe27a"/><stop offset=".55" stop-color="#f0602a"/><stop offset="1" stop-color="#9a1a10"/></radialGradient></defs>
    <path d="M32 4c4 10 14 14 18 26 4 14-6 28-18 28S10 44 14 30c2-6 6-8 8-14 2 4 2 8 6 10 0-8 0-16 4-22z" fill="url(#${g}a)" stroke="#4e0a06" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M32 26c4 6 9 9 9 17a9 9 0 0 1-18 0c0-5 3-7 5-10 1 3 2 4 4 5 0-5-1-8 0-12z" fill="#ffd36b" stroke="#c4421c" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M18 38c0-5 2-8 5-11" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".75"/>`,
  balance: g => `
    <defs><linearGradient id="${g}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb0a0"/><stop offset=".55" stop-color="#e0402a"/><stop offset="1" stop-color="#8a1a10"/></linearGradient>
    <linearGradient id="${g}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".55" stop-color="#f0b82a"/><stop offset="1" stop-color="#9a6a0a"/></linearGradient></defs>
    <path d="M32 4L6 32l26 28z" fill="url(#${g}a)"/><path d="M32 4l26 28-26 28z" fill="url(#${g}b)"/>
    <path d="M32 4v56" stroke="#3e1a08" stroke-width="2"/>
    <path d="M32 4l26 28-26 28L6 32z" fill="none" stroke="#3e1a08" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="32" cy="32" r="7" fill="#fff4d6" stroke="#3e1a08" stroke-width="2"/>
    <path d="M13 29l12-13" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".8"/>`,
  feather: g => `
    <defs><linearGradient id="${g}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8f0ff"/><stop offset=".5" stop-color="#7a8fe0"/><stop offset="1" stop-color="#3a3f9a"/></linearGradient></defs>
    <path d="M50 6C30 8 14 22 12 44l-4 14 6-6c20-2 36-16 38-36 0-4-1-8-2-10z" fill="url(#${g}a)" stroke="#1e2160" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M22 40l-6-4M28 33l-8-3M34 26l-6-6M26 38l8 4M32 31l10 2M38 24l8 0" stroke="#4a55b5" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M10 56C22 40 34 26 48 10" stroke="#1e2160" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M19 27c4-7 10-12 18-15" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".8"/>`,
  mind: g => `
    <defs><radialGradient id="${g}a" cx=".4" cy=".35"><stop offset="0" stop-color="#ffd6f0"/><stop offset=".6" stop-color="#e05ab0"/><stop offset="1" stop-color="#7a1a5e"/></radialGradient></defs>
    <circle cx="24" cy="32" r="18" fill="url(#${g}a)" stroke="#4a0e38" stroke-width="2.5"/>
    <circle cx="40" cy="32" r="18" fill="url(#${g}a)" stroke="#4a0e38" stroke-width="2.5"/>
    <path d="M32 16A18 18 0 0 1 32 48A18 18 0 0 1 32 16z" fill="#ffb8e2" stroke="#4a0e38" stroke-width="1.8"/>
    <circle cx="17" cy="32" r="4" fill="#4a0e38"/><circle cx="47" cy="32" r="4" fill="#4a0e38"/>
    <path d="M11 27a13 13 0 0 1 7-8" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".8"/>`,
  rain: g => `
    <defs><linearGradient id="${g}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0f4ff"/><stop offset=".5" stop-color="#5ab0e8"/><stop offset="1" stop-color="#1d5fa0"/></linearGradient></defs>
    <path d="M18 36h30a10 10 0 0 0 1-20 13 13 0 0 0-24-4 10 10 0 0 0-7 24z" fill="url(#${g}a)" stroke="#0f3a6b" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M22 42c2 4 4 6 4 8a4 4 0 0 1-8 0c0-2 2-4 4-8zM32 46c2 4 4 6 4 8a4 4 0 0 1-8 0c0-2 2-4 4-8zM42 42c2 4 4 6 4 8a4 4 0 0 1-8 0c0-2 2-4 4-8z" fill="#8fd0ff" stroke="#0f3a6b" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M23 22a8 8 0 0 1 7-6" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".8"/>`,
  // Sinnoh
  coal: g => `
    <defs><radialGradient id="${g}a" cx=".4" cy=".35"><stop offset="0" stop-color="#8a8f99"/><stop offset=".6" stop-color="#3b3f48"/><stop offset="1" stop-color="#15171c"/></radialGradient></defs>
    <path d="M20 8l18-2 16 12 4 18-10 18-20 4-16-12-6-18z" fill="url(#${g}a)" stroke="#0a0b0e" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M22 22l10 8 12-4M32 30l-4 14 8 6M32 30l14 10" stroke="#ff7a2a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="32" cy="30" r="3.5" fill="#ffd36b"/>
    <path d="M14 22l5-10" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".6"/>`,
  forest: g => `
    <defs><linearGradient id="${g}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d0f5b0"/><stop offset=".5" stop-color="#4cb04c"/><stop offset="1" stop-color="#1f5e24"/></linearGradient></defs>
    <path d="M28 46h8v12h-8z" fill="#8a5a2a" stroke="#3e2410" stroke-width="2" stroke-linejoin="round"/>
    <path d="M32 4l14 16h-6l12 14h-7l11 14H8l11-14h-7l12-14h-6z" fill="url(#${g}a)" stroke="#123f19" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M22 34h20M18 48h28" stroke="#1f6a2a" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M28 11l-6 7" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".8"/>`,
  cobble: g => `
    <defs><linearGradient id="${g}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8e2d8"/><stop offset=".5" stop-color="#a89c8a"/><stop offset="1" stop-color="#5e5446"/></linearGradient></defs>
    <rect x="6" y="6" width="52" height="52" rx="10" fill="url(#${g}a)" stroke="#2e281e" stroke-width="2.5"/>
    <path d="M16 24h18v18H16z" fill="#d8d0c2" opacity=".7"/>
    <path d="M8 24h48M8 42h48M24 8v16M42 8v16M16 24v18M34 24v18M50 24v18M26 42v14M44 42v14" stroke="#5e5446" stroke-width="2" fill="none"/>
    <path d="M12 15a8 8 0 0 1 6-5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".8"/>`,
  fen: g => `
    <defs><radialGradient id="${g}a" cx=".4" cy=".35"><stop offset="0" stop-color="#c8f5e8"/><stop offset=".6" stop-color="#3ab0a0"/><stop offset="1" stop-color="#155e5a"/></radialGradient></defs>
    <circle cx="32" cy="32" r="26" fill="url(#${g}a)" stroke="#0b3a38" stroke-width="2.5"/>
    <path d="M24 36V16M32 36V12M40 36V18" stroke="#2a5a1e" stroke-width="2.2" stroke-linecap="round"/>
    <rect x="22" y="14" width="4" height="9" rx="2" fill="#8a5a2a" stroke="#3e2410" stroke-width="1"/>
    <rect x="30" y="10" width="4" height="10" rx="2" fill="#8a5a2a" stroke="#3e2410" stroke-width="1"/>
    <rect x="38" y="16" width="4" height="8" rx="2" fill="#8a5a2a" stroke="#3e2410" stroke-width="1"/>
    <path d="M12 38c4-3 8-3 12 0s8 3 12 0 8-3 12 0M15 46c4-3 8-3 12 0s8 3 12 0 7-2 9-1" stroke="#e8fff8" stroke-width="2.2" stroke-linecap="round" fill="none"/>
    <path d="M13 25a20 20 0 0 1 7-10" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".75"/>`,
  relic: g => `
    <defs><linearGradient id="${g}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#e0b030"/><stop offset="1" stop-color="#8a6010"/></linearGradient>
    <radialGradient id="${g}b" cx=".4" cy=".35"><stop offset="0" stop-color="#f0d0ff"/><stop offset=".6" stop-color="#9a5ad6"/><stop offset="1" stop-color="#4a1a7a"/></radialGradient></defs>
    <circle cx="32" cy="32" r="26" fill="url(#${g}a)" stroke="#4a3006" stroke-width="2.5"/>
    <circle cx="32" cy="32" r="20" fill="none" stroke="#8a6010" stroke-width="1.5"/>
    <path d="M32 12l14 10-5 20H23l-5-20z" fill="url(#${g}b)" stroke="#2a0e48" stroke-width="2" stroke-linejoin="round"/>
    <path d="M18 22h28M32 12l-6 10 6 20 6-20z" stroke="#c9a0f0" stroke-width="1.3" fill="none" stroke-linejoin="round"/>
    <circle cx="32" cy="50" r="3" fill="#9a5ad6" stroke="#2a0e48" stroke-width="1.5"/>
    <path d="M14 22a20 20 0 0 1 7-9" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".8"/>`,
  mine: g => `
    <defs><linearGradient id="${g}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset=".5" stop-color="#9aa4b0"/><stop offset="1" stop-color="#4e5662"/></linearGradient></defs>
    <path d="M32 4l26 12-6 30-20 14-20-14-6-30z" fill="url(#${g}a)" stroke="#262c35" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M32 20l10 6v12l-10 6-10-6V26z" fill="#d6dce3" stroke="#4e5662" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="32" cy="32" r="4.5" fill="#262c35"/>
    <circle cx="14" cy="20" r="2" fill="#4e5662"/><circle cx="50" cy="20" r="2" fill="#4e5662"/><circle cx="32" cy="52" r="2" fill="#4e5662"/>
    <path d="M12 16l14-6" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".85"/>`,
  icicle: g => `
    <defs><linearGradient id="${g}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#9ee0f5"/><stop offset="1" stop-color="#2f86b5"/></linearGradient></defs>
    <path d="M6 10h52l-4 8-4 30-4-24-4 36-5-36-4 20-4-20-5 36-4-36-4 24-4-30z" fill="url(#${g}a)" stroke="#164a6b" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M12 18h42" stroke="#2f86b5" stroke-width="1.5"/>
    <path d="M23 26v20M41 26v20" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".6"/>
    <path d="M9 13h46" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".85"/>`,
  beacon: g => `
    <defs><radialGradient id="${g}a" cx=".5" cy=".35"><stop offset="0" stop-color="#fffbe0"/><stop offset=".6" stop-color="#ffd23a"/><stop offset="1" stop-color="#d08a10"/></radialGradient></defs>
    <circle cx="32" cy="32" r="26" fill="url(#${g}a)" stroke="#6b4a06" stroke-width="2.5"/>
    <path d="M32 21L12 16v12zM32 21l20-5v12z" fill="#fff8d0" opacity=".9"/>
    <path d="M28 24h8l3 30H25z" fill="#f2f2f2" stroke="#3a2a06" stroke-width="2" stroke-linejoin="round"/>
    <path d="M27 34h10M26 44h12" stroke="#d04a4a" stroke-width="3"/>
    <rect x="27" y="17" width="10" height="7" rx="1.5" fill="#fff6a0" stroke="#3a2a06" stroke-width="1.8"/>
    <path d="M26 17l6-6 6 6z" fill="#d04a4a" stroke="#3a2a06" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M13 25a20 20 0 0 1 6-10" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".75"/>`,
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
