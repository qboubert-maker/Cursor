/* BlankDelay — Pixel Gun 3D-inspired voxel FPS aim trainer */
const BLANK_GUNS = {
    assault: { id: 'assault', name: 'Assault Rifle', reloadMs: 130, spread: 0.018, pellets: 1, dmg: 1, mag: 30, color: '#8a9098', accent: '#ff4444', hot: '#c44' },
    smg:     { id: 'smg', name: 'SMG', reloadMs: 75, spread: 0.038, pellets: 1, dmg: 1, mag: 40, color: '#5a6a7a', accent: '#44ccff', hot: '#28a' },
    sniper:  { id: 'sniper', name: 'Sniper', reloadMs: 900, spread: 0.004, pellets: 1, dmg: 1, mag: 5, color: '#4a4a52', accent: '#ffcc44', hot: '#a80' },
    pistol:  { id: 'pistol', name: 'Pistol', reloadMs: 220, spread: 0.022, pellets: 1, dmg: 1, mag: 16, color: '#e8eaee', accent: '#44aaff', hot: '#28f' }
};

const PG_SKINS = [
    { skin: '#f0c8a0', shirt: '#e83030', pants: '#2a2a3a', helm: '#d4a020' },
    { skin: '#d4a574', shirt: '#3080ff', pants: '#1a1a28', helm: '#888' },
    { skin: '#c68642', shirt: '#30cc55', pants: '#222230', helm: '#c44' },
    { skin: '#f0c8a0', shirt: '#ff9920', pants: '#333340', helm: '#fff' }
];

class BlankTrainer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.mode = options.mode || 'aim';
        this.style = options.style || 'pixel';
        this.accent = options.accent || '#ff4444';
        this.onStats = options.onStats || (() => {});
        this.onStateChange = options.onStateChange || (() => {});
        this.onLoadProgress = options.onLoadProgress || (() => {});

        this.state = 'idle';
        this._raf = 0;
        this.locked = false;
        this.menuOpen = false;
        this.score = 0; this.hits = 0; this.shots = 0; this.streak = 0; this.bestStreak = 0;
        this.health = 10; this.ammo = 30; this.reserve = 120;
        this.matchTime = 180;

        this.yaw = 0; this.pitch = 0;
        this.fov = 1.15;
        this.sensX = 0.0024; this.sensY = 0.0024;
        this.adsMult = 0.35;
        this.adsHeld = false;

        this.gun = BLANK_GUNS.assault;
        this.spread = this.gun.spread;
        this.reloadMs = this.gun.reloadMs;
        this.pellets = 1;
        this.reloading = false;

        this.moveSettings = { speed: 1, direction: 'mixed', pattern: 'strafe', practiceMode: 'tracking' };
        this.targetCount = 6;
        this.targets = [];
        this.world = [];
        this.clouds = [];
        this.lastShot = 0;
        this.keys = {};
        this.fx = []; this.tracers = []; this.particles = [];
        this.muzzleFlash = 0; this.gunRecoil = 0; this.gunBob = 0;
        this.time = 0;
        this.audioCtx = null;

        this._buildWorld();
        this._bindKeys();
        this._resize();
        this._ro = new ResizeObserver(() => this._resize());
        if (canvas.parentElement) this._ro.observe(canvas.parentElement);
        window.addEventListener('resize', () => this._resize());
    }

    _buildWorld() {
        this.world = [];
        for (let gx = -6; gx <= 6; gx++) {
            for (let gz = 0; gz <= 14; gz++) {
                const dist = Math.hypot(gx * 0.8, gz - 4);
                if (dist > 8 && Math.random() > 0.35) continue;
                const grass = gz < 10;
                this.world.push({
                    x: gx * 2.2, z: gz * 2.2 + 6,
                    h: grass ? 1 : (1 + Math.floor(Math.random() * 2)),
                    top: grass ? '#5cb85c' : '#6a7a5a',
                    side: grass ? '#4a9a4a' : '#5a6a4a',
                    front: grass ? '#3d8a3d' : '#4a5a3a'
                });
            }
        }
        for (let i = 0; i < 8; i++) {
            const tx = (Math.random() - 0.5) * 20;
            const tz = 14 + Math.random() * 18;
            const th = 2 + Math.floor(Math.random() * 3);
            for (let j = 0; j < th; j++) {
                this.world.push({ x: tx, z: tz, h: 1, yOff: j, top: '#6b4a2a', side: '#5a3a1a', front: '#4a2a10', tree: true });
            }
            this.world.push({ x: tx, z: tz, h: 1.8, yOff: th, top: '#2d8a2d', side: '#228022', front: '#1a701a', tree: true });
            this.world.push({ x: tx + 0.9, z: tz, h: 1.4, yOff: th, top: '#38a038', side: '#2a902a', front: '#208020', tree: true });
            this.world.push({ x: tx - 0.9, z: tz, h: 1.4, yOff: th, top: '#38a038', side: '#2a902a', front: '#208020', tree: true });
        }
        for (let i = 0; i < 5; i++) {
            const ix = (i - 2) * 8;
            const iz = 22 + (i % 2) * 4;
            for (let dx = -2; dx <= 2; dx++) {
                for (let dz = 0; dz <= 2; dz++) {
                    if (Math.abs(dx) === 2 && dz === 1 && Math.random() > 0.5) continue;
                    this.world.push({
                        x: ix + dx * 2, z: iz + dz * 2, h: 1,
                        top: '#6bc96b', side: '#4aaa4a', front: '#3a9a3a', island: true
                    });
                }
            }
        }
        this.clouds = [];
        for (let i = 0; i < 12; i++) {
            this.clouds.push({
                x: (Math.random() - 0.5) * 40,
                y: 8 + Math.random() * 6,
                z: 30 + Math.random() * 40,
                w: 2 + Math.random() * 3,
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    _resize() {
        const parent = this.canvas.parentElement;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.w = Math.max(640, Math.floor(rect.width));
        this.h = Math.max(480, Math.floor(rect.height));
        this.canvas.width = Math.floor(this.w * dpr);
        this.canvas.height = Math.floor(this.h * dpr);
        this.canvas.style.width = this.w + 'px';
        this.canvas.style.height = this.h + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.dpr = dpr;
    }

    _bindKeys() {
        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            if (this.state === 'playing') {
                if (e.code === 'Escape' || e.code === 'Tab') {
                    e.preventDefault();
                    this.openMenu();
                }
                if (e.code === 'KeyR') {
                    if (!this.reloading) this._spawnTargets();
                }
            }
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.adsHeld = true;
        });
        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.adsHeld = false;
        });
        this.canvas.addEventListener('click', () => {
            if (this.state === 'playing' && !this.menuOpen) this.canvas.requestPointerLock();
        });
        document.addEventListener('pointerlockchange', () => {
            this.locked = document.pointerLockElement === this.canvas;
        });
        document.addEventListener('mousemove', e => {
            if (!this.locked || this.state !== 'playing' || this.menuOpen) return;
            const mult = this.adsHeld ? this.adsMult : 1;
            this.yaw -= e.movementX * this.sensX * mult;
            this.pitch += e.movementY * this.sensY * mult;
            this.pitch = Math.max(-0.85, Math.min(0.85, this.pitch));
        });
        this.canvas.addEventListener('mousedown', e => {
            if (this.state !== 'playing' || this.menuOpen || e.button !== 0) return;
            if (!this.locked) { this.canvas.requestPointerLock(); return; }
            this._shoot();
        });
    }

    _initAudio() {
        if (!this.audioCtx) try { this.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
    }

    _playGunshot() {
        this._initAudio();
        if (!this.audioCtx) return;
        const ctx = this.audioCtx;
        if (ctx.state === 'suspended') ctx.resume();
        const len = ctx.sampleRate * (this.gun.id === 'sniper' ? 0.16 : 0.08);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain();
        g.gain.value = this.gun.id === 'sniper' ? 0.75 : 0.5;
        const f = ctx.createBiquadFilter();
        f.frequency.value = this.gun.id === 'smg' ? 3200 : 2000;
        src.connect(f); f.connect(g); g.connect(ctx.destination);
        src.start();
    }

    _playHit() {
        this._initAudio();
        if (!this.audioCtx) return;
        const o = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        o.frequency.value = 880;
        g.gain.value = 0.12;
        g.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.1);
        o.connect(g); g.connect(this.audioCtx.destination);
        o.start(); o.stop(this.audioCtx.currentTime + 0.1);
    }

    setGun(id) {
        this.gun = BLANK_GUNS[id] || BLANK_GUNS.assault;
        this.spread = this.gun.spread;
        this.reloadMs = this.gun.reloadMs;
        this.ammo = this.gun.mag;
    }

    setMoveSettings(s) {
        Object.assign(this.moveSettings, s);
        if (this.targets.length) this._spawnTargets();
    }

    setSensitivityXY(x, y) { this.sensX = x; this.sensY = y; }

    async loadAndStart() {
        this.state = 'loading';
        this.onStateChange('loading');
        this._resize();
        this.score = 0; this.hits = 0; this.shots = 0; this.streak = 0;
        this.health = 10; this.matchTime = 180;
        this.yaw = 0; this.pitch = -0.05;
        this.setGun(this.gun.id);
        for (let i = 0; i <= 100; i += 5) {
            this.onLoadProgress(i);
            await new Promise(r => setTimeout(r, 35));
        }
        this.onLoadProgress(100);
        this._spawnTargets();
        this._emitStats();
        this.state = 'playing';
        this.onStateChange('playing');
        this._startLoop();
        setTimeout(() => {
            if (this.state === 'playing' && !this.locked) this.canvas.requestPointerLock();
        }, 400);
    }

    _startLoop() {
        if (this._raf) cancelAnimationFrame(this._raf);
        const tick = () => {
            this._raf = requestAnimationFrame(tick);
            if (this.state === 'playing') {
                this.time += 0.016;
                this.matchTime = Math.max(0, this.matchTime - 0.016);
                this.gunBob += 0.16;
                this._update();
                this._draw();
            }
        };
        tick();
    }

    openMenu() {
        this.menuOpen = true;
        this.state = 'menu';
        if (document.pointerLockElement === this.canvas) document.exitPointerLock();
        this.onStateChange('menu');
    }

    resumeFromMenu() {
        this.menuOpen = false;
        this.state = 'playing';
        this.onStateChange('playing');
        setTimeout(() => this.canvas.requestPointerLock(), 200);
    }

    stop() {
        this.state = 'idle';
        this.menuOpen = false;
        if (document.pointerLockElement === this.canvas) document.exitPointerLock();
        this.onStateChange('stopped');
    }

    _spawnTargets() {
        const mode = this.moveSettings.practiceMode;
        const count = mode === 'reaction' ? 2 : mode === 'boxfight' ? 4 : this.targetCount;
        this.targets = [];
        for (let i = 0; i < count; i++) {
            const dist = mode === 'boxfight' ? 10 + Math.random() * 8 : 14 + Math.random() * 12;
            const angle = (Math.random() - 0.5) * (mode === 'flick' ? 1.8 : 1.0);
            const ox = Math.sin(angle) * dist * 0.85;
            const oz = Math.cos(angle) * dist * 0.5 + 16;
            this.targets.push({
                x: ox, z: oz, originX: ox, originZ: oz,
                y: 1.2, baseY: 1.2,
                r: 0.55, hit: false, phase: Math.random() * Math.PI * 2,
                orbitR: 1.5 + Math.random() * 2, strafeAmp: 0.04,
                speed: 0.8 + Math.random() * 0.7, walk: Math.random() * 6,
                skinIdx: i % 4, peek: mode === 'boxfight' ? Math.random() > 0.4 : false,
                visible: mode !== 'reaction' || Math.random() > 0.3,
                reactTimer: mode === 'reaction' ? 50 + Math.random() * 70 : 0,
                hitFlash: 0
            });
        }
    }

    _shoot() {
        if (this.reloading) return;
        const now = Date.now();
        if (now - this.lastShot < this.reloadMs) return;
        if (this.ammo <= 0) {
            this._reload();
            return;
        }
        this.lastShot = now;
        this.shots++;
        this.ammo--;
        this.muzzleFlash = this.gun.id === 'sniper' ? 10 : 6;
        this.gunRecoil = this.gun.id === 'sniper' ? 22 : 12;
        this._playGunshot();

        const spread = this.adsHeld ? this.spread * 0.45 : this.spread;
        let anyHit = false;
        for (let p = 0; p < this.pellets; p++) {
            const sy = (Math.random() - 0.5) * spread;
            const sp = (Math.random() - 0.5) * spread;
            const ay = this.yaw + sy, ap = this.pitch + sp;
            this.tracers.push({ life: 1, ay, ap });
            this.targets.forEach(t => {
                if (t.hit || !t.visible) return;
                if (this._rayHit(t, ay, ap)) {
                    t.hit = true; t.hitFlash = 1; anyHit = true;
                    const dist = Math.hypot(t.x, t.z - 8);
                    const pts = Math.round(350 - dist * 4);
                    this.score += Math.max(75, pts);
                    this.hits++; this.streak++;
                    this.bestStreak = Math.max(this.bestStreak, this.streak);
                    this.fx.push({ type: 'hit', life: 1, pts: Math.max(75, pts), ox: (Math.random() - 0.5) * 40 });
                    this._spawnParticles(t.x, t.y + 1.5, t.z, '#ff4444');
                    this._playHit();
                }
            });
        }
        if (!anyHit) this.streak = 0;
        this._emitStats();
        if (this.targets.every(t => t.hit || !t.visible)) setTimeout(() => this._spawnTargets(), 500);
        if (this.ammo <= 0) this._reload();
    }

    _reload() {
        if (this.reloading) return;
        this.reloading = true;
        setTimeout(() => {
            this.ammo = this.gun.mag;
            this.reloading = false;
        }, this.gun.id === 'sniper' ? 1200 : 700);
    }

    _spawnParticles(x, y, z, color) {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x, y, z, vx: (Math.random() - 0.5) * 0.3, vy: Math.random() * 0.2,
                vz: (Math.random() - 0.5) * 0.3, life: 1, color
            });
        }
    }

    _rayHit(t, ay, ap) {
        const dx = t.x, dz = t.z - 8;
        const dist = Math.hypot(dx, dz);
        const tx = Math.atan2(dx, dz);
        const ty = Math.atan2(t.y + t.r, dist);
        let da = Math.abs(tx - ay);
        if (da > Math.PI) da = Math.PI * 2 - da;
        const dp = Math.abs(ty - ap);
        const hr = (t.r * 1.8) / Math.max(dist * 0.12, 1.5);
        return da < hr && dp < hr * 1.4;
    }

    _emitStats() {
        const acc = this.shots ? Math.round((this.hits / this.shots) * 100) : 0;
        this.onStats({
            score: this.score, hits: this.hits, shots: this.shots,
            accuracy: acc, streak: this.streak, best: this.bestStreak,
            ammo: this.ammo, mag: this.gun.mag, health: this.health,
            time: Math.ceil(this.matchTime)
        });
    }

    _update() {
        const ms = this.moveSettings;
        const spd = ms.speed;
        this.targets.forEach(t => {
            if (t.hit) { t.hitFlash = Math.max(0, t.hitFlash - 0.08); return; }
            if (ms.practiceMode === 'reaction') {
                t.reactTimer--;
                t.visible = t.reactTimer > 0 && t.reactTimer < 45;
                if (t.reactTimer <= 0) { t.reactTimer = 60 + Math.random() * 50; t.visible = false; }
                return;
            }
            if (t.peek) t.visible = Math.sin(t.phase * 2.2) > -0.1;
            t.phase += 0.028 * t.speed * spd;
            t.walk += 0.18 * spd;
            const walk = Math.sin(t.walk) * 0.12;
            switch (ms.pattern) {
                case 'zigzag': t.x += Math.sign(Math.sin(t.phase * 3)) * 0.06 * spd; t.z -= 0.025 * spd; break;
                case 'jump': t.y = t.baseY + Math.abs(Math.sin(t.phase * 2)) * 1.2 * spd; break;
                case 'sway': t.x = t.originX + Math.sin(t.phase) * 2 * spd; t.y = t.baseY + Math.sin(t.phase * 2) * 0.5; break;
                case 'erratic': t.x += (Math.random() - 0.5) * 0.09 * spd; t.z += (Math.random() - 0.5) * 0.06 * spd; break;
                default: t.x = t.originX + Math.sin(t.phase * 1.5) * t.strafeAmp * 8 * spd + walk; t.y = t.baseY + Math.sin(t.phase) * 0.15;
            }
            switch (ms.direction) {
                case 'left': t.x -= 0.05 * spd; break;
                case 'right': t.x += 0.05 * spd; break;
                case 'forward': t.z -= 0.05 * spd; break;
                case 'circle': t.x = t.originX + Math.sin(t.phase) * t.orbitR; t.z = t.originZ + Math.cos(t.phase) * t.orbitR; break;
                case 'rush': t.z -= 0.07 * spd; break;
            }
            if (t.z < 10) t.z = 10;
        });
        if (this.muzzleFlash > 0) this.muzzleFlash--;
        if (this.gunRecoil > 0) this.gunRecoil *= 0.72;
        this.tracers = this.tracers.filter(t => (t.life -= 0.12) > 0);
        this.fx = this.fx.filter(f => (f.life -= 0.05) > 0);
        this.particles = this.particles.filter(p => {
            p.x += p.vx; p.y += p.vy; p.z += p.vz; p.vy -= 0.01;
            p.life -= 0.04;
            return p.life > 0;
        });
    }

    _project(x, y, z) {
        const px = x, pz = z - 8;
        const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
        const rx = px * cy + pz * sy;
        const rz = -px * sy + pz * cy;
        if (rz <= 0.5) return null;
        const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
        const ry = y * cp - rz * sp;
        const fz = y * sp + rz * cp;
        if (fz <= 0.35) return null;
        const sc = (this.h / fz) * this.fov * 0.55;
        return { x: this.w / 2 + rx * sc, y: this.h / 2 - ry * sc, sc, fz, depth: fz };
    }

    _drawVoxel(cx, cy, cz, w, h, d, colors, outline = true) {
        const hw = w / 2, hd = d / 2;
        const corners = [
            [cx - hw, cy, cz - hd], [cx + hw, cy, cz - hd],
            [cx + hw, cy, cz + hd], [cx - hw, cy, cz + hd],
            [cx - hw, cy + h, cz - hd], [cx + hw, cy + h, cz - hd],
            [cx + hw, cy + h, cz + hd], [cx - hw, cy + h, cz + hd]
        ];
        const proj = corners.map(c => this._project(c[0], c[1], c[2]));
        if (proj.some(p => !p)) {
            const base = this._project(cx, cy + h / 2, cz);
            if (!base || base.sc < 0.5) return null;
            const sw = Math.max(8, w * base.sc * 42);
            const sh = Math.max(12, h * base.sc * 42);
            const px = base.x - sw / 2, py = base.y - sh / 2;
            this.ctx.fillStyle = colors.top || colors;
            this.ctx.fillRect(px, py, sw, sh);
            if (outline) {
                this.ctx.strokeStyle = '#111';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(px, py, sw, sh);
            }
            return { x: base.x, y: base.y, size: sw };
        }

        const faces = [
            { idx: [4, 5, 6, 7], color: colors.top },
            { idx: [0, 1, 5, 4], color: colors.side },
            { idx: [1, 2, 6, 5], color: colors.front },
            { idx: [2, 3, 7, 6], color: colors.side },
            { idx: [3, 0, 4, 7], color: colors.front }
        ];
        const faceDepths = faces.map(f => {
            const avgZ = f.idx.reduce((s, i) => s + (proj[i]?.depth || 0), 0) / 4;
            return { ...f, depth: avgZ };
        }).sort((a, b) => a.depth - b.depth);

        let center = null;
        faceDepths.forEach(f => {
            const pts = f.idx.map(i => proj[i]);
            if (pts.some(p => !p)) return;
            this.ctx.fillStyle = f.color;
            this.ctx.beginPath();
            this.ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < 4; i++) this.ctx.lineTo(pts[i].x, pts[i].y);
            this.ctx.closePath();
            this.ctx.fill();
            if (outline) {
                this.ctx.strokeStyle = '#1a1a1a';
                this.ctx.lineWidth = Math.max(1.5, 2.5 / (proj[0].sc * 0.02 + 1));
                this.ctx.stroke();
            }
        });
        const top = proj[4];
        if (top) center = { x: top.x, y: top.y, size: w * top.sc * 30 };
        return center;
    }

    _drawSky() {
        const ctx = this.ctx;
        const g = ctx.createLinearGradient(0, 0, 0, this.h * 0.65);
        g.addColorStop(0, '#4ab8f5');
        g.addColorStop(0.5, '#6ecfff');
        g.addColorStop(1, '#a8e4ff');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.w, this.h);

        this.clouds.forEach(c => {
            c.phase += 0.002;
            const p = this._project(c.x + Math.sin(c.phase) * 2, c.y, c.z);
            if (!p) return;
            const s = c.w * p.sc * 35;
            ctx.fillStyle = 'rgba(255,255,255,0.92)';
            ctx.fillRect(p.x - s, p.y - s * 0.3, s * 2, s * 0.6);
            ctx.fillRect(p.x - s * 0.5, p.y - s * 0.7, s, s * 0.5);
            ctx.fillRect(p.x + s * 0.2, p.y - s * 0.5, s * 0.8, s * 0.4);
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(p.x - s, p.y - s * 0.3, s * 2, s * 0.6);
        });
    }

    _drawArena() {
        this._drawSky();
        const sorted = [...this.world].sort((a, b) => {
            const da = (a.x * a.x + (a.z - 8) * (a.z - 8));
            const db = (b.x * b.x + (b.z - 8) * (b.z - 8));
            return db - da;
        });
        sorted.forEach(b => {
            const y = (b.yOff || 0) * 1.05;
            this._drawVoxel(b.x, y, b.z, 2, b.h * 1.05, 2, { top: b.top, side: b.side, front: b.front });
        });
    }

    _drawHuman(t) {
        if (!t.visible && !t.hit) return;
        const pal = PG_SKINS[t.skinIdx % 4];
        const walk = Math.sin(t.walk) * 0.18;
        const bx = t.x, by = t.y, bz = t.z;

        if (t.hit && t.hitFlash <= 0.05) {
            const p = this._project(bx, by + 1, bz);
            if (p) {
                this.ctx.globalAlpha = 0.25;
                this._drawVoxel(bx, by, bz, 1.2, 2, 0.8, { top: '#fff', side: '#ddd', front: '#eee' });
                this.ctx.globalAlpha = 1;
            }
            return;
        }

        const flash = t.hit ? Math.min(1, t.hitFlash) : 0;
        const shirt = flash > 0.3 ? '#fff' : pal.shirt;
        const pants = pal.pants;

        this._drawVoxel(bx, by, bz, 0.9, 1.1, 0.55, { top: shirt, side: this._shade(shirt, -30), front: this._shade(shirt, -15) });
        this._drawVoxel(bx, by + 1.1, bz, 0.65, 0.55, 0.5, { top: pal.skin, side: this._shade(pal.skin, -25), front: pal.skin });
        this._drawVoxel(bx, by + 1.65, bz, 0.7, 0.35, 0.55, { top: pal.helm, side: this._shade(pal.helm, -20), front: pal.helm });
        this._drawVoxel(bx - 0.55 + walk, by + 0.2, bz, 0.35, 0.9, 0.35, { top: shirt, side: this._shade(shirt, -35), front: this._shade(shirt, -20) });
        this._drawVoxel(bx + 0.55 - walk, by + 0.2, bz, 0.35, 0.9, 0.35, { top: shirt, side: this._shade(shirt, -35), front: this._shade(shirt, -20) });
        this._drawVoxel(bx - 0.22 + walk * 0.4, by - 0.5, bz + 0.1, 0.3, 0.55, 0.3, { top: pants, side: '#1a1a28', front: '#222230' });
        this._drawVoxel(bx + 0.22 - walk * 0.4, by - 0.5, bz - 0.1, 0.3, 0.55, 0.3, { top: pants, side: '#1a1a28', front: '#222230' });

        const head = this._project(bx, by + 1.9, bz);
        if (head && !t.hit) {
            this.ctx.strokeStyle = '#ff2222';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(head.x - 14, head.y - 16, 28, 28);
        }
    }

    _shade(hex, amt) {
        const n = parseInt(hex.replace('#', ''), 16);
        let r = (n >> 16) + amt, g = ((n >> 8) & 0xff) + amt, b = (n & 0xff) + amt;
        r = Math.max(0, Math.min(255, r));
        g = Math.max(0, Math.min(255, g));
        b = Math.max(0, Math.min(255, b));
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    _drawParticles() {
        this.particles.forEach(p => {
            const pr = this._project(p.x, p.y, p.z);
            if (!pr) return;
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            const s = 4 + p.life * 6;
            this.ctx.fillRect(pr.x - s / 2, pr.y - s / 2, s, s);
            this.ctx.globalAlpha = 1;
        });
    }

    _drawGun() {
        const ctx = this.ctx;
        const bob = Math.sin(this.gunBob) * 4;
        const recoil = this.gunRecoil;
        const cx = this.w * 0.78;
        const cy = this.h - 70 + bob + recoil;
        const g = this.gun;

        ctx.save();
        ctx.translate(cx, cy);

        const outline = () => {
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 2.5;
        };

        if (g.id === 'pistol') {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(-18, 8, 22, 38);
            outline(); ctx.strokeRect(-18, 8, 22, 38);
            ctx.fillStyle = g.color;
            ctx.fillRect(-55, -8, 42, 22);
            outline(); ctx.strokeRect(-55, -8, 42, 22);
            ctx.fillStyle = '#222';
            ctx.fillRect(-58, -12, 20, 28);
            outline(); ctx.strokeRect(-58, -12, 20, 28);
            ctx.fillStyle = g.accent;
            ctx.fillRect(-30, -2, 18, 10);
            ctx.fillStyle = '#44ccff';
            ctx.fillRect(-52, -6, 10, 10);
            outline(); ctx.strokeRect(-52, -6, 10, 10);
            ctx.fillStyle = '#333';
            ctx.fillRect(-12, 2, 8, 18);
            if (this.muzzleFlash > 0) this._drawMuzzle(-58, -4, 16);
        } else if (g.id === 'sniper') {
            ctx.fillStyle = g.color;
            ctx.fillRect(-130, -14, 120, 20);
            outline(); ctx.strokeRect(-130, -14, 120, 20);
            ctx.fillStyle = '#111';
            ctx.fillRect(-145, -18, 32, 30);
            outline(); ctx.strokeRect(-145, -18, 32, 30);
            ctx.fillStyle = g.accent;
            ctx.fillRect(-60, -6, 55, 8);
            ctx.fillStyle = '#333';
            ctx.fillRect(0, -4, 90, 8);
            ctx.fillStyle = '#222';
            ctx.fillRect(-20, 6, 24, 32);
            outline(); ctx.strokeRect(-20, 6, 24, 32);
            if (this.muzzleFlash > 0) this._drawMuzzle(-148, -8, 20);
        } else if (g.id === 'smg') {
            ctx.fillStyle = g.color;
            ctx.fillRect(-75, -12, 70, 24);
            outline(); ctx.strokeRect(-75, -12, 70, 24);
            ctx.fillStyle = '#111';
            ctx.fillRect(-82, -16, 26, 32);
            outline(); ctx.strokeRect(-82, -16, 26, 32);
            ctx.fillStyle = g.accent;
            ctx.fillRect(-40, -2, 30, 12);
            ctx.fillStyle = '#222';
            ctx.fillRect(-15, 4, 20, 36);
            outline(); ctx.strokeRect(-15, 4, 20, 36);
            if (this.muzzleFlash > 0) this._drawMuzzle(-85, -6, 14);
        } else {
            ctx.fillStyle = g.color;
            ctx.fillRect(-95, -14, 80, 22);
            outline(); ctx.strokeRect(-95, -14, 80, 22);
            ctx.fillStyle = '#111';
            ctx.fillRect(-102, -18, 28, 30);
            outline(); ctx.strokeRect(-102, -18, 28, 30);
            ctx.fillStyle = g.accent;
            ctx.fillRect(-50, -4, 38, 10);
            ctx.fillStyle = '#333';
            ctx.fillRect(0, -16, 65, 14);
            outline(); ctx.strokeRect(0, -16, 65, 14);
            ctx.fillStyle = '#222';
            ctx.fillRect(-12, 2, 22, 38);
            outline(); ctx.strokeRect(-12, 2, 22, 38);
            if (this.muzzleFlash > 0) this._drawMuzzle(-105, -6, 16);
        }

        if (this.reloading) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(-150, -30, 160, 80);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('RELOAD', -60, 10);
        }

        ctx.restore();
    }

    _drawMuzzle(x, y, r) {
        const fa = this.muzzleFlash / 8;
        this.ctx.fillStyle = `rgba(255,240,100,${fa})`;
        this.ctx.beginPath();
        this.ctx.arc(x, y, r + fa * 12, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = `rgba(255,255,255,${fa * 0.8})`;
        this.ctx.beginPath();
        this.ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
        this.ctx.fill();
    }

    _drawCrosshair() {
        const cx = this.w / 2, cy = this.h / 2;
        const gap = this.adsHeld ? 3 : 6;
        this.ctx.strokeStyle = this.adsHeld ? '#ff3333' : '#fff';
        this.ctx.lineWidth = 2.5;
        const arms = [
            [cx - gap - 14, cy, cx - gap, cy],
            [cx + gap, cy, cx + gap + 14, cy],
            [cx, cy - gap - 14, cx, cy - gap],
            [cx, cy + gap, cx, cy + gap + 14]
        ];
        arms.forEach(l => {
            this.ctx.beginPath();
            this.ctx.moveTo(l[0], l[1]);
            this.ctx.lineTo(l[2], l[3]);
            this.ctx.stroke();
        });
        this.ctx.fillStyle = '#ff3333';
        this.ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
        if (this.adsHeld) {
            this.ctx.strokeStyle = 'rgba(255,50,50,0.35)';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(cx - 55, cy - 40, 110, 80);
        }
    }

    _drawTracers() {
        const gx = this.w * 0.78 - 60;
        const gy = this.h - 80;
        this.tracers.forEach(tr => {
            const len = 180 * tr.life;
            const ex = this.w / 2 + Math.sin(tr.ay) * len;
            const ey = this.h / 2 - Math.tan(tr.ap) * len * 0.4;
            this.ctx.strokeStyle = `rgba(255,230,80,${tr.life * 0.9})`;
            this.ctx.lineWidth = 2.5;
            this.ctx.beginPath();
            this.ctx.moveTo(gx, gy);
            this.ctx.lineTo(ex, ey);
            this.ctx.stroke();
        });
    }

    _drawHud() {
        const ctx = this.ctx;
        const pad = 14;

        for (let i = 0; i < 10; i++) {
            const hx = pad + i * 22;
            const hy = pad + 4;
            ctx.fillStyle = i < this.health ? '#e83030' : '#3a2020';
            ctx.fillRect(hx, hy, 16, 14);
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(hx, hy, 16, 14);
            ctx.fillStyle = i < this.health ? '#ff5555' : '#2a1515';
            ctx.fillRect(hx + 3, hy + 3, 10, 8);
        }

        for (let i = 0; i < 5; i++) {
            const sx = pad + i * 18;
            const sy = pad + 26;
            ctx.fillStyle = i < 5 ? '#d4a020' : '#3a3020';
            ctx.beginPath();
            ctx.moveTo(sx + 7, sy);
            ctx.lineTo(sx + 14, sy + 12);
            ctx.lineTo(sx, sy + 12);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#111';
            ctx.stroke();
        }

        const mins = Math.floor(this.matchTime / 60);
        const secs = Math.ceil(this.matchTime % 60);
        const timeStr = mins + ':' + String(secs).padStart(2, '0');
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.w / 2 - 50, pad, 100, 28);
        ctx.fillStyle = '#fff';
        ctx.fillText('⏳ ' + timeStr, this.w / 2, pad + 19);

        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.w - pad - 90, pad, 90, 28);
        ctx.fillStyle = '#ffcc44';
        ctx.fillText('★ ' + this.score, this.w - pad - 8, pad + 19);

        const guns = ['assault', 'smg', 'sniper', 'pistol'];
        const barW = 58;
        const totalW = guns.length * (barW + 6);
        const startX = (this.w - totalW) / 2;
        const barY = this.h - pad - 52;

        guns.forEach((id, i) => {
            const gx = startX + i * (barW + 6);
            const active = this.gun.id === id;
            ctx.fillStyle = active ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.55)';
            ctx.fillRect(gx, barY, barW, 48);
            ctx.strokeStyle = active ? '#ff4444' : '#333';
            ctx.lineWidth = active ? 3 : 1.5;
            ctx.strokeRect(gx, barY, barW, 48);

            const gc = BLANK_GUNS[id];
            ctx.fillStyle = active ? gc.accent : '#888';
            ctx.fillRect(gx + 10, barY + 10, barW - 20, 10);
            ctx.fillStyle = active ? '#222' : '#444';
            ctx.fillRect(gx + 14, barY + 24, barW - 28, 14);

            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = active ? '#111' : '#aaa';
            ctx.fillText(gc.name.split(' ')[0].slice(0, 5).toUpperCase(), gx + barW / 2, barY + 44);

            if (active) {
                ctx.font = 'bold 11px monospace';
                ctx.fillStyle = '#111';
                const ammoStr = this.reloading ? '…' : this.ammo + '/' + this.gun.mag;
                ctx.fillText(ammoStr, gx + barW / 2, barY - 6);
            }
        });

        ctx.textAlign = 'left';
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(pad, this.h - pad - 22, 140, 20);
        ctx.fillStyle = '#ff4444';
        ctx.fillText('STREAK ' + this.streak, pad + 8, this.h - pad - 8);
    }

    _drawHitFx() {
        const cx = this.w / 2;
        this.fx.forEach(f => {
            this.ctx.globalAlpha = f.life;
            this.ctx.fillStyle = '#ff4444';
            this.ctx.font = 'bold 22px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 3;
            this.ctx.strokeText('+' + f.pts, cx + f.ox, this.h * 0.38 - (1 - f.life) * 50);
            this.ctx.fillText('+' + f.pts, cx + f.ox, this.h * 0.38 - (1 - f.life) * 50);
            this.ctx.globalAlpha = 1;
        });
    }

    _draw() {
        const ctx = this.ctx;
        ctx.fillStyle = '#4ab8f5';
        ctx.fillRect(0, 0, this.w, this.h);

        this._drawArena();

        const sorted = [...this.targets].sort((a, b) => {
            const da = (a.x * a.x + (a.z - 8) * (a.z - 8));
            const db = (b.x * b.x + (b.z - 8) * (b.z - 8));
            return db - da;
        });
        sorted.forEach(t => this._drawHuman(t));
        this._drawParticles();
        this._drawTracers();
        this._drawCrosshair();
        this._drawGun();
        this._drawHud();
        this._drawHitFx();

        if (!this.locked && this.state === 'playing') {
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(this.w / 2 - 140, this.h / 2 + 40, 280, 32);
            ctx.fillStyle = '#fff';
            ctx.fillText('Click arena to capture mouse', this.w / 2, this.h / 2 + 60);
        }
    }
}

window.BlankTrainer = BlankTrainer;
window.BLANK_GUNS = BLANK_GUNS;
