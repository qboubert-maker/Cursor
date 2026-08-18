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
        login: 'Creators: log in to your dashboard. Admin: use your admin email to open affiliate analytics.'
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

    $('affiliate-btn')?.addEventListener('click', async () => {
        const session = BD_STORE.getSession();
        if (session?.role === 'admin' || BD_STORE.isAdminSession?.()) {
            await showAdminDash();
        } else if (session?.email) {
            showAffiliateDash(session.email);
        } else {
            showAuthTab('signup');
            openModal('auth-modal');
        }
    });

    $('auth-signup-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const email = $('auth-signup-email')?.value?.trim();
        const pass = $('auth-signup-pass')?.value;
        const res = await BD_STORE.signupAndSync(email, pass);
        if (!res.ok) {
            $('auth-error').textContent = res.msg;
            $('auth-error').hidden = false;
            return;
        }
        closeModal('auth-modal');
        showAffiliateDash(email);
    });

    $('auth-login-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const email = $('auth-login-email')?.value?.trim();
        const pass = $('auth-login-pass')?.value;
        const res = await BD_STORE.login(email, pass);
        if (!res.ok) {
            $('auth-error').textContent = res.msg;
            $('auth-error').hidden = false;
            return;
        }
        closeModal('auth-modal');
        if (res.admin) await showAdminDash();
        else showAffiliateDash(email);
    });

    async function showAffiliateDash(email) {
        const user = BD_STORE.getAffiliateUser(email);
        if (!user) return;
        // Keep this affiliate visible in the LIVE admin registry
        BD_STORE.syncAffiliateRemote?.('upsert', { user: BD_STORE.publicAffiliate(user), password: user.password });
        const branded = BD_STORE.affiliateShortLink(user.code);
        $('aff-link').textContent = branded;
        $('aff-code').textContent = user.code;
        $('aff-earnings').textContent = formatPrice(user.earnings || 0);
        if ($('aff-available')) $('aff-available').textContent = formatPrice(BD_STORE.availableBalance(email));
        $('aff-sales').textContent = String(user.sales || 0);
        if ($('aff-clicks')) $('aff-clicks').textContent = String(BD_STORE.getAffiliateClicks?.(user.code) || 0);
        $('aff-email').textContent = email;
        if ($('aff-cashout-amount')) $('aff-cashout-amount').value = BD_STORE.availableBalance(email) || '';
        if ($('aff-cashout-error')) $('aff-cashout-error').hidden = true;
        if ($('aff-cashout-ok')) $('aff-cashout-ok').hidden = true;
        refreshAffiliatePayoutStatus(user);
        const list = $('aff-sales-list');
        if (list) {
            const sales = BD_STORE.getAffiliateSales?.(user.code) || [];
            list.innerHTML = sales.length
                ? sales.slice().reverse().slice(0, 20).map(s =>
                    `<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;gap:10px;">
                        <span>${s.product || 'Product'} · ${new Date(s.date).toLocaleDateString()}</span>
                        <strong class="mono">${formatPrice(s.commission || 0)}</strong>
                    </div>`).join('')
                : '<p class="checkout-note">No sales yet — share your short affiliate link.</p>';
        }
        openModal('affiliate-dash-modal');
    }

    async function showAdminDash() {
        if ($('admin-sync-status')) $('admin-sync-status').textContent = 'Loading live affiliate registry…';
        // Always keep any old/local accounts visible, then merge live cloud data on top
        const localCountBefore = (BD_STORE.listAffiliates?.() || []).length;
        let remote = await BD_STORE.pullRemoteAffiliates?.();
        // If live works, also upload any old local-only accounts so they appear for good
        if (remote && remote.ok && localCountBefore) {
            await BD_STORE.pushAllLocalAffiliatesToLive?.();
            remote = await BD_STORE.pullRemoteAffiliates?.();
        }
        const analytics = BD_STORE.getAdminAnalytics(remote && remote.ok ? remote : null);
        // If remote failed, still show THIS browser's old accounts
        const fallback = (!remote || !remote.ok) ? BD_STORE.getAdminAnalytics(null) : analytics;
        const view = (remote && remote.ok) ? analytics : fallback;
        if ($('admin-email')) $('admin-email').textContent = BD_STORE.ADMIN_EMAIL;
        if ($('admin-sync-status')) {
            if (remote && remote.ok) {
                $('admin-sync-status').textContent = 'Live cloud registry connected · ' + (remote.userCount || view.affiliateCount) + ' affiliate email(s) (includes old accounts synced from this browser + all new live signups).';
                $('admin-sync-status').style.color = '#6f6';
            } else {
                const detail = remote?.detail || remote?.msg || 'unknown';
                $('admin-sync-status').textContent = 'Live registry unavailable (' + detail + '). Showing ' + view.affiliateCount + ' account(s) saved in THIS browser (old local accounts). Redeploy the latest zip, then Refresh Live.';
                $('admin-sync-status').style.color = '#f88';
            }
        }
        if ($('admin-aff-count')) $('admin-aff-count').textContent = String(view.affiliateCount);
        if ($('admin-clicks')) $('admin-clicks').textContent = String(view.totalClicks);
        if ($('admin-aff-share')) $('admin-aff-share').textContent = formatPrice(view.affiliateShare);
        if ($('admin-owner-share')) $('admin-owner-share').textContent = formatPrice(view.ownerShare);
        if ($('admin-pending-amount')) $('admin-pending-amount').textContent = formatPrice(view.pendingAmount);

        const table = $('admin-aff-table');
        if (table) {
            if (!view.affiliates.length) {
                table.innerHTML = '<p class="checkout-note">No affiliate accounts found yet on this browser or live registry. After redeploy, new signups appear automatically. Old creators must log in once on the live site.</p>';
            } else {
                table.innerHTML = `<table class="admin-aff-table"><thead><tr>
                    <th>Email</th><th>Code</th><th>Link</th><th>Clicks</th><th>Sales</th><th>Earned</th><th>Available</th><th>Auto-pay</th><th>Last seen</th>
                </tr></thead><tbody>${view.affiliates.map(a => `<tr>
                    <td>${a.email}</td>
                    <td class="mono">${a.code}</td>
                    <td class="mono admin-link-cell"><a href="${a.link}" target="_blank" rel="noopener">${String(a.link||'').replace('https://','')}</a></td>
                    <td class="mono">${a.clicks}</td>
                    <td class="mono">${a.sales}</td>
                    <td class="mono">${formatPrice(a.earnings || 0)}</td>
                    <td class="mono">${formatPrice(a.available || 0)}</td>
                    <td>${a.payoutsEnabled || a.stripeAccountId ? 'Stripe' : 'Manual'}</td>
                    <td class="mono">${a.lastSeen ? new Date(a.lastSeen).toLocaleString() : '—'}</td>
                </tr>`).join('')}</tbody></table>`;
            }
        }

        const cash = $('admin-cashout-table');
        if (cash) {
            const rows = [...view.pendingCashouts, ...view.paidCashouts].sort((a,b) => (b.created||0)-(a.created||0));
            if (!rows.length) {
                cash.innerHTML = '<p class="checkout-note">No cashout requests yet.</p>';
            } else {
                cash.innerHTML = `<table class="admin-aff-table"><thead><tr>
                    <th>When</th><th>Email</th><th>Amount</th><th>Method</th><th>Pay to</th><th>Status</th><th></th>
                </tr></thead><tbody>${rows.map(c => `<tr>
                    <td>${new Date(c.created).toLocaleString()}</td>
                    <td>${c.email}</td>
                    <td class="mono">${formatPrice(c.amount || 0)}</td>
                    <td>${c.method || '—'}</td>
                    <td class="mono">${c.payoutTo || '—'}</td>
                    <td>${c.status}</td>
                    <td>${c.status === 'pending' ? `<button type="button" class="btn btn-primary btn-sm admin-mark-paid" data-id="${c.id}">Mark paid</button>` : '✓'}</td>
                </tr>`).join('')}</tbody></table>`;
                cash.querySelectorAll('.admin-mark-paid').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        BD_STORE.markCashoutPaid(btn.dataset.id);
                        await showAdminDash();
                    });
                });
            }
        }
        openModal('admin-dash-modal');
    }


    async function refreshAffiliatePayoutStatus(user) {
        const statusEl = $('aff-payout-status');
        const connectBtn = $('aff-connect-stripe');
        const autoBtn = $('aff-auto-payout-btn');
        if (!user) return;
        try {
            const res = await fetch('/.netlify/functions/affiliate-connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'status', email: user.email, code: user.code })
            });
            const data = await res.json();
            if (!data?.ok) {
                if (statusEl) statusEl.textContent = 'Connect Stripe once (after deploy). Then your 20% can auto-deposit on each sale.';
                return;
            }
            if (data.payoutsEnabled) {
                if (statusEl) statusEl.textContent = 'Stripe connected · auto-deposit ON. New commissions can pay out automatically. Available now: $' + Number(data.available || 0).toFixed(2);
                if (connectBtn) connectBtn.textContent = 'Manage Stripe Payouts';
                if (autoBtn) autoBtn.hidden = !(Number(data.available || 0) >= 5);
            } else if (data.connected) {
                if (statusEl) statusEl.textContent = 'Stripe started but onboarding incomplete — click Connect to finish.';
                if (connectBtn) connectBtn.textContent = 'Finish Stripe Setup';
                if (autoBtn) autoBtn.hidden = true;
            } else {
                if (statusEl) statusEl.textContent = 'Not connected yet. Connect Stripe so 20% auto-deposits to your bank. Manual cashout still works as backup.';
                if (connectBtn) connectBtn.textContent = 'Connect Stripe for Auto-Payouts';
                if (autoBtn) autoBtn.hidden = true;
            }
        } catch (_) {
            if (statusEl) statusEl.textContent = 'Connect Stripe for auto-payouts (works after Netlify deploy with Stripe keys).';
        }
    }

    $('aff-copy-btn')?.addEventListener('click', () => {
        navigator.clipboard?.writeText($('aff-link')?.textContent || '');
        $('aff-copy-btn').textContent = 'Copied!';
        setTimeout(() => { $('aff-copy-btn').textContent = 'Copy Link'; }, 2000);
    });


    $('aff-connect-stripe')?.addEventListener('click', async () => {
        const session = BD_STORE.getSession();
        const user = session?.email ? BD_STORE.getAffiliateUser(session.email) : null;
        if (!user) return;
        const btn = $('aff-connect-stripe');
        const prev = btn?.textContent;
        if (btn) btn.textContent = 'Opening Stripe…';
        try {
            const res = await fetch('/.netlify/functions/affiliate-connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'onboard', email: user.email, code: user.code })
            });
            const data = await res.json();
            if (!data?.ok || !data.url) {
                alert(data?.msg || 'Could not start Stripe Connect. Make sure the site is deployed on Netlify with STRIPE_SECRET_KEY and Connect enabled.');
                if (btn) btn.textContent = prev || 'Connect Stripe for Auto-Payouts';
                return;
            }
            window.location.href = data.url;
        } catch (err) {
            alert('Connect failed. Deploy to Netlify and enable Stripe Connect first.');
            if (btn) btn.textContent = prev || 'Connect Stripe for Auto-Payouts';
        }
    });

    $('aff-auto-payout-btn')?.addEventListener('click', async () => {
        const session = BD_STORE.getSession();
        const user = session?.email ? BD_STORE.getAffiliateUser(session.email) : null;
        if (!user) return;
        const ok = $('aff-cashout-ok');
        const err = $('aff-cashout-error');
        try {
            const res = await fetch('/.netlify/functions/affiliate-connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'payout-available', email: user.email, code: user.code })
            });
            const data = await res.json();
            if (!data?.ok) {
                if (err) { err.textContent = data?.msg || 'Payout failed'; err.hidden = false; }
                if (ok) ok.hidden = true;
                return;
            }
            if (err) err.hidden = true;
            if (ok) {
                ok.textContent = 'Auto-deposit sent: $' + Number(data.amount).toFixed(2) + ' via Stripe.';
                ok.hidden = false;
            }
            // sync local paidOut best-effort
            user.paidOut = data.paidOut;
            const users = BD_STORE.getUsers();
            const idx = users.findIndex(u => u.email === user.email);
            if (idx >= 0) { users[idx].paidOut = data.paidOut; BD_STORE.saveUsers(users); }
            showAffiliateDash(user.email);
        } catch (_) {
            if (err) { err.textContent = 'Payout request failed.'; err.hidden = false; }
        }
    });

    $('aff-cashout-btn')?.addEventListener('click', () => {
        const session = BD_STORE.getSession();
        if (!session?.email) return;
        const amount = parseFloat($('aff-cashout-amount')?.value || '0');
        const method = $('aff-cashout-method')?.value;
        const payoutTo = $('aff-cashout-to')?.value?.trim();
        const res = BD_STORE.requestCashout(session.email, amount, method, payoutTo);
        const err = $('aff-cashout-error');
        const ok = $('aff-cashout-ok');
        if (!res.ok) {
            if (err) { err.textContent = res.msg; err.hidden = false; }
            if (ok) ok.hidden = true;
            return;
        }
        if (err) err.hidden = true;
        if (ok) {
            ok.textContent = 'Cashout requested — admin will pay you via ' + method + '.';
            ok.hidden = false;
        }
        showAffiliateDash(session.email);
    });

    $('aff-logout')?.addEventListener('click', () => {
        BD_STORE.logout();
        closeModal('affiliate-dash-modal');
    });

    $('admin-logout')?.addEventListener('click', () => {
        BD_STORE.logout();
        closeModal('admin-dash-modal');
    });

    $('admin-refresh')?.addEventListener('click', async () => {
        await showAdminDash();
    });

    $('admin-push-local')?.addEventListener('click', async () => {
        const btn = $('admin-push-local');
        const prev = btn?.textContent;
        if (btn) btn.textContent = 'Uploading…';
        const n = await BD_STORE.pushAllLocalAffiliatesToLive?.();
        if (btn) btn.textContent = prev || 'Upload Local Affiliates';
        if ($('admin-sync-status')) {
            $('admin-sync-status').textContent = 'Uploaded ' + (n || 0) + ' local affiliate(s) to live registry. Refreshing…';
            $('admin-sync-status').style.color = '#6f6';
        }
        await showAdminDash();
    });

    /* Capture affiliate/ref from URL on landing */
    const params = new URLSearchParams(location.search);
    let affCode = params.get('aff');
    const shortMatch = location.pathname.match(/^\/a\/([A-Za-z0-9-]+)\/?$/i);
    if (!affCode && shortMatch) affCode = shortMatch[1];
    if (affCode) {
        sessionStorage.setItem('bd-aff-pending', affCode);
        BD_STORE.trackAffiliateClick?.(affCode);
    }
    if (params.get('ref')) sessionStorage.setItem('bd-ref-pending', params.get('ref'));
    if (/blankdelayaffiliatetweaks/i.test(location.pathname) && params.get('aff')) {
        BD_STORE.trackAffiliateClick?.(params.get('aff'));
    }


    // If an affiliate is already logged in on this device, push them into the LIVE registry
    (async () => {
        const session = BD_STORE.getSession?.();
        if (session?.role === 'affiliate' && session.email) {
            const user = BD_STORE.getAffiliateUser(session.email);
            if (user) {
                await BD_STORE.syncAffiliateRemote?.('upsert', {
                    user: BD_STORE.publicAffiliate(user),
                    password: user.password
                });
            }
        }
    })();

    if (params.get('aff_connect') === 'done') {
        const session = BD_STORE.getSession();
        if (session?.email && session.role !== 'admin') {
            setTimeout(() => showAffiliateDash(session.email), 300);
        }
    }

})();
