const BD_PRODUCT_THEME = {
    fps: 'fps',
    ping: 'ping',
    'zero-plus': 'delay-plus',
    controller: 'controller',
    keyboard: 'keyboard',
    aim: 'aim',
    shotgun: 'shotgun'
};

const BD_ELECTRON_CMD = {
    premium: 'electron:premium',
    'zero-plus': 'electron:zero-plus',
    zero: 'electron:zero',
    fps: 'electron:fps',
    ping: 'electron:ping',
    controller: 'electron:controller',
    keyboard: 'electron:keyboard',
    aim: 'electron:aim',
    shotgun: 'electron:shotgun'
};

function buildProductUrl(order, origin) {
    const base = (origin || window.location.origin).replace(/\/$/, '');
    const slug = order.slug === 'cart' ? (order.items?.[0]?.slug || 'premium') : (order.slug || 'premium');
    const params = new URLSearchParams({
        p: slug,
        key: order.license || '',
        order: order.id || '',
        email: order.email || ''
    });
    return `${base}/product.html?${params.toString()}`;
}

function isPurchaseKey(key) {
    return /^BD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test((key || '').trim());
}

(function initProductPage() {
    if (!document.getElementById('product-page')) return;

    const params = new URLSearchParams(window.location.search);
    const slug = params.get('p') || 'ping';
    const urlKey = (params.get('key') || '').trim();
    const orderId = params.get('order') || '';
    const catalog = BD_STORE.CATALOG[slug] || BD_STORE.CATALOG.ping;

    if (BD_PRODUCT_THEME[slug]) {
        document.body.dataset.theme = BD_PRODUCT_THEME[slug];
    }

    document.title = `BlankDelay — ${catalog.name}`;
    document.getElementById('product-tag').textContent = catalog.tag;
    document.getElementById('product-name').textContent = catalog.name;
    document.getElementById('product-desc').textContent =
        (catalog.perks && catalog.perks[0]) ? catalog.perks[0] + ' — activate with your purchase key below.' : 'Activate with your purchase key below.';

    const keyInput = document.getElementById('license-key');
    const keyHint = document.getElementById('key-hint');
    const licenseMsg = document.getElementById('license-msg');
    const log = document.getElementById('log');

    if (urlKey && keyInput) keyInput.value = urlKey;
    if (keyHint && urlKey) {
        keyHint.textContent = 'Your license key from email is pre-filled below.';
    }

    function addLog(msg) {
        if (!log) return;
        const line = document.createElement('div');
        line.textContent = msg;
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;
    }

    function validateKey(key) {
        const normalized = key.trim().toUpperCase();
        if (!normalized) return { valid: false, msg: 'Enter your license key.' };
        if (urlKey && normalized === urlKey.toUpperCase()) return { valid: true, msg: 'License activated — welcome!' };
        if (isPurchaseKey(normalized)) return { valid: true, msg: 'License activated — welcome!' };
        return { valid: false, msg: 'Invalid license key. Use the key from your email.' };
    }

    document.getElementById('license-btn')?.addEventListener('click', () => {
        const key = keyInput?.value || '';
        const result = validateKey(key);
        if (result.valid) {
            licenseMsg.textContent = '✓ ' + result.msg;
            licenseMsg.className = 'license-msg success';
            document.getElementById('license-section')?.classList.add('activated');
            document.getElementById('unlocked-panel').hidden = false;
            document.getElementById('status').textContent = 'Activated';
            if (orderId) {
                document.getElementById('order-ref').textContent = 'Order: ' + orderId;
            }
            addLog('License validated — product unlocked.');
            addLog('Desktop app: run npm run ' + (BD_ELECTRON_CMD[slug] || 'electron:hub') + ' on your PC for full tweaks.');
        } else {
            licenseMsg.textContent = '✗ ' + result.msg;
            licenseMsg.className = 'license-msg error';
            addLog('License validation failed.');
        }
    });

    document.getElementById('open-desktop-btn')?.addEventListener('click', () => {
        addLog('On your PC, run: npm run ' + (BD_ELECTRON_CMD[slug] || 'electron:hub'));
        alert('Desktop app runs on your PC.\n\nIn the BlankDelay folder run:\nnpm run ' + (BD_ELECTRON_CMD[slug] || 'electron:hub') + '\n\nThen paste the same license key there.');
    });

    if (urlKey) addLog('Key loaded from your purchase link.');
})();
