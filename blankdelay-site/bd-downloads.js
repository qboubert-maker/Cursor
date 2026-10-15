/* BlankDelay — customer download links (one hub app; product-named .exe URLs) */
const BD_SETUP_FILES = {
    premium: 'BlankDelay-Blank-Premium-Utility-Setup.exe',
    'zero-plus': 'BlankDelay-Zero-Delay-Plus-Setup.exe',
    zero: 'BlankDelay-Zero-Delay-Setup.exe',
    fps: 'BlankDelay-FPS-Boost-Setup.exe',
    ping: 'BlankDelay-Ping-Optimizer-Setup.exe',
    controller: 'BlankDelay-Controller-Macro-V2-Setup.exe',
    keyboard: 'BlankDelay-Keyboard-Macro-V2-Setup.exe',
    aim: 'BlankDelay-Aim-Bundle-Setup.exe',
    shotgun: 'BlankDelay-Shotgun-Pack-Setup.exe',
    'blank-pass-full': 'BlankDelay-Setup.exe',
    'blank-pass-monthly': 'BlankDelay-Setup.exe',
    'gift-card': 'BlankDelay-Setup.exe'
};

const BD_DOWNLOADS = {
    hub: 'https://blankdelay.com/downloads/BlankDelay-Setup.exe',
    label: 'BlankDelay Desktop App'
};

function bdSetupFileName(slug) {
    return BD_SETUP_FILES[slug] || 'BlankDelay-Setup.exe';
}

function bdDownloadUrl(slug, origin) {
    const base = (origin || 'https://blankdelay.com').replace(/\/$/, '');
    return base + '/downloads/' + bdSetupFileName(slug);
}

function bdDownloadLabel(slug) {
    const names = {
        premium: 'Blank Premium Utility',
        'zero-plus': 'Zero Delay Plus',
        zero: 'Zero Delay',
        fps: 'FPS Boost',
        ping: 'Ping Optimizer',
        controller: 'Controller Macro',
        keyboard: 'Keyboard Macro',
        aim: 'Aim Bundle',
        shotgun: 'Shotgun Pack',
        'blank-pass-full': 'Blank Pass — Full Kit',
        'blank-pass-monthly': 'Blank Pass Monthly',
        'gift-card': 'BlankDelay Gift Card'
    };
    return names[slug] || BD_DOWNLOADS.label;
}
