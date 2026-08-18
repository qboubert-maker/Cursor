(function () {
    const $ = (id) => document.getElementById(id);

    async function licenseFromSessionId(sessionId) {
        const data = new TextEncoder().encode('bd-v1-' + sessionId);
        const hash = await crypto.subtle.digest('SHA-256', data);
        const hex = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
        const part = (off) => hex.substring(off, off + 4).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
        return `BD-${part(0)}-${part(4)}-${part(8)}`;
    }

    function formatPrice(n) {
        return '$' + Number(n || 0).toFixed(2);
    }

    function slugFromParams() {
        const p = new URLSearchParams(window.location.search);
        return p.get('p') || p.get('product') || '';
    }

    function showLoading(on) {
        const el = $('thank-loading');
        if (el) el.hidden = !on;
        const ready = $('thank-ready');
        if (ready) ready.hidden = on;
    }

    function copyText(text, btn, okLabel) {
        navigator.clipboard?.writeText(text).then(() => {
            if (!btn) return;
            const prev = btn.textContent;
            btn.textContent = okLabel || 'Copied!';
            setTimeout(() => { btn.textContent = prev; }, 2000);
        });
    }

    async function loadFulfillment() {
        if (!$('thank-you-page')) return;

        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('session_id') || params.get('session') || params.get('order') || '';
        const fallbackSlug = slugFromParams() || 'premium';

        showLoading(true);

        let data = null;

        if (sessionId) {
            try {
                const res = await fetch('/.netlify/functions/get-fulfillment?session_id=' + encodeURIComponent(sessionId));
                if (res.ok) data = await res.json();
            } catch (err) {
                console.warn('Fulfillment API unavailable, using local key', err);
            }
            if (!data?.license) {
                data = {
                    ok: true,
                    license: await licenseFromSessionId(sessionId),
                    slug: fallbackSlug,
                    product: BD_STORE?.CATALOG?.[fallbackSlug]?.name || 'BlankDelay Product',
                    email: params.get('email') || '',
                    orderId: sessionId,
                    price: BD_STORE?.CATALOG?.[fallbackSlug]?.price || 0,
                    downloadUrl: typeof bdDownloadUrl === 'function' ? bdDownloadUrl(fallbackSlug) : BD_DOWNLOADS?.hub
                };
            }
        } else if (params.get('key')) {
            data = {
                ok: true,
                license: params.get('key'),
                slug: fallbackSlug,
                product: BD_STORE?.CATALOG?.[fallbackSlug]?.name || 'BlankDelay Product',
                email: params.get('email') || '',
                orderId: params.get('order') || 'BD-DEMO',
                price: BD_STORE?.CATALOG?.[fallbackSlug]?.price || 0,
                downloadUrl: typeof bdDownloadUrl === 'function' ? bdDownloadUrl(fallbackSlug) : BD_DOWNLOADS?.hub
            };
        } else {
            showLoading(false);
            $('thank-no-session')?.removeAttribute('hidden');
            $('thank-ready')?.setAttribute('hidden', '');
            return;
        }

        const slug = data.slug || fallbackSlug;
        const product = data.product || (BD_STORE?.CATALOG?.[slug]?.name || 'BlankDelay Product');
        const downloadUrl = data.downloadUrl || (typeof bdDownloadUrl === 'function' ? bdDownloadUrl(slug) : BD_DOWNLOADS?.hub);
        const downloadLabel = typeof bdDownloadLabel === 'function' ? bdDownloadLabel(slug) : 'BlankDelay App';

        if ($('thank-product')) $('thank-product').textContent = product;
        if ($('thank-license')) $('thank-license').textContent = data.license;
        if ($('thank-email')) $('thank-email').textContent = data.email || 'your email';
        if ($('thank-order-id')) $('thank-order-id').textContent = data.orderId || sessionId;
        if ($('thank-price')) $('thank-price').textContent = data.price ? formatPrice(data.price) : formatPrice(BD_STORE?.CATALOG?.[slug]?.price);

        const dlBtn = $('thank-download-btn');
        if (dlBtn) {
            dlBtn.href = downloadUrl;
            dlBtn.textContent = 'Download ' + downloadLabel;
        }

        const sec = $('thank-security-notice');
        if (sec && typeof BD_DOWNLOAD_NOTICE !== 'undefined') {
            sec.innerHTML = BD_DOWNLOAD_NOTICE.htmlPage;
        }

        if (data.email && typeof BD_EMAIL_SEND === 'function') {
            BD_EMAIL_SEND({
                id: data.orderId,
                slug,
                product,
                email: data.email,
                name: 'Customer',
                price: data.price || BD_STORE?.CATALOG?.[slug]?.price || 0,
                license: data.license
            }).then((r) => {
                const st = $('thank-email-status');
                if (!st) return;
                if (r.ok) {
                    st.textContent = '✓ Copy also sent to ' + data.email;
                    st.style.color = '#6f6';
                } else if (!r.skipped) {
                    st.textContent = 'Email backup: ' + (r.msg || 'could not send');
                    st.style.color = '#fa0';
                }
                st.style.display = 'block';
            });
        }

        showLoading(false);
        $('thank-no-session')?.setAttribute('hidden', '');
        $('thank-ready')?.removeAttribute('hidden');

        // Backup: credit affiliate from this Stripe session if webhook missed it (retry once)
        if (sessionId) {
            const creditOnce = () =>
                fetch('/.netlify/functions/affiliate-api', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'credit-from-session', session_id: sessionId }),
                    keepalive: true
                }).then((r) => r.json().catch(() => null));
            creditOnce()
                .then((res) => {
                    if (res && res.ok === false && res.reason !== 'no_affiliate' && res.reason !== 'already_credited') {
                        setTimeout(() => { creditOnce().catch(() => {}); }, 2500);
                    }
                })
                .catch(() => {
                    setTimeout(() => { creditOnce().catch(() => {}); }, 2500);
                });
        }

        $('thank-copy-key')?.addEventListener('click', () => copyText(data.license, $('thank-copy-key'), 'Copied!'));
        $('thank-copy-key-inline')?.addEventListener('click', () => copyText(data.license, $('thank-copy-key-inline'), 'Copied!'));
    }

    document.addEventListener('DOMContentLoaded', loadFulfillment);
})();
