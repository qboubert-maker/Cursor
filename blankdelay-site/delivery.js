const BD_PRODUCT_APPS = {
    premium: { label: 'Blank Premium Utility', launch: 'npm run electron:premium' },
    'zero-plus': { label: 'Zero Delay Plus', launch: 'npm run electron:zero-plus' },
    zero: { label: 'Zero Delay', launch: 'npm run electron:zero' },
    fps: { label: 'FPS Boost', launch: 'npm run electron:fps' },
    ping: { label: 'Ping Optimizer', launch: 'npm run electron:ping' },
    controller: { label: 'Controller Macro', launch: 'npm run electron:controller' },
    keyboard: { label: 'Keyboard Macro', launch: 'npm run electron:keyboard' },
    aim: { label: 'Aim Bundle', launch: 'npm run electron:aim' },
    shotgun: { label: 'Shotgun Pack', launch: 'npm run electron:shotgun' }
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

function buildDeliveryUrl(order, origin) {
    return buildProductUrl(order, origin);
}

(function initDeliveryPage() {
    if (!document.getElementById('delivery-page')) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('session_id') || params.get('key') || params.get('order')) {
        window.location.replace('thank-you.html?' + params.toString());
        return;
    }
    const slug = params.get('p') || 'premium';
    const product = BD_STORE.CATALOG[slug] || BD_STORE.CATALOG.premium;
    const app = BD_PRODUCT_APPS[slug] || { label: product.name, launch: 'npm run electron:hub' };

    document.getElementById('del-order-id').textContent = params.get('order') || 'BD-DEMO';
    document.getElementById('del-product').textContent = product.name;
    document.getElementById('del-email').textContent = params.get('email') || 'your email';
    document.getElementById('del-license').textContent = params.get('key') || 'BD-XXXX-XXXX-XXXX';
    document.getElementById('del-tag').textContent = product.tag;
    document.getElementById('del-price-line').textContent = 'Paid: ' + (product.monthly ? '$' + product.price.toFixed(2) + '/mo' : '$' + product.price.toFixed(2) + ' one-time');

    const stepDl = document.getElementById('del-step-download');
    const dlBtn = document.getElementById('del-download-btn');
    const dlDesc = document.getElementById('del-download-desc');
    const downloadUrl = typeof bdDownloadUrl === 'function' ? bdDownloadUrl(slug) : '';
    if (dlBtn && downloadUrl) {
        dlBtn.href = downloadUrl;
        dlBtn.textContent = 'Download ' + (typeof bdDownloadLabel === 'function' ? bdDownloadLabel(slug) : app.label);
    }
    if (dlDesc) {
        dlDesc.textContent = 'Download and run the BlankDelay app for ' + product.name + ', then paste your license key.';
    }
    if (stepDl) {
        stepDl.innerHTML = 'Download and install <strong>' + app.label + '</strong>, then open it on your PC.';
    }
    const hint = document.getElementById('del-launch-hint');
    if (hint) hint.textContent = 'Windows 10/11 · Run as Administrator if prompted for system tweaks.';

    const sec = document.getElementById('del-security-notice');
    if (sec && typeof BD_DOWNLOAD_NOTICE !== 'undefined') {
        sec.innerHTML = BD_DOWNLOAD_NOTICE.htmlPage;
    }

    document.getElementById('del-copy-key')?.addEventListener('click', () => {
        const key = document.getElementById('del-license')?.textContent || '';
        navigator.clipboard?.writeText(key);
        const btn = document.getElementById('del-copy-key');
        if (btn) {
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy License Key'; }, 2000);
        }
    });
})();
