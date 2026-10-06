/* BlankDelay - reactive holo SVG models */
const HoloModels = (function () {
    const GP = ['A','B','X','Y','LB','RB','LT','RT','Back','Start','LS','RS','D-Up','D-Down','D-Left','D-Right'];

    function ps5Edge() {
        return `<svg class="holo-svg holo-ps5" viewBox="0 0 600 380" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="ps5White" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f4f4f4"/><stop offset="100%" stop-color="#d8d8d8"/></linearGradient>
  <linearGradient id="ps5Black" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#2a2a2a"/><stop offset="100%" stop-color="#111"/></linearGradient>
  <filter id="blueGlow"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="btnGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<ellipse cx="300" cy="360" rx="200" ry="18" fill="rgba(87,242,135,0.08)"/>
<path d="M300 42 C390 42 455 72 478 118 C495 152 492 192 468 228 C442 264 395 288 345 300 L320 310 C310 314 305 316 300 316 C295 316 290 314 280 310 L255 300 C205 288 158 264 132 228 C108 192 105 152 122 118 C145 72 210 42 300 42 Z" fill="url(#ps5White)" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>
<path d="M210 95 C250 88 350 88 390 95 C420 100 440 125 445 155 C448 185 435 215 410 235 C385 252 350 262 300 265 C250 262 215 252 190 235 C165 215 152 185 155 155 C160 125 180 100 210 95 Z" fill="url(#ps5Black)" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
<rect id="bar-l" x="218" y="108" width="10" height="72" rx="3" fill="#00a2ff" opacity="0.85" filter="url(#blueGlow)"/>
<rect id="bar-r" x="372" y="108" width="10" height="72" rx="3" fill="#00a2ff" opacity="0.85" filter="url(#blueGlow)"/>
<rect x="238" y="112" width="124" height="64" rx="8" fill="#1a1a1a" stroke="rgba(255,255,255,0.15)" stroke-width="1.2"/>
<text x="300" y="150" text-anchor="middle" fill="rgba(255,255,255,0.2)" font-size="10" font-family="monospace">TOUCHPAD</text>
<rect id="btn-LT" class="holo-btn" x="148" y="88" width="72" height="18" rx="5" fill="rgba(87,242,135,0.08)" stroke="rgba(87,242,135,0.4)" stroke-width="1.5"/>
<rect id="btn-RT" class="holo-btn" x="380" y="88" width="72" height="18" rx="5" fill="rgba(87,242,135,0.08)" stroke="rgba(87,242,135,0.4)" stroke-width="1.5"/>
<rect id="btn-LB" class="holo-btn" x="148" y="112" width="72" height="14" rx="4" fill="rgba(87,242,135,0.06)" stroke="rgba(87,242,135,0.35)" stroke-width="1.2"/>
<rect id="btn-RB" class="holo-btn" x="380" y="112" width="72" height="14" rx="4" fill="rgba(87,242,135,0.06)" stroke="rgba(87,242,135,0.35)" stroke-width="1.2"/>
<g id="stick-l" transform="translate(220,210)"><circle r="30" fill="rgba(20,20,20,0.9)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/><circle id="stick-l-cap" class="stick-cap" r="22" fill="#111" stroke="rgba(87,242,135,0.5)" stroke-width="2"/></g>
<g id="stick-r" transform="translate(380,210)"><circle r="30" fill="rgba(20,20,20,0.9)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/><circle id="stick-r-cap" class="stick-cap" r="22" fill="#111" stroke="rgba(87,242,135,0.5)" stroke-width="2"/></g>
<g id="dpad" transform="translate(168,188)">
  <rect id="btn-D-Up" class="holo-btn" x="-12" y="-28" width="24" height="18" rx="3" fill="rgba(87,242,135,0.08)" stroke="rgba(87,242,135,0.45)" stroke-width="1.5"/>
  <rect id="btn-D-Down" class="holo-btn" x="-12" y="10" width="24" height="18" rx="3" fill="rgba(87,242,135,0.08)" stroke="rgba(87,242,135,0.45)" stroke-width="1.5"/>
  <rect id="btn-D-Left" class="holo-btn" x="-30" y="-8" width="18" height="24" rx="3" fill="rgba(87,242,135,0.08)" stroke="rgba(87,242,135,0.45)" stroke-width="1.5"/>
  <rect id="btn-D-Right" class="holo-btn" x="12" y="-8" width="18" height="24" rx="3" fill="rgba(87,242,135,0.08)" stroke="rgba(87,242,135,0.45)" stroke-width="1.5"/>
</g>
<circle id="btn-Y" class="holo-btn" cx="432" cy="178" r="12" fill="rgba(87,242,135,0.1)" stroke="rgba(87,242,135,0.5)" stroke-width="1.5"/>
<circle id="btn-B" class="holo-btn" cx="458" cy="204" r="12" fill="rgba(87,242,135,0.1)" stroke="rgba(87,242,135,0.5)" stroke-width="1.5"/>
<circle id="btn-A" class="holo-btn" cx="432" cy="230" r="12" fill="rgba(87,242,135,0.1)" stroke="rgba(87,242,135,0.5)" stroke-width="1.5"/>
<circle id="btn-X" class="holo-btn" cx="406" cy="204" r="12" fill="rgba(87,242,135,0.1)" stroke="rgba(87,242,135,0.5)" stroke-width="1.5"/>
<rect id="btn-Back" class="holo-btn" x="268" y="128" width="22" height="10" rx="3" fill="rgba(87,242,135,0.08)" stroke="rgba(87,242,135,0.4)" stroke-width="1"/>
<rect id="btn-Start" class="holo-btn" x="310" y="128" width="22" height="10" rx="3" fill="rgba(87,242,135,0.08)" stroke="rgba(87,242,135,0.4)" stroke-width="1"/>
<circle id="btn-PS" class="holo-btn" cx="300" cy="248" r="10" fill="rgba(87,242,135,0.08)" stroke="rgba(87,242,135,0.45)" stroke-width="1.2"/>
<rect id="btn-FnL" class="holo-btn" x="198" y="252" width="28" height="10" rx="5" fill="rgba(87,242,135,0.06)" stroke="rgba(87,242,135,0.35)" stroke-width="1"/>
<rect id="btn-FnR" class="holo-btn" x="374" y="252" width="28" height="10" rx="5" fill="rgba(87,242,135,0.06)" stroke="rgba(87,242,135,0.35)" stroke-width="1"/>
<text x="300" y="368" text-anchor="middle" fill="rgba(87,242,135,0.75)" font-size="12" font-family="monospace">DUALSENSE EDGE · PS5</text>
</svg>`;
    }

    function xbox() {
        return `<svg class="holo-svg holo-xbox" viewBox="0 0 600 380" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="xboxWhite" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ececec"/><stop offset="100%" stop-color="#c8c8c8"/></linearGradient>
<filter id="greenGlow"><feGaussianBlur stdDeviation="5"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<path d="M300 48 C385 48 450 78 472 122 C488 156 485 196 462 232 C436 268 390 292 340 304 L315 312 C305 316 300 318 300 318 C295 318 290 316 280 312 L255 304 C205 292 158 268 132 232 C108 196 105 156 122 122 C145 78 215 48 300 48 Z" fill="url(#xboxWhite)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
<path d="M215 100 C255 92 345 92 385 100 C415 106 435 132 440 162 C443 192 428 222 402 242 C377 258 342 268 300 271 C258 268 223 258 198 242 C172 222 157 192 160 162 C165 132 185 106 215 100 Z" fill="#1a1a1a" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>
<g id="stick-l" transform="translate(225,215)"><circle r="30" fill="#111" stroke="rgba(87,242,135,0.35)" stroke-width="2"/><circle id="stick-l-cap" class="stick-cap" r="22" fill="#0a0a0a" stroke="rgba(87,242,135,0.5)" stroke-width="2"/></g>
<g id="stick-r" transform="translate(375,215)"><circle r="30" fill="#111" stroke="rgba(87,242,135,0.35)" stroke-width="2"/><circle id="stick-r-cap" class="stick-cap" r="22" fill="#0a0a0a" stroke="rgba(87,242,135,0.5)" stroke-width="2"/></g>
<circle id="btn-Y" class="holo-btn" cx="430" cy="175" r="12"/><circle id="btn-B" class="holo-btn" cx="456" cy="201" r="12"/><circle id="btn-A" class="holo-btn" cx="430" cy="227" r="12"/><circle id="btn-X" class="holo-btn" cx="404" cy="201" r="12"/>
<rect id="btn-LB" class="holo-btn" x="150" y="108" width="68" height="14" rx="4" fill="rgba(87,242,135,0.08)" stroke="rgba(87,242,135,0.4)" stroke-width="1.2"/>
<rect id="btn-RB" class="holo-btn" x="382" y="108" width="68" height="14" rx="4" fill="rgba(87,242,135,0.08)" stroke="rgba(87,242,135,0.4)" stroke-width="1.2"/>
<rect id="btn-LT" class="holo-btn" x="150" y="88" width="68" height="14" rx="4" fill="rgba(87,242,135,0.08)" stroke="rgba(87,242,135,0.4)" stroke-width="1.2"/>
<rect id="btn-RT" class="holo-btn" x="382" y="88" width="68" height="14" rx="4" fill="rgba(87,242,135,0.08)" stroke="rgba(87,242,135,0.4)" stroke-width="1.2"/>
<text x="300" y="368" text-anchor="middle" fill="rgba(87,242,135,0.75)" font-size="12" font-family="monospace">XBOX CONTROLLER</text>
</svg>`;
    }

    function keyboard() {
        const rows = [
            ['ESC','1','2','3','4','5','6','7','8','9','0','BACK'],
            ['TAB','Q','W','E','R','T','Y','U','I','O','P'],
            ['CAPS','A','S','D','F','G','H','J','K','L','ENTER'],
            ['SHIFT','Z','X','C','V','B','N','M',',','.','SHIFT'],
            ['CTRL','ALT','SPACE','ALT','CTRL']
        ];
        const widths = { ESC:1, BACK:1.4, TAB:1.3, CAPS:1.4, ENTER:1.5, SHIFT:1.8, CTRL:1.2, ALT:1.1, SPACE:5.5 };
        let svg = '<svg class="holo-svg holo-kb" viewBox="0 0 600 260" xmlns="http://www.w3.org/2000/svg">';
        svg += '<rect x="20" y="30" width="560" height="180" rx="16" fill="rgba(20,20,20,0.9)" stroke="rgba(87,242,135,0.35)" stroke-width="2"/>';
        let y = 48, u = 34, gap = 5;
        rows.forEach(row => {
            const rowW = row.reduce((s,k)=>s+(widths[k]||1)*u+gap,0);
            let x = (600-rowW)/2;
            row.forEach(k => {
                const kw = (widths[k]||1)*u;
                svg += `<rect id="key-${k}" class="holo-key" x="${x}" y="${y}" width="${kw-3}" height="28" rx="4" fill="rgba(87,242,135,0.06)" stroke="rgba(87,242,135,0.35)" stroke-width="1.2"/>`;
                if (k.length<=5) svg += `<text x="${x+kw/2-1.5}" y="${y+18}" text-anchor="middle" fill="rgba(255,255,255,0.35)" font-size="8" font-family="monospace">${k}</text>`;
                x += kw+gap;
            });
            y += 34;
        });
        svg += '<text x="300" y="245" text-anchor="middle" fill="rgba(87,242,135,0.7)" font-size="12" font-family="monospace">GAMING KEYBOARD</text></svg>';
        return svg;
    }

    function mouse() {
        return `<svg class="holo-svg holo-mouse" viewBox="0 0 240 320" xmlns="http://www.w3.org/2000/svg">
<path d="M120 24 C175 24 200 80 200 150 C200 220 175 270 120 285 C65 270 40 220 40 150 C40 80 65 24 120 24 Z" fill="rgba(18,18,18,0.95)" stroke="rgba(87,242,135,0.45)" stroke-width="2.5"/>
<line x1="120" y1="32" x2="120" y2="130" stroke="rgba(87,242,135,0.3)" stroke-width="1.5"/>
<rect id="btn-LMB" class="holo-btn" x="48" y="36" width="68" height="72" rx="6" fill="rgba(87,242,135,0.06)" stroke="rgba(87,242,135,0.4)" stroke-width="1.5"/>
<rect id="btn-RMB" class="holo-btn" x="124" y="36" width="68" height="72" rx="6" fill="rgba(87,242,135,0.06)" stroke="rgba(87,242,135,0.4)" stroke-width="1.5"/>
<rect id="btn-WHEEL" class="holo-btn" x="104" y="78" width="32" height="44" rx="8" fill="rgba(87,242,135,0.08)" stroke="rgba(87,242,135,0.45)" stroke-width="1.5"/>
<rect id="btn-M4" class="holo-btn" x="28" y="100" width="14" height="40" rx="3" fill="rgba(87,242,135,0.06)" stroke="rgba(87,242,135,0.35)" stroke-width="1.2"/>
<rect id="btn-M5" class="holo-btn" x="198" y="100" width="14" height="40" rx="3" fill="rgba(87,242,135,0.06)" stroke="rgba(87,242,135,0.35)" stroke-width="1.2"/>
<text x="120" y="308" text-anchor="middle" fill="rgba(87,242,135,0.7)" font-size="11" font-family="monospace">GAMING MOUSE</text>
</svg>`;
    }

    return { GP, ps5Edge, xbox, keyboard, mouse };
})();