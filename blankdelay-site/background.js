// B&W reactive field + spinning universe. Same look, but the canvas
// no longer blocks taps and scrolling on phones or desktop browsers.
(function () {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

    let w = 0, h = 0, cx = 0, cy = 0;
    let mouseX = 0, mouseY = 0, drift = 0;
    let ripples = [], particles = [], stars = [], meteors = [], shooters = [], nebulaDots = [];
    let universeAngle = 0;
    let nebulaCanvas = null;
    let running = false;
    let lastDraw = 0;
    const phone = window.matchMedia('(pointer: coarse), (max-width: 820px)').matches;
    const saveData = navigator.connection && navigator.connection.saveData;
    const lite = phone || saveData;
    const frameGap = lite ? 32 : 16;

    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
        cx = w / 2; cy = h / 2;
        nebulaCanvas = null;
        if (!particles.length) initAll();
    }

    function initAll() {
        const area = w * h;
        const starCount = lite ? Math.min(200, Math.max(80, Math.round(area / 16000))) : Math.min(420, Math.max(180, Math.round(area / 7000)));
        const dustCount = lite ? Math.min(48, Math.max(18, Math.round(area / 22000))) : Math.min(110, Math.max(40, Math.round(area / 16000)));
        const dotCount = lite ? 40 : 80;

        particles = [];
        for (let i = 0; i < dustCount; i++) {
            particles.push({
                x: Math.random() * w, y: Math.random() * h,
                ox: 0, oy: 0, r: Math.random() * 1.4 + 0.25,
                a: Math.random() * 0.3 + 0.06, phase: Math.random() * Math.PI * 2,
            });
        }
        particles.forEach(p => { p.ox = p.x; p.oy = p.y; });

        stars = [];
        for (let i = 0; i < starCount; i++) {
            const dist = Math.random();
            stars.push({
                angle: Math.random() * Math.PI * 2,
                dist: 0.08 + dist * 0.92,
                size: Math.random() * 2.4 + 0.3,
                brightness: 0.25 + Math.random() * 0.75,
                arm: Math.floor(Math.random() * 4),
                hue: Math.random() < 0.35 ? 210 + Math.random() * 40 : Math.random() < 0.5 ? 280 + Math.random() * 30 : 0
            });
        }

        nebulaDots = [];
        for (let i = 0; i < dotCount; i++) {
            nebulaDots.push({
                angle: Math.random() * Math.PI * 2,
                dist: Math.random() * 0.35,
                size: Math.random() * 3 + 1,
                hue: 220 + Math.random() * 80,
                alpha: 0.04 + Math.random() * 0.08
            });
        }
    }

    function buildNebula() {
        const maxR = Math.min(w, h) * 0.72;
        const size = Math.ceil(maxR * 1.15);
        nebulaCanvas = document.createElement('canvas');
        nebulaCanvas.width = size;
        nebulaCanvas.height = size;
        const nctx = nebulaCanvas.getContext('2d');
        const nx = size / 2, ny = size / 2;
        const g = nctx.createRadialGradient(nx, ny, 0, nx, ny, maxR * 0.55);
        g.addColorStop(0, 'rgba(120, 80, 255, 0.12)');
        g.addColorStop(0.25, 'rgba(60, 120, 255, 0.08)');
        g.addColorStop(0.55, 'rgba(20, 40, 80, 0.04)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        nctx.fillStyle = g;
        nctx.beginPath();
        nctx.arc(nx, ny, maxR * 0.55, 0, Math.PI * 2);
        nctx.fill();
        const core = nctx.createRadialGradient(nx, ny, 0, nx, ny, maxR * 0.18);
        core.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
        core.addColorStop(0.4, 'rgba(180, 200, 255, 0.06)');
        core.addColorStop(1, 'rgba(0,0,0,0)');
        nctx.fillStyle = core;
        nctx.beginPath();
        nctx.arc(nx, ny, maxR * 0.18, 0, Math.PI * 2);
        nctx.fill();
    }

    function spawnMeteor() {
        if (meteors.length >= (lite ? 2 : 4)) return;
        meteors.push({
            x: Math.random() * w * 1.2 - w * 0.1,
            y: -40 - Math.random() * 120,
            vx: 2.5 + Math.random() * 4,
            vy: 6 + Math.random() * 8,
            len: 50 + Math.random() * 80,
            life: 1,
            width: 1.2 + Math.random() * 1
        });
    }

    function spawnShooter() {
        if (shooters.length >= (lite ? 1 : 2)) return;
        const fromLeft = Math.random() < 0.5;
        shooters.push({
            x: fromLeft ? -20 : w + 20,
            y: Math.random() * h * 0.55,
            vx: fromLeft ? 10 + Math.random() * 12 : -(10 + Math.random() * 12),
            vy: 3 + Math.random() * 6,
            len: 70 + Math.random() * 100,
            life: 1,
            width: 1.5 + Math.random() * 1
        });
    }

    setInterval(() => { if (!document.hidden && Math.random() < 0.45) spawnMeteor(); }, lite ? 1400 : 900);
    setInterval(() => { if (!document.hidden && Math.random() < 0.35) spawnShooter(); }, lite ? 2000 : 1400);

    function addRipple(x, y, power) {
        if (ripples.length > 2) return;
        ripples.push({ x, y, r: 0, life: 1, power });
    }

    let cursorQueued = false;
    if (!lite) {
        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX; mouseY = e.clientY;
            drift = (mouseX / Math.max(w, 1) - 0.5) * 0.8;
            if (cursorQueued) return;
            cursorQueued = true;
            requestAnimationFrame(() => {
                cursorQueued = false;
                const cursor = document.getElementById('cursor');
                if (!cursor) return;
                cursor.style.opacity = '1';
                cursor.style.left = mouseX + 'px';
                cursor.style.top = mouseY + 'px';
            });
        }, { passive: true });
        document.addEventListener('mouseleave', () => {
            const cursor = document.getElementById('cursor');
            if (cursor) cursor.style.opacity = '0';
        });
        document.querySelectorAll('a, button, .card, .product-card, .stat-pill, .orbit-item, .platform-card, .review-card').forEach(el => {
            el.addEventListener('mouseenter', () => document.getElementById('cursor')?.classList.add('hover'));
            el.addEventListener('mouseleave', () => document.getElementById('cursor')?.classList.remove('hover'));
        });
    }

    // Ripples stay on empty space. Clicks on links and buttons go straight through.
    document.addEventListener('click', (e) => {
        if (e.target.closest('a, button, input, select, textarea, label')) return;
        addRipple(e.clientX, e.clientY, 1.1);
    }, { passive: true });

    function drawNebula(spinCx, spinCy) {
        if (!nebulaCanvas) buildNebula();
        ctx.drawImage(nebulaCanvas, spinCx - nebulaCanvas.width / 2, spinCy - nebulaCanvas.height / 2);
        const maxR = Math.min(w, h) * 0.72;
        for (let i = 0; i < nebulaDots.length; i++) {
            const n = nebulaDots[i];
            const a = n.angle + universeAngle * 0.4;
            const r = n.dist * maxR;
            const x = spinCx + Math.cos(a) * r;
            const y = spinCy + Math.sin(a) * r * 0.45;
            ctx.fillStyle = `hsla(${n.hue}, 70%, 65%, ${n.alpha})`;
            ctx.fillRect(x, y, n.size, n.size);
        }
    }

    function drawUniverse(t) {
        universeAngle += 0.0045 + Math.abs(drift) * 0.003;
        const spinCx = cx + drift * 40;
        const spinCy = cy + Math.sin(t * 0.4) * 30;
        const maxR = Math.min(w, h) * 0.72;

        drawNebula(spinCx, spinCy);

        const armSteps = lite ? 28 : 48;
        for (let arm = 0; arm < 4; arm++) {
            ctx.beginPath();
            for (let i = 0; i <= armSteps; i++) {
                const p = i / armSteps;
                const a = universeAngle * 1.35 + arm * (Math.PI * 2 / 4) + p * Math.PI * 2.2;
                const r = p * maxR;
                const x = spinCx + Math.cos(a) * r;
                const y = spinCy + Math.sin(a) * r * 0.48;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            const armHue = 220 + arm * 25;
            ctx.strokeStyle = `hsla(${armHue}, 60%, 70%, ${0.04 + arm * 0.012})`;
            ctx.lineWidth = 2 + arm * 0.5;
            ctx.stroke();
        }

        for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            const a = s.angle + universeAngle * (1.15 + s.arm * 0.12);
            const spiral = s.dist * (0.5 + s.arm * 0.1);
            const radius = spiral * maxR;
            const x = spinCx + Math.cos(a) * radius;
            const y = spinCy + Math.sin(a) * radius * 0.48;
            const tw = 0.45 + Math.sin(t * 3 + s.angle * 12) * 0.55;
            const size = s.size * (0.8 + tw * 0.4);
            if (s.hue > 0) {
                ctx.fillStyle = `hsla(${s.hue}, 55%, 75%, ${s.brightness * tw * 0.85})`;
            } else {
                const g = Math.floor(140 + s.brightness * 115 * tw);
                ctx.fillStyle = `rgba(${g},${g},${Math.min(255, g + 20)},${s.brightness * tw * 0.8})`;
            }
            ctx.fillRect(x, y, size, size);
        }
    }

    function drawMeteors() {
        for (let i = meteors.length - 1; i >= 0; i--) {
            const m = meteors[i];
            m.x += m.vx; m.y += m.vy; m.life -= 0.006;
            if (m.y > h + 120 || m.life <= 0) { meteors.splice(i, 1); continue; }
            ctx.strokeStyle = `rgba(220,230,255,${m.life * 0.85})`;
            ctx.lineWidth = m.width;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(m.x, m.y);
            ctx.lineTo(m.x - m.vx * 5, m.y - m.vy * 5);
            ctx.stroke();
        }
    }

    function drawShooters() {
        for (let i = shooters.length - 1; i >= 0; i--) {
            const s = shooters[i];
            s.x += s.vx; s.y += s.vy; s.life -= 0.009;
            if (s.life <= 0 || s.x < -300 || s.x > w + 300) { shooters.splice(i, 1); continue; }
            ctx.strokeStyle = `rgba(220,230,255,${s.life})`;
            ctx.lineWidth = s.width;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s.x - s.vx * 4, s.y - s.vy * 4);
            ctx.stroke();
        }
    }

    function tick(now) {
        if (!running) return;
        if (document.hidden) { running = false; return; }
        if (now - lastDraw < frameGap) {
            requestAnimationFrame(tick);
            return;
        }
        lastDraw = now;
        const t = now * 0.001;
        ctx.fillStyle = '#010108';
        ctx.fillRect(0, 0, w, h);

        drawUniverse(t);
        drawMeteors();
        drawShooters();

        if (!lite) {
            ctx.fillStyle = `rgba(255,255,255,${0.035 + Math.abs(drift) * 0.02})`;
            ctx.beginPath();
            ctx.arc(mouseX, mouseY, 160, 0, Math.PI * 2);
            ctx.fill();
        }

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const dx = mouseX - p.x, dy = mouseY - p.y;
            const dist2 = dx * dx + dy * dy;
            if (!lite && dist2 < 48400 && dist2 > 4) {
                const dist = Math.sqrt(dist2);
                p.x += (dx / dist) * 0.85;
                p.y += (dy / dist) * 0.85;
            } else {
                p.x += (p.ox - p.x) * 0.02;
                p.y += (p.oy - p.y) * 0.02;
            }
            p.ox += Math.sin(t + p.phase) * 0.14;
            p.oy += Math.cos(t * 0.8 + p.phase) * 0.12;
            const gray = Math.floor(50 + Math.sin(t + p.phase) * 60);
            const tw = 0.5 + Math.sin(t * 2 + p.phase) * 0.5;
            ctx.fillStyle = `rgba(${gray},${gray},${gray},${p.a * tw})`;
            ctx.fillRect(p.x, p.y, p.r * 2, p.r * 2);
        }

        for (let i = ripples.length - 1; i >= 0; i--) {
            const rip = ripples[i];
            rip.r += 5 + rip.power * 2;
            rip.life -= 0.018;
            if (rip.life <= 0) { ripples.splice(i, 1); continue; }
            ctx.beginPath();
            ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255,255,255,${rip.life * 0.45})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        requestAnimationFrame(tick);
    }

    function start() {
        if (running || document.hidden) return;
        running = true;
        requestAnimationFrame(tick);
    }

    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
    window.addEventListener('resize', resize);
    resize();
    start();
})();
