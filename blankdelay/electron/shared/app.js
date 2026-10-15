/* Shared app.js — kept for hub.html only. Product pages use inline scripts. */
(function () {
    const canvas = document.getElementById('bg-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let w, h, particles = [];
        function resize() {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
            if (!particles.length) {
                particles = Array.from({ length: 40 }, () => ({
                    x: Math.random() * w, y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
                    r: Math.random() * 1.5 + 0.3
                }));
            }
        }
        function draw() {
            ctx.clearRect(0, 0, w, h);
            particles.forEach(p => {
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.25)';
                ctx.fill();
            });
            requestAnimationFrame(draw);
        }
        resize(); draw();
        window.addEventListener('resize', resize);
    }
})();
