'use strict';

/**
 * Windows high-resolution timing for macro stage handoffs.
 *
 * Without timeBeginPeriod(1), Node's setTimeout often quantizes to ~15.6ms on
 * Windows — which turns an 8ms edit-open into a 16ms stall and makes Double
 * Edit feel slow / inconsistent. Raising the multimedia timer is enough;
 * do NOT busy-spin on the Electron main thread (that freezes the UI).
 */

const koffi = require('koffi');

let begun = false;
let timeBeginPeriod = null;
let timeEndPeriod = null;

try {
  const winmm = koffi.load('winmm.dll');
  timeBeginPeriod = winmm.func('uint __stdcall timeBeginPeriod(uint period)');
  timeEndPeriod = winmm.func('uint __stdcall timeEndPeriod(uint period)');
} catch (err) {
  console.warn('[hires] winmm unavailable:', err.message);
}

function enable() {
  if (begun || !timeBeginPeriod) return false;
  const rc = timeBeginPeriod(1);
  begun = rc === 0;
  if (begun) console.log('[hires] 1ms multimedia timer enabled');
  else console.warn('[hires] timeBeginPeriod(1) failed:', rc);
  return begun;
}

function disable() {
  if (!begun || !timeEndPeriod) return;
  timeEndPeriod(1);
  begun = false;
}

module.exports = { enable, disable };
