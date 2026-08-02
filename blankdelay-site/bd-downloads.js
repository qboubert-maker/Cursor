/* BlankDelay — customer download links (one hub app for all products) */
const BD_DOWNLOADS = {
    hub: 'https://blankdelay.com/downloads/BlankDelay-Setup.exe',
    label: 'BlankDelay Desktop App'
};

function bdDownloadUrl(slug) {
    return BD_DOWNLOADS.hub;
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
};
