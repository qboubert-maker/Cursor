/* BlankDelay — live particle FX for splash / key / unlock transitions */
(function () {
    const FX = { canvas: null, ctx: null, particles: [], raf: 0, w: 0, h: 0, accent: '#ffffff' };

    function rand(a, b) { return a + Math.random() * (b - a); }

    function readAccent() {
        const c = getComputedStyle(document.body).getPropertyValue('--accent').trim();
        return c || '#ffffff';
    }

    function resize() {
        if (!FX.canvas) return;
        FX.w = FX.canvas.width = window.innerWidth;
        FX.h = FX.canvas.height = window.innerHeight;
    }

    function spawnBurst(x, y, count, speed) {
        FX.accent = readAccent();
        for (let i = 0; i < count; i++) {
            const ang = Math.random() * Math.PI * 2;
            const sp = rand(speed * 0.4, speed);
            FX.particles.push({
                x, y,
                vx: Math.cos(ang) * sp,
                vy: Math.sin(ang) * sp,
                life: rand(0.6, 1.4),
                max: rand(0.6, 1.4),
                r: rand(1.2, 3.2),
                kind: Math.random() > 0.65 ? 'streak' : 'dot'
            });
        }
    }

    function spawnAmbient(n) {
        FX.accent = readAccent();
        for (let i = 0; i < n; i++) {
            FX.particles.push({
                x: rand(0, FX.w),
                y: rand(0, FX.h),
                vx: rand(-0.25, 0.25),
                vy: rand(-0.45, -0.05),
                life: rand(2, 5),
                max: rand(2, 5),
                r: rand(0.6, 1.8),
                kind: 'ambient'
            });
        }
    }

    function tick() {
        if (!FX.ctx) return;
        FX.ctx.clearRect(0, 0, FX.w, FX.h);

        if (FX.particles.length < 48) spawnAmbient(3);

        for (let i = FX.particles.length - 1; i >= 0; i--) {
            const p = FX.particles[i];
            p.life -= 0.016;
            p.x += p.vx;
            p.y += p.vy;
            if (p.kind !== 'ambient') {
                p.vx *= 0.96;
                p.vy *= 0.96;
            }
            if (p.life <= 0 || p.x < -20 || p.x > FX.w + 20 || p.y < -20 || p.y > FX.h + 20) {
                FX.particles.splice(i, 1);
                continue;
            }
            const a = Math.max(0, p.life / p.max);
            FX.ctx.save();
            FX.ctx.globalAlpha = a * (p.kind === 'ambient' ? 0.35 : 0.85);
            if (p.kind === 'streak') {
                FX.ctx.strokeStyle = FX.accent;
                FX.ctx.lineWidth = 1.5;
                FX.ctx.beginPath();
                FX.ctx.moveTo(p.x, p.y);
                FX.ctx.lineTo(p.x - p.vx * 8, p.y - p.vy * 8);
                FX.ctx.stroke();
            } else {
                FX.ctx.fillStyle = FX.accent;
                FX.ctx.beginPath();
                FX.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                FX.ctx.fill();
            }
            FX.ctx.restore();
        }

        FX.raf = requestAnimationFrame(tick);
    }

    function mount(screenEl) {
        if (!screenEl || FX.canvas) return;
        const cv = document.createElement('canvas');
        cv.className = 'bd-splash-fx-canvas';
        screenEl.prepend(cv);
        FX.canvas = cv;
        FX.ctx = cv.getContext('2d');
        resize();
        window.addEventListener('resize', resize);
        spawnAmbient(40);
        tick();
    }

    function burstAt(el, count, speed) {
        if (!el || !FX.canvas) return;
        const r = el.getBoundingClientRect();
        spawnBurst(r.left + r.width / 2, r.top + r.height / 2, count || 36, speed || 4.5);
    }

    function burstCenter(count, speed) {
        spawnBurst(FX.w / 2, FX.h / 2, count || 48, speed || 5);
    }

    function destroy() {
        cancelAnimationFrame(FX.raf);
        FX.canvas?.remove();
        FX.canvas = null;
        FX.ctx = null;
        FX.particles = [];
    }

    window.BdSplashFx = { mount, burstAt, burstCenter, destroy, spawnAmbient: () => spawnAmbient(24) };
})();
