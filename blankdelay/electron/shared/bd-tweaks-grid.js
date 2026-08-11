/* BlankDelay — 3-column tweak grid engine (Zero Delay / FPS / Ping) */
const BdTweaksGrid = (function () {
    function el(id) { return document.getElementById(id); }

    function toast(msg, title, warn) {
        let stack = el('bd-tg-toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.id = 'bd-tg-toast-stack';
            stack.className = 'bd-tg-toast-stack';
            document.body.appendChild(stack);
        }
        const node = document.createElement('div');
        node.className = 'bd-tg-toast' + (warn ? ' warn' : '');
        node.innerHTML = `<div class="t-title">${title || (warn ? 'Notice' : 'Success')}</div><div>${msg}</div>`;
        stack.appendChild(node);
        setTimeout(() => node.remove(), 3200);
    }

    function ringSvg() {
        return `<svg viewBox="0 0 74 74">
            <circle class="bg" cx="37" cy="37" r="30"></circle>
            <circle class="fg" id="bd-tg-ring-fg" cx="37" cy="37" r="30" stroke-dasharray="188.5" stroke-dashoffset="188.5"></circle>
        </svg>`;
    }

    function init(opts) {
        const mount = el(opts.mountId);
        if (!mount) return null;

        const categories = opts.categories || [];
        const allTweaks = [];
        categories.forEach(c => c.tweaks.forEach(t => allTweaks.push(t)));

        mount.innerHTML = `
            <div class="bd-tg-wrap">
                <div class="bd-tg-admin-warning" id="bd-tg-admin-warning" hidden>
                    <p><strong>⚠ Administrator required</strong> — this app needs admin rights to modify system settings.</p>
                    <button class="bd-tg-btn bd-tg-btn-primary" id="bd-tg-elevate-btn" type="button">Restart as Admin</button>
                </div>
                <div class="bd-tg-head">
                    <div class="bd-tg-head-left">
                        <div class="eyebrow">System Optimization</div>
                        <h1>${opts.productLabel} by BlankDelay</h1>
                        <p>${opts.subtitle || 'Tweaks apply instantly and persist after restart.'}</p>
                    </div>
                    <div class="bd-tg-head-right">
                        <div class="bd-tg-ring">
                            ${ringSvg()}
                            <div class="bd-tg-ring-label"><span class="pct" id="bd-tg-pct">0%</span><span class="lbl">Optimized</span></div>
                        </div>
                        <div class="bd-tg-stats">
                            <div class="bd-tg-stat"><div class="val" id="bd-tg-active">0</div><div class="lbl">Active</div></div>
                            <div class="bd-tg-stat"><div class="val" id="bd-tg-total">${allTweaks.length}</div><div class="lbl">Total</div></div>
                            <div class="bd-tg-stat"><div class="val" id="bd-tg-latency">0%</div><div class="lbl">Est. Latency</div></div>
                        </div>
                        <div class="bd-tg-actions">
                            <button class="bd-tg-btn bd-tg-btn-primary" id="bd-tg-apply-btn" type="button">Apply All Optimizations</button>
                            <button class="bd-tg-btn" id="bd-tg-revert-btn" type="button">Revert All</button>
                        </div>
                    </div>
                </div>
                <div class="bd-tg-grid" id="bd-tg-grid-cols"></div>
            </div>
        `;

        const gridCols = el('bd-tg-grid-cols');
        categories.forEach((cat) => {
            const col = document.createElement('div');
            col.className = 'bd-tg-col';
            col.innerHTML = `
                <div class="bd-tg-col-head">
                    <span class="ic">${cat.icon || '⚙'}</span> ${cat.name}
                    <span class="count">${cat.tweaks.length}</span>
                </div>
                <div class="bd-tg-rows"></div>
            `;
            const rows = col.querySelector('.bd-tg-rows');
            cat.tweaks.forEach((tweak) => {
                const row = document.createElement('div');
                row.className = 'bd-tg-row';
                row.innerHTML = `
                    <div class="bd-tg-row-text"><div class="name">${tweak.name}</div><div class="desc">${tweak.desc}</div></div>
                    <div class="bd-tg-switch on" data-id="${tweak.id}" data-label="${tweak.name}"></div>
                `;
                rows.appendChild(row);
            });
            gridCols.appendChild(col);
        });

        const applyBtn = el('bd-tg-apply-btn');
        const revertBtn = el('bd-tg-revert-btn');
        const elevateBtn = el('bd-tg-elevate-btn');
        const adminWarning = el('bd-tg-admin-warning');
        let isAdmin = false;

        function updateRing() {
            const total = allTweaks.length;
            const activeSwitches = mount.querySelectorAll('.bd-tg-switch.on').length;
            const pct = total ? Math.round((activeSwitches / total) * 100) : 0;
            const circumference = 188.5;
            const offset = circumference - (circumference * pct) / 100;
            const fg = el('bd-tg-ring-fg');
            if (fg) fg.setAttribute('stroke-dashoffset', String(offset));
            const pctEl = el('bd-tg-pct'); if (pctEl) pctEl.textContent = pct + '%';
            const activeEl = el('bd-tg-active'); if (activeEl) activeEl.textContent = String(activeSwitches);
            const latencyEl = el('bd-tg-latency'); if (latencyEl) latencyEl.textContent = '-' + Math.round(pct * 2.86) + '%';
        }

        mount.querySelectorAll('.bd-tg-switch').forEach((sw) => {
            sw.addEventListener('click', () => {
                sw.classList.toggle('on');
                updateRing();
            });
        });

        function getEnabled() {
            const enabled = [];
            mount.querySelectorAll('.bd-tg-switch.on').forEach((sw) => {
                const t = allTweaks.find((x) => x.id === sw.dataset.id);
                if (t) enabled.push({ id: t.id, name: t.name, cmd: t.apply });
            });
            return enabled;
        }

        async function refreshAdmin() {
            isAdmin = await window.blankDelay.checkAdmin();
            adminWarning.hidden = isAdmin;
            if (opts.onAdminStatus) opts.onAdminStatus(isAdmin);
            return isAdmin;
        }

        elevateBtn.addEventListener('click', () => window.blankDelay.restartAsAdmin());

        applyBtn.addEventListener('click', async () => {
            if (!isAdmin) { toast('Click "Restart as Admin" above first.', 'Admin required', true); return; }
            const enabled = getEnabled();
            if (!enabled.length) { toast('Turn on at least one tweak first.', 'Nothing selected', true); return; }
            applyBtn.disabled = true;
            applyBtn.textContent = `Applying ${enabled.length}…`;
            const results = await window.blankDelay.runTweaks(enabled);
            let ok = 0;
            results.forEach((r) => {
                if (r.success) { ok++; toast(`Applied · saved`, r.name); }
                else toast(r.error || 'Failed to apply', r.name, true);
            });
            applyBtn.disabled = false;
            applyBtn.textContent = 'Re-Apply Optimizations';
            if (opts.onApplied) opts.onApplied(ok, enabled.length);
            toast(`${ok}/${enabled.length} optimizations applied`, 'Done');
        });

        revertBtn.addEventListener('click', async () => {
            if (!isAdmin) { toast('Admin required to revert.', 'Admin required', true); return; }
            revertBtn.disabled = true;
            revertBtn.textContent = 'Reverting…';
            const cmds = allTweaks.map((t) => ({ id: t.id, name: t.name, cmd: t.restore }));
            const results = await window.blankDelay.runTweaks(cmds);
            let ok = 0;
            results.forEach((r) => {
                if (r.success) { ok++; toast('Reverted · saved', r.name); }
            });
            revertBtn.disabled = false;
            revertBtn.textContent = 'Revert All';
            if (opts.onReverted) opts.onReverted(ok, cmds.length);
            toast(`${ok}/${cmds.length} settings reverted`, 'Done');
        });

        refreshAdmin();
        updateRing();

        return {
            refreshAdmin,
            updateRing,
            getEnabled,
            isAdmin: () => isAdmin
        };
    }

    return { init, toast };
})();
