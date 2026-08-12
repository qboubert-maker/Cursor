(function () {
    function productList() {
        if (typeof BD_STORE === 'undefined' || !BD_STORE.CATALOG) return '';
        return Object.entries(BD_STORE.CATALOG)
            .filter(([slug]) => !slug.startsWith('blank-pass') && slug !== 'gift-card')
            .map(([slug, p]) =>
                `• <strong>${p.name}</strong> — $${p.price.toFixed(2)}${p.monthly ? '/mo' : ''} <span class="mono">(${p.tag})</span>`
            ).join('<br>');
    }

    const TOPICS = [
        {
            id: 'brand',
            keys: ['blankdelay', 'blank delay', 'what is', 'who are', 'about', 'brand', 'slogan', 'mean', 'company', 'elevate', 'performance'],
            answer: 'BlankDelay is a competitive gaming optimization brand. Tagline: <strong>"Delay? We Left That BLANK."</strong> Subline: <strong>elevate your game performance now</strong>. We sell safe Windows PC tools — system tweaks, macros, and Fortnite-ready aim modules. No cheats, no game injection.'
        },
        {
            id: 'nav-home',
            keys: ['home', 'hero', 'main page', 'start', 'where start', 'landing'],
            answer: 'The <strong>Home</strong> section shows our hero, live stats, and quick links. Click <strong>Buy Products Now</strong> for Products, or <strong>Find Your Setup</strong> for the platform quiz.'
        },
        {
            id: 'nav-products',
            keys: ['products', 'product tab', 'buy', 'shop', 'catalog', 'lineup', 'choose your edge', 'get now', 'all products'],
            answer: 'Go to <strong>Products</strong> in the nav. Nine core products in 3 categories:<br><br><strong>System Tweaks:</strong> Blank Premium ($29.99), Zero Delay Plus ($14.99), Zero Delay ($9.99), FPS Boost ($9.99), Ping Optimizer ($9.99)<br><strong>Macro Pro:</strong> Controller Macro V2 ($19.99), Keyboard Macro V2 ($19.99)<br><strong>Fortnite Aim:</strong> Aim Bundle ($14.99), Shotgun Pack ($9.99)<br><br>Click <strong>Get Now</strong> → <strong>Buy Now</strong> or <strong>Add to Cart</strong>.'
        },
        {
            id: 'nav-compatibility',
            keys: ['compatibility', 'games', 'fortnite', 'valorant', 'supported', 'platform', 'console', 'xbox', 'playstation', 'orbit', 'warzone', 'apex'],
            answer: 'The <strong>Compatibility</strong> tab shows 1000+ supported games and every platform. All PC products require <strong>Windows 10/11 64-bit</strong>. Macro Pro and Aim modules are built for <strong>Fortnite</strong> and work in any game via OS-level input. Hover game logos in the orbit to explore.'
        },
        {
            id: 'nav-reviews',
            keys: ['reviews', 'testimonial', 'rating', 'feedback', 'players say'],
            answer: 'The <strong>Reviews</strong> section has player testimonials about FPS gains, lower latency, and better gameplay. Scroll to Reviews in the nav.'
        },
        {
            id: 'nav-about',
            keys: ['about', 'founded', 'blank', 'story', 'mission', 'who made'],
            answer: 'The <strong>About</strong> section explains BlankDelay was built for competitive players tired of input lag and gatekept configs. Lab-tested optimization — not placebo tweaks.'
        },
        {
            id: 'nav-specials',
            keys: ['specials', 'deals', 'bundle', 'pass', 'refer', 'affiliate', 'gift', 'extras'],
            answer: 'The <strong>Specials</strong> tab has:<br>• <strong>Blank Pass Full Kit</strong> ($39.99) — season bundle<br>• <strong>Blank Pass Monthly</strong> ($9.99/mo) — all core products<br>• <strong>Refer a Friend</strong> — $5 credit<br>• <strong>Creator Affiliate</strong> — 20% commission<br>• <strong>Gift Cards</strong> ($10/$25/$50)'
        },
        {
            id: 'nav-faq',
            keys: ['faq', 'questions', 'help', 'support', 'ai support', 'this chat', 'chatbot'],
            answer: 'You\'re in <strong>FAQ & AI Support</strong>. Accordion FAQs on the left, this AI chat on the right. Ask about any product, Macro Pro, Aim Assist, cart, checkout, license keys, Fortnite setup, or site features.'
        },
        {
            id: 'nav-support',
            keys: ['tools', 'scanner', 'latency scan', 'fps estimator', 'calculator', 'preview', 'benchmark', 'float support', 'support button'],
            answer: 'Click the floating <strong>Support</strong> button (bottom-right) or go to <strong>FAQ</strong>. BlankDelay AI Support answers product, cart, checkout, license, Macro Pro, and Aim Assist questions instantly.'
        },
        {
            id: 'premium',
            keys: ['premium', 'blank premium', 'utility', 'all in one', 'v4', 'best', 'recommended', 'most popular'],
            answer: '<strong>Blank Premium Utility</strong> ($29.99, was $124.95) — V4 ALL IN ONE. FPS boost, input optimization, network tweaks, GPU scheduling, and every system tweak combined. Best value for everything in one purchase.'
        },
        {
            id: 'zero-plus',
            keys: ['zero delay plus', 'zero plus', 'zplus', 'latency fps'],
            answer: '<strong>Zero Delay Plus</strong> ($14.99) — Ultimate PC Latency & FPS Optimizer. Everything in Zero Delay plus advanced FPS optimizations and deep latency fixes.'
        },
        {
            id: 'zero',
            keys: ['zero delay', 'quantum', 'input lag', 'delay engine', '0ms', 'latency'],
            answer: '<strong>Zero Delay</strong> ($9.99) — Quantum Delay Engine. Eliminates input lag via Nagle\'s off, timer resolution, mouse/keyboard queue optimization, and game priority tweaks.'
        },
        {
            id: 'fps',
            keys: ['fps boost', 'fps', 'frame', 'frames', 'framerate', 'stutter'],
            answer: '<strong>FPS Boost</strong> ($9.99) — Dynamic Frame Stabilizer. Disables Game DVR, enables Game Mode & GPU scheduling, optimizes CPU priority for max frame rate.'
        },
        {
            id: 'ping',
            keys: ['ping', 'network', 'jitter', 'dns', 'lag online', 'connection'],
            answer: '<strong>Ping Optimizer</strong> ($9.99) — Lowers ping & jitter. Cloudflare DNS, Nagle\'s off, TCP tuning, and adapter power-saving fixes.'
        },
        {
            id: 'controller',
            keys: ['controller macro', 'controller', 'gamepad', 'xbox controller', 'ps controller', 'rapid fire', 'macro pro controller', 'antimicro', 'gamepad map', 'fortnite controller'],
            answer: '<strong>Controller Macro V2</strong> ($19.99) — <strong>Macro Pro</strong> edition:<br>• Map every controller button → keyboard/mouse output<br>• Fortnite preset (wall/floor/ramp/edit/scroll reset)<br>• Record + timeline editor, profile save/load<br>• 3D reactive controller visualization<br>• Per-game profiles (Fortnite exe detection)<br>• F12 panic stop · OS-level input<br><br>Download <strong>BlankDelay-Setup.exe</strong>, open Controller Macro, enter license key.'
        },
        {
            id: 'keyboard',
            keys: ['keyboard macro', 'keyboard', 'keybind', 'edit macro', 'build macro', 'scroll reset', 'macro pro keyboard', 'f key', 'mouse macro'],
            answer: '<strong>Keyboard Macro V2</strong> ($19.99) — <strong>Macro Pro</strong> edition:<br>• F1–F12 hotkey + mouse button mapping<br>• Keyboard & Mouse tabs with Fortnite presets<br>• Timeline recorder, import/export profiles<br>• Live 3D keyboard/mouse holo visualization<br>• Caps Lock modifier layer + text expansion<br>• F12 panic stop · works in Fortnite & any game'
        },
        {
            id: 'macro-pro',
            keys: ['macro pro', 'timeline', 'record macro', 'profile', 'import export', 'fortnite preset', 'panic', 'f12', 'holo', 'reactive', '3d visualization'],
            answer: '<strong>Macro Pro</strong> (Controller + Keyboard apps) includes:<br>• <strong>Map</strong> — button/key → output sequences<br>• <strong>Record</strong> — timeline editor with delays<br>• <strong>Library</strong> — save/load/export JSON profiles<br>• <strong>Settings</strong> — delay, jitter, loop count, game profile<br>• Fortnite preset loads Q+C+E, edit chains, scroll reset<br>• F12 instantly stops all macros'
        },
        {
            id: 'aim',
            keys: ['aim bundle', 'aim assist', 'lock on', 'fortnite aim', 'weapon class', 'ar smg sniper', 'aim pro', 'radar'],
            answer: '<strong>Aim Bundle</strong> ($14.99) — <strong>Aim Assist Pro</strong> for Fortnite:<br>• Universal lock-on for AR, SMG, Shotgun, Sniper, Pistol, Melee<br>• Per-weapon-class strength + target radius<br>• Fortnite HUD weapon detection (pixel sampling)<br>• Keyboard <strong>and controller</strong> toggle binding<br>• Live lock-on radar preview · profile library<br>• Only runs when Fortnite is focused · F12 panic stop'
        },
        {
            id: 'shotgun',
            keys: ['shotgun', 'shotgun pack', 'close range', 'box fight', 'flick', 'one pump', 'pump tactical combat'],
            answer: '<strong>Shotgun Pack</strong> ($9.99) — Shotgun-only <strong>Aim Assist Pro</strong>:<br>• Activates only when holding a shotgun in Fortnite<br>• Pump, Tactical, Combat, Charge, Drum, Auto, Heavy selection<br>• Lock-on strength + target radius with live radar<br>• Controller button toggle (LB default) + keyboard toggle<br>• Force Shotgun mode if auto-detect is unsure'
        },
        {
            id: 'fortnite',
            keys: ['fortnite', 'fortniteclient', 'battle royale', 'build', 'edit', 'piece control', 'creative'],
            answer: '<strong>Fortnite compatibility:</strong><br>• Macro Pro: OS-level key input — map controller to Q/C/E/G combos, scroll reset, edit macros<br>• Aim Bundle / Shotgun Pack: detect <strong>FortniteClient-Win64-Shipping.exe</strong>, HUD weapon sampling, shows OPEN when Fortnite is running<br>• System tweaks (Zero Delay, FPS, Ping) work in all Fortnite modes<br>• 100% safe — no injection, no memory editing'
        },
        {
            id: 'desktop-hub',
            keys: ['desktop app', 'download', 'setup exe', 'installer', 'hub', 'blankdelay-setup', 'electron', 'open app', 'all products app'],
            answer: 'All products download via one hub: <strong>BlankDelay-Setup.exe</strong> from your thank-you page or email. Open the app → pick your product (Premium, Macros, Aim, etc.) → enter license key <strong>BD-XXXX-XXXX-XXXX</strong> format. One installer contains all 9 products.'
        },
        {
            id: 'license',
            keys: ['license key', 'key format', 'activate', 'bd-', 'invalid key', 'enter key'],
            answer: 'License keys look like <strong>BD-XXXX-XXXX-XXXX</strong> (letters & numbers). Enter in the desktop app license portal after download. One key per product purchased. Cart checkout gives one key per item on the thank-you page.'
        },
        {
            id: 'blank-pass',
            keys: ['blank pass', 'pass full', 'pass monthly', 'subscription', 'season bundle', 'auto renew', 'resubscribe', 'monthly pass'],
            answer: '<strong>Blank Pass Full Kit</strong> ($39.99) — Premium + Zero Delay + FPS Boost bundle.<br><br><strong>Blank Pass Monthly</strong> ($9.99/mo) — all core products. Choose auto-renew or one month only at checkout.'
        },
        {
            id: 'gift',
            keys: ['gift card', 'gift', 'present', 'credit'],
            answer: '<strong>Gift Cards</strong> in Specials — $10, $25, or $50. Email delivery, redeemable on any product, never expires.'
        },
        {
            id: 'refer',
            keys: ['refer', 'referral', 'friend', 'invite', '$5', 'redeem'],
            answer: '<strong>Refer a Friend</strong>: Share your link from Specials. When a friend buys, you earn <strong>$5 credit</strong>.'
        },
        {
            id: 'affiliate',
            keys: ['affiliate', 'creator program', 'commission', '20%', 'partner', 'earn money', 'tiktok', 'linktree'],
            answer: '<strong>Creator Affiliate Program</strong> (Specials): 20% commission per sale. If TikTok blocks in-app links, tell viewers to tap <strong>Open in browser</strong> or paste <strong>blankdelay.com</strong> directly.'
        },
        {
            id: 'cart',
            keys: ['cart', 'add to cart', 'shopping cart', 'bag', 'multiple products'],
            answer: '<strong>Cart workflow:</strong><br>1. <strong>Get Now</strong> on any product<br>2. <strong>Add to Cart</strong> or <strong>Buy Now</strong><br>3. Open cart icon in nav<br>4. Adjust quantity, review total<br>5. <strong>Checkout</strong> — one key per product on thank-you page'
        },
        {
            id: 'checkout',
            keys: ['checkout', 'pay', 'purchase', 'buy now', 'order', 'complete purchase', 'card', 'stripe'],
            answer: 'At checkout: enter email, name, card details. Apply promo (<strong>BLANK15</strong> = 15% off). Complete Purchase → thank-you page shows license key + email within 1–2 minutes.'
        },
        {
            id: 'delivery',
            keys: ['deliver', 'delivery', 'email', 'license', 'key', 'download', 'receive', 'after buy', 'thank you'],
            answer: 'After purchase you land on the <strong>thank-you page</strong> with your license key and download button right on screen — copy the key, download the app, paste it in. A backup copy is also emailed within 1–2 minutes.'
        },
        {
            id: 'promo',
            keys: ['promo', 'discount', 'blank15', 'blank10', 'creator20', 'code', 'coupon', '15%', '10%', '20%', 'exit popup'],
            answer: 'Valid promo codes:<br>• <strong>BLANK15</strong> — 15% off<br>• <strong>BLANK10</strong> — 10% off<br>• <strong>CREATOR20</strong> — 20% off<br>Enter at checkout or claim BLANK15 from the exit popup.'
        },
        {
            id: 'install',
            keys: ['install', 'setup', 'how to use', 'activate', 'desktop app', 'electron', 'open app', 'apply tweaks', 'first time'],
            answer: '<strong>Setup steps:</strong><br>1. Download <strong>BlankDelay-Setup.exe</strong> from email/thank-you<br>2. Run installer → open product from hub<br>3. Enter license key → Activate<br>4. <strong>System products:</strong> toggle tweaks → Apply All (admin may be required)<br>5. <strong>Macro Pro / Aim:</strong> load Fortnite preset → Arm → play<br>6. <strong>Restore Defaults</strong> undoes system tweaks'
        },
        {
            id: 'virus-warning',
            keys: ['virus', 'malware', 'unsafe', 'smartscreen', 'windows protected', 'blocked', 'defender', 'false positive', 'not a virus', 'download blocked', 'run anyway', 'more info'],
            answer: '<strong>This is NOT a virus</strong> — it is a false positive because BlankDelay is a new publisher and the app is not code-signed yet.<br><br><strong>If Windows says "Windows protected your PC":</strong><br>1. Click <strong>More info</strong><br>2. Click <strong>Run anyway</strong><br><br><strong>If your browser blocks the download:</strong> Click <strong>Keep</strong> or <strong>Download anyway</strong><br><br><strong>If Windows Defender blocks it:</strong> Windows Security → Protection history → <strong>Allow</strong> on the file<br><br>BlankDelay does not inject into games or steal data. 14-day money-back guarantee.'
        },
        {
            id: 'safe',
            keys: ['safe', 'ban', 'banned', 'cheat', 'inject', 'vac', 'anti cheat', 'tos', 'fortnite ban', 'epic'],
            answer: 'BlankDelay is <strong>safe for competitive play</strong>. System tweaks = registry & Windows config only. Macros use OS-level keyboard/mouse input — no game memory access. Aim modules use external HUD detection — no injection. Fully reversible. You will NOT get banned for system tweaks; use macros/aim at your own discretion in tournaments.'
        },
        {
            id: 'refund',
            keys: ['refund', 'money back', 'return', 'cancel order', 'guarantee'],
            answer: '<strong>14-day money-back guarantee</strong> on all paid products. Contact support via FAQ chat or email within 14 days.'
        },
        {
            id: 'requirements',
            keys: ['requirement', 'windows', 'win 10', 'win 11', 'pc spec', 'ram', 'admin', 'system req'],
            answer: 'Requirements: <strong>Windows 10/11 64-bit</strong>, admin rights for system tweaks, 8GB+ RAM recommended. Internet for license activation. Controller macros need USB/Bluetooth gamepad connected.'
        },
        {
            id: 'theme',
            keys: ['dark mode', 'light mode', 'theme', 'toggle theme', 'moon', 'sun'],
            answer: 'Click the <strong>☾/☀ icon</strong> in the top nav to switch dark/light mode. Preference saves automatically.'
        },
        {
            id: 'discord',
            keys: ['discord', 'join discord', 'community', 'live support', 'human support', 'contact', 'email'],
            answer: 'For instant help use this <strong>AI Support chat</strong> or the floating Support button. FAQ section covers products, setup, and troubleshooting. Purchase support: check thank-you page and email delivery first.'
        },
        {
            id: 'compare',
            keys: ['difference', 'compare', 'which one', 'which product', 'best for', 'should i buy', 'recommend', 'worth it', 'vs'],
            answer: '<strong>Quick picker:</strong><br>• <strong>Everything</strong> → Blank Premium ($29.99)<br>• <strong>Input lag</strong> → Zero Delay ($9.99)<br>• <strong>Lag + FPS</strong> → Zero Delay Plus ($14.99)<br>• <strong>Max FPS</strong> → FPS Boost ($9.99)<br>• <strong>Lower ping</strong> → Ping Optimizer ($9.99)<br>• <strong>Controller player</strong> → Controller Macro Pro ($19.99)<br>• <strong>Keyboard player</strong> → Keyboard Macro Pro ($19.99)<br>• <strong>All-weapon Fortnite aim</strong> → Aim Bundle ($14.99)<br>• <strong>Shotgun only</strong> → Shotgun Pack ($9.99)<br>• <strong>Budget bundle</strong> → Blank Pass Full Kit ($39.99)'
        },
        {
            id: 'quiz',
            keys: ['quiz', 'find setup', 'what platform', 'what do i play', 'platform finder'],
            answer: 'The <strong>Platform Finder quiz</strong> is on the home page ("Find Your Setup"). Pick your platform and we recommend the best product.'
        },
        {
            id: 'price',
            keys: ['price', 'cost', 'how much', 'expensive', 'cheap', 'afford'],
            answer: 'Current prices:<br>' + (productList() || 'See Products tab.') + '<br><br>One-time purchase except Blank Pass Monthly ($9.99/mo).'
        },
        {
            id: 'which-best',
            keys: ['starter', 'beginner', 'first product', 'new here', 'start here'],
            answer: 'New here? Try <strong>Zero Delay</strong> ($9.99) for input lag, or <strong>Blank Premium</strong> ($29.99) for the full suite. Fortnite players: add <strong>Controller Macro</strong> or <strong>Keyboard Macro</strong>. Use the Latency Scanner in Tools first.'
        },
        {
            id: 'controller-toggle',
            keys: ['controller toggle', 'lb', 'button bind', 'gamepad toggle', 'pad button', 'which button controller'],
            answer: 'In <strong>Aim Bundle</strong> and <strong>Shotgun Pack</strong>: go to Control tab → <strong>Controller Toggle</strong> → pick a button (default <strong>LB</strong>) or click and press any pad button. Press that button in-game to toggle assist on/off. Keyboard toggle defaults to <strong>F9</strong>.'
        },
        {
            id: 'tiktok',
            keys: ['tiktok', 'linktree', 'open in browser', 'link not working', 'social', 'bio link'],
            answer: 'If TikTok says <strong>"open in browser"</strong> when tapping our link — that\'s normal. TikTok blocks many shop/software links in-app. Tap <strong>Open in browser</strong> or paste <strong>https://blankdelay.com</strong> in Chrome/Safari. The site works perfectly in a real browser.'
        },
        {
            id: 'patch',
            keys: ['update', 'patch', 'new version', 'latest', 'v2', 'macro pro update', 'aim pro'],
            answer: 'Latest updates include <strong>Macro Pro</strong> (Controller + Keyboard) with timeline editor, 3D holo, Fortnite presets, and <strong>Aim Assist Pro</strong> (Aim Bundle + Shotgun Pack) with lock-on radar, controller toggle, and Fortnite detection. Re-download <strong>BlankDelay-Setup.exe</strong> from your email for the newest version.'
        }
    ];

    const SYNONYMS = {
        buy: ['purchase', 'order', 'get', 'checkout', 'pay'],
        product: ['products', 'pack', 'tool', 'utility', 'macro', 'bundle', 'app'],
        lag: ['delay', 'latency', 'input', 'ms', 'responsiveness'],
        help: ['support', 'assist', 'question', 'how'],
        work: ['works', 'working', 'function', 'do', 'compatible'],
        fortnite: ['fn', 'battle royale', 'epic', 'fortniteclient'],
        controller: ['gamepad', 'pad', 'xbox', 'playstation', 'ps5', 'xbox'],
        aim: ['aimbot', 'lock', 'lockon', 'lock-on', 'assist', 'tracking'],
        macro: ['macros', 'bind', 'mapping', 'sequence', 'combo'],
        download: ['install', 'setup', 'exe', 'installer', 'deliver']
    };

    const SUGGESTIONS = [
        'Windows says virus when I download — what do I do?',
        'How do Aim Bundle and Shotgun Pack work?',
        'How do I download and activate my license?',
        'Is it safe for Fortnite?',
        'What\'s the difference between Premium and Zero Delay?',
        'How does the cart and checkout work?'
    ];

    const chat = document.getElementById('help-chat');
    const input = document.getElementById('help-input');
    const sendBtn = document.getElementById('help-send');
    const chips = document.getElementById('help-chips');
    if (!chat || !input) return;

    function tokenize(text) {
        return text.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 1);
    }

    function expandTokens(tokens) {
        const set = new Set(tokens);
        tokens.forEach(t => {
            Object.entries(SYNONYMS).forEach(([base, syns]) => {
                if (t === base || syns.includes(t)) {
                    set.add(base);
                    syns.forEach(s => set.add(s));
                }
            });
        });
        return set;
    }

    function scoreTopic(topic, query) {
        const lower = query.toLowerCase();
        const qTokens = expandTokens(tokenize(query));
        let score = 0;

        topic.keys.forEach(key => {
            const keyLower = key.toLowerCase();
            if (lower.includes(keyLower)) score += keyLower.split(' ').length * 4;
            tokenize(key).forEach(kt => {
                if (qTokens.has(kt)) score += 3;
            });
        });

        if (topic.id && lower.replace(/-/g, ' ').includes(topic.id.replace(/-/g, ' '))) score += 5;
        return score;
    }

    function findAnswer(q) {
        const lower = q.toLowerCase().trim();
        if (!lower) return 'Type a question — I know every product, price, and setup step on this site.';

        if (/^(hi|hey|hello|yo|sup|what'?s up)\b/.test(lower)) {
            return 'Hey! I\'m <strong>BlankDelay AI Support</strong> — updated for Macro Pro, Aim Assist Pro, Fortnite, cart, checkout, and all 9 products. What do you need?';
        }
        if (/thank/.test(lower)) {
            return 'You\'re welcome! Good luck in your games — delay? We left that blank. Ask anytime.';
        }

        let best = null, bestScore = 0;
        const ranked = [];
        TOPICS.forEach(topic => {
            const s = scoreTopic(topic, q);
            if (s > 0) ranked.push({ topic, s });
            if (s > bestScore) { bestScore = s; best = topic; }
        });

        if (best && bestScore >= 3) return best.answer;

        if (best && bestScore >= 2 && ranked.length === 1) return best.answer;

        if (/product|sell|offer|have|list|all|lineup|everything/.test(lower)) {
            return 'Full lineup:<br><br>' + (productList() || TOPICS.find(t => t.id === 'nav-products').answer);
        }

        if (ranked.length >= 2 && bestScore >= 2) {
            const second = ranked.sort((a, b) => b.s - a.s)[1];
            if (second && bestScore - second.s <= 2) {
                return best.answer + '<br><br><span class="mono" style="color:var(--dim)">Also related: ' + second.topic.id.replace(/-/g, ' ') + '</span>';
            }
        }

        const hints = [];
        if (/buy|cart|pay|order|checkout/.test(lower)) hints.push('cart & checkout');
        if (/macro|controller|keyboard|f12|record|timeline/.test(lower)) hints.push('Macro Pro');
        if (/aim|shotgun|lock|radar|fortnite/.test(lower)) hints.push('Aim Assist Pro');
        if (/lag|fps|ping|premium|zero/.test(lower)) hints.push('system tweaks');
        if (/special|refer|affiliate|gift|pass/.test(lower)) hints.push('Specials tab');
        if (/install|setup|key|license|download|exe/.test(lower)) hints.push('delivery & setup');

        if (hints.length) {
            return 'I can help with <strong>' + hints.join(', ') + '</strong>. Try: "How does Controller Macro Pro work?" or "How do I activate my license?"<br><br>Or browse the FAQ accordion on the left.';
        }

        return 'Ask me about:<br>• <strong>Macro Pro</strong> — controller/keyboard mapping, Fortnite presets<br>• <strong>Aim Assist Pro</strong> — Aim Bundle & Shotgun Pack<br>• <strong>System tweaks</strong> — Premium, Zero Delay, FPS, Ping<br>• <strong>Buying</strong> — cart, checkout, license keys, download<br>• <strong>Safety</strong> — bans, refunds, Windows requirements';
    }

    function addMsg(text, role) {
        const div = document.createElement('div');
        div.className = 'help-msg help-msg--' + role;
        div.innerHTML = role === 'bot'
            ? '<span class="help-avatar">BD</span><div class="help-bubble">' + text + '</div>'
            : '<div class="help-bubble">' + text + '</div>';
        chat.appendChild(div);
        chat.scrollTop = chat.scrollHeight;
    }

    function reply(q) {
        if (!q.trim()) return;
        addMsg(q.trim(), 'user');
        input.value = '';
        sendBtn.disabled = true;
        setTimeout(() => {
            addMsg(findAnswer(q), 'bot');
            sendBtn.disabled = false;
            input.focus();
        }, 350 + Math.random() * 250);
    }

    sendBtn?.addEventListener('click', () => reply(input.value));
    input?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); reply(input.value); }
    });

    if (chips) {
        SUGGESTIONS.forEach(s => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'help-chip';
            btn.textContent = s;
            btn.addEventListener('click', () => reply(s));
            chips.appendChild(btn);
        });
    }

    addMsg('Hey — I\'m <strong>BlankDelay AI Support</strong> (updated). I know Macro Pro, Aim Assist Pro, all 9 products, Fortnite setup, cart, checkout, license keys, and more. Ask anything!', 'bot');
})();
