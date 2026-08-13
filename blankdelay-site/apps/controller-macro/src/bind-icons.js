'use strict';

/**
 * Official-looking PlayStation / Xbox button glyphs for the bind picker.
 * Inline SVG so we never depend on external icon fonts.
 */
(function (global) {
  const uid = () => `bi${Math.random().toString(36).slice(2, 9)}`;

  const svg = (body, view = '0 0 24 24') =>
    `<svg class="bind-icon" viewBox="${view}" width="22" height="22" aria-hidden="true" focusable="false" shape-rendering="geometricPrecision">${body}</svg>`;

  const FONT = 'Outfit,Segoe UI,Arial,sans-serif';

  const TONES = {
    steel: {
      top: '#3a3a40',
      bot: '#141416',
      rim0: 'rgba(255,255,255,0.55)',
      rim1: 'rgba(180,180,190,0.35)',
      rim2: 'rgba(0,0,0,0.45)',
      sheen: 'rgba(255,255,255,0.16)',
      text: '#f4f4f5',
    },
    cyan: {
      top: '#4a4a52',
      bot: '#1a1a1e',
      rim0: 'rgba(255,255,255,0.65)',
      rim1: 'rgba(200,200,210,0.4)',
      rim2: 'rgba(0,0,0,0.5)',
      sheen: 'rgba(255,255,255,0.18)',
      text: '#ffffff',
    },
    amber: {
      top: '#52525a',
      bot: '#1c1c20',
      rim0: 'rgba(255,255,255,0.6)',
      rim1: 'rgba(190,190,200,0.4)',
      rim2: 'rgba(0,0,0,0.5)',
      sheen: 'rgba(255,255,255,0.16)',
      text: '#f4f4f5',
    },
    violet: {
      top: '#404048',
      bot: '#161618',
      rim0: 'rgba(255,255,255,0.6)',
      rim1: 'rgba(180,180,190,0.4)',
      rim2: 'rgba(0,0,0,0.5)',
      sheen: 'rgba(255,255,255,0.16)',
      text: '#f4f4f5',
    },
  };

  const capsuleDefs = (id, tone) => {
    const t = TONES[tone] || TONES.steel;
    return (
      `<defs>` +
      `<linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1">` +
      `<stop stop-color="${t.top}"/><stop offset="1" stop-color="${t.bot}"/>` +
      `</linearGradient>` +
      `<linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1">` +
      `<stop stop-color="${t.rim0}"/><stop offset="0.45" stop-color="${t.rim1}"/><stop offset="1" stop-color="${t.rim2}"/>` +
      `</linearGradient>` +
      `<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1">` +
      `<stop stop-color="${t.sheen}"/><stop offset="1" stop-color="rgba(255,255,255,0)"/>` +
      `</linearGradient>` +
      `</defs>`
    );
  };

  /** Premium pill badge used for bumpers / system labels. */
  const badge = (label, tone = 'steel') => {
    const id = uid();
    const t = TONES[tone] || TONES.steel;
    const size = label.length > 3 ? 6.2 : label.length > 2 ? 6.8 : 7.6;
    return svg(
      capsuleDefs(id, tone) +
      `<rect x="1" y="4.4" width="22" height="15.2" rx="7.6" fill="url(#${id}f)" stroke="url(#${id}r)" stroke-width="1.15"/>` +
      `<rect x="2.3" y="5.4" width="19.4" height="5.4" rx="2.7" fill="url(#${id}s)"/>` +
      `<text x="12" y="15.05" text-anchor="middle" font-size="${size}" font-weight="800" font-family="${FONT}" letter-spacing="0.4" fill="${t.text}">${label}</text>`,
    );
  };

  /** Stylized trigger silhouette (L2 / R2 / LT / RT) — large glyph + bold label. */
  const trigger = (label, tone = 'cyan') => {
    const id = uid();
    const t = TONES[tone] || TONES.cyan;
    // Two-letter labels (L2/R2) get a bigger type size than LT/RT.
    const size = label.length > 2 ? 7.4 : 8.6;
    return svg(
      capsuleDefs(id, tone) +
      // Wide DualSense-style trigger body — fills the viewBox so it stays sharp at 18–26px.
      `<path d="M3.2 5.1c0-1.15.93-2.08 2.08-2.08h13.44c1.15 0 2.08.93 2.08 2.08v4.05c0 2.85-1.72 5.35-4.35 6.42l-2.05.84a4.2 4.2 0 0 1-3.2 0l-2.05-.84C4.92 14.5 3.2 12 3.2 9.15V5.1Z" fill="url(#${id}f)" stroke="url(#${id}r)" stroke-width="1.25" stroke-linejoin="round"/>` +
      `<path d="M4.85 4.35h14.3c.72 0 1.3.52 1.3 1.16v2.05c0 .28-.23.5-.52.5H4.07c-.29 0-.52-.22-.52-.5V5.51c0-.64.58-1.16 1.3-1.16Z" fill="url(#${id}s)"/>` +
      // Crisp label: heavy weight + slight dark halo so it stays readable when scaled down.
      `<text x="12" y="13.15" text-anchor="middle" font-size="${size}" font-weight="900" font-family="${FONT}" letter-spacing="0.2" fill="rgba(0,0,0,0.55)">${label}</text>` +
      `<text x="12" y="12.95" text-anchor="middle" font-size="${size}" font-weight="900" font-family="${FONT}" letter-spacing="0.2" fill="${t.text}">${label}</text>`,
    );
  };

  const psFace = () => {
    const x = uid();
    const o = uid();
    const sq = uid();
    const tri = uid();
    return {
      0: svg(
        `<defs><linearGradient id="${x}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f4f4f5"/><stop offset="1" stop-color="#a1a1aa"/></linearGradient>` +
        `<filter id="${x}g" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0.6" stdDeviation="0.5" flood-color="#ffffff" flood-opacity="0.28"/></filter></defs>` +
        `<path d="M6.1 6.1 17.9 17.9M17.9 6.1 6.1 17.9" fill="none" stroke="url(#${x})" stroke-width="3.15" stroke-linecap="round" filter="url(#${x}g)"/>`,
      ),
      1: svg(
        `<defs><linearGradient id="${o}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#c8c8d0"/></linearGradient>` +
        `<filter id="${o}g" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0.6" stdDeviation="0.5" flood-color="#ffffff" flood-opacity="0.28"/></filter></defs>` +
        `<circle cx="12" cy="12" r="7.15" fill="none" stroke="url(#${o})" stroke-width="2.6" filter="url(#${o}g)"/>`,
      ),
      2: svg(
        `<defs><linearGradient id="${sq}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e4e4e7"/><stop offset="1" stop-color="#a1a1aa"/></linearGradient>` +
        `<filter id="${sq}g" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0.6" stdDeviation="0.5" flood-color="#ffffff" flood-opacity="0.28"/></filter></defs>` +
        `<rect x="5.35" y="5.35" width="13.3" height="13.3" rx="1.5" fill="none" stroke="url(#${sq})" stroke-width="2.5" filter="url(#${sq}g)"/>`,
      ),
      3: svg(
        `<defs><linearGradient id="${tri}" x1="0.5" y1="0" x2="0.5" y2="1"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#a1a1aa"/></linearGradient>` +
        `<filter id="${tri}g" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0.6" stdDeviation="0.5" flood-color="#ffffff" flood-opacity="0.28"/></filter></defs>` +
        `<path d="M12 4.6 19.6 18.4H4.4Z" fill="none" stroke="url(#${tri})" stroke-width="2.4" stroke-linejoin="round" filter="url(#${tri}g)"/>`,
      ),
    };
  };

  const xboxFace = () => {
    const a = uid();
    const b = uid();
    const x = uid();
    const y = uid();
    const face = (id, c0, c1, letter) =>
      svg(
        `<defs><radialGradient id="${id}" cx="32%" cy="28%"><stop stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></radialGradient>` +
        `<linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop stop-color="rgba(255,255,255,0.45)"/><stop offset="1" stop-color="rgba(0,0,0,0.35)"/></linearGradient></defs>` +
        `<circle cx="12" cy="12" r="9.2" fill="url(#${id})" stroke="url(#${id}r)" stroke-width="1"/>` +
        `<circle cx="9.2" cy="8.8" r="3.2" fill="rgba(255,255,255,0.14)"/>` +
        `<text x="12" y="16.1" text-anchor="middle" font-size="11" font-weight="800" font-family="${FONT}" fill="#fff">${letter}</text>`,
      );
    return {
      0: face(a, '#d4d4d8', '#71717a', 'A'),
      1: face(b, '#e4e4e7', '#52525b', 'B'),
      2: face(x, '#f4f4f5', '#71717a', 'X'),
      3: face(y, '#ffffff', '#a1a1aa', 'Y'),
    };
  };

  const stick = (label) => {
    const id = uid();
    return svg(
      `<defs>` +
      `<radialGradient id="${id}b" cx="35%" cy="30%"><stop stop-color="#3a3a40"/><stop offset="1" stop-color="#121214"/></radialGradient>` +
      `<radialGradient id="${id}k" cx="35%" cy="30%"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#a1a1aa"/></radialGradient>` +
      `<linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop stop-color="rgba(255,255,255,0.5)"/><stop offset="1" stop-color="rgba(0,0,0,0.5)"/></linearGradient>` +
      `</defs>` +
      `<circle cx="12" cy="10.6" r="8.1" fill="url(#${id}b)" stroke="url(#${id}r)" stroke-width="1.2"/>` +
      `<circle cx="12" cy="10.6" r="3.15" fill="url(#${id}k)"/>` +
      `<circle cx="10.7" cy="9.3" r="1.05" fill="rgba(255,255,255,0.55)"/>` +
      `<text x="12" y="22.6" text-anchor="middle" font-size="5.5" font-weight="800" font-family="${FONT}" fill="rgba(244,244,245,0.72)">${label}</text>`,
    );
  };

  const dpad = (rot) => {
    const id = uid();
    return svg(
      `<defs>` +
      `<linearGradient id="${id}f" x1="0.5" y1="0" x2="0.5" y2="1"><stop stop-color="#f4f4f5"/><stop offset="1" stop-color="#a1a1aa"/></linearGradient>` +
      `<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop stop-color="rgba(255,255,255,0.35)"/><stop offset="1" stop-color="rgba(120,120,130,0.25)"/></linearGradient>` +
      `</defs>` +
      `<g transform="rotate(${rot} 12 12)">` +
      `<path d="M12 2.9 17 11.2H7Z" fill="url(#${id}f)" stroke="rgba(255,255,255,0.28)" stroke-width="0.6"/>` +
      `<rect x="10" y="10.4" width="4" height="9.4" rx="1.2" fill="url(#${id}s)" stroke="rgba(255,255,255,0.2)" stroke-width="0.5"/>` +
      `</g>`,
    );
  };

  const psLogo = () => {
    const id = uid();
    return svg(
      `<defs>` +
      `<radialGradient id="${id}" cx="32%" cy="28%"><stop stop-color="#d4d4d8"/><stop offset="1" stop-color="#3f3f46"/></radialGradient>` +
      `<linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop stop-color="rgba(255,255,255,0.5)"/><stop offset="1" stop-color="rgba(0,0,0,0.45)"/></linearGradient>` +
      `</defs>` +
      `<circle cx="12" cy="12" r="10.2" fill="url(#${id})" stroke="url(#${id}r)" stroke-width="1"/>` +
      `<circle cx="8.8" cy="8.4" r="3.4" fill="rgba(255,255,255,0.16)"/>` +
      `<g fill="#fff" transform="translate(12 12.2) scale(0.062) translate(-168 -108)">` +
      `<g transform="translate(112 -24)">` +
      `<path d="m 202.26159,183.35015 c -4.79763,6.05282 -16.5518,10.37069 -16.5518,10.37069 L 98.270237,225.12853 V 201.96607 L 162.61981,179.0379 c 7.30243,-2.61639 8.42374,-6.31504 2.48807,-8.25641 -5.92451,-1.94692 -16.65222,-1.38907 -23.96023,1.23845 l -42.877413,15.10139 v -24.03836 l 2.471343,-0.83676 c 0,0 12.39015,-4.38483 29.81223,-6.31504 17.42209,-1.91903 38.75477,0.26208 55.50185,6.61067 18.87252,5.96356 20.99797,14.75553 16.20593,20.80831 z M 106.59357,143.90923 V 84.675297 c 0,-6.956571 -1.28308,-13.360816 -7.810093,-15.173908 -4.99845,-1.601044 -8.10017,3.040386 -8.10017,9.991321 V 227.82864 L 50.678916,215.13163 V 38.266598 c 17.009261,3.157543 41.789541,10.621757 55.111334,15.112544 33.87907,11.631459 45.36546,26.108047 45.36546,58.726288 0,31.79264 -19.62564,43.84248 -44.56214,31.8038 z m -129.318334,55.63569 c -19.374598,-5.45586 -22.599048,-16.8251 -13.768071,-23.37447 8.161544,-6.04722 22.041185,-10.59938 22.041185,-10.59938 l 57.359521,-20.3955 v 23.25177 L 1.6315556,183.19956 c -7.291275,2.61637 -8.412579,6.32056 -2.48807,8.26197 5.930088,1.94131 16.6633804,1.38904 23.9658154,-1.23291 l 19.79857,-7.18528 v 20.80273 c -1.255187,0.22315 -2.655427,0.44632 -3.949672,0.66385 -19.804149,3.2356 -40.8969684,1.88557 -61.682963,-4.965 z"/>` +
      `</g></g>`,
    );
  };

  const touch = (() => {
    const id = uid();
    return svg(
      capsuleDefs(id, 'steel') +
      `<rect x="3.2" y="6.4" width="17.6" height="11.2" rx="2.6" fill="url(#${id}f)" stroke="url(#${id}r)" stroke-width="1.1"/>` +
      `<rect x="4.4" y="7.4" width="15.2" height="3.6" rx="1.4" fill="url(#${id}s)"/>` +
      `<path d="M8.2 13.4h7.6" stroke="rgba(234,248,255,0.7)" stroke-width="1.35" stroke-linecap="round"/>`,
    );
  })();

  const createIcon = (() => {
    const id = uid();
    return svg(
      capsuleDefs(id, 'steel') +
      `<rect x="2.6" y="7.1" width="18.8" height="9.8" rx="4.9" fill="url(#${id}f)" stroke="url(#${id}r)" stroke-width="1.1"/>` +
      `<rect x="3.8" y="8" width="16.4" height="3.2" rx="1.6" fill="url(#${id}s)"/>` +
      `<path d="M12 9.6v4.8M9.6 12h4.8" stroke="#f4f8ff" stroke-width="1.55" stroke-linecap="round"/>`,
    );
  })();

  const optionsIcon = (() => {
    const id = uid();
    return svg(
      capsuleDefs(id, 'steel') +
      `<rect x="2.6" y="7.1" width="18.8" height="9.8" rx="4.9" fill="url(#${id}f)" stroke="url(#${id}r)" stroke-width="1.1"/>` +
      `<rect x="3.8" y="8" width="16.4" height="3.2" rx="1.6" fill="url(#${id}s)"/>` +
      `<circle cx="8.2" cy="12" r="1.2" fill="#f4f8ff"/><circle cx="12" cy="12" r="1.2" fill="#f4f8ff"/><circle cx="15.8" cy="12" r="1.2" fill="#f4f8ff"/>`,
    );
  })();

  function buildSet(family) {
    if (family === 'xbox') {
      const guide = uid();
      return {
        ...xboxFace(),
        4: badge('LB'),
        5: badge('RB'),
        6: trigger('LT', 'cyan'),
        7: trigger('RT', 'cyan'),
        8: badge('View'),
        9: badge('Menu'),
        10: stick('LS'),
        11: stick('RS'),
        12: dpad(0),
        13: dpad(180),
        14: dpad(-90),
        15: dpad(90),
        16: svg(
          `<defs><radialGradient id="${guide}" cx="32%" cy="28%"><stop stop-color="#3CB83C"/><stop offset="1" stop-color="#0E6E0E"/></radialGradient>` +
          `<linearGradient id="${guide}r" x1="0" y1="0" x2="0" y2="1"><stop stop-color="rgba(255,255,255,0.45)"/><stop offset="1" stop-color="rgba(0,0,0,0.4)"/></linearGradient></defs>` +
          `<circle cx="12" cy="12" r="10" fill="url(#${guide})" stroke="url(#${guide}r)" stroke-width="1"/>` +
          `<circle cx="8.8" cy="8.6" r="3.2" fill="rgba(255,255,255,0.16)"/>` +
          `<text x="12" y="15.7" text-anchor="middle" font-size="9" font-weight="800" font-family="${FONT}" fill="#fff">X</text>`,
        ),
        17: badge('Share'),
        18: badge('P3', 'amber'),
        19: badge('P1', 'amber'),
        20: badge('P4', 'amber'),
        21: badge('P2', 'amber'),
        22: badge('P5', 'amber'),
        23: badge('P6', 'amber'),
      };
    }
    return {
      ...psFace(),
      4: badge('L1'),
      5: badge('R1'),
      6: trigger('L2', 'cyan'),
      7: trigger('R2', 'cyan'),
      8: createIcon,
      9: optionsIcon,
      10: stick('L3'),
      11: stick('R3'),
      12: dpad(0),
      13: dpad(180),
      14: dpad(-90),
      15: dpad(90),
      16: psLogo(),
      17: touch,
      18: badge('L4', 'amber'),
      19: badge('R4', 'amber'),
      20: badge('Fn1', 'violet'),
      21: badge('Fn2', 'violet'),
      22: badge('L5', 'amber'),
      23: badge('R5', 'amber'),
    };
  }

  function iconFor(bindId, family) {
    const id = Number(bindId);
    const set = buildSet(family);
    return set[id] || badge('?');
  }

  global.AphroditeBindIcons = { iconFor };
})(typeof window !== 'undefined' ? window : globalThis);
