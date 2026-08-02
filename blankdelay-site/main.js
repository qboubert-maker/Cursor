(function () {
    /* ── Page load ── */
    window.addEventListener('load', () => {
        document.body.classList.remove('loading');
        document.body.classList.add('loaded');
    });

    /* ── Custom cursor mark ── */
    const cursorMark = document.getElementById('cursor-mark');
    document.addEventListener('mousemove', e => {
        if (cursorMark) {
            cursorMark.style.left = e.clientX + 'px';
            cursorMark.style.top = e.clientY + 'px';
        }
    });

    /* ── Theme toggle ── */
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('bd-theme');
    if (savedTheme === 'light') document.body.classList.add('theme-light');
    function updateThemeIcon() {
        if (!themeToggle) return;
        themeToggle.textContent = document.body.classList.contains('theme-light') ? '☀' : '☾';
        themeToggle.title = document.body.classList.contains('theme-light') ? 'Switch to dark mode' : 'Switch to light mode';
    }
    updateThemeIcon();
    themeToggle?.addEventListener('click', () => {
        document.body.classList.toggle('theme-light');
        localStorage.setItem('bd-theme', document.body.classList.contains('theme-light') ? 'light' : 'dark');
        updateThemeIcon();
    });

    /* ── Scroll reveal (exclude review marquee cards) ── */
    document.querySelectorAll('.section, .product-card, .about-card, .blog-card, .platform-card, .orbit-item, .specials-hero').forEach(el => {
        el.classList.add('reveal');
    });
    const revealObs = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.08 });
    document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

    /* ── Exit intent ── */
    const exitModal = document.getElementById('exit-modal');
    let exitShown = false;
    document.addEventListener('mouseout', e => {
        if (exitShown || e.clientY > 10) return;
        exitShown = true;
        if (exitModal) exitModal.hidden = false;
    });
    document.getElementById('exit-close')?.addEventListener('click', () => { if (exitModal) exitModal.hidden = true; });

    /* ── FAQ accordion ── */
    document.querySelectorAll('.faq-q').forEach(btn => {
        btn.addEventListener('click', () => {
            const item = btn.closest('.faq-item');
            const open = item.classList.contains('open');
            document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
            if (!open) item.classList.add('open');
            btn.setAttribute('aria-expanded', !open);
        });
    });

    /* ── Setup wizard ── */
    let wizardStep = 1;
    document.getElementById('wizard-next')?.addEventListener('click', () => {
        const steps = document.querySelectorAll('.wizard-step');
        steps.forEach(s => s.classList.remove('active'));
        wizardStep = wizardStep >= 3 ? 1 : wizardStep + 1;
        steps[wizardStep - 1]?.classList.add('active');
    });

    /* ── Sys req checker ── */
    document.getElementById('sysreq-btn')?.addEventListener('click', () => {
        const cpu = document.getElementById('sys-cpu')?.value;
        const ram = document.getElementById('sys-ram')?.value;
        const out = document.getElementById('sysreq-out');
        if (!out) return;
        if (cpu === 'warn' || ram === 'warn') {
            out.textContent = 'Supported with Blank Delay — Blank Premium recommended on newer hardware.';
        } else {
            out.textContent = '✓ Fully compatible. Blank Premium will run at full performance.';
        }
    });



    /* ── Demo / profiler (legacy hooks) ── */
    document.getElementById('profiler-btn')?.addEventListener('click', () => alert('Hardware profiler download starting…'));

    document.querySelectorAll('a[href="#faq"]').forEach(link => {
        link.addEventListener('click', () => {
            setTimeout(() => document.getElementById('help-input')?.focus(), 450);
        });
    });


    /* ── Purchase notifications ── */
    const matrix = document.getElementById('matrix-canvas');
    const productsSection = document.querySelector('.products-section');
    if (matrix && productsSection) {
        const mctx = matrix.getContext('2d');
        const resizeMatrix = () => {
            matrix.width = productsSection.offsetWidth;
            matrix.height = productsSection.offsetHeight;
        };
        resizeMatrix();
        window.addEventListener('resize', resizeMatrix);
        const cols = Math.floor(matrix.width / 14) || 40;
        const drops = Array(cols).fill(0);
        setInterval(() => {
            mctx.fillStyle = 'rgba(0,0,0,0.05)';
            mctx.fillRect(0, 0, matrix.width, matrix.height);
            mctx.fillStyle = 'rgba(255,255,255,0.15)';
            mctx.font = '10px monospace';
            drops.forEach((y, i) => {
                mctx.fillText(String.fromCharCode(48 + Math.random() * 10), i * 14, y);
                drops[i] = y > matrix.height ? 0 : y + 14;
            });
        }, 80);
    }

    /* ── Constellation lines in orbit ── */
    const constCanvas = document.getElementById('constellation-canvas');
    const orbitStage = document.querySelector('.orbit-stage');
    if (constCanvas && orbitStage) {
        const cctx = constCanvas.getContext('2d');
        const resizeConst = () => {
            constCanvas.width = orbitStage.offsetWidth;
            constCanvas.height = orbitStage.offsetHeight;
        };
        resizeConst();
        window.addEventListener('resize', resizeConst);
        function drawConst() {
            cctx.clearRect(0, 0, constCanvas.width, constCanvas.height);
            const cx = constCanvas.width / 2, cy = constCanvas.height / 2;
            cctx.strokeStyle = 'rgba(255,255,255,0.06)';
            cctx.lineWidth = 1;
            for (let i = 0; i < 8; i++) {
                const a1 = Date.now() * 0.0003 + i * 0.8;
                const a2 = a1 + 1.2;
                const r1 = 80 + i * 25, r2 = 100 + i * 20;
                cctx.beginPath();
                cctx.moveTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1 * 0.45);
                cctx.lineTo(cx + Math.cos(a2) * r2, cy + Math.sin(a2) * r2 * 0.45);
                cctx.stroke();
            }
            requestAnimationFrame(drawConst);
        }
        drawConst();
    }

    /* ── Game orbit ── */
    const orbit = document.getElementById('game-orbit');
    if (orbit) {
        const items = orbit.querySelectorAll('.orbit-item');
        const count = items.length;
        let angle = 0;
        function getRadii() {
            return {
                rx: Math.min(window.innerWidth * 0.44, 520),
                ry: Math.min(window.innerWidth * 0.18, 195)
            };
        }
        let { rx, ry } = getRadii();
        items.forEach(el => {
            const glow = el.dataset.glow;
            if (glow) el.style.setProperty('--glow', glow);
            el.addEventListener('mouseenter', () => {
                el.style.boxShadow = `0 0 30px ${glow || 'rgba(255,255,255,0.3)'}`;
            });
            el.addEventListener('mouseleave', () => { el.style.boxShadow = ''; });
        });
        function placeOrbit() {
            angle += 0.0045;
            items.forEach((el, i) => {
                const a = angle + (i / count) * Math.PI * 2;
                const x = Math.cos(a) * rx;
                const y = Math.sin(a) * ry;
                const depth = (Math.sin(a) + 1) / 2;
                el.style.transform = `translate(${x}px, ${y}px) scale(${0.9 + depth * 0.22})`;
                el.style.zIndex = Math.floor(depth * 10);
                el.style.opacity = 0.78 + depth * 0.22;
            });
            requestAnimationFrame(placeOrbit);
        }
        window.addEventListener('resize', () => { ({ rx, ry } = getRadii()); });
        placeOrbit();
    }

    /* ── Nav + scroll + sticky CTA ── */
    const sticky = document.getElementById('sticky-cta');
    window.addEventListener('scroll', () => {
        document.getElementById('nav')?.classList.toggle('scrolled', window.scrollY > 40);
        sticky?.classList.toggle('show', window.scrollY > 600);
        const y = window.scrollY;
        document.querySelector('.hero-brand-row')?.style && (document.querySelector('.hero-brand-row').style.transform = `translateY(${y * 0.04}px)`);
        document.querySelector('.hero-showcase')?.style && (document.querySelector('.hero-showcase').style.transform = `translateY(${y * 0.02}px)`);
    });
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            const t = document.querySelector(a.getAttribute('href'));
            if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
        });
    });

    /* ── Live latency ticker ── */
    const navLatency = document.getElementById('nav-latency-badge');
    const showcaseLatency = document.getElementById('showcase-latency');
    if (navLatency || showcaseLatency) {
        setInterval(() => {
            const jitter = Math.random() < 0.15 ? '1' : '0';
            const label = jitter + 'ms';
            if (navLatency) {
                navLatency.textContent = label;
                navLatency.classList.toggle('flash', jitter === '0');
            }
            if (showcaseLatency) {
                showcaseLatency.textContent = label + ' LIVE';
                showcaseLatency.classList.toggle('flash', jitter === '0');
            }
        }, 1800);
    }

    /* ── Generic media-live reactive canvases ── */
    const LIVE_THEME_CONFIG = {
        'delay-plus': { count: 28, color: 'rgba(100,200,255,0.55)', activeColor: 'rgba(180,100,255,0.75)', streaks: true },
        delay: { count: 24, color: 'rgba(255,255,255,0.35)', activeColor: 'rgba(255,255,255,0.7)', streaks: true },
        fps: { count: 36, color: 'rgba(57,255,20,0.35)', activeColor: 'rgba(57,255,20,0.75)', streaks: true },
        ping: { count: 22, color: 'rgba(0,150,255,0.35)', activeColor: 'rgba(0,200,255,0.7)', nodes: true },
        controller: { count: 30, split: true },
        keyboard: { count: 20, color: 'rgba(255,255,255,0.3)', activeColor: 'rgba(255,255,255,0.65)', grid: true },
        aim: { count: 18, color: 'rgba(255,60,60,0.4)', activeColor: 'rgba(255,80,80,0.75)', crosshair: true },
        shotgun: { count: 24, color: 'rgba(255,140,40,0.4)', activeColor: 'rgba(255,80,40,0.75)', burst: true }
    };

    function animateStat(fromEl, toEl, start, end, suffix) {
        if (!fromEl || !toEl || fromEl.dataset.animating) return;
        fromEl.dataset.animating = '1';
        const isPlus = String(end).includes('+');
        const endNum = parseFloat(String(end).replace('+', ''));
        const t0 = performance.now();
        (function tick(now) {
            const t = Math.min((now - t0) / 850, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            const val = Math.round(start + (endNum - start) * eased);
            fromEl.textContent = val + (suffix || '');
            if (t < 1) requestAnimationFrame(tick);
            else { fromEl.textContent = start + (suffix || ''); delete fromEl.dataset.animating; }
        })(performance.now());
        toEl.style.opacity = '1';
    }

    document.querySelectorAll('.media-live[data-theme]').forEach(media => {
        const theme = media.dataset.theme;
        const cfg = LIVE_THEME_CONFIG[theme];
        const canvas = media.querySelector('.live-media-canvas');
        const logoWrap = media.querySelector('.live-logo-wrap');
        const card = media.closest('.product-card');
        const statFrom = media.querySelector('.live-stat-from');
        const statTo = media.querySelector('.live-stat-to');
        if (!canvas || !cfg || !card) return;

        const ctx = canvas.getContext('2d');
        let particles = [], w = 0, h = 0, mx = 0.5, my = 0.5, active = false;
        const statDefaults = { from: statFrom?.textContent, to: statTo?.textContent };

        function resize() {
            w = canvas.width = media.offsetWidth;
            h = canvas.height = media.offsetHeight;
            if (!particles.length) {
                particles = Array.from({ length: cfg.count }, (_, i) => ({
                    x: Math.random() * w, y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.5) * 1.2,
                    r: Math.random() * 1.8 + 0.4, side: i % 2 ? 'left' : 'right'
                }));
            }
        }

        function draw() {
            ctx.clearRect(0, 0, w, h);
            const cx = w * mx, cy = h * my;
            const speed = active ? 2.2 : 1;

            particles.forEach(p => {
                p.x += p.vx * speed + (cx - p.x) * 0.002 * (active ? 1 : 0);
                p.y += p.vy * speed + (cy - p.y) * 0.002 * (active ? 1 : 0);
                if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;

                let fill = cfg.split
                    ? (p.x < w * 0.5 ? (active ? 'rgba(87,242,135,0.7)' : 'rgba(87,242,135,0.3)') : (active ? 'rgba(0,112,243,0.7)' : 'rgba(0,112,243,0.3)'))
                    : (active ? cfg.activeColor : cfg.color);

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = fill;
                ctx.fill();

                if (active) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(cx, cy);
                    ctx.strokeStyle = cfg.split ? 'rgba(255,255,255,0.06)' : fill.replace(/[\d.]+\)$/, '0.1)');
                    ctx.stroke();
                }

                if (cfg.streaks && active && Math.random() > 0.92) {
                    ctx.strokeStyle = cfg.activeColor;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x + p.vx * 20, p.y + p.vy * 20);
                    ctx.stroke();
                }
            });

            if (cfg.crosshair && active) {
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = 1;
                const s = 16;
                ctx.beginPath();
                ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy);
                ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s);
                ctx.stroke();
            }

            if (cfg.nodes && active) {
                particles.slice(0, 6).forEach((p, i) => {
                    const p2 = particles[(i + 3) % particles.length];
                    ctx.strokeStyle = 'rgba(0,200,255,0.15)';
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                });
            }

            requestAnimationFrame(draw);
        }

        resize();
        draw();
        window.addEventListener('resize', resize);

        card.addEventListener('mouseenter', () => {
            active = true;
            if (statFrom && statTo) {
                const start = parseFloat(statFrom.textContent);
                const end = parseFloat(statTo.textContent);
                if (!isNaN(start) && !isNaN(end)) animateStat(statFrom, statTo, start, end);
            }
        });
        card.addEventListener('mouseleave', () => {
            active = false; mx = 0.5; my = 0.5;
            if (logoWrap) logoWrap.style.transform = '';
            if (statFrom) statFrom.textContent = statDefaults.from;
            if (statTo) statTo.textContent = statDefaults.to;
        });
        card.addEventListener('mousemove', e => {
            const r = media.getBoundingClientRect();
            mx = (e.clientX - r.left) / r.width;
            my = (e.clientY - r.top) / r.height;
            if (logoWrap) {
                const lx = (mx - 0.5) * 18;
                const ly = (my - 0.5) * 14;
                logoWrap.style.transform = `translate(${lx}px, ${ly}px) scale(${active ? 1.08 : 1})`;
            }
        });
    });

    /* ── Product video hover ── */
    document.querySelectorAll('.product-media video:not(.edit-live-video):not(.aim-live-video):not(.storm-live-video)').forEach(v => {
        const card = v.closest('.product-card');
        if (!card) return;
        card.addEventListener('mouseenter', () => v.play().catch(() => {}));
        card.addEventListener('mouseleave', () => { v.pause(); v.currentTime = 0; });
    });

    /* ── Blank Edit Engine live clip ── */
    document.querySelectorAll('.media-edit').forEach(media => {
        const canvas = media.querySelector('.edit-media-canvas');
        const video = media.querySelector('.edit-live-video');
        const card = media.closest('.product-card');
        if (!canvas || !video || !card) return;

        video.play().catch(() => {});

        const ctx = canvas.getContext('2d');
        let particles = [];
        let w = 0, h = 0, mx = 0.5, my = 0.5, active = false, rafId = null;

        function resize() {
            w = canvas.width = media.offsetWidth;
            h = canvas.height = media.offsetHeight;
            if (!particles.length) {
                particles = Array.from({ length: 24 }, () => ({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 1.2,
                    vy: (Math.random() - 0.5) * 1.2,
                    r: Math.random() * 1.6 + 0.4
                }));
            }
        }

        function draw() {
            ctx.clearRect(0, 0, w, h);
            const cx = w * mx;
            const cy = h * my;
            const speed = active ? 2.2 : 1;

            particles.forEach(p => {
                p.x += p.vx * speed;
                p.y += p.vy * speed;
                if (p.x < 0) p.x = w;
                if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h;
                if (p.y > h) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = active ? 'rgba(107,186,255,0.7)' : 'rgba(107,186,255,0.35)';
                ctx.fill();

                if (active) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(cx, cy);
                    ctx.strokeStyle = 'rgba(107,186,255,0.08)';
                    ctx.stroke();
                }
            });

            rafId = requestAnimationFrame(draw);
        }

        resize();
        draw();
        window.addEventListener('resize', resize);

        const editObs = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) video.play().catch(() => {});
            });
        }, { threshold: 0.3 });
        editObs.observe(media);

        card.addEventListener('mouseenter', () => { active = true; video.playbackRate = 1.15; });
        card.addEventListener('mouseleave', () => {
            active = false;
            mx = 0.5;
            my = 0.5;
            video.playbackRate = 1;
        });
        card.addEventListener('mousemove', e => {
            const r = media.getBoundingClientRect();
            mx = (e.clientX - r.left) / r.width;
            my = (e.clientY - r.top) / r.height;
        });
    });

    /* ── Monitor Optimization live reactive image ── */
    document.querySelectorAll('.media-monitor-live').forEach(media => {
        const canvas = media.querySelector('.monitor-media-canvas');
        const imgWrap = media.querySelector('.monitor-image-wrap');
        const hzFrom = media.querySelector('.monitor-hz');
        const card = media.closest('.product-card');
        if (!canvas || !imgWrap || !card) return;

        const ctx = canvas.getContext('2d');
        let particles = [];
        let w = 0, h = 0, mx = 0.5, my = 0.5, active = false, rafId = null;
        let hzAnim = null;

        function resize() {
            w = canvas.width = media.offsetWidth;
            h = canvas.height = media.offsetHeight;
            if (!particles.length) {
                particles = Array.from({ length: 26 }, () => ({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 0.7,
                    vy: (Math.random() - 0.5) * 0.7,
                    r: Math.random() * 1.6 + 0.4
                }));
            }
        }

        function draw() {
            ctx.clearRect(0, 0, w, h);
            const cx = w * mx;
            const cy = h * my;
            const speed = active ? 1.8 : 0.8;

            particles.forEach(p => {
                p.x += p.vx * speed + (cx - p.x) * 0.002 * (active ? 1 : 0);
                p.y += p.vy * speed + (cy - p.y) * 0.002 * (active ? 1 : 0);
                if (p.x < 0) p.x = w;
                if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h;
                if (p.y > h) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = active ? 'rgba(255,200,60,0.55)' : 'rgba(255,255,255,0.28)';
                ctx.fill();
            });

            if (active) {
                ctx.strokeStyle = 'rgba(255,180,40,0.12)';
                ctx.beginPath();
                ctx.moveTo(0, cy);
                ctx.lineTo(w, cy);
                ctx.stroke();
            }

            rafId = requestAnimationFrame(draw);
        }

        function animateHz() {
            if (!hzFrom || hzAnim) return;
            const start = 144;
            const end = 240;
            const startTime = performance.now();
            hzAnim = requestAnimationFrame(function tick(now) {
                const t = Math.min((now - startTime) / 800, 1);
                const eased = 1 - Math.pow(1 - t, 3);
                hzFrom.textContent = Math.round(start + (end - start) * eased);
                if (t < 1) hzAnim = requestAnimationFrame(tick);
                else hzAnim = null;
            });
        }

        resize();
        draw();
        window.addEventListener('resize', resize);

        card.addEventListener('mouseenter', () => { active = true; animateHz(); });
        card.addEventListener('mouseleave', () => {
            active = false;
            mx = 0.5;
            my = 0.5;
            imgWrap.style.transform = '';
            if (hzFrom) hzFrom.textContent = '144';
            if (hzAnim) cancelAnimationFrame(hzAnim);
            hzAnim = null;
        });
        card.addEventListener('mousemove', e => {
            const r = media.getBoundingClientRect();
            mx = (e.clientX - r.left) / r.width;
            my = (e.clientY - r.top) / r.height;
            const lx = (mx - 0.5) * 16;
            const ly = (my - 0.5) * 12;
            imgWrap.style.transform = `translate(${lx}px, ${ly}px) scale(${active ? 1.04 : 1})`;
        });
    });

    /* ── Aim Bundle live air-tracking clip ── */
    document.querySelectorAll('.media-aim-live').forEach(media => {
        const canvas = media.querySelector('.aim-media-canvas');
        const video = media.querySelector('.aim-live-video');
        const card = media.closest('.product-card');
        if (!canvas || !video || !card) return;

        video.play().catch(() => {});

        const ctx = canvas.getContext('2d');
        let particles = [];
        let w = 0, h = 0, mx = 0.5, my = 0.5, active = false, rafId = null;

        function resize() {
            w = canvas.width = media.offsetWidth;
            h = canvas.height = media.offsetHeight;
            if (!particles.length) {
                particles = Array.from({ length: 20 }, () => ({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 1.4,
                    vy: (Math.random() - 0.5) * 1.4,
                    r: Math.random() * 1.5 + 0.4
                }));
            }
        }

        function draw() {
            ctx.clearRect(0, 0, w, h);
            const cx = w * mx;
            const cy = h * my;
            const speed = active ? 2.4 : 1.1;

            particles.forEach(p => {
                p.x += p.vx * speed;
                p.y += p.vy * speed;
                if (p.x < 0) p.x = w;
                if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h;
                if (p.y > h) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = active ? 'rgba(255,80,80,0.65)' : 'rgba(255,255,255,0.3)';
                ctx.fill();

                if (active) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(cx, cy);
                    ctx.strokeStyle = 'rgba(255,80,80,0.1)';
                    ctx.stroke();
                }
            });

            if (active) {
                ctx.strokeStyle = 'rgba(255,255,255,0.45)';
                ctx.lineWidth = 1;
                const s = 14;
                ctx.beginPath();
                ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy);
                ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s);
                ctx.stroke();
            }

            rafId = requestAnimationFrame(draw);
        }

        resize();
        draw();
        window.addEventListener('resize', resize);

        const aimObs = new IntersectionObserver(entries => {
            entries.forEach(e => { if (e.isIntersecting) video.play().catch(() => {}); });
        }, { threshold: 0.3 });
        aimObs.observe(media);

        card.addEventListener('mouseenter', () => { active = true; video.playbackRate = 1.1; });
        card.addEventListener('mouseleave', () => {
            active = false;
            mx = 0.5;
            my = 0.5;
            video.playbackRate = 1;
        });
        card.addEventListener('mousemove', e => {
            const r = media.getBoundingClientRect();
            mx = (e.clientX - r.left) / r.width;
            my = (e.clientY - r.top) / r.height;
        });
    });

    /* ── Endgame Storm Locker live clip ── */
    document.querySelectorAll('.media-storm-live').forEach(media => {
        const canvas = media.querySelector('.storm-media-canvas');
        const video = media.querySelector('.storm-live-video');
        const fpsFrom = media.querySelector('.storm-fps');
        const card = media.closest('.product-card');
        if (!canvas || !video || !card) return;

        video.play().catch(() => {});

        const ctx = canvas.getContext('2d');
        let particles = [];
        let w = 0, h = 0, mx = 0.5, my = 0.5, active = false, fpsAnim = null;

        function resize() {
            w = canvas.width = media.offsetWidth;
            h = canvas.height = media.offsetHeight;
            if (!particles.length) {
                particles = Array.from({ length: 28 }, () => ({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 1.3,
                    vy: (Math.random() - 0.5) * 1.3,
                    r: Math.random() * 1.7 + 0.4,
                    hue: Math.random() > 0.5 ? 270 : 220
                }));
            }
        }

        function draw() {
            ctx.clearRect(0, 0, w, h);
            const cx = w * mx;
            const cy = h * my;
            const speed = active ? 2.5 : 1.1;

            particles.forEach(p => {
                p.x += p.vx * speed + (cx - p.x) * 0.003 * (active ? 1 : 0);
                p.y += p.vy * speed + (cy - p.y) * 0.003 * (active ? 1 : 0);
                if (p.x < 0) p.x = w;
                if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h;
                if (p.y > h) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = active
                    ? `hsla(${p.hue}, 85%, 68%, 0.7)`
                    : `hsla(${p.hue}, 70%, 58%, 0.32)`;
                ctx.fill();

                if (active) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(cx, cy);
                    ctx.strokeStyle = `hsla(${p.hue}, 80%, 60%, 0.1)`;
                    ctx.stroke();
                }
            });

            if (active) {
                const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.35);
                grad.addColorStop(0, 'rgba(168,85,247,0.12)');
                grad.addColorStop(1, 'rgba(168,85,247,0)');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, w, h);
            }

            requestAnimationFrame(draw);
        }

        function animateFps() {
            if (!fpsFrom || fpsAnim) return;
            const start = 38;
            const end = 144;
            const startTime = performance.now();
            fpsAnim = requestAnimationFrame(function tick(now) {
                const t = Math.min((now - startTime) / 900, 1);
                const eased = 1 - Math.pow(1 - t, 3);
                fpsFrom.textContent = Math.round(start + (end - start) * eased);
                if (t < 1) fpsAnim = requestAnimationFrame(tick);
                else fpsAnim = null;
            });
        }

        resize();
        draw();
        window.addEventListener('resize', resize);

        const stormObs = new IntersectionObserver(entries => {
            entries.forEach(e => { if (e.isIntersecting) video.play().catch(() => {}); });
        }, { threshold: 0.3 });
        stormObs.observe(media);

        card.addEventListener('mouseenter', () => { active = true; animateFps(); video.playbackRate = 1.12; });
        card.addEventListener('mouseleave', () => {
            active = false;
            mx = 0.5;
            my = 0.5;
            video.playbackRate = 1;
            if (fpsFrom) fpsFrom.textContent = '38';
            if (fpsAnim) cancelAnimationFrame(fpsAnim);
            fpsAnim = null;
        });
        card.addEventListener('mousemove', e => {
            const r = media.getBoundingClientRect();
            mx = (e.clientX - r.left) / r.width;
            my = (e.clientY - r.top) / r.height;
        });
    });

    /* ── Blank Premium live reactive icon ── */
    document.querySelectorAll('.media-premium').forEach(media => {
        const canvas = media.querySelector('.premium-media-canvas');
        const logoWrap = media.querySelector('.premium-logo-wrap');
        const card = media.closest('.product-card');
        if (!canvas || !logoWrap || !card) return;

        const ctx = canvas.getContext('2d');
        let particles = [];
        let w = 0, h = 0, mx = 0.5, my = 0.5, active = false, rafId = null;

        function resize() {
            w = canvas.width = media.offsetWidth;
            h = canvas.height = media.offsetHeight;
            if (!particles.length) {
                particles = Array.from({ length: 28 }, () => ({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 0.6,
                    vy: (Math.random() - 0.5) * 0.6,
                    r: Math.random() * 1.8 + 0.4
                }));
            }
        }

        function draw() {
            ctx.clearRect(0, 0, w, h);
            const cx = w * mx;
            const cy = h * my;
            const speed = active ? 1.6 : 0.7;

            particles.forEach(p => {
                p.x += p.vx * speed + (cx - p.x) * 0.002 * (active ? 1 : 0);
                p.y += p.vy * speed + (cy - p.y) * 0.002 * (active ? 1 : 0);
                if (p.x < 0) p.x = w;
                if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h;
                if (p.y > h) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = active ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)';
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(cx, cy);
                ctx.strokeStyle = active ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)';
                ctx.stroke();
            });

            rafId = requestAnimationFrame(draw);
        }

        function start() {
            if (rafId) return;
            resize();
            draw();
        }

        function stop() {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = null;
        }

        resize();
        start();
        window.addEventListener('resize', resize);

        card.addEventListener('mouseenter', () => { active = true; });
        card.addEventListener('mouseleave', () => {
            active = false;
            mx = 0.5;
            my = 0.5;
            logoWrap.style.transform = '';
        });
        card.addEventListener('mousemove', e => {
            const r = media.getBoundingClientRect();
            mx = (e.clientX - r.left) / r.width;
            my = (e.clientY - r.top) / r.height;
            const lx = (mx - 0.5) * 18;
            const ly = (my - 0.5) * 14;
            logoWrap.style.transform = `translate(${lx}px, ${ly}px) scale(${active ? 1.08 : 1})`;
        });
    });

    /* ── FPS Boost live reactive image ── */
    document.querySelectorAll('.media-fps').forEach(media => {
        const canvas = media.querySelector('.fps-media-canvas');
        const imgWrap = media.querySelector('.fps-image-wrap');
        const fpsFrom = media.querySelector('.fps-from');
        const card = media.closest('.product-card');
        if (!canvas || !imgWrap || !card) return;

        const ctx = canvas.getContext('2d');
        let particles = [];
        let w = 0, h = 0, mx = 0.5, my = 0.5, active = false, rafId = null;
        let fpsAnim = null;

        function resize() {
            w = canvas.width = media.offsetWidth;
            h = canvas.height = media.offsetHeight;
            if (!particles.length) {
                particles = Array.from({ length: 32 }, () => ({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 0.8,
                    vy: (Math.random() - 0.5) * 0.8,
                    r: Math.random() * 2 + 0.5
                }));
            }
        }

        function draw() {
            ctx.clearRect(0, 0, w, h);
            const cx = w * mx;
            const cy = h * my;
            const speed = active ? 2 : 0.9;

            particles.forEach(p => {
                p.x += p.vx * speed + (cx - p.x) * 0.003 * (active ? 1 : 0);
                p.y += p.vy * speed + (cy - p.y) * 0.003 * (active ? 1 : 0);
                if (p.x < 0) p.x = w;
                if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h;
                if (p.y > h) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = active ? 'rgba(57,255,20,0.65)' : 'rgba(57,255,20,0.28)';
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(cx, cy);
                ctx.strokeStyle = active ? 'rgba(57,255,20,0.08)' : 'rgba(57,255,20,0.04)';
                ctx.stroke();
            });

            rafId = requestAnimationFrame(draw);
        }

        function animateFpsCounter() {
            if (!fpsFrom || fpsAnim) return;
            const start = 32;
            const end = 540;
            const startTime = performance.now();
            fpsAnim = requestAnimationFrame(function tick(now) {
                const t = Math.min((now - startTime) / 900, 1);
                const eased = 1 - Math.pow(1 - t, 3);
                fpsFrom.textContent = Math.round(start + (end - start) * eased);
                if (t < 1) fpsAnim = requestAnimationFrame(tick);
                else fpsAnim = null;
            });
        }

        resize();
        draw();
        window.addEventListener('resize', resize);

        card.addEventListener('mouseenter', () => {
            active = true;
            animateFpsCounter();
        });
        card.addEventListener('mouseleave', () => {
            active = false;
            mx = 0.5;
            my = 0.5;
            imgWrap.style.transform = '';
            if (fpsFrom) fpsFrom.textContent = '32';
            if (fpsAnim) cancelAnimationFrame(fpsAnim);
            fpsAnim = null;
        });
        card.addEventListener('mousemove', e => {
            const r = media.getBoundingClientRect();
            mx = (e.clientX - r.left) / r.width;
            my = (e.clientY - r.top) / r.height;
            const lx = (mx - 0.5) * 22;
            const ly = (my - 0.5) * 16;
            imgWrap.style.transform = `translate(${lx}px, ${ly}px) scale(${active ? 1.04 : 1})`;
        });
    });

    /* ── Controller Optimization live reactive image ── */
    document.querySelectorAll('.media-controller-live').forEach(media => {
        const canvas = media.querySelector('.controller-media-canvas');
        const imgWrap = media.querySelector('.controller-image-wrap');
        const msFrom = media.querySelector('.controller-ms');
        const card = media.closest('.product-card');
        if (!canvas || !imgWrap || !card) return;

        const ctx = canvas.getContext('2d');
        let particles = [];
        let w = 0, h = 0, mx = 0.5, my = 0.5, active = false, msAnim = null;

        function resize() {
            w = canvas.width = media.offsetWidth;
            h = canvas.height = media.offsetHeight;
            if (!particles.length) {
                particles = Array.from({ length: 30 }, () => ({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 0.9,
                    vy: (Math.random() - 0.5) * 0.9,
                    r: Math.random() * 1.8 + 0.4,
                    side: Math.random() > 0.5 ? 'left' : 'right'
                }));
            }
        }

        function draw() {
            ctx.clearRect(0, 0, w, h);
            const cx = w * mx;
            const cy = h * my;
            const speed = active ? 2.2 : 1;

            particles.forEach(p => {
                p.x += p.vx * speed + (cx - p.x) * 0.0025 * (active ? 1 : 0);
                p.y += p.vy * speed + (cy - p.y) * 0.0025 * (active ? 1 : 0);
                if (p.x < 0) p.x = w;
                if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h;
                if (p.y > h) p.y = 0;

                const onLeft = p.x < w * 0.5;
                const color = onLeft
                    ? (active ? 'rgba(87,242,135,0.65)' : 'rgba(87,242,135,0.28)')
                    : (active ? 'rgba(0,112,243,0.65)' : 'rgba(0,112,243,0.28)');

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();

                if (active) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(cx, cy);
                    ctx.strokeStyle = onLeft ? 'rgba(87,242,135,0.08)' : 'rgba(0,112,243,0.08)';
                    ctx.stroke();
                }
            });

            requestAnimationFrame(draw);
        }

        function animateMs() {
            if (!msFrom || msAnim) return;
            const start = 8;
            const end = 1;
            const startTime = performance.now();
            msAnim = requestAnimationFrame(function tick(now) {
                const t = Math.min((now - startTime) / 850, 1);
                const eased = 1 - Math.pow(1 - t, 3);
                msFrom.textContent = Math.max(1, Math.round(start + (end - start) * eased));
                if (t < 1) msAnim = requestAnimationFrame(tick);
                else msAnim = null;
            });
        }

        function updateColors() {
            const leftHue = (0.5 - mx) * 50;
            const rightHue = (mx - 0.5) * 50;
            media.style.setProperty('--ctrl-hue-left', `${leftHue}deg`);
            media.style.setProperty('--ctrl-hue-right', `${rightHue}deg`);
        }

        resize();
        draw();
        updateColors();
        window.addEventListener('resize', resize);

        card.addEventListener('mouseenter', () => { active = true; animateMs(); });
        card.addEventListener('mouseleave', () => {
            active = false;
            mx = 0.5;
            my = 0.5;
            imgWrap.style.transform = '';
            if (msFrom) msFrom.textContent = '8';
            if (msAnim) cancelAnimationFrame(msAnim);
            msAnim = null;
            updateColors();
        });
        card.addEventListener('mousemove', e => {
            const r = media.getBoundingClientRect();
            mx = (e.clientX - r.left) / r.width;
            my = (e.clientY - r.top) / r.height;
            updateColors();
            const lx = (mx - 0.5) * 18;
            const ly = (my - 0.5) * 14;
            imgWrap.style.transform = `translate(${lx}px, ${ly}px) scale(${active ? 1.03 : 1})`;
        });
    });

    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('mousemove', e => {
            const r = card.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            card.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`;
        });
        card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });

    /* ── Particle burst ── */
    document.querySelectorAll('.btn-get, .btn-primary').forEach(btn => {
        btn.addEventListener('click', e => {
            for (let i = 0; i < 12; i++) {
                const p = document.createElement('div');
                p.className = 'burst-particle';
                p.style.left = e.clientX + 'px';
                p.style.top = e.clientY + 'px';
                const ang = (Math.PI * 2 * i) / 12;
                p.style.setProperty('--bx', Math.cos(ang) * 60 + 'px');
                p.style.setProperty('--by', Math.sin(ang) * 60 + 'px');
                document.body.appendChild(p);
                setTimeout(() => p.remove(), 700);
            }
        });
    });

    /* ── Before / After slider ── */
    const ba = document.getElementById('ba-slider');
    if (ba) {
        const input = ba.querySelector('input[type="range"]');
        const after = ba.querySelector('.ba-after');
        input?.addEventListener('input', () => {
            after.style.width = input.value + '%';
            ba.querySelector('.ba-handle').style.left = input.value + '%';
        });
    }

    /* ── Platform quiz ── */
    const quiz = document.getElementById('platform-quiz');
    if (quiz) {
        quiz.querySelectorAll('.quiz-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                quiz.querySelectorAll('.quiz-opt').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                const result = document.getElementById('quiz-result');
                if (result) {
                    result.hidden = false;
                    result.textContent = btn.dataset.result;
                }
            });
        });
    }

    /* ── Purchase notifications ── */
    const products = ['Blank Premium Utility', 'Zero Delay Plus', 'Zero Delay', 'FPS Boost', 'Ping Optimizer', 'Controller Macro', 'Keyboard Macro', 'Aim Bundle', 'Shotgun Pack'];
    const names = ['Tyler R.', 'Marcus J.', 'Jordan K.', 'Derek M.', 'Chris N.', 'Ryan T.', 'Brandon L.', 'Kevin H.'];
    const toast = document.getElementById('purchase-toast');
    function showToast() {
        if (!toast) return;
        toast.querySelector('.toast-name').textContent = names[Math.floor(Math.random() * names.length)];
        toast.querySelector('.toast-product').textContent = products[Math.floor(Math.random() * products.length)];
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 4500);
    }
    setTimeout(showToast, 5000);
    setInterval(showToast, 14000 + Math.random() * 8000);

    document.querySelectorAll('.platform-card').forEach(card => {
        card.addEventListener('mouseenter', () => card.style.borderColor = 'rgba(255,255,255,0.35)');
        card.addEventListener('mouseleave', () => card.style.borderColor = '');
    });

    document.querySelectorAll('.review-track').forEach(track => {
        track.innerHTML += track.innerHTML;
    });

    document.querySelectorAll('.gift-opts span').forEach(span => {
        span.addEventListener('click', () => {
            span.parentElement.querySelectorAll('span').forEach(s => s.classList.remove('active'));
            span.classList.add('active');
        });
    });
})();
