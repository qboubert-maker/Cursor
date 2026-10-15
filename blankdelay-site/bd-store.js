/* BlankDelay client-side store (demo — connect Stripe for real payments) */
const BD_STORE = {
    DISCOUNTS: { BLANK15: 0.15, BLANK10: 0.10, CREATOR20: 0.20 },
    AFFILIATE_RATE: 0.20,
    REFER_BONUS: 5,

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

    signup(email, password) {
        const users = this.getUsers();
        if (users.find(u => u.email === email)) return { ok: false, msg: 'Email already registered.' };
        const code = 'AFF-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const user = { email, password, code, earnings: 0, sales: 0, created: Date.now() };
        users.push(user);
        this.saveUsers(users);
        this.setSession({ email, code });
        return { ok: true, user };
    },

    login(email, password) {
        const user = this.getUsers().find(u => u.email === email && u.password === password);
        if (!user) return { ok: false, msg: 'Invalid email or password.' };
        this.setSession({ email: user.email, code: user.code });
        return { ok: true, user };
    },

    getAffiliateUser(email) {
        return this.getUsers().find(u => u.email === email);
    },

    creditAffiliate(code, amount, productName) {
        const users = this.getUsers();
        const u = users.find(x => x.code === code);
        if (!u) return;
        const commission = +(amount * this.AFFILIATE_RATE).toFixed(2);
        u.earnings = +(u.earnings + commission).toFixed(2);
        u.sales += 1;
        this.saveUsers(users);
        const sales = this.get('bd-aff-sales', []);
        sales.push({ code, amount, commission, product: productName || 'BlankDelay Product', date: Date.now() });
        this.set('bd-aff-sales', sales);
    },

    trackAffiliateClick(code) {
        if (!code) return;
        const clicks = this.get('bd-aff-clicks', {});
        clicks[code] = (clicks[code] || 0) + 1;
        this.set('bd-aff-clicks', clicks);
    },

    getAffiliateClicks(code) {
        const clicks = this.get('bd-aff-clicks', {});
        return clicks[code] || 0;
    },

    getAffiliateSales(code) {
        return this.get('bd-aff-sales', []).filter(s => s.code === code);
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
