/* BlankDelay client-side store (demo — connect Stripe for real payments) */
const BD_STORE = {
    DISCOUNTS: { BLANK15: 0.15, BLANK10: 0.10, CREATOR20: 0.20 },
    /* Affiliates earn 20% of each sale; BlankDelay keeps 80%. */
    AFFILIATE_RATE: 0.20,
    OWNER_RATE: 0.80,
    REFER_BONUS: 5,
    DISCORD_INVITE: 'https://discord.gg/hH3cv8RrV',
    /* Admin login (email + SHA-256 of password). Do not put plaintext passwords in source. */
    ADMIN_EMAIL: 'qboubert@gmail.com',
    ADMIN_PASS_HASH: '392f20ddf686371e7d82fe552b0f8de510f7349c05e6904a74544cb0af3faf92',

    CATALOG: {
        premium: { name: 'Blank Premium Utility', tag: 'V4 · ALL IN ONE TWEAKING PACK', price: 29.99, was: 124.95, perks: ['FPS boost + input optimization', 'Network & OS tweaks', 'All future updates included', 'Instant email delivery'] },
        'zero-plus': { name: 'Zero Delay Plus', tag: 'Ultimate PC Latency & FPS Optimizer', price: 14.99, was: 74.95, perks: ['Advanced latency engine', 'FPS stabilizer included', 'One-time purchase', 'Instant email delivery'] },
        zero: { name: 'Zero Delay', tag: 'Quantum Delay Engine', price: 9.99, was: 49.95, perks: ['Eliminate input lag', '0ms target latency', '100% safe tweaks', 'Instant email delivery'] },
        fps: { name: 'FPS Boost', tag: 'Dynamic Frame Stabilizer', price: 9.99, was: 49.95, perks: ['Maximize frame rate', 'Endgame stability', 'Deep system optimization', 'Instant email delivery'] },
        ping: { name: 'Ping Optimizer', tag: 'Quantum Ping Optimizer', price: 9.99, was: 49.95, perks: ['Lower ping & jitter', 'Optimized routing', 'Smoother gameplay', 'Instant email delivery'] },
        controller: { name: 'Controller Macro', tag: 'V2 · Macro Pro', price: 19.99, was: 99.95, perks: ['Macro Pro — map buttons to keys', 'Fortnite presets + 3D holo', 'Timeline recorder & profiles', 'Instant email delivery'] },
        keyboard: { name: 'Keyboard Macro', tag: 'V2 · Macro Pro', price: 19.99, was: 99.95, perks: ['F-key & mouse macro mapping', 'Record, edit & export timelines', 'Live keyboard/mouse visualization', 'Instant email delivery'] },
        aim: { name: 'Aim Bundle', tag: 'Aim Assist Pro', price: 14.99, was: 74.95, perks: ['All-weapon Fortnite lock-on', 'Per-class strength & radius', 'Controller + keyboard toggle', 'Instant email delivery'] },
        shotgun: { name: 'Shotgun Pack', tag: 'Shotgun Aim Pro', price: 9.99, was: 49.95, perks: ['Shotgun-only Fortnite assist', 'Live lock-on radar preview', 'Controller button toggle bind', 'Instant email delivery'] },
        'blank-pass-full': { name: 'Blank Pass — Full Kit', tag: 'LIMITED · SEASON BUNDLE', price: 39.99, was: 74.96, perks: ['Blank Premium Utility', 'Zero Delay + FPS Boost', 'Mouse Latency Fix included', 'One purchase · total optimization'] },
        'blank-pass-monthly': { name: 'Blank Pass Monthly', tag: 'Subscription', price: 9.99, was: 29.99, monthly: true, perks: ['All core products included', 'Auto-updates every season', 'Cancel auto-renew anytime', 'Instant email delivery'] },
        'gift-card': { name: 'BlankDelay Gift Card', tag: 'Send credit to a friend', price: 50, was: 50, perks: ['Delivered via email', 'Redeemable on any product', 'Never expires', 'Perfect for gifting'] }
    },

    MONTH_MS: 30 * 24 * 60 * 60 * 1000,

    get(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
        catch { return fallback; }
    },
    set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },

    getSession() { return this.get('bd-session', null); },
    setSession(user) { this.set('bd-session', user); },
    logout() { localStorage.removeItem('bd-session'); },

    getUsers() { return this.get('bd-users', []); },
    saveUsers(users) { this.set('bd-users', users); },

    async hashPassword(password) {
        const data = new TextEncoder().encode(String(password || ''));
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
    },

    isAdminEmail(email) {
        return String(email || '').trim().toLowerCase() === this.ADMIN_EMAIL;
    },

    makeAffiliateCode() {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
        const users = this.getUsers();
        if (users.some((u) => u.code === code)) return this.makeAffiliateCode();
        return code;
    },

    affiliateShortLink(code) {
        const c = encodeURIComponent(String(code || '').trim());
        return `https://blankdelay.com/a/${c}`;
    },

    signup(email, password) {
        const clean = String(email || '').trim().toLowerCase();
        if (!clean || !password) return { ok: false, msg: 'Email and password required.' };
        if (this.isAdminEmail(clean)) return { ok: false, msg: 'That email is reserved. Use Log In for admin.' };
        const users = this.getUsers();
        if (users.find((u) => u.email.toLowerCase() === clean)) return { ok: false, msg: 'Email already registered.' };
        const code = this.makeAffiliateCode();
        const user = {
            email: clean,
            password,
            code,
            earnings: 0,
            sales: 0,
            paidOut: 0,
            created: Date.now()
        };
        users.push(user);
        this.saveUsers(users);
        this.setSession({ email: clean, code, role: 'affiliate' });
        return { ok: true, user };
    },

    async signupAndSync(email, password) {
        const local = this.signup(email, password);
        if (!local.ok) return local;
        try {
            const res = await fetch('/.netlify/functions/affiliate-api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'register',
                    email: local.user.email,
                    password,
                    code: local.user.code
                })
            });
            const data = await res.json();
            if (!data?.ok) {
                // roll back local if cloud rejected (e.g. already registered elsewhere)
                const users = this.getUsers().filter((u) => u.email !== local.user.email);
                this.saveUsers(users);
                this.logout();
                return { ok: false, msg: data?.msg || 'Could not save affiliate to live registry.' };
            }
            if (data.user?.code && data.user.code !== local.user.code) {
                const users = this.getUsers();
                const u = users.find((x) => x.email === local.user.email);
                if (u) {
                    u.code = data.user.code;
                    this.saveUsers(users);
                    this.setSession({ email: u.email, code: u.code, role: 'affiliate' });
                }
            }
            return { ok: true, user: this.getAffiliateUser(email), live: true, userCount: data.userCount };
        } catch (_) {
            // Still allow local account, but mark not live
            await this.syncAffiliateRemote('upsert', {
                user: this.publicAffiliate(local.user),
                password
            });
            return { ok: true, user: local.user, live: false, msg: 'Account created locally. Live sync pending — open dashboard again after deploy.' };
        }
    },

    async login(email, password) {
        const clean = String(email || '').trim().toLowerCase();
        if (this.isAdminEmail(clean)) {
            const hash = await this.hashPassword(password);
            if (hash !== this.ADMIN_PASS_HASH) return { ok: false, msg: 'Invalid email or password.' };
            this.setSession({ email: this.ADMIN_EMAIL, role: 'admin', code: 'ADMIN' });
            return { ok: true, user: { email: this.ADMIN_EMAIL, role: 'admin' }, admin: true };
        }

        // 1) Live cloud login (works across devices)
        try {
            const res = await fetch('/.netlify/functions/affiliate-api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'login', email: clean, password })
            });
            const data = await res.json();
            if (data?.ok && data.user) {
                const users = this.getUsers();
                const idx = users.findIndex((u) => u.email.toLowerCase() === clean);
                const row = {
                    email: clean,
                    password,
                    code: data.user.code,
                    earnings: data.user.earnings || 0,
                    sales: data.user.sales || 0,
                    paidOut: data.user.paidOut || 0,
                    created: data.user.created || Date.now(),
                    stripeAccountId: data.user.stripeAccountId || '',
                    payoutsEnabled: !!data.user.payoutsEnabled
                };
                if (idx >= 0) users[idx] = { ...users[idx], ...row };
                else users.push(row);
                this.saveUsers(users);
                this.setSession({ email: clean, code: row.code, role: 'affiliate' });
                return { ok: true, user: row, admin: false, live: true };
            }
        } catch (_) { /* fall through to local */ }

        // 2) Local fallback, then push to cloud
        const user = this.getUsers().find((u) => u.email.toLowerCase() === clean && u.password === password);
        if (!user) return { ok: false, msg: 'Invalid email or password.' };
        this.setSession({ email: user.email, code: user.code, role: 'affiliate' });
        await this.syncAffiliateRemote('upsert', { user: this.publicAffiliate(user), password });
        return { ok: true, user, admin: false, live: false };
    },

    isAdminSession() {
        const s = this.getSession();
        return !!(s && s.role === 'admin' && this.isAdminEmail(s.email));
    },

    publicAffiliate(u) {
        if (!u) return null;
        return {
            email: u.email,
            code: u.code,
            earnings: u.earnings || 0,
            sales: u.sales || 0,
            paidOut: u.paidOut || 0,
            created: u.created || 0,
            link: this.affiliateShortLink(u.code),
            stripeAccountId: u.stripeAccountId || '',
            payoutsEnabled: !!u.payoutsEnabled
        };
    },

    getAffiliateUser(email) {
        const clean = String(email || '').trim().toLowerCase();
        return this.getUsers().find((u) => u.email.toLowerCase() === clean);
    },

    listAffiliates() {
        return this.getUsers().map((u) => this.publicAffiliate(u));
    },

    creditAffiliate(code, amount, productName) {
        const users = this.getUsers();
        const u = users.find((x) => x.code === code);
        if (!u) return;
        const commission = +(amount * this.AFFILIATE_RATE).toFixed(2);
        u.earnings = +(u.earnings + commission).toFixed(2);
        u.sales += 1;
        this.saveUsers(users);
        const sales = this.get('bd-aff-sales', []);
        const row = {
            code,
            amount,
            commission,
            product: productName || 'BlankDelay Product',
            date: Date.now()
        };
        sales.push(row);
        this.set('bd-aff-sales', sales);
        this.syncAffiliateRemote('sale', { sale: row, user: this.publicAffiliate(u) });
    },

    trackAffiliateClick(code) {
        if (!code || code === 'ADMIN') return;
        const clicks = this.get('bd-aff-clicks', {});
        clicks[code] = (clicks[code] || 0) + 1;
        this.set('bd-aff-clicks', clicks);
        this.syncAffiliateRemote('click', { code });
    },

    getAffiliateClicks(code) {
        const clicks = this.get('bd-aff-clicks', {});
        return clicks[code] || 0;
    },

    getAffiliateSales(code) {
        return this.get('bd-aff-sales', []).filter((s) => s.code === code);
    },

    getCashouts() {
        return this.get('bd-aff-cashouts', []);
    },

    saveCashouts(list) {
        this.set('bd-aff-cashouts', list);
    },

    requestCashout(email, amount, method, payoutTo) {
        const user = this.getAffiliateUser(email);
        if (!user) return { ok: false, msg: 'Affiliate not found.' };
        const available = +Math.max(0, (user.earnings || 0) - (user.paidOut || 0)).toFixed(2);
        const amt = +Number(amount).toFixed(2);
        if (!(amt >= 5)) return { ok: false, msg: 'Minimum cashout is $5.00.' };
        if (amt > available) return { ok: false, msg: 'Amount exceeds available balance.' };
        if (!method || !payoutTo) return { ok: false, msg: 'Choose a cashout method and payout details.' };
        const pending = this.getCashouts().some((c) => c.email === user.email && c.status === 'pending');
        if (pending) return { ok: false, msg: 'You already have a pending cashout request.' };
        const row = {
            id: 'CO-' + Date.now().toString(36).toUpperCase(),
            email: user.email,
            code: user.code,
            amount: amt,
            method: String(method),
            payoutTo: String(payoutTo).trim(),
            status: 'pending',
            created: Date.now()
        };
        const list = this.getCashouts();
        list.push(row);
        this.saveCashouts(list);
        this.syncAffiliateRemote('cashout', { cashout: row });
        return { ok: true, cashout: row };
    },

    markCashoutPaid(cashoutId) {
        const list = this.getCashouts();
        const row = list.find((c) => c.id === cashoutId);
        if (!row || row.status === 'paid') return { ok: false, msg: 'Cashout not found.' };
        row.status = 'paid';
        row.paidAt = Date.now();
        this.saveCashouts(list);
        const users = this.getUsers();
        const u = users.find((x) => x.email === row.email);
        if (u) {
            u.paidOut = +((u.paidOut || 0) + row.amount).toFixed(2);
            this.saveUsers(users);
            this.syncAffiliateRemote('upsert', { user: this.publicAffiliate(u) });
        }
        this.syncAffiliateRemote('cashout-paid', { cashout: row });
        return { ok: true, cashout: row };
    },

    availableBalance(email) {
        const u = this.getAffiliateUser(email);
        if (!u) return 0;
        return +Math.max(0, (u.earnings || 0) - (u.paidOut || 0)).toFixed(2);
    },

    async syncAffiliateRemote(action, payload) {
        try {
            const res = await fetch('/.netlify/functions/affiliate-api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...payload })
            });
            const data = await res.json().catch(() => null);
            return data;
        } catch (_) {
            return { ok: false, msg: 'offline' };
        }
    },

    async pushAllLocalAffiliatesToLive() {
        const users = this.getUsers();
        let pushed = 0;
        for (const u of users) {
            if (!u?.email || !u?.code) continue;
            const data = await this.syncAffiliateRemote('upsert', {
                user: this.publicAffiliate(u),
                password: u.password || undefined
            });
            if (data?.ok) pushed += 1;
        }
        return pushed;
    },

    async pullRemoteAffiliates() {
        try {
            const res = await fetch('/.netlify/functions/affiliate-api?action=list&ts=' + Date.now(), {
                cache: 'no-store'
            });
            if (!res.ok) return { ok: false, msg: 'HTTP ' + res.status };
            const data = await res.json();
            if (!data || !data.ok) return { ok: false, msg: (data && (data.detail || data.msg)) || 'Bad registry response', detail: data && data.detail };

            // Always hydrate local cache from LIVE registry so admin sees everyone
            const byEmail = new Map(this.getUsers().map((u) => [u.email.toLowerCase(), u]));
            (data.users || []).forEach((remote) => {
                const key = String(remote.email || '').toLowerCase();
                if (!key || !remote.code) return;
                const existing = byEmail.get(key);
                if (existing) {
                    existing.code = remote.code || existing.code;
                    existing.earnings = Math.max(existing.earnings || 0, remote.earnings || 0);
                    existing.sales = Math.max(existing.sales || 0, remote.sales || 0);
                    existing.paidOut = Math.max(existing.paidOut || 0, remote.paidOut || 0);
                    existing.created = existing.created || remote.created || Date.now();
                    existing.lastSeen = remote.lastSeen || existing.lastSeen || 0;
                    if (remote.stripeAccountId) existing.stripeAccountId = remote.stripeAccountId;
                    if (remote.payoutsEnabled) existing.payoutsEnabled = true;
                } else {
                    byEmail.set(key, {
                        email: key,
                        password: '',
                        code: remote.code,
                        earnings: remote.earnings || 0,
                        sales: remote.sales || 0,
                        paidOut: remote.paidOut || 0,
                        created: remote.created || Date.now(),
                        lastSeen: remote.lastSeen || 0,
                        stripeAccountId: remote.stripeAccountId || '',
                        payoutsEnabled: !!remote.payoutsEnabled
                    });
                }
            });
            this.saveUsers([...byEmail.values()]);

            if (data.clicks && typeof data.clicks === 'object') {
                // Live clicks are source of truth (still take max to be safe)
                const clicks = this.get('bd-aff-clicks', {});
                Object.keys(data.clicks).forEach((code) => {
                    clicks[code] = Math.max(clicks[code] || 0, data.clicks[code] || 0);
                });
                // Also include any codes only on remote
                Object.assign(clicks, { ...clicks, ...Object.fromEntries(
                    Object.entries(data.clicks).map(([k, v]) => [k, Math.max(clicks[k] || 0, v || 0)])
                ) });
                this.set('bd-aff-clicks', clicks);
            }
            if (Array.isArray(data.cashouts)) {
                const local = this.getCashouts();
                const byId = new Map(local.map((c) => [c.id, c]));
                data.cashouts.forEach((c) => {
                    if (c && c.id) byId.set(c.id, { ...(byId.get(c.id) || {}), ...c });
                });
                this.saveCashouts([...byId.values()]);
            }
            if (Array.isArray(data.sales)) {
                const local = this.get('bd-aff-sales', []);
                const keys = new Set(local.map((s) => `${s.code}|${s.date}|${s.commission}|${s.sessionId || ''}`));
                data.sales.forEach((s) => {
                    const k = `${s.code}|${s.date}|${s.commission}|${s.sessionId || ''}`;
                    if (!keys.has(k)) local.push(s);
                });
                this.set('bd-aff-sales', local);
            }

            this.set('bd-aff-live-meta', {
                at: Date.now(),
                userCount: data.userCount || (data.users || []).length,
                live: true
            });
            return data;
        } catch (err) {
            return { ok: false, msg: err.message || 'offline' };
        }
    },

    getAdminAnalytics(remoteData) {
        // Prefer live remote users list when provided
        const clicksMap = { ...(this.get('bd-aff-clicks', {}) || {}), ...((remoteData && remoteData.clicks) || {}) };
        const remoteUsers = Array.isArray(remoteData?.users) ? remoteData.users : null;
        const affiliates = (remoteUsers || this.listAffiliates()).map((a) => {
            const row = remoteUsers ? { ...a, link: a.link || this.affiliateShortLink(a.code) } : a;
            return {
                ...row,
                clicks: clicksMap[row.code] || 0,
                available: +Math.max(0, (row.earnings || 0) - (row.paidOut || 0)).toFixed(2)
            };
        });
        const sales = Array.isArray(remoteData?.sales) && remoteData.sales.length
            ? remoteData.sales
            : this.get('bd-aff-sales', []);
        const cashouts = Array.isArray(remoteData?.cashouts) && remoteData.cashouts.length
            ? remoteData.cashouts
            : this.getCashouts();

        let totalClicks = 0;
        let totalCommission = 0;
        let totalSalesAmount = 0;
        affiliates.forEach((a) => {
            totalClicks += a.clicks || 0;
            totalCommission += a.earnings || 0;
        });
        sales.forEach((s) => {
            totalSalesAmount += s.amount || 0;
        });
        const pendingCashouts = cashouts.filter((c) => c.status === 'pending');
        const paidCashouts = cashouts.filter((c) => c.status === 'paid');
        const pendingAmount = pendingCashouts.reduce((n, c) => n + (c.amount || 0), 0);
        const paidAmount = paidCashouts.reduce((n, c) => n + (c.amount || 0), 0);
        return {
            live: !!(remoteData && remoteData.ok),
            affiliateCount: affiliates.length,
            totalClicks,
            totalSales: sales.length,
            totalSalesAmount: +totalSalesAmount.toFixed(2),
            affiliateShare: +totalCommission.toFixed(2),
            ownerShare: +(totalSalesAmount * this.OWNER_RATE).toFixed(2),
            commissionRate: this.AFFILIATE_RATE,
            ownerRate: this.OWNER_RATE,
            pendingCashouts,
            paidCashouts,
            pendingAmount: +pendingAmount.toFixed(2),
            paidAmount: +paidAmount.toFixed(2),
            affiliates: affiliates.sort((a, b) => String(a.email).localeCompare(String(b.email)))
        };
    },

    getReferrals() { return this.get('bd-referrals', []); },

    createReferral(referrerEmail, friendEmail) {
        const refs = this.getReferrals();
        const code = 'REF-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        refs.push({ referrerEmail, friendEmail, code, credited: false, redeemed: false, date: Date.now() });
        this.set('bd-referrals', refs);
        return code;
    },

    processReferralOnPurchase(buyerEmail, refCode, orderTotal) {
        const refs = this.getReferrals();
        const ref = refs.find(r => r.code === refCode && !r.credited);
        if (!ref) return;
        if (ref.friendEmail.toLowerCase() !== buyerEmail.toLowerCase()) return;
        ref.credited = true;
        ref.orderTotal = orderTotal;
        const credits = this.get('bd-refer-credits', {});
        credits[ref.referrerEmail] = (credits[ref.referrerEmail] || 0) + this.REFER_BONUS;
        this.set('bd-referrals', refs);
        this.set('bd-refer-credits', credits);
    },

    getReferCredits(email) {
        const credits = this.get('bd-refer-credits', {});
        return credits[email] || 0;
    },

    redeemReferCredit(email, amount) {
        const credits = this.get('bd-refer-credits', {});
        const bal = credits[email] || 0;
        if (bal < amount) return false;
        credits[email] = +(bal - amount).toFixed(2);
        this.set('bd-refer-credits', credits);
        const redemptions = this.get('bd-refer-redemptions', []);
        redemptions.push({ email, amount, date: Date.now() });
        this.set('bd-refer-redemptions', redemptions);
        return true;
    },

    getActiveDiscount() {
        return localStorage.getItem('bd-discount-code') || '';
    },
    setActiveDiscount(code) {
        if (code) localStorage.setItem('bd-discount-code', code.toUpperCase());
        else localStorage.removeItem('bd-discount-code');
    },
    getDiscountPercent(code) {
        return this.DISCOUNTS[(code || '').toUpperCase()] || 0;
    },
    applyDiscountPrice(price, code) {
        const pct = this.getDiscountPercent(code);
        if (!pct) return { final: price, discount: 0, percent: 0, code: '' };
        const discount = +(price * pct).toFixed(2);
        return { final: +(price - discount).toFixed(2), discount, percent: pct * 100, code: code.toUpperCase() };
    },

    getCart() { return this.get('bd-cart', []); },

    sanitizeCart() {
        const raw = this.getCart();
        if (!Array.isArray(raw)) {
            this.set('bd-cart', []);
            return [];
        }
        const cart = raw
            .filter(i => i && i.slug && this.CATALOG[i.slug] && !this.CATALOG[i.slug].free)
            .map(i => ({ slug: i.slug, qty: Math.max(1, parseInt(i.qty, 10) || 1), added: i.added || Date.now() }));
        if (cart.length !== raw.length) this.set('bd-cart', cart);
        return cart;
    },

    addToCart(slug, qty = 1) {
        const product = this.CATALOG[slug];
        if (!product || product.free) return { ok: false, msg: 'Product not available.' };
        const cart = this.getCart();
        const existing = cart.find(i => i.slug === slug);
        if (existing) existing.qty += qty;
        else cart.push({ slug, qty, added: Date.now() });
        this.set('bd-cart', cart);
        return { ok: true, cart };
    },

    removeFromCart(slug) {
        const cart = this.getCart().filter(i => i.slug !== slug);
        this.set('bd-cart', cart);
        return cart;
    },

    updateCartQty(slug, qty) {
        const cart = this.getCart();
        const item = cart.find(i => i.slug === slug);
        if (!item) return cart;
        if (qty < 1) return this.removeFromCart(slug);
        item.qty = qty;
        this.set('bd-cart', cart);
        return cart;
    },

    clearCart() { localStorage.removeItem('bd-cart'); },

    getCartCount() {
        return this.sanitizeCart().reduce((n, i) => n + i.qty, 0);
    },

    getCartProductCount() {
        return this.sanitizeCart().length;
    },

    getCartSubtotal() {
        return this.sanitizeCart().reduce((sum, i) => {
            const p = this.CATALOG[i.slug];
            return sum + (p ? p.price * i.qty : 0);
        }, 0);
    },

    getCartItems() {
        return this.sanitizeCart().map(i => {
            const p = this.CATALOG[i.slug];
            if (!p) return null;
            return { slug: i.slug, qty: i.qty, name: p.name, tag: p.tag, price: p.price, was: p.was, monthly: !!p.monthly };
        }).filter(Boolean);
    },

    getPassSubs() { return this.get('bd-pass-subs', {}); },
    savePassSubs(subs) { this.set('bd-pass-subs', subs); },

    processPassSubscriptions() {
        const subs = this.getPassSubs();
        let changed = false;
        const renewals = this.get('bd-pass-renewals', []);
        Object.keys(subs).forEach(email => {
            const sub = subs[email];
            if (!sub) return;
            if (Date.now() >= sub.expiresAt) {
                if (sub.autoRenew) {
                    sub.expiresAt = Date.now() + this.MONTH_MS;
                    sub.lastRenewed = Date.now();
                    sub.active = true;
                    renewals.push({ email, date: Date.now(), amount: 9.99, type: 'auto' });
                    changed = true;
                } else {
                    sub.active = false;
                    changed = true;
                }
            }
        });
        if (changed) this.savePassSubs(subs);
        if (renewals.length) this.set('bd-pass-renewals', renewals);
        return subs;
    },

    getPassSubscription(email) {
        if (!email) return null;
        this.processPassSubscriptions();
        const subs = this.getPassSubs();
        return subs[email.toLowerCase()] || null;
    },

    isPassActive(email) {
        const sub = this.getPassSubscription(email);
        return !!(sub && sub.active && Date.now() < sub.expiresAt);
    },

    createPassSubscription(email, autoRenew) {
        const key = email.toLowerCase();
        const subs = this.getPassSubs();
        const existing = subs[key];
        const now = Date.now();
        subs[key] = {
            email: key,
            plan: 'blank-pass-monthly',
            autoRenew: !!autoRenew,
            startedAt: existing?.startedAt || now,
            expiresAt: now + this.MONTH_MS,
            lastRenewed: now,
            active: true
        };
        this.savePassSubs(subs);
        localStorage.setItem('bd-pass-email', key);
        return subs[key];
    },

    renewPassManual(email) {
        const key = email.toLowerCase();
        const subs = this.getPassSubs();
        const sub = subs[key];
        if (!sub) return null;
        const now = Date.now();
        sub.expiresAt = Math.max(sub.expiresAt, now) + this.MONTH_MS;
        sub.lastRenewed = now;
        sub.active = true;
        this.savePassSubs(subs);
        return sub;
    },

    setPassAutoRenew(email, autoRenew) {
        const key = email.toLowerCase();
        const subs = this.getPassSubs();
        if (!subs[key]) return false;
        subs[key].autoRenew = !!autoRenew;
        this.savePassSubs(subs);
        return true;
    },

    formatPassExpiry(ts) {
        return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    },

    getPassDaysLeft(email) {
        const sub = this.getPassSubscription(email);
        if (!sub || !sub.active) return 0;
        return Math.max(0, Math.ceil((sub.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
    }
};
