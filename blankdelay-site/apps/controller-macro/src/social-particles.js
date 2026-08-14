/**
 * Socials — floating particle icons (YouTube / TikTok / Discord)
 * Waits for real canvas layout before forming, then freezes.
 */
(function () {
  'use strict';

  const COUNT = 640;
  const DPR_CAP = 1;
  const SAMPLE = 360;
  const FORM_FRAMES = 48;

  const ICONS = {
    youtube: {
      color: [0.96, 0.96, 0.96],
      colorHi: [1, 1, 1],
      glow: 'rgba(255, 255, 255, 0.38)',
      glowSoft: 'rgba(255, 255, 255, 0.1)',
      draw(ctx, s) {
        const pad = s * 0.14;
        const w = s - pad * 2;
        const h = w * 0.72;
        const x = (s - w) / 2;
        const y = (s - h) / 2;
        const r = Math.max(8, h * 0.22);

        ctx.save();
        ctx.fillStyle = '#fff';
        roundedRectPath(ctx, x, y, w, h, r);
        ctx.fill();

        // Punch play triangle
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        const cx = x + w * 0.40;
        const cy = y + h * 0.5;
        const tw = w * 0.22;
        const th = h * 0.30;
        ctx.moveTo(cx, cy - th);
        ctx.lineTo(cx + tw, cy);
        ctx.lineTo(cx, cy + th);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      },
    },
    tiktok: {
      color: [0.92, 0.92, 0.92],
      colorB: [0.72, 0.72, 0.72],
      colorHi: [1, 1, 1],
      glow: 'rgba(255, 255, 255, 0.3)',
      glowSoft: 'rgba(200, 200, 200, 0.1)',
      draw(ctx, s) {
        const path = new Path2D(
          'M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z',
        );
        const vbW = 448;
        const vbH = 512;
        const scale = (s * 0.86) / vbH;
        const ox = (s - vbW * scale) / 2;
        const oy = (s - vbH * scale) / 2;
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.translate(ox + 2.4 * scale, oy + 1.8 * scale);
        ctx.scale(scale, scale);
        ctx.fill(path);
        ctx.restore();
        ctx.translate(ox, oy);
        ctx.scale(scale, scale);
        ctx.globalAlpha = 1;
        ctx.fill(path);
        ctx.restore();
      },
    },
    discord: {
      color: [0.9, 0.9, 0.9],
      colorHi: [1, 1, 1],
      glow: 'rgba(255, 255, 255, 0.36)',
      glowSoft: 'rgba(255, 255, 255, 0.1)',
      draw(ctx, s) {
        const p = new Path2D(
          'M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.078.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.078-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.028C.533 9.046-.319 13.58.099 18.058a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.11 13.11 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.029 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z',
        );
        const scale = (s * 0.9) / 24;
        const ox = (s - 24 * scale) / 2;
        const oy = (s - 24 * scale) / 2;
        ctx.save();
        ctx.translate(ox, oy);
        ctx.scale(scale, scale);
        ctx.fillStyle = '#fff';
        ctx.fill(p, 'nonzero');
        ctx.restore();
      },
    },
  };

  function roundedRectPath(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function sampleIcon(key) {
    const icon = ICONS[key];
    const S = SAMPLE;
    const cv = document.createElement('canvas');
    cv.width = S;
    cv.height = S;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, S, S);
    icon.draw(ctx, S);
    const data = ctx.getImageData(0, 0, S, S).data;
    const pts = [];
    const cum = [];
    let acc = 0;

    for (let y = 1; y < S - 1; y++) {
      for (let x = 1; x < S - 1; x++) {
        const a = data[(y * S + x) * 4 + 3];
        if (a < 100) continue;
        const n =
          (data[((y - 1) * S + x) * 4 + 3] < 100 ? 1 : 0) +
          (data[((y + 1) * S + x) * 4 + 3] < 100 ? 1 : 0) +
          (data[(y * S + x - 1) * 4 + 3] < 100 ? 1 : 0) +
          (data[(y * S + x + 1) * 4 + 3] < 100 ? 1 : 0);
        const edge = n > 0;
        const keep = edge ? 0.95 : key === 'discord' ? 0.7 : 0.5;
        if (Math.random() > keep) continue;
        const w = edge ? 2.4 : 1.1;
        pts.push({
          x: (x / S - 0.5) * 2,
          y: (y / S - 0.5) * 2,
          edge,
          w,
        });
        acc += w;
        cum.push(acc);
      }
    }
    return { pts, cum, acc };
  }

  function pick(samples) {
    const { pts, cum, acc } = samples;
    if (!pts.length) return null;
    const t = Math.random() * acc;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < t) lo = mid + 1;
      else hi = mid;
    }
    return pts[lo];
  }

  function makeDot(r, g, b, sharp) {
    const c = document.createElement('canvas');
    c.width = c.height = 40;
    const ctx = c.getContext('2d');
    const gr = ctx.createRadialGradient(20, 20, 0, 20, 20, 20);
    if (sharp) {
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.18, `rgba(${r},${g},${b},1)`);
      gr.addColorStop(0.42, `rgba(${r},${g},${b},0.65)`);
      gr.addColorStop(0.72, `rgba(${r},${g},${b},0.12)`);
      gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    } else {
      gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
      gr.addColorStop(0.35, `rgba(${r},${g},${b},0.55)`);
      gr.addColorStop(0.7, `rgba(${r},${g},${b},0.12)`);
      gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    }
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 40, 40);
    return c;
  }

  function createSwarm(canvas, key, floatPhase) {
    const icon = ICONS[key];
    const samples = sampleIcon(key);
    if (!samples.pts.length) {
      console.warn('[SocialParticles] empty sample for', key);
      return null;
    }

    const [cr, cg, cb] = icon.color.map((v) => (v * 255) | 0);
    const [br, bg, bb] = (icon.colorB || icon.color).map((v) => (v * 255) | 0);
    const [hr, hg, hb] = (icon.colorHi || icon.color).map((v) => (v * 255) | 0);
    const dotA = makeDot(cr, cg, cb, true);
    const dotB = icon.colorB ? makeDot(br, bg, bb, true) : dotA;
    const dotHi = makeDot(hr, hg, hb, true);

    const particles = [];
    for (let i = 0; i < COUNT; i++) {
      const s = pick(samples);
      const jAmt = s.edge ? 0.003 : 0.008;
      const jx = (Math.random() - 0.5) * jAmt;
      const jy = (Math.random() - 0.5) * jAmt;

      let twin = false;
      let ox = 0;
      let oy = 0;
      if (icon.colorB) {
        twin = Math.random() > 0.58;
        if (twin) {
          ox = -0.035;
          oy = 0.02;
        }
      }
      const hi = s.edge && Math.random() > 0.78;

      particles.push({
        tx: s.x + jx + ox,
        ty: s.y + jy + oy,
        x: s.x + (Math.random() - 0.5) * 0.55,
        y: s.y + (Math.random() - 0.5) * 0.55,
        phase: Math.random() * Math.PI * 2,
        speed: 0.28 + Math.random() * 0.4,
        size: s.edge ? 1.4 + Math.random() * 0.5 : 0.9 + Math.random() * 0.35,
        twin,
        hi,
        edge: s.edge,
      });
    }

    let raf = 0;
    let running = false;
    let t0 = 0;
    let form = 0;
    let frames = 0;
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true }) || canvas.getContext('2d');

    function syncSize() {
      const parent = canvas.parentElement;
      const rect = (parent || canvas).getBoundingClientRect();
      // Prefer the square content box of the canvas itself once laid out
      const crect = canvas.getBoundingClientRect();
      const side = Math.max(
        crect.width || 0,
        crect.height || 0,
        Math.min(rect.width || 0, rect.height || 0) * 0.72,
        1,
      );
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      const px = Math.max(1, Math.floor(side * dpr));
      if (canvas.width !== px || canvas.height !== px) {
        canvas.width = px;
        canvas.height = px;
        return true;
      }
      return false;
    }

    function readySize() {
      return canvas.width >= 120 && canvas.height >= 120;
    }

    function drawFrame(now) {
      syncSize();
      if (!readySize()) return false;

      if (!t0) t0 = now;
      const t = (now - t0) / 1000;
      frames += 1;
      form = Math.min(1, frames / FORM_FRAMES);
      const ease = form * form * (3 - 2 * form);

      const w = canvas.width;
      const h = canvas.height;
      const bob = Math.sin(t * 0.45 + floatPhase) * (h * 0.01) * (1 - ease * 0.85);
      const cx = w * 0.5;
      const cy = h * 0.5 + bob;
      const scale = Math.min(w, h) * 0.52;

      ctx.clearRect(0, 0, w, h);

      const bloomR = scale * 1.1;
      const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloomR);
      bloom.addColorStop(0, icon.glow);
      bloom.addColorStop(0.5, icon.glowSoft);
      bloom.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.3 + ease * 0.1;
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(cx, cy, bloomR, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const sway = Math.sin(t * p.speed + p.phase) * (0.004 + (1 - ease) * 0.012);
        p.x += (p.tx + sway - p.x) * (0.16 + ease * 0.14);
        p.y += (p.ty - p.y) * (0.16 + ease * 0.14);

        const px = cx + p.x * scale;
        const py = cy + p.y * scale;
        const sz = p.size * (Math.min(w, h) / 320);
        const dot = p.hi ? dotHi : p.twin ? dotB : dotA;
        ctx.globalAlpha = p.edge ? 0.98 : 0.82;
        ctx.drawImage(dot, px - sz, py - sz, sz * 2, sz * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      return form >= 1;
    }

    let formed = false;

    function tick(now) {
      if (!running || document.hidden) {
        running = false;
        raf = 0;
        return;
      }
      const done = drawFrame(now);
      if (done) {
        formed = true;
        running = false;
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    }

    function paintSettled() {
      form = 1;
      frames = FORM_FRAMES;
      for (const p of particles) {
        p.x = p.tx;
        p.y = p.ty;
      }
      drawFrame(performance.now());
      formed = true;
    }

    return {
      get formed() { return formed; },
      start() {
        if (running) return;
        // Already formed — keep the static icon, do not re-swarm.
        if (formed) {
          syncSize();
          if (readySize()) paintSettled();
          return;
        }
        running = true;
        form = 0;
        frames = 0;
        t0 = 0;
        const kick = () => {
          syncSize();
          if (!readySize()) {
            raf = requestAnimationFrame(kick);
            return;
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(kick);
      },
      stop() {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      },
      resize() {
        const changed = syncSize();
        if (!readySize()) return;
        if ((changed || !running) && !raf) {
          if (formed) paintSettled();
          else drawFrame(performance.now());
        }
      },
      reset() {
        formed = false;
        form = 0;
        frames = 0;
        t0 = 0;
        for (const p of particles) {
          p.x = p.tx + (Math.random() - 0.5) * 0.55;
          p.y = p.ty + (Math.random() - 0.5) * 0.55;
        }
      },
    };
  }

  const swarms = new Map();
  let bound = false;

  function destroyAll() {
    swarms.forEach((s) => s.stop());
    swarms.clear();
  }

  function mountAll() {
    let i = 0;
    document.querySelectorAll('[data-soc-particles]').forEach((el) => {
      const key = el.getAttribute('data-soc-particles');
      const canvas = el.querySelector('canvas');
      if (!key || !canvas || !ICONS[key] || swarms.has(key)) return;
      const swarm = createSwarm(canvas, key, i * 1.7);
      if (swarm) swarms.set(key, swarm);
      i += 1;
    });
  }

  function start() {
    if (!swarms.size) mountAll();
    swarms.forEach((s) => s.start());
  }

  function stop() {
    swarms.forEach((s) => s.stop());
  }

  function resize() {
    swarms.forEach((s) => s.resize());
  }

  function remount() {
    destroyAll();
    mountAll();
    start();
  }

  function bindResize() {
    if (bound) return;
    bound = true;
    window.addEventListener('resize', () => {
      const page = document.querySelector('.page[data-page="socials"]');
      if (page && !page.hidden) resize();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
    });
  }

  // Don't mount while section is hidden — remount() from the view switcher
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindResize);
  } else {
    bindResize();
  }

  window.SocialParticles = { start, stop, resize, mountAll, remount };
})();
