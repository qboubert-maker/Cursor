'use strict';

const fs = require('fs');
const path = require('path');

const PACKED = `app.asar${path.sep}`;
const UNPACKED = `app.asar.unpacked${path.sep}`;

/**
 * Windows cannot execute an .exe, load a .dll or start a worker thread from
 * inside app.asar. electron-builder writes those files to app.asar.unpacked
 * instead, so rewrite the path whenever that copy is really on disk.
 */
function unpacked(target) {
  const p = path.normalize(String(target || ''));
  if (!p || !p.includes(PACKED)) return p;
  const alt = p.replace(PACKED, UNPACKED);
  try {
    if (fs.existsSync(alt)) return alt;
  } catch {
    /* fall through to the packed path */
  }
  return p;
}

module.exports = { unpacked };
