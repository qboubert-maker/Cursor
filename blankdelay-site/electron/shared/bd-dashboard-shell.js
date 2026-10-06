/* BlankDelay — sidebar dashboard shell engine (Premium / Aphrodite-style layout) */
const BdDashboardShell = (function () {
    const MARK_SVG = '<svg viewBox="0 0 32 32"><circle cx="8" cy="16" r="3.5" fill="currentColor"/><path fill="currentColor" d="M11 16h4l14-6-3 6 3 6-14-6z"/></svg>';

    function el(id) { return document.getElementById(id); }

    function toast(msg, title, warn) {
        if (window.BdTweaksGrid?.toast) return window.BdTweaksGrid.toast(msg, title, warn);
    }

    function init(opts) {
        const mount = el(opts.mountId);
        if (!mount) return null;

        const categories = opts.categories || [];
        const allTweaks = [];
        categories.forEach((c) => c.tweaks.forEach((t) => allTweaks.push(t)));

        mount.innerHTML = `
            <div class="bd-ds-shell">
                <aside class="bd-ds-sidebar">
                    <div class="bd-ds-brand">
                        <div class="mark3">${MARK_SVG}</div>
                        <div class="name1">BLANKDELAY</div>
                        <div class="name2">${opts.productName}</div>
                    </div>
                    <a class="bd-ds-discord" href="https://discord.gg/5gyVpYMY9" target="_blank" rel="noreferrer">Join Discord</a>
                    <div class="bd-ds-nav-label">Main</div>
                    <div class="bd-ds-nav-item active" data-view="dashboard"><span class="ic">⌂</span> Dashboard</div>
                    <div class="bd-ds-nav-label">Tweak Categories</div>
                    <div id="bd-ds-nav-cats"></div>
                    <div class="bd-ds-sidebar-foot">
                        <div class="bd-ds-profile-pill" id="bd-ds-profile-pill"><span class="dot"></span> Checking admin…</div>
                    </div>
                </aside>
                <main class="bd-ds-main">
                    <div class="bd-ds-main-head">
                        <h1><span>⌂</span> <span id="bd-ds-view-title">Dashboard</span></h1>
                        <span class="status-pill" id="bd-ds-status-pill">Checking…</span>
                    </div>
                    <div class="bd-ds-admin-banner" id="bd-ds-admin-banner" hidden>
                        <p><strong>⚠ Administrator required</strong> — restart as admin to apply system-level tweaks.</p>
                        <button class="bd-ds-action-btn bd-ds-action-btn-primary" id="bd-ds-elevate-btn" type="button">Restart as Admin</button>
                    </div>
                    <div class="bd-ds-view" id="bd-ds-view-dashboard">
                        <div class="bd-ds-section-title">System Overview</div>
                        <div class="bd-ds-stat-grid">
                            <div class="bd-ds-stat-card"><span class="ic2">⚡</span><span class="lbl2">Active Tweaks</span><span class="val2" id="bd-ds-active">0</span></div>
                            <div class="bd-ds-stat-card"><span class="ic2">◎</span><span class="lbl2">Total Available</span><span class="val2">${allTweaks.length}</span></div>
                            <div class="bd-ds-stat-card"><span class="ic2">🖥</span><span class="lbl2">Admin Status</span><span class="val2" id="bd-ds-admin-val">Checking</span></div>
                            <div class="bd-ds-stat-card"><span class="ic2">⏱</span><span class="lbl2">Latency Mode</span><span class="val2" id="bd-ds-latency-val">Normal</span></div>
                            <div class="bd-ds-stat-card"><span class="ic2">🔋</span><span class="lbl2">Power Mode</span><span class="val2" id="bd-ds-power-val">Balanced</span></div>
                            <div class="bd-ds-stat-card"><span class="ic2">🌐</span><span class="lbl2">Profile</span><span class="val2" id="bd-ds-profile-val">None</span></div>
                        </div>
                        <div class="bd-ds-section-title">Quick Actions</div>
                        <div class="bd-ds-actions-row">
                            <button class="bd-ds-action-btn bd-ds-action-btn-primary" id="bd-ds-enable-all" type="button">✓ Enable All Safe Tweaks</button>
                            <button class="bd-ds-action-btn" id="bd-ds-reset-all" type="button">↻ Reset All Tweaks</button>
                            <button class="bd-ds-action-btn" id="bd-ds-export" type="button">⬇ Export Script</button>
                        </div>
                        <div class="bd-ds-getting-started">
                            <strong>Getting Started</strong> — Welcome to ${opts.productName}! Select a category from the left, or use Quick Actions above. Toggles apply real Windows/registry changes on this PC once you click Apply (admin required).
                        </div>
                    </div>
                    <div id="bd-ds-cat-views"></div>
                </main>
            </div>
        `;

        const navCats = el('bd-ds-nav-cats');
        const catViews = el('bd-ds-cat-views');

        categories.forEach((cat) => {
            const nav = document.createElement('div');
            nav.className = 'bd-ds-nav-item';
            nav.dataset.view = cat.key;
            nav.innerHTML = `<span class="ic">${cat.icon || '⚙'}</span> ${cat.name} <span class="cnt">${cat.tweaks.length}</span>`;
            navCats.appendChild(nav);

            const view = document.createElement('div');
            view.className = 'bd-ds-view';
            view.id = `bd-ds-view-${cat.key}`;
            view.hidden = true;
            view.innerHTML = `
                <div class="bd-ds-cat-head">
                    <h2>${cat.icon || '⚙'} ${cat.name}</h2>
                    <div class="bd-ds-cat-actions">
                        <button class="bd-ds-action-btn bd-ds-action-btn-primary" data-cat-apply="${cat.key}" type="button">Apply Category</button>
                        <button class="bd-ds-action-btn" data-cat-revert="${cat.key}" type="button">Revert Category</button>
                    </div>
                </div>
                <div class="bd-ds-toggle-list" id="bd-ds-toggles-${cat.key}"></div>
            `;
            catViews.appendChild(view);

            const list = view.querySelector(`#bd-ds-toggles-${cat.key}`);
            cat.tweaks.forEach((t) => {
                const row = document.createElement('div');
                row.className = 'bd-ds-toggle-row';
                row.innerHTML = `
                    <div><div class="name3">${t.name}</div><div class="desc3">${t.desc}</div></div>
                    <div class="bd-ds-switch" data-id="${t.id}" data-label="${t.name}"></div>
                `;
                list.appendChild(row);
            });
        });

        mount.querySelectorAll('.bd-ds-switch').forEach((sw) => {
            sw.addEventListener('click', () => { sw.classList.toggle('on'); updateStats(); });
        });

        function updateStats() {
            const active = mount.querySelectorAll('.bd-ds-switch.on').length;
            const activeEl = el('bd-ds-active'); if (activeEl) activeEl.textContent = String(active);
            const latencyEl = el('bd-ds-latency-val'); if (latencyEl) latencyEl.textContent = active > 0 ? 'Optimized' : 'Normal';
            const profileEl = el('bd-ds-profile-val'); if (profileEl) profileEl.textContent = active > 0 ? 'Custom' : 'None';
        }

        function switchView(key) {
            mount.querySelectorAll('.bd-ds-nav-item').forEach((n) => n.classList.toggle('active', n.dataset.view === key));
            const dash = el('bd-ds-view-dashboard');
            dash.hidden = key !== 'dashboard';
            categories.forEach((c) => { const v = el(`bd-ds-view-${c.key}`); if (v) v.hidden = c.key !== key; });
            const title = el('bd-ds-view-title');
            if (title) title.textContent = key === 'dashboard' ? 'Dashboard' : (categories.find((c) => c.key === key)?.name || key);
        }

        mount.querySelectorAll('.bd-ds-nav-item').forEach((nav) => {
            nav.addEventListener('click', () => switchView(nav.dataset.view));
        });

        let isAdmin = false;
        async function refreshAdmin() {
            isAdmin = await window.blankDelay.checkAdmin();
            const banner = el('bd-ds-admin-banner'); if (banner) banner.hidden = isAdmin;
            const pill = el('bd-ds-status-pill');
            if (pill) { pill.textContent = isAdmin ? 'Admin ✓' : 'No Admin'; pill.classList.toggle('admin-ok', isAdmin); }
            const adminVal = el('bd-ds-admin-val'); if (adminVal) adminVal.textContent = isAdmin ? 'Elevated' : 'Standard';
            const profilePill = el('bd-ds-profile-pill');
            if (profilePill) { profilePill.classList.toggle('ok', isAdmin); profilePill.innerHTML = `<span class="dot"></span> ${isAdmin ? 'Running as Administrator' : 'Not running as admin'}`; }
            if (opts.onAdminStatus) opts.onAdminStatus(isAdmin);
            return isAdmin;
        }
        el('bd-ds-elevate-btn').addEventListener('click', () => window.blankDelay.restartAsAdmin());

        function tweaksFor(key) { return categories.find((c) => c.key === key)?.tweaks || []; }

        async function applyList(list, label) {
            if (!isAdmin) { toast('Restart as Admin first.', 'Admin required', true); return; }
            if (!list.length) { toast('No tweaks to apply.', 'Nothing selected', true); return; }
            const results = await window.blankDelay.runTweaks(list.map((t) => ({ id: t.id, name: t.name, cmd: t.apply })));
            let ok = 0;
            results.forEach((r) => { if (r.success) ok++; });
            toast(`${ok}/${list.length} applied`, label || 'Done');
            if (opts.onApplied) opts.onApplied(ok, list.length);
        }
        async function revertList(list, label) {
            if (!isAdmin) { toast('Restart as Admin first.', 'Admin required', true); return; }
            const results = await window.blankDelay.runTweaks(list.map((t) => ({ id: t.id, name: t.name, cmd: t.restore })));
            let ok = 0;
            results.forEach((r) => { if (r.success) ok++; });
            toast(`${ok}/${list.length} reverted`, label || 'Done');
            if (opts.onReverted) opts.onReverted(ok, list.length);
        }

        mount.querySelectorAll('[data-cat-apply]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.catApply;
                const list = tweaksFor(key);
                mount.querySelectorAll(`#bd-ds-toggles-${key} .bd-ds-switch`).forEach((sw) => sw.classList.add('on'));
                updateStats();
                applyList(list, categories.find((c) => c.key === key)?.name);
            });
        });
        mount.querySelectorAll('[data-cat-revert]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.catRevert;
                const list = tweaksFor(key);
                mount.querySelectorAll(`#bd-ds-toggles-${key} .bd-ds-switch`).forEach((sw) => sw.classList.remove('on'));
                updateStats();
                revertList(list, categories.find((c) => c.key === key)?.name);
            });
        });

        el('bd-ds-enable-all').addEventListener('click', () => {
            mount.querySelectorAll('.bd-ds-switch').forEach((sw) => sw.classList.add('on'));
            updateStats();
            applyList(allTweaks, 'All Tweaks');
        });
        el('bd-ds-reset-all').addEventListener('click', () => {
            mount.querySelectorAll('.bd-ds-switch').forEach((sw) => sw.classList.remove('on'));
            updateStats();
            revertList(allTweaks, 'All Tweaks');
        });
        el('bd-ds-export').addEventListener('click', () => {
            const enabledIds = new Set([...mount.querySelectorAll('.bd-ds-switch.on')].map((sw) => sw.dataset.id));
            const chosen = allTweaks.filter((t) => enabledIds.has(t.id));
            const list = chosen.length ? chosen : allTweaks;
            const lines = [
                '# BlankDelay Premium — Exported Tweak Script',
                `# Generated ${new Date().toISOString()}`,
                '# Run this script as Administrator (right-click -> Run with PowerShell)',
                ''
            ];
            list.forEach((t) => { lines.push(`# ${t.name}`); lines.push(t.apply); lines.push(''); });
            const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'BlankDelay-Premium-tweaks.ps1';
            a.click();
            toast(`${list.length} commands exported`, 'Export Script');
        });

        refreshAdmin();
        updateStats();

        return { refreshAdmin, isAdmin: () => isAdmin };
    }

    return { init };
})();

window.BdDashboardShell = BdDashboardShell;
