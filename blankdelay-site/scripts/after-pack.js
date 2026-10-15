'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { stamp } = require('./stamp-icons');

const PRODUCT_LAUNCHERS = [
    { file: 'BlankDelay Hub.exe', product: 'hub' },
    { file: 'BlankDelay-Premium-Utility.exe', product: 'premium' },
    { file: 'BlankDelay-Zero-Delay-Plus.exe', product: 'zero-plus' },
    { file: 'BlankDelay-Zero-Delay.exe', product: 'zero' },
    { file: 'BlankDelay-FPS-Boost.exe', product: 'fps' },
    { file: 'BlankDelay-Ping-Optimizer.exe', product: 'ping' },
    { file: 'BlankDelay-Keyboard-Macro-V2.exe', product: 'keyboard' },
    { file: 'BlankDelay-Aim-Bundle.exe', product: 'aim' },
    { file: 'BlankDelay-Shotgun-Pack.exe', product: 'shotgun' }
];

function buildLauncher(nsi, out, product, iconPath) {
    const args = process.platform === 'win32'
        ? [`/DPRODUCT=${product}`, `/DOUTFILE=${out}`, `/DICON=${iconPath}`, nsi]
        : [`-DPRODUCT=${product}`, `-DOUTFILE=${out}`, `-DICON=${iconPath}`, nsi];
    execFileSync('makensis', args, { stdio: 'pipe' });
}

exports.default = async function afterPack(context) {
    const appOutDir = context.appOutDir;
    const projectDir = context.packager.projectDir;
    const exePath = path.join(appOutDir, 'BlankDelay.exe');
    const iconPath = path.join(projectDir, 'build', 'icon.ico');
    const nsi = path.join(projectDir, 'scripts', 'make-product-launchers.nsi');

    if (!fs.existsSync(exePath)) return;

    if (fs.existsSync(iconPath)) {
        try {
            stamp(exePath, iconPath, 'BlankDelay');
            console.log('[after-pack] stamped BlankDelay logo onto BlankDelay.exe');
        } catch (err) {
            console.warn('[after-pack] stamp failed:', err.message || err);
        }
        const ctrl = path.join(appOutDir, 'resources', 'controller-macro', 'BlankDelay-Controller-Macro.exe');
        if (fs.existsSync(ctrl)) {
            try {
                stamp(ctrl, iconPath, 'BlankDelay Controller Macro');
                console.log('[after-pack] stamped logo onto Controller Macro exe');
            } catch (err) {
                console.warn('[after-pack] controller stamp failed:', err.message || err);
            }
        }
    }

    for (const entry of PRODUCT_LAUNCHERS) {
        const out = path.join(appOutDir, entry.file);
        try {
            buildLauncher(nsi, out, entry.product, iconPath);
            if (fs.existsSync(iconPath)) stamp(out, iconPath, entry.file.replace(/\.exe$/i, ''));
            console.log('[after-pack] launcher', entry.file);
        } catch (err) {
            console.warn('[after-pack] launcher failed', entry.file, String(err.message || err).slice(0, 180));
        }
    }
};
