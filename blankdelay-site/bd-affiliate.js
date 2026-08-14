/* BlankDelay affiliate API client (Netlify function) */
(function (global) {
    const API = '/.netlify/functions/affiliate';

    async function affApi(action, payload = {}, headers = {}) {
        const res = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ action, ...payload })
        });
        let data = {};
        try { data = await res.json(); } catch { data = { ok: false, msg: 'Bad response' }; }
        data._status = res.status;
        return data;
    }

    function getAffToken() {
        try { return localStorage.getItem('bd-aff-token') || ''; } catch { return ''; }
    }
    function setAffToken(token) {
        try {
            if (token) localStorage.setItem('bd-aff-token', token);
            else localStorage.removeItem('bd-aff-token');
        } catch { /* ignore */ }
    }

    function rememberAffCode(code) {
        if (!code) return;
        try {
            sessionStorage.setItem('bd-aff-pending', code);
            localStorage.setItem('bd-aff-code', code);
            localStorage.setItem('bd-aff-code-at', String(Date.now()));
        } catch { /* ignore */ }
    }

    const BD_AFF = {
        api: affApi,
        getToken: getAffToken,
        setToken: setAffToken,
        rememberCode: rememberAffCode,

        async signup(email, password) {
            const data = await affApi('signup', { email, password });
            if (data.ok && data.token) {
                setAffToken(data.token);
                try { localStorage.setItem('bd-session', JSON.stringify({ email: data.user.email, code: data.user.code })); } catch { /* */ }
            }
            return data;
        },

        async login(email, password) {
            const data = await affApi('login', { email, password });
            if (data.ok && data.token) {
                setAffToken(data.token);
                try { localStorage.setItem('bd-session', JSON.stringify({ email: data.user.email, code: data.user.code })); } catch { /* */ }
            }
            return data;
        },

        async me() {
            const token = getAffToken();
            if (!token) return { ok: false, msg: 'Not logged in.' };
            return affApi('me', { token });
        },

        async click(code) {
            rememberAffCode(code);
            return affApi('click', { code });
        },

        async cashout(paypalEmail, amount) {
            return affApi('cashout', { token: getAffToken(), paypalEmail, amount });
        },

        async forgot(email) {
            return affApi('forgot', { email });
        },

        async reset(token, password) {
            return affApi('reset', { token, password });
        },

        logout() {
            setAffToken('');
            try { localStorage.removeItem('bd-session'); } catch { /* */ }
        }
    };

    global.BD_AFF = BD_AFF;
})(typeof window !== 'undefined' ? window : globalThis);
