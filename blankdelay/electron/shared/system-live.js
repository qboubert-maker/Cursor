/* BlankDelay — live system metrics + apply scanner */
const BlankSystemLive = (function () {
    let pollTimer = null;

    function el(id) { return document.getElementById(id); }

    function ensureScanPanel() {
        if (el('live-scan-panel')) return;
        const panel = document.createElement('div');
        panel.id = 'live-scan-panel';
        panel.className = 'live-scan card';
        panel.innerHTML = `
            <div class="live-scan-head">
                <span class="live-pulse-dot"></span>
                <strong id="live-scan-title">Live System Scan</strong>
                <span class="mono live-scan-pct" id="live-scan-pct">0%</span>
            </div>
            <div class="live-scan-bar"><div class="live-scan-fill" id="live-scan-fill"></div></div>
            <p class="field-hint" id="live-scan-status">Reading your PC…</p>
        `;
        const log = el('log');
        if (log) log.parentNode.insertBefore(panel, log);
    }

    function updateMetricsUI(type, m) {
        if (!m || m.error) return;
        if (type === 'latency' || type === 'zero-plus') {
            if (el('metric-delay')) el('metric-delay').textContent = m.timerOptimized && m.nagleOff ? '~0ms' : (m.pingMs ? m.pingMs + 'ms net' : '—');
            if (el('metric-timer')) el('metric-timer').textContent = m.timerOptimized ? '0.5ms' : 'Default';
            if (el('metric-nagle')) el('metric-nagle').textContent = m.nagleOff ? 'OFF' : 'ON';
            if (el('metric-mouse')) el('metric-mouse').textContent = m.mouseQueue != null ? m.mouseQueue : '—';
        }
        if (type === 'fps') {
            if (el('metric-fps')) el('metric-fps').textContent = m.gameMode && m.gpuScheduling ? 'BOOSTED' : 'Standard';
            if (el('metric-gpu')) el('metric-gpu').textContent = m.gpuScheduling ? 'HW ON' : 'HW OFF';
            if (el('metric-vfx')) el('metric-vfx').textContent = m.sysMainRunning === false ? 'Lean' : 'Default';
            if (el('metric-sysmain')) el('metric-sysmain').textContent = m.sysMainRunning ? 'Running' : 'Stopped';
            if (el('metric-game')) el('metric-game').textContent = m.gameMode ? 'ON' : 'OFF';
        }
        if (type === 'ping') {
            if (el('metric-ping')) el('metric-ping').textContent = m.pingMs != null ? m.pingMs + 'ms' : '—';
            if (el('metric-dns')) el('metric-dns').textContent = m.cloudflareDns ? '1.1.1.1' : 'ISP';
            if (el('metric-nagle')) el('metric-nagle').textContent = m.nagleOff ? 'OFF' : 'ON';
            if (el('metric-route')) el('metric-route').textContent = m.nagleOff && m.cloudflareDns ? 'Optimized' : 'Default';
        }
        if (el('metric-fps') && el('metric-delay') && el('metric-ping') && !el('metric-gpu') && !el('metric-dns')) {
            if (el('metric-delay')) el('metric-delay').textContent = m.timerOptimized && m.nagleOff ? '~0ms' : (m.pingMs != null ? m.pingMs + 'ms' : '—');
            if (el('metric-fps')) el('metric-fps').textContent = m.gameMode && m.gpuScheduling && m.sysMainRunning === false ? 'BOOSTED' : 'Standard';
            if (el('metric-ping')) el('metric-ping').textContent = m.pingMs != null ? m.pingMs + 'ms' : '—';
        }
        if (el('metric-status') && m.timerOptimized !== undefined) {
            const optimized = m.nagleOff && m.timerOptimized && (m.mouseQueue <= 20);
            if (optimized) {
                el('metric-status').textContent = 'Optimized';
                el('metric-status').classList.add('text-ok');
            }
        }
    }

    async function refresh(type) {
        const m = await window.blankDelay.getSystemMetrics(type);
        updateMetricsUI(type, m);
        return m;
    }

    function startPolling(type, intervalMs) {
        stopPolling();
        refresh(type);
        pollTimer = setInterval(() => refresh(type), intervalMs || 8000);
    }

    function stopPolling() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
    }

    async function animateApply(tweakNames, runFn) {
        ensureScanPanel();
        const fill = el('live-scan-fill');
        const pct = el('live-scan-pct');
        const status = el('live-scan-status');
        const title = el('live-scan-title');
        if (title) title.textContent = 'Applying optimizations…';
        let progress = 0;
        const total = tweakNames.length || 1;

        for (let i = 0; i < tweakNames.length; i++) {
            if (status) status.textContent = `Working on: ${tweakNames[i]}…`;
            progress = Math.round(((i + 0.5) / total) * 100);
            if (fill) fill.style.width = progress + '%';
            if (pct) pct.textContent = progress + '%';
            await new Promise(r => setTimeout(r, 350));
        }

        const results = await runFn();
        for (let i = 0; i < tweakNames.length; i++) {
            progress = Math.round(((i + 1) / total) * 100);
            if (fill) fill.style.width = progress + '%';
            if (pct) pct.textContent = progress + '%';
        }
        if (status) status.textContent = 'Scan complete — verifying changes…';
        if (title) title.textContent = 'Live System Scan';
        await refresh('latency');
        return results;
    }

    return { refresh, startPolling, stopPolling, animateApply, updateMetricsUI, ensureScanPanel };
})();
