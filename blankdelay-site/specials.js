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



    /* ── Affiliate auth (server-backed) ── */
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
        if ($('auth-forgot-form')) $('auth-forgot-form').hidden = true;
        if ($('auth-reset-form')) $('auth-reset-form').hidden = true;
        const desc = $('auth-tab-desc');
        if (desc) desc.textContent = AUTH_DESC[tab] || '';
        if ($('auth-error')) $('auth-error').hidden = true;
    }

    function showForgotForm() {
        if ($('auth-signup-form')) $('auth-signup-form').hidden = true;
        if ($('auth-login-form')) $('auth-login-form').hidden = true;
        if ($('auth-forgot-form')) $('auth-forgot-form').hidden = false;
        if ($('auth-reset-form')) $('auth-reset-form').hidden = true;
        if ($('auth-tab-desc')) $('auth-tab-desc').textContent = 'Enter your affiliate email to get a password reset link.';
        if ($('auth-error')) $('auth-error').hidden = true;
    }

    function showResetForm(token) {
        openModal('auth-modal');
        if ($('auth-signup-form')) $('auth-signup-form').hidden = true;
        if ($('auth-login-form')) $('auth-login-form').hidden = true;
        if ($('auth-forgot-form')) $('auth-forgot-form').hidden = true;
        if ($('auth-reset-form')) $('auth-reset-form').hidden = false;
        if ($('auth-reset-token')) $('auth-reset-token').value = token || '';
        if ($('auth-tab-desc')) $('auth-tab-desc').textContent = 'Choose a new password for your affiliate account.';
        if ($('auth-error')) $('auth-error').hidden = true;
    }

    $('auth-tab-signup')?.addEventListener('click', () => showAuthTab('signup'));
    $('auth-tab-login')?.addEventListener('click', () => showAuthTab('login'));
    $('auth-forgot-link')?.addEventListener('click', (e) => { e.preventDefault(); showForgotForm(); });

    $('affiliate-btn')?.addEventListener('click', async () => {
        const token = window.BD_AFF?.getToken?.();
        if (token) {
            await showAffiliateDash();
            return;
        }
        showAuthTab('signup');
        openModal('auth-modal');
    });

    $('auth-signup-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = $('auth-signup-email')?.value?.trim();
        const pass = $('auth-signup-pass')?.value;
        if (!window.BD_AFF) {
            $('auth-error').textContent = 'Affiliate system loading — refresh and try again.';
            $('auth-error').hidden = false;
            return;
        }
        const res = await BD_AFF.signup(email, pass);
        if (!res.ok) {
            $('auth-error').textContent = res.msg || 'Signup failed.';
            $('auth-error').hidden = false;
            return;
        }
        closeModal('auth-modal');
        await showAffiliateDash();
    });

    $('auth-login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = $('auth-login-email')?.value?.trim();
        const pass = $('auth-login-pass')?.value;
        const res = await BD_AFF.login(email, pass);
        if (!res.ok) {
            $('auth-error').textContent = res.msg || 'Login failed.';
            $('auth-error').hidden = false;
            return;
        }
        closeModal('auth-modal');
        await showAffiliateDash();
    });

    $('auth-forgot-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = $('auth-forgot-email')?.value?.trim();
        const res = await BD_AFF.forgot(email);
        if (!res.ok) {
            $('auth-error').textContent = res.msg || 'Could not start reset.';
            $('auth-error').hidden = false;
            return;
        }
        if (res.resetUrl) {
            $('auth-error').textContent = 'Reset link ready — open it to set a new password. (Also copy it somewhere safe.)';
            $('auth-error').hidden = false;
            prompt('Your password reset link (valid 1 hour):', res.resetUrl);
        } else {
            $('auth-error').textContent = res.msg || 'Check your email for a reset link.';
            $('auth-error').hidden = false;
        }
    });

    $('auth-reset-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = $('auth-reset-token')?.value?.trim();
        const pass = $('auth-reset-pass')?.value;
        const res = await BD_AFF.reset(token, pass);
        if (!res.ok) {
            $('auth-error').textContent = res.msg || 'Reset failed.';
            $('auth-error').hidden = false;
            return;
        }
        $('auth-error').textContent = 'Password updated — log in with your new password.';
        $('auth-error').hidden = false;
        showAuthTab('login');
    });

    async function showAffiliateDash() {
        const res = await BD_AFF.me();
        if (!res.ok || !res.user) {
            BD_AFF.logout();
            showAuthTab('login');
            openModal('auth-modal');
            return;
        }
        const user = res.user;
        const branded = `https://blankdelay.com/blankdelayaffiliatetweaks?aff=${encodeURIComponent(user.code)}`;
        if ($('aff-link')) $('aff-link').textContent = branded;
        if ($('aff-code')) $('aff-code').textContent = user.code;
        if ($('aff-earnings')) $('aff-earnings').textContent = formatPrice(user.earnings || 0);
        if ($('aff-balance')) $('aff-balance').textContent = formatPrice(user.balance || 0);
        if ($('aff-sales')) $('aff-sales').textContent = String(user.sales || 0);
        if ($('aff-clicks')) $('aff-clicks').textContent = String(user.clicks || 0);
        if ($('aff-email')) $('aff-email').textContent = user.email;
        if ($('aff-paypal')) $('aff-paypal').value = user.paypalEmail || user.email || '';
        const rate = res.rates?.affiliate != null ? Math.round(res.rates.affiliate * 100) : 80;
        if ($('aff-rate-note')) $('aff-rate-note').textContent = `${rate}% commission per sale · 20% cash-out fee to BlankDelay`;

        const list = $('aff-sales-list');
        if (list) {
            const sales = res.sales || [];
            list.innerHTML = sales.length
                ? sales.slice(0, 20).map(s =>
                    `<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;gap:10px;">
                        <span>${s.product || 'Product'} · ${new Date(s.date).toLocaleDateString()}</span>
                        <strong class="mono">${formatPrice(s.commission || 0)}</strong>
                    </div>`).join('')
                : '<p class="checkout-note">No sales yet — share your BlankDelay Affiliate Tweaks link.</p>';
        }
        if ($('aff-cashout-msg')) {
            $('aff-cashout-msg').textContent = '';
            $('aff-cashout-msg').hidden = true;
        }
        openModal('affiliate-dash-modal');
    }

    $('aff-copy-btn')?.addEventListener('click', () => {
        navigator.clipboard?.writeText($('aff-link')?.textContent || '');
        $('aff-copy-btn').textContent = 'Copied!';
        setTimeout(() => { $('aff-copy-btn').textContent = 'Copy Link'; }, 2000);
    });

    $('aff-logout')?.addEventListener('click', () => {
        BD_AFF.logout();
        closeModal('affiliate-dash-modal');
    });

    $('aff-cashout-btn')?.addEventListener('click', async () => {
        const paypal = $('aff-paypal')?.value?.trim();
        const res = await BD_AFF.cashout(paypal);
        const msg = $('aff-cashout-msg');
        if (msg) {
            msg.hidden = false;
            msg.textContent = res.msg || (res.ok ? 'Cash-out requested.' : 'Cash-out failed.');
            msg.style.color = res.ok ? '#8dffb4' : '#ff8f8f';
        }
        if (res.ok) await showAffiliateDash();
    });

    /* Capture affiliate/ref from URL on landing */
    const params = new URLSearchParams(location.search);
    const affCode = params.get('aff');
    if (affCode) {
        sessionStorage.setItem('bd-aff-pending', affCode);
        localStorage.setItem('bd-aff-code', affCode);
        BD_AFF?.click?.(affCode);
        if (typeof bdSyncStripeLinks === 'function') bdSyncStripeLinks();
    }
    if (params.get('ref')) sessionStorage.setItem('bd-ref-pending', params.get('ref'));
    if (/blankdelayaffiliatetweaks/i.test(location.pathname) && affCode) {
        BD_AFF?.click?.(affCode);
    }

    const resetTok = params.get('aff_reset');
    if (resetTok) showResetForm(resetTok);
})();
