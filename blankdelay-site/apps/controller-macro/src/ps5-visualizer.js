/**
 * Live controller visualizer — moves SVG parts with gamepad input (VSCView-style).
 */
(function () {
  const DEADZONE = 0.05;
  const STICK_TRAVEL = { x: 14, y: 14 };
  const BTN_PRESS = 1.8;
  const TRIGGER_PULL = 8;
  const BTN_DOWN_THRESHOLD = 0.12;
  const NO_PAD_POLL_MS = 250;
  // 0 = requestAnimationFrame (smooth). Avoid setTimeout pacing while live.
  const PAD_POLL_MS = 0;

  const svgTextCache = new Map();

  async function prefetchSvg(src) {
    if (!src) return '';
    if (svgTextCache.has(src)) return svgTextCache.get(src);
    const res = await fetch(src);
    if (!res.ok) throw new Error(`SVG fetch failed (${res.status})`);
    const text = await res.text();
    svgTextCache.set(src, text);
    return text;
  }

  async function preloadSvgs(sources) {
    const list = Array.isArray(sources) ? sources : [];
    await Promise.all(list.map((src) => prefetchSvg(src).catch(() => null)));
  }

  const VARIANT_MAPS = {
    ps5: {
      buttons: {
        0: ['crosss', 'cross'],
        1: ['circle'],
        2: ['square'],
        3: ['triangle', 'triangle '],
        4: ['l1'],
        5: ['r1'],
        8: ['create button'],
        9: ['option button'],
        10: ['left stick'],
        11: ['right stick'],
        12: ['d-pad up'],
        13: ['d-pad down'],
        14: ['d-pad left'],
        15: ['d-pad right'],
        16: ['ps button'],
        17: ['touchpad', 'touch pad', 'touchpad click', 'touch pad click'],
      },
      triggers: {
        l2: ['l2 triggers'],
        r2: ['r2 trigger'],
      },
      sticks: {
        left: ['left stick'],
        right: ['right stick'],
      },
    },
    ps4: {
      buttons: {
        0: ['cross'],
        1: ['circle'],
        2: ['square'],
        3: ['triangle', 'triangle '],
        4: ['l1'],
        5: ['r1'],
        8: ['share button'],
        9: ['option button'],
        10: ['left stick'],
        11: ['right stick'],
        12: ['d-pad up'],
        13: ['d-pad down'],
        14: ['d-pad left'],
        15: ['d-pad right'],
        16: ['ps button'],
        17: ['touchpad', 'touch pad', 'touchpad click', 'touch pad click'],
      },
      triggers: {
        l2: ['left trigger'],
        r2: ['right trigger'],
      },
      sticks: {
        left: ['left stick'],
        right: ['right stick'],
      },
    },
    'xbox-one': {
      buttons: {
        0: ['a button'],
        1: ['b button'],
        2: ['x button'],
        3: ['y button'],
        4: ['xbox one bumpers'],
        5: ['xbox one bumpers'],
        8: ['view button'],
        9: ['menu button'],
        10: ['left stick'],
        11: ['right stick'],
        12: ['d-pad'],
        13: ['d-pad'],
        14: ['d-pad'],
        15: ['d-pad'],
        16: ['xbox guide button'],
      },
      triggers: {
        l2: ['left trigger'],
        r2: ['right triggers'],
      },
      sticks: {
        left: ['left stick'],
        right: ['right stick'],
      },
    },
    'xbox-series-s': {
      buttons: {
        0: ['a button'],
        1: ['b button'],
        2: ['x button'],
        3: ['y button'],
        4: ['bumpers'],
        5: ['bumpers'],
        8: ['view button', 'share button'],
        9: ['menu button'],
        10: ['left stick'],
        11: ['right stick'],
        12: ['main d-pad', 'd-pad', 'xbox series controller d-pad'],
        13: ['main d-pad', 'd-pad', 'xbox series controller d-pad'],
        14: ['main d-pad', 'd-pad', 'xbox series controller d-pad'],
        15: ['main d-pad', 'd-pad', 'xbox series controller d-pad'],
        16: ['xbox guide button'],
      },
      triggers: {
        l2: ['left trigger'],
        r2: ['right trigger'],
      },
      sticks: {
        left: ['left stick'],
        right: ['right stick'],
      },
    },
  };

  const BUTTON_LABELS = {
    0: 'A / Cross',
    1: 'B / Circle',
    2: 'X / Square',
    3: 'Y / Triangle',
    4: 'LB / L1',
    5: 'RB / R1',
    6: 'LT / L2',
    7: 'RT / R2',
    8: 'View / Share',
    9: 'Menu / Options',
    10: 'L3',
    11: 'R3',
    12: 'D-Up',
    13: 'D-Down',
    14: 'D-Left',
    15: 'D-Right',
    16: 'Guide / PS',
    17: 'Touchpad',
  };

  function normLabel(value) {
    return String(value || '').trim().toLowerCase();
  }

  const INKSCAPE_NS = 'http://www.inkscape.org/namespaces/inkscape';

  function readInkscapeLabel(node) {
    if (!node?.getAttribute) return '';
    const raw =
      node.getAttribute('inkscape:label')
      || (node.getAttributeNS ? node.getAttributeNS(INKSCAPE_NS, 'label') : '')
      || node.getAttribute('label')
      || '';
    return normLabel(raw);
  }

  // Build a label->element index once per SVG so lookup is robust regardless of
  // whether the document was parsed as HTML (literal attr name) or XML (namespaced).
  function buildLabelIndex(svg) {
    const index = new Map();
    if (!svg) return index;
    const walker = document.createTreeWalker(svg, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;
    while (node) {
      const label = readInkscapeLabel(node);
      if (label) {
        const tag = node.tagName?.toLowerCase();
        const host = tag === 'g'
          ? node
          : (node.id ? node : (node.closest('g[id]') || node));
        if (!index.has(label)) index.set(label, host);
      }
      node = walker.nextNode();
    }
    return index;
  }

  function findByLabels(svg, labels, index) {
    if (!svg || !labels?.length) return null;
    const idx = index || buildLabelIndex(svg);
    for (const label of labels) {
      const key = normLabel(label);
      const el = idx.get(key);
      if (el) return el;
    }
    return null;
  }

  function applyDeadzone(value, dead = DEADZONE) {
    const abs = Math.abs(value);
    if (abs < dead) return 0;
    return Math.sign(value) * ((abs - dead) / (1 - dead));
  }

  function buttonValue(pad, index) {
    const btn = pad.buttons[index];
    if (!btn) return 0;
    if (typeof btn.value === 'number') return btn.pressed || btn.value > 0.05 ? Math.max(btn.value, btn.pressed ? 1 : 0) : 0;
    return btn.pressed ? 1 : 0;
  }

  function buttonDown(pad, index) {
    return buttonValue(pad, index) > BTN_DOWN_THRESHOLD;
  }

  function setPressedState(el, pressed) {
    if (!el) return;
    const on = !!pressed;
    if (el._iocPressed === on) return;
    el._iocPressed = on;
    el.classList.toggle('ioc-pressed', on);
  }

  function setMotion(el, dx, dy) {
    if (!el) return;
    // Quantize so tiny stick noise does not rewrite SVG transforms every poll.
    const x = Math.round((dx || 0) * 2) / 2;
    const y = Math.round((dy || 0) * 2) / 2;
    const cache = el._iocMotion;
    if (cache && cache.x === x && cache.y === y) return;
    el._iocMotion = { x, y };

    const base = el.dataset.iocBaseTransform || '';
    if (!x && !y) {
      if (base) el.setAttribute('transform', base);
      else el.removeAttribute('transform');
      return;
    }
    const move = `translate(${x.toFixed(2)} ${y.toFixed(2)})`;
    // Prepend so motion stays in parent space (left stick SVG uses a scale matrix).
    el.setAttribute('transform', base ? `${move} ${base}` : move);
  }

    function enhanceControllerSvg(svg) {
    if (!svg || svg.dataset.novaEnhanced === '1') return;
    svg.dataset.novaEnhanced = '1';
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    // Skip SVG feComponentTransfer — it re-filters the whole DualSense every
    // paint and tanks GPU while sticks move.
    // Force center marks onto the SJ logo (absolute URL) so relative <image>
    // hrefs never keep an old cuff/aphrodite mark after inline load.
    const logoUrl = new URL('assets/blank-logo.png', window.location.href).href;
    svg.querySelectorAll('image').forEach((img) => {
      const href = img.getAttribute('href') || img.getAttribute('xlink:href') || '';
      if (!href || href.startsWith('data:')) return;
      if (/blank-logo|aphrodite-.*mark|aphrodite-ps-mark|cuff/i.test(href) || /assets\/.+\.png/i.test(href)) {
        img.setAttribute('href', logoUrl);
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', logoUrl);
      }
    });
  }

  function mount(container) {
    if (!container) return null;

    let svg = null;
    let variantId = 'ps5';
    let labelIndex = new Map();
    let buttonEls = new Map();
    let indexEls = new Map();
    let stickEls = { left: null, right: null };
    let triggerEls = { l2: null, r2: null };
    let listening = false;
    let lastActive = false;
    const buttonStateCache = new Map();

    function resetMotion() {
      buttonEls.forEach((el) => {
        delete el._iocMotion;
        setPressedState(el, false);
        setMotion(el, 0, 0);
      });
      [stickEls.left, stickEls.right, triggerEls.l2, triggerEls.r2].forEach((el) => {
        if (!el) return;
        delete el._iocMotion;
        setMotion(el, 0, 0);
      });
      if (lastActive) {
        container.classList.remove('is-live');
        lastActive = false;
      }
      buttonStateCache.clear();
    }

    function capturePart(el, motionPart = false) {
      if (!el || el.dataset.iocBaseTransform != null) return;
      el.dataset.iocBaseTransform = el.getAttribute('transform') || '';
      if (motionPart) el.classList.add('ioc-motion-part');
    }

    function rememberIndex(index, el) {
      if (!el) return;
      const idx = Number(index);
      if (!el._iocIndexes) el._iocIndexes = [];
      if (!el._iocIndexes.includes(idx)) el._iocIndexes.push(idx);
      if (!indexEls.has(idx)) indexEls.set(idx, el);
      el.classList.add('ioc-clickable');
      el.style.pointerEvents = 'auto';
    }

    let clickMode = false;
    let partClickHandler = null;
    let mappedIndexes = new Set();
    let targetIndex = null;

    function resolveClickIndex(el, clientX, clientY) {
      const indexes = el?._iocIndexes || [];
      if (!indexes.length) return null;
      if (indexes.length === 1) return indexes[0];

      const rect = el.getBoundingClientRect?.();
      if (!rect || !rect.width || !rect.height) return indexes[0];
      const nx = (clientX - rect.left) / rect.width;
      const ny = (clientY - rect.top) / rect.height;

      // Shared bumpers (LB/RB): left half → 4, right half → 5
      if (indexes.includes(4) && indexes.includes(5)) {
        return nx < 0.5 ? 4 : 5;
      }

      // Shared d-pad plate: pick by click quadrant
      const dpad = [12, 13, 14, 15].filter((i) => indexes.includes(i));
      if (dpad.length >= 2) {
        const dx = nx - 0.5;
        const dy = ny - 0.5;
        if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 14 : 15;
        return dy < 0 ? 12 : 13;
      }

      return indexes[0];
    }

    function paintMapped() {
      indexEls.forEach((el) => {
        if (!el) return;
        el.classList.remove('ioc-mapped', 'ioc-map-target');
      });
      mappedIndexes.forEach((idx) => {
        const el = indexEls.get(Number(idx));
        if (el) el.classList.add('ioc-mapped');
      });
      if (targetIndex != null && Number.isFinite(Number(targetIndex))) {
        const el = indexEls.get(Number(targetIndex));
        if (el) el.classList.add('ioc-map-target');
      }
    }

    function onSvgClick(e) {
      if (!clickMode || !partClickHandler) return;
      let hit = e.target?.closest?.('.ioc-clickable');
      // Fallback: pointer-events / stacked paths can make target a non-button
      // chrome node; walk the hit-test stack for a bound part.
      if ((!hit || !svg?.contains(hit)) && svg && typeof document.elementsFromPoint === 'function') {
        const stack = document.elementsFromPoint(e.clientX, e.clientY) || [];
        hit = stack.find((el) => el?.classList?.contains('ioc-clickable') && svg.contains(el)) || null;
      }
      if (!hit || !svg?.contains(hit)) return;
      e.preventDefault();
      e.stopPropagation();
      const index = resolveClickIndex(hit, e.clientX, e.clientY);
      if (index == null || index < 0 || index > 17) return;
      partClickHandler(index);
    }

    function setClickMode(on) {
      clickMode = !!on;
      container.classList.toggle('is-click-map', clickMode);
      // Keep the normal cursor — only clickables get pointer via CSS.
      if (svg) svg.style.cursor = '';
    }

    function onPartClick(fn) {
      partClickHandler = typeof fn === 'function' ? fn : null;
    }

    function setMappedIndexes(indexes) {
      mappedIndexes = new Set(
        (Array.isArray(indexes) ? indexes : [])
          .map(Number)
          .filter((n) => Number.isFinite(n) && n >= 0 && n < 18),
      );
      paintMapped();
    }

    function setTargetIndex(index) {
      targetIndex = index == null || index === '' || index === 'none'
        ? null
        : Number(index);
      if (!Number.isFinite(targetIndex)) targetIndex = null;
      paintMapped();
    }

    function bindParts() {
      buttonEls = new Map();
      indexEls = new Map();
      buttonStateCache.clear();
      stickEls = { left: null, right: null };
      triggerEls = { l2: null, r2: null };
      labelIndex = buildLabelIndex(svg);
      if (!svg) return;

      const map = VARIANT_MAPS[variantId] || VARIANT_MAPS.ps5;
      const seen = new Set();

      Object.entries(map.buttons).forEach(([index, labels]) => {
        labels.forEach((label) => {
          const key = normLabel(label);
          if (seen.has(key)) return;
          const el = findByLabels(svg, [label], labelIndex);
          if (el) {
            seen.add(key);
            capturePart(el, true);
            buttonEls.set(key, el);
            rememberIndex(Number(index), el);
          }
        });
      });

      Object.entries(map.sticks).forEach(([stickId, labels]) => {
        const el = findByLabels(svg, labels, labelIndex);
        if (el) {
          capturePart(el, true);
          stickEls[stickId] = el;
          rememberIndex(stickId === 'left' ? 10 : 11, el);
        }
      });

      Object.entries(map.triggers).forEach(([triggerId, labels]) => {
        const el = findByLabels(svg, labels, labelIndex);
        if (el) {
          capturePart(el, true);
          triggerEls[triggerId] = el;
          rememberIndex(triggerId === 'l2' ? 6 : 7, el);
        }
      });

      // Touchpad often sits under body chrome in the SVG paint order — lift it
      // so Home delay clicks and paddle map clicks actually land.
      const touchEl = indexEls.get(17);
      if (touchEl?.parentNode) {
        touchEl.parentNode.appendChild(touchEl);
      }

      // Re-bind click once per SVG load
      svg.removeEventListener('click', onSvgClick);
      svg.addEventListener('click', onSvgClick);
      setClickMode(clickMode);
      paintMapped();

      const totalParts = buttonEls.size + (stickEls.left ? 1 : 0) + (stickEls.right ? 1 : 0) + (triggerEls.l2 ? 1 : 0) + (triggerEls.r2 ? 1 : 0);
      container.dataset.iocBoundParts = String(totalParts);
      if (totalParts === 0) {
        console.warn('[Nova IOC] controller visualizer bound 0 parts — SVG labels may not match the variant map.');
      }
    }

    function applyButton(pad, index, labels, pressY = BTN_PRESS) {
      const idx = Number(index);
      const down = buttonDown(pad, idx);
      if (buttonStateCache.get(idx) === down) return;
      buttonStateCache.set(idx, down);
      labels.forEach((label) => {
        const el = buttonEls.get(normLabel(label));
        if (!el) return;
        setPressedState(el, down);
        setMotion(el, 0, down ? pressY : 0);
      });
    }

    function applyCombinedBumpers(pad, map) {
      const labels = new Set([
        ...(map.buttons[4] || []),
        ...(map.buttons[5] || []),
      ].map(normLabel));
      const downL = buttonDown(pad, 4);
      const downR = buttonDown(pad, 5);
      const stateKey = 'bumpers-combined';
      const state = `${downL ? 1 : 0}${downR ? 1 : 0}`;
      if (buttonStateCache.get(stateKey) === state) return;
      buttonStateCache.set(stateKey, state);

      labels.forEach((key) => {
        const el = buttonEls.get(key);
        if (!el) return;
        const down = downL || downR;
        setPressedState(el, down);
        const dx = (downR ? BTN_PRESS * 0.45 : 0) - (downL ? BTN_PRESS * 0.45 : 0);
        const dy = down ? BTN_PRESS : 0;
        setMotion(el, dx, dy);
      });
    }

    function applyShoulders(pad, map) {
      const l1Labels = map.buttons[4] || [];
      const r1Labels = map.buttons[5] || [];
      const l1El = l1Labels.length ? buttonEls.get(normLabel(l1Labels[0])) : null;
      const r1El = r1Labels.length ? buttonEls.get(normLabel(r1Labels[0])) : null;

      if (l1El && r1El && l1El !== r1El) {
        applyButton(pad, 4, l1Labels);
        applyButton(pad, 5, r1Labels);
        return;
      }

      applyCombinedBumpers(pad, map);
    }

    function touchpadDown(pad) {
      return buttonDown(pad, 17);
    }

    function applyTouchpad(pad, map) {
      const labels = map.buttons[17];
      if (!labels?.length) return;
      const idx = 17;
      const down = buttonDown(pad, idx);
      if (buttonStateCache.get(idx) === down) return;
      buttonStateCache.set(idx, down);
      labels.forEach((label) => {
        const el = buttonEls.get(normLabel(label));
        if (!el) return;
        setPressedState(el, down);
      });
    }

    function applyDpad(pad, map) {
      const dirs = [
        { idx: 12, dx: 0, dy: -BTN_PRESS * 0.85 },
        { idx: 13, dx: 0, dy: BTN_PRESS * 0.85 },
        { idx: 14, dx: -BTN_PRESS * 0.85, dy: 0 },
        { idx: 15, dx: BTN_PRESS * 0.85, dy: 0 },
      ];
      const offsets = new Map();

      dirs.forEach(({ idx, dx, dy }) => {
        if (!buttonDown(pad, idx)) return;
        (map.buttons[idx] || []).forEach((label) => {
          const el = buttonEls.get(normLabel(label));
          if (!el) return;
          const cur = offsets.get(el) || { dx: 0, dy: 0 };
          offsets.set(el, { dx: cur.dx + dx, dy: cur.dy + dy });
        });
      });

      const touched = new Set();
      dirs.forEach(({ idx }) => {
        (map.buttons[idx] || []).forEach((label) => {
          const el = buttonEls.get(normLabel(label));
          if (el) touched.add(el);
        });
      });

      touched.forEach((el) => {
        const off = offsets.get(el) || { dx: 0, dy: 0 };
        setPressedState(el, off.dx !== 0 || off.dy !== 0);
        setMotion(el, off.dx, off.dy);
      });
    }

    let pollHandle = 0;

    function clearPoll() {
      if (!pollHandle) return;
      cancelAnimationFrame(pollHandle);
      clearTimeout(pollHandle);
      pollHandle = 0;
    }

    function schedulePoll(delayMs = 0) {
      clearPoll();
      if (!listening) return;
      if (delayMs > 0) {
        pollHandle = window.setTimeout(() => {
          pollHandle = 0;
          poll();
        }, delayMs);
        return;
      }
      pollHandle = requestAnimationFrame(poll);
    }

    function setLiveState(active) {
      if (active === lastActive) return;
      lastActive = active;
      container.classList.toggle('is-live', active);
    }

    function poll() {
      if (!listening) return;
      // Only pause when the window is actually hidden. Frameless Electron
      // often reports document.hasFocus() === false even while visible, which
      // previously blocked all stick/button motion.
      if (document.hidden) {
        schedulePoll(NO_PAD_POLL_MS);
        return;
      }

      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = Array.from(pads).find(Boolean);
      if (!pad) {
        resetMotion();
        schedulePoll(NO_PAD_POLL_MS);
        return;
      }

      const map = VARIANT_MAPS[variantId] || VARIANT_MAPS.ps5;
      let active = false;

      const lx = applyDeadzone(pad.axes[0] || 0, DEADZONE) * STICK_TRAVEL.x;
      const ly = applyDeadzone(pad.axes[1] || 0, DEADZONE) * STICK_TRAVEL.y;
      const rx = applyDeadzone(pad.axes[2] || 0, DEADZONE) * STICK_TRAVEL.x;
      const ry = applyDeadzone(pad.axes[3] || 0, DEADZONE) * STICK_TRAVEL.y;

      if (stickEls.left) {
        const click = buttonDown(pad, 10) ? BTN_PRESS * 0.55 : 0;
        setPressedState(stickEls.left, click > 0 || buttonDown(pad, 10));
        setMotion(stickEls.left, lx, ly + click);
        if (lx || ly || click) active = true;
      }
      if (stickEls.right) {
        const click = buttonDown(pad, 11) ? BTN_PRESS * 0.55 : 0;
        setPressedState(stickEls.right, click > 0 || buttonDown(pad, 11));
        setMotion(stickEls.right, rx, ry + click);
        if (rx || ry || click) active = true;
      }

      const l2Norm = buttonValue(pad, 6);
      const r2Norm = buttonValue(pad, 7);
      const l2 = l2Norm * TRIGGER_PULL;
      const r2 = r2Norm * TRIGGER_PULL;
      if (triggerEls.l2) {
        setPressedState(triggerEls.l2, l2Norm > BTN_DOWN_THRESHOLD);
        setMotion(triggerEls.l2, 0, l2);
        if (l2Norm > 0.05) active = true;
      }
      if (triggerEls.r2) {
        setPressedState(triggerEls.r2, r2Norm > BTN_DOWN_THRESHOLD);
        setMotion(triggerEls.r2, 0, r2);
        if (r2Norm > 0.05) active = true;
      }

      const skipButtons = new Set(['4', '5', '10', '11', '12', '13', '14', '15', '17']);
      Object.entries(map.buttons).forEach(([index, labels]) => {
        if (skipButtons.has(index)) return;
        applyButton(pad, index, labels);
        if (buttonDown(pad, Number(index))) active = true;
      });

      applyTouchpad(pad, map);
      if (touchpadDown(pad)) active = true;

      applyShoulders(pad, map);
      if (buttonDown(pad, 4) || buttonDown(pad, 5)) active = true;

      applyDpad(pad, map);
      if ([12, 13, 14, 15].some((i) => buttonDown(pad, i))) active = true;

      setLiveState(active);
      schedulePoll(PAD_POLL_MS);
    }

    async function load(nextVariant, src) {
      variantId = nextVariant || variantId;
      resetMotion();

      if (!src) {
        container.innerHTML = '';
        svg = null;
        return;
      }

      try {
        const text = await prefetchSvg(src);
        container.innerHTML = text;
        svg = container.querySelector('svg');
        if (!svg) throw new Error('SVG root missing after load');
        svg.classList.add('nova-ioc-hero__controller');
        svg.setAttribute('role', 'img');
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        enhanceControllerSvg(svg);
        bindParts();
        if (listening) schedulePoll();
      } catch (err) {
        console.error('[Nova IOC] controller visualizer load failed:', err);
        container.innerHTML = '';
        svg = null;
      }
    }

    function startListening() {
      if (listening) return;
      listening = true;
      schedulePoll();
    }

    function stopListening() {
      listening = false;
      clearPoll();
      resetMotion();
    }

    function getPartElement(index) {
      return indexEls.get(Number(index)) || null;
    }

    return {
      load,
      startListening,
      stopListening,
      container,
      setClickMode,
      onPartClick,
      setMappedIndexes,
      setTargetIndex,
      getPartElement,
    };
  }

  window.NovaInputOcControllerVisualizer = { mount, preloadSvgs, VARIANT_MAPS };
})();
