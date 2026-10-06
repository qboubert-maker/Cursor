// B&W reactive field + vibrant spinning universe, fast meteors & shooting stars
(function () {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let w = 0, h = 0, cx = 0, cy = 0;
    let mouseX = 0, mouseY = 0, drift = 0;
    let ripples = [], particles = [], stars = [], meteors = [], shooters = [], nebulaDots = [];
    let universeAngle = 0;

    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
        cx = w / 2; cy = h / 2;
        if (!particles.length) initAll();
    }

    function initAll() {
        particles = [];
        const n = Math.floor((w * h) / 9000);
        for (let i = 0; i < n; i++) {
            particles.push({
                x: Math.random() * w, y: Math.random() * h,
                ox: 0, oy: 0, r: Math.random() * 1.4 + 0.25,
                a: Math.random() * 0.3 + 0.06, phase: Math.random() * Math.PI * 2,
            });
        }
        particles.forEach(p => { p.ox = p.x; p.oy = p.y; });

        stars = [];
        for (let i = 0; i < 620; i++) {
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
        for (let i = 0; i < 120; i++) {
            nebulaDots.push({
                angle: Math.random() * Math.PI * 2,
                dist: Math.random() * 0.35,
                size: Math.random() * 3 + 1,
                hue: 220 + Math.random() * 80,
                alpha: 0.04 + Math.random() * 0.08
            });
        }
    }

    function spawnMeteor() {
        if (meteors.length >= 4) return;
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
        if (shooters.length >= 2) return;
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

    setInterval(() => { if (Math.random() < 0.45) spawnMeteor(); }, 900);
    setInterval(() => { if (Math.random() < 0.35) spawnShooter(); }, 1400);

    function addRipple(x, y, power) {
        ripples.push({ x, y, r: 0, life: 1, power });
        spawnShooter();
        spawnMeteor();
    }

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX; mouseY = e.clientY;
        drift = (mouseX / w - 0.5) * 0.8;
        const cursor = document.getElementById('cursor');
        if (cursor) {
            cursor.style.opacity = '1';
            cursor.style.left = mouseX + 'px';
            cursor.style.top = mouseY + 'px';
        }
    });
    document.addEventListener('mouseleave', () => {
        document.getElementById('cursor')?.style && (document.getElementById('cursor').style.opacity = '0');
    });
    document.addEventListener('click', (e) => {
        addRipple(e.clientX, e.clientY, 1.3);
        for (let i = 0; i < 3; i++) setTimeout(() => addRipple(e.clientX + (Math.random()-0.5)*60, e.clientY + (Math.random()-0.5)*60, 0.5), i * 50);
    });
    document.querySelectorAll('a, button, .card, .product-card, .stat-pill, .orbit-item, .platform-card, .review-card').forEach(el => {
        el.addEventListener('mouseenter', () => document.getElementById('cursor')?.classList.add('hover'));
        el.addEventListener('mouseleave', () => document.getElementById('cursor')?.classList.remove('hover'));
    });

    function drawNebula(spinCx, spinCy, t) {
        const maxR = Math.min(w, h) * 0.72;
        const g = ctx.createRadialGradient(spinCx, spinCy, 0, spinCx, spinCy, maxR * 0.55);
        g.addColorStop(0, 'rgba(120, 80, 255, 0.12)');
        g.addColorStop(0.25, 'rgba(60, 120, 255, 0.08)');
        g.addColorStop(0.55, 'rgba(20, 40, 80, 0.04)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(spinCx, spinCy, maxR * 0.55, 0, Math.PI * 2);
        ctx.fill();

        const core = ctx.createRadialGradient(spinCx, spinCy, 0, spinCx, spinCy, maxR * 0.18);
        core.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
        core.addColorStop(0.4, 'rgba(180, 200, 255, 0.06)');
        core.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(spinCx, spinCy, maxR * 0.18, 0, Math.PI * 2);
        ctx.fill();

        nebulaDots.forEach(n => {
            const a = n.angle + universeAngle * 0.4;
            const r = n.dist * maxR;
            const x = spinCx + Math.cos(a) * r;
            const y = spinCy + Math.sin(a) * r * 0.45;
            ctx.beginPath();
            ctx.arc(x, y, n.size, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${n.hue}, 70%, 65%, ${n.alpha})`;
            ctx.fill();
        });
    }

    function drawUniverse(t) {
        universeAngle += 0.0045 + Math.abs(drift) * 0.003;
        const spinCx = cx + drift * 40;
        const spinCy = cy + Math.sin(t * 0.4) * 30;
        const maxR = Math.min(w, h) * 0.72;

        drawNebula(spinCx, spinCy, t);

        for (let arm = 0; arm < 4; arm++) {
            ctx.beginPath();
            for (let i = 0; i <= 80; i++) {
                const p = i / 80;
                const a = universeAngle * 1.35 + arm * (Math.PI * 2 / 4) + p * Math.PI * 2.2;
                const r = p * maxR;
                const x = spinCx + Math.cos(a) * r;
                const y = spinCy + Math.sin(a) * r * 0.48;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            const armHue = 220 + arm * 25;
            ctx.strokeStyle = `hsla(${armHue}, 60%, 70%, ${0.04 + arm * 0.012})`;
            ctx.lineWidth = 2 + arm * 0.5;
            ctx.stroke();
        }

        for (const s of stars) {
            const a = s.angle + universeAngle * (1.15 + s.arm * 0.12);
            const spiral = s.dist * (0.5 + s.arm * 0.1);
            const radius = spiral * maxR;
            const x = spinCx + Math.cos(a) * radius;
            const y = spinCy + Math.sin(a) * radius * 0.48;
            const tw = 0.45 + Math.sin(t * 3 + s.angle * 12) * 0.55;
            ctx.beginPath();
            ctx.arc(x, y, s.size * (0.8 + tw * 0.4), 0, Math.PI * 2);
            if (s.hue > 0) {
                ctx.fillStyle = `hsla(${s.hue}, 55%, 75%, ${s.brightness * tw * 0.85})`;
            } else {
                const g = Math.floor(140 + s.brightness * 115 * tw);
                ctx.fillStyle = `rgba(${g},${g},${Math.min(255,g+20)},${s.brightness * tw * 0.8})`;
            }
            ctx.fill();
        }
    }

    function drawMeteors() {
        for (let i = meteors.length - 1; i >= 0; i--) {
            const m = meteors[i];
            m.x += m.vx; m.y += m.vy; m.life -= 0.006;
            if (m.y > h + 120 || m.life <= 0) { meteors.splice(i, 1); continue; }
            const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 4, m.y - m.vy * 4);
            g.addColorStop(0, `rgba(255,255,255,${m.life})`);
            g.addColorStop(0.2, `rgba(200,220,255,${m.life * 0.7})`);
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.beginPath();
            ctx.moveTo(m.x, m.y);
            ctx.lineTo(m.x - m.vx * 5, m.y - m.vy * 5);
            ctx.strokeStyle = g;
            ctx.lineWidth = m.width;
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.width, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${m.life})`;
            ctx.fill();
        }
    }

    function drawShooters() {
        for (let i = shooters.length - 1; i >= 0; i--) {
            const s = shooters[i];
            s.x += s.vx; s.y += s.vy; s.life -= 0.009;
            if (s.life <= 0 || s.x < -300 || s.x > w + 300) { shooters.splice(i, 1); continue; }
            const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 3, s.y - s.vy * 3);
            g.addColorStop(0, `rgba(255,255,255,${s.life})`);
            g.addColorStop(0.15, `rgba(180,210,255,${s.life * 0.8})`);
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s.x - s.vx * 4, s.y - s.vy * 4);
            ctx.strokeStyle = g;
            ctx.lineWidth = s.width;
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.width * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${s.life})`;
            ctx.fill();
        }
    }

    function tick() {
        const t = Date.now() * 0.001;
        ctx.fillStyle = '#010108';
        ctx.fillRect(0, 0, w, h);

        drawUniverse(t);
        drawMeteors();
        drawShooters();

        const g = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 320);
        g.addColorStop(0, `rgba(255,255,255,${0.06 + Math.abs(drift) * 0.04})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        particles.forEach(p => {
            const dx = mouseX - p.x, dy = mouseY - p.y, dist = Math.hypot(dx, dy);
            if (dist < 220 && dist > 2) { p.x += (dx/dist)*0.85; p.y += (dy/dist)*0.85; }
            else { p.x += (p.ox-p.x)*0.02; p.y += (p.oy-p.y)*0.02; }
            p.ox += Math.sin(t+p.phase)*0.14; p.oy += Math.cos(t*0.8+p.phase)*0.12;
            const gray = Math.floor(50 + Math.sin(t+p.phase)*60);
            const tw = 0.5 + Math.sin(t*2+p.phase)*0.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
            ctx.fillStyle = `rgba(${gray},${gray},${gray},${p.a*tw})`;
            ctx.fill();
        });

        ripples.forEach((rip, i) => {
            rip.r += 5 + rip.power * 2; rip.life -= 0.018;
            if (rip.life <= 0) { ripples.splice(i, 1); return; }
            ctx.beginPath(); ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI*2);
            ctx.strokeStyle = `rgba(255,255,255,${rip.life*0.45})`; ctx.lineWidth = 2; ctx.stroke();
        });

        requestAnimationFrame(tick);
    }

    window.addEventListener('resize', resize);
    resize();
    tick();
})();
