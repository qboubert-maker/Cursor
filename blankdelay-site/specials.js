(function () {

    const $ = id => document.getElementById(id);



    function openModal(id) { const m = $(id); if (m) m.hidden = false; }

    function closeModal(id) { const m = $(id); if (m) m.hidden = true; }



    document.querySelectorAll('[data-close-modal]').forEach(btn => {

        btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));

    });



    function formatPrice(n) { return '$' + n.toFixed(2); }



    /* ── Blank Pass subscription status ── */

    function getPassEmail() {

        return localStorage.getItem('bd-pass-email') || '';

    }



    function updatePassCard() {

        BD_STORE.processPassSubscriptions();

        const email = getPassEmail();

        const status = $('pass-status');

        const subscribeBtn = $('blank-pass-subscribe');

        const manageBtn = $('blank-pass-manage');

        if (!email) return;



        const sub = BD_STORE.getPassSubscription(email);

        if (!sub) return;



        if (BD_STORE.isPassActive(email)) {

            const days = BD_STORE.getPassDaysLeft(email);

            if (status) {

                status.hidden = false;

                status.style.color = '#6f6';

                status.textContent = `Active · ${days} day${days !== 1 ? 's' : ''} left · ends ${BD_STORE.formatPassExpiry(sub.expiresAt)}` +

                    (sub.autoRenew ? ' · auto-renew ON' : ' · one month only');

            }

            if (subscribeBtn) subscribeBtn.textContent = 'Extend Subscription';

            if (manageBtn) manageBtn.hidden = false;

        } else {

            if (status) {

                status.hidden = false;

                status.style.color = '#f88';

                status.textContent = `Expired ${BD_STORE.formatPassExpiry(sub.expiresAt)} — resubscribe to restore access`;

            }

            if (subscribeBtn) subscribeBtn.textContent = 'Resubscribe';

            if (manageBtn) manageBtn.hidden = false;

        }

    }



    function renderPassModal() {

        const email = getPassEmail();

        const sub = email ? BD_STORE.getPassSubscription(email) : null;

        const emailEl = $('pass-modal-email');

        const statusEl = $('pass-modal-status');

        const actionsEl = $('pass-modal-actions');

        if (!emailEl || !statusEl || !actionsEl) return;



        if (!email || !sub) {

            emailEl.textContent = 'Subscribe first to manage your Blank Pass.';

            statusEl.innerHTML = '';

            actionsEl.innerHTML = '<a href="' + (bdStripeUrl('blank-pass-monthly') || 'index.html#specials') + '" class="btn btn-primary">Subscribe · $9.99/mo</a>';

            return;

        }



        emailEl.textContent = `Account: ${email}`;

        const active = BD_STORE.isPassActive(email);

        const days = BD_STORE.getPassDaysLeft(email);



        if (active) {

            statusEl.innerHTML = `

                <p style="color:#6f6;margin-bottom:8px;">✓ Active — ${days} day${days !== 1 ? 's' : ''} remaining</p>

                <p class="mono" style="font-size:13px;color:var(--text-dim);">Current period ends ${BD_STORE.formatPassExpiry(sub.expiresAt)}</p>

                <p style="margin-top:10px;font-size:14px;">Billing: <strong>${sub.autoRenew ? 'Auto-renew ($9.99 every 30 days)' : 'One month only — no auto-renew'}</strong></p>

            `;

        } else {

            statusEl.innerHTML = `

                <p style="color:#f88;margin-bottom:8px;">✗ Expired — access ended ${BD_STORE.formatPassExpiry(sub.expiresAt)}</p>

                <p style="font-size:14px;">Resubscribe to unlock all core products again.</p>

            `;

        }



        actionsEl.innerHTML = '';

        if (active && sub.autoRenew) {

            const cancelBtn = document.createElement('button');

            cancelBtn.className = 'btn btn-ghost';

            cancelBtn.textContent = 'Turn Off Auto-Renew';

            cancelBtn.addEventListener('click', () => {

                BD_STORE.setPassAutoRenew(email, false);

                updatePassCard();

                renderPassModal();

            });

            actionsEl.appendChild(cancelBtn);

        } else if (active && !sub.autoRenew) {

            const enableBtn = document.createElement('button');

            enableBtn.className = 'btn btn-ghost';

            enableBtn.textContent = 'Enable Auto-Renew';

            enableBtn.addEventListener('click', () => {

                BD_STORE.setPassAutoRenew(email, true);

                updatePassCard();

                renderPassModal();

            });

            actionsEl.appendChild(enableBtn);

        }



        const renewLink = document.createElement('a');

        renewLink.className = 'btn btn-primary';

        renewLink.href = bdStripeUrl('blank-pass-monthly') || 'index.html#specials';

        renewLink.textContent = active ? 'Extend / Change Billing' : 'Resubscribe · $9.99';

        renewLink.style.marginLeft = actionsEl.children.length ? '8px' : '0';

        actionsEl.appendChild(renewLink);

    }



    updatePassCard();



    /* ── Exit modal — claim BLANK15 ── */

    $('claim-discount-btn')?.addEventListener('click', () => {

        BD_STORE.setActiveDiscount('BLANK15');

        closeModal('exit-modal');

        if (typeof bdSyncStripeLinks === 'function') bdSyncStripeLinks();
        window.location.href = bdStripeUrl('premium') || 'index.html#products';

    });



    /* ── Blank Pass purchases ── */

    $('blank-pass-buy')?.addEventListener('click', e => {
        if (bdStripeUrl('blank-pass-full')) return;
        e.preventDefault();
        bdGoStripe('blank-pass-full');
    });
    $('blank-pass-subscribe')?.addEventListener('click', e => {
        if (bdGoStripe('blank-pass-monthly')) { e.preventDefault(); return; }
        e.preventDefault();
        window.location.href = bdStripeUrl('blank-pass-monthly') || 'index.html#specials';
    });

    $('blank-pass-manage')?.addEventListener('click', () => {

        renderPassModal();

        openModal('pass-modal');

    });



    /* ── Gift cards ── */

    let giftAmount = 50;

    document.querySelectorAll('.gift-opts span').forEach(opt => {

        opt.addEventListener('click', () => {

            document.querySelectorAll('.gift-opts span').forEach(s => s.classList.remove('active'));

            opt.classList.add('active');

            giftAmount = parseInt(opt.textContent.replace('$', ''), 10);

        });

    });

    $('gift-buy-btn')?.addEventListener('click', () => {

        if (!bdGoStripe('gift-card')) window.location.href = bdStripeUrl('gift-card') || 'index.html#specials';

    });



    /* ── Refer a friend ── */

    $('refer-btn')?.addEventListener('click', () => {

        const yourEmail = $('refer-your-email')?.value?.trim();

        const friendEmail = $('refer-email')?.value?.trim();

        const err = $('refer-error');

        if (!yourEmail || !yourEmail.includes('@')) {

            if (err) { err.textContent = 'Enter your email address.'; err.hidden = false; }

            return;

        }

        if (!friendEmail || !friendEmail.includes('@')) {

            if (err) { err.textContent = 'Enter your friend\'s email.'; err.hidden = false; }

            return;

        }

        const code = BD_STORE.createReferral(yourEmail, friendEmail);

        const link = bdStripeUrl('premium') || `${location.origin}${location.pathname.replace('index.html', '')}index.html#products`;

        $('refer-link-out').textContent = link;

        $('refer-success').hidden = false;

        if (err) err.hidden = true;

    });



    $('refer-redeem-btn')?.addEventListener('click', () => {

        const email = $('refer-your-email')?.value?.trim() || $('refer-redeem-email')?.value?.trim();

        if (!email) { alert('Enter your email in the Refer a Friend form first.'); return; }

        $('refer-balance').textContent = formatPrice(BD_STORE.getReferCredits(email));

        if ($('refer-redeem-email')) $('refer-redeem-email').value = email;

        openModal('refer-redeem-modal');

    });



    $('redeem-submit')?.addEventListener('click', () => {

        const email = $('refer-redeem-email')?.value?.trim();

        const amt = parseFloat($('redeem-amount')?.value || '5');

        if (BD_STORE.redeemReferCredit(email, amt)) {

            $('redeem-msg').textContent = `$${amt.toFixed(2)} redemption submitted — paid to ${email} within 3–5 days.`;

            $('refer-balance').textContent = formatPrice(BD_STORE.getReferCredits(email));

        } else {

            $('redeem-msg').textContent = 'Insufficient balance.';

        }

    });



    /* ── Affiliate auth ── */

    let authTab = 'signup';

    const AUTH_DESC = {

        signup: 'New creator? Enter your email and password to create your affiliate account.',

        login: 'Already registered? Log in with your email and password to open your dashboard.'

    };



    function showAuthTab(tab) {

        authTab = tab;

        $('auth-tab-signup')?.classList.toggle('active', tab === 'signup');

        $('auth-tab-login')?.classList.toggle('active', tab === 'login');

        if ($('auth-signup-form')) $('auth-signup-form').hidden = tab !== 'signup';

        if ($('auth-login-form')) $('auth-login-form').hidden = tab !== 'login';

        const desc = $('auth-tab-desc');

        if (desc) desc.textContent = AUTH_DESC[tab] || '';

        if ($('auth-error')) $('auth-error').hidden = true;

    }

    $('auth-tab-signup')?.addEventListener('click', () => showAuthTab('signup'));

    $('auth-tab-login')?.addEventListener('click', () => showAuthTab('login'));



    $('affiliate-btn')?.addEventListener('click', () => {

        const session = BD_STORE.getSession();

        if (session) showAffiliateDash(session.email);

        else { showAuthTab('signup'); openModal('auth-modal'); }

    });



    $('auth-signup-form')?.addEventListener('submit', e => {

        e.preventDefault();

        const email = $('auth-signup-email')?.value?.trim();

        const pass = $('auth-signup-pass')?.value;

        const res = BD_STORE.signup(email, pass);

        if (!res.ok) {

            $('auth-error').textContent = res.msg;

            $('auth-error').hidden = false;

            return;

        }

        closeModal('auth-modal');

        showAffiliateDash(email);

    });



    $('auth-login-form')?.addEventListener('submit', e => {

        e.preventDefault();

        const email = $('auth-login-email')?.value?.trim();

        const pass = $('auth-login-pass')?.value;

        const res = BD_STORE.login(email, pass);

        if (!res.ok) {

            $('auth-error').textContent = res.msg;

            $('auth-error').hidden = false;

            return;

        }

        closeModal('auth-modal');

        showAffiliateDash(email);

    });



    function showAffiliateDash(email) {

        const user = BD_STORE.getAffiliateUser(email);

        if (!user) return;

        const base = (location.origin + location.pathname).replace(/index\.html$/i, '');

        const link = `${base}?aff=${encodeURIComponent(user.code)}#products`.replace('?#', '?').replace(/([^:])\/{2,}/g, '$1/');

        const branded = `https://blankdelay.com/blankdelayaffiliatetweaks?aff=${encodeURIComponent(user.code)}`;

        $('aff-link').textContent = branded;

        $('aff-code').textContent = user.code;

        $('aff-earnings').textContent = formatPrice(user.earnings || 0);

        $('aff-sales').textContent = String(user.sales || 0);

        if ($('aff-clicks')) $('aff-clicks').textContent = String(BD_STORE.getAffiliateClicks?.(user.code) || 0);

        $('aff-email').textContent = email;

        const list = $('aff-sales-list');

        if (list) {

            const sales = BD_STORE.getAffiliateSales?.(user.code) || [];

            list.innerHTML = sales.length

                ? sales.slice().reverse().slice(0, 20).map(s =>

                    `<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;gap:10px;">

                        <span>${s.product || 'Product'} · ${new Date(s.date).toLocaleDateString()}</span>

                        <strong class="mono">${formatPrice(s.commission || 0)}</strong>

                    </div>`).join('')

                : '<p class="checkout-note">No sales yet — share your BlankDelay Affiliate Tweaks link.</p>';

        }

        openModal('affiliate-dash-modal');

    }



    $('aff-copy-btn')?.addEventListener('click', () => {

        navigator.clipboard?.writeText($('aff-link')?.textContent || '');

        $('aff-copy-btn').textContent = 'Copied!';

        setTimeout(() => { $('aff-copy-btn').textContent = 'Copy Link'; }, 2000);

    });



    $('aff-logout')?.addEventListener('click', () => {

        BD_STORE.logout();

        closeModal('affiliate-dash-modal');

    });



    /* Capture affiliate/ref from URL on landing */

    const params = new URLSearchParams(location.search);

    if (params.get('aff')) {

        sessionStorage.setItem('bd-aff-pending', params.get('aff'));

        BD_STORE.trackAffiliateClick?.(params.get('aff'));

    }

    if (params.get('ref')) sessionStorage.setItem('bd-ref-pending', params.get('ref'));

    // Pretty path support: /blankdelayaffiliatetweaks?aff=CODE

    if (/blankdelayaffiliatetweaks/i.test(location.pathname) && params.get('aff')) {

        BD_STORE.trackAffiliateClick?.(params.get('aff'));

    }

})();

