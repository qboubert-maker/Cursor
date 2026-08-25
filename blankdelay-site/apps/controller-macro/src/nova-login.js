(function () {
  'use strict';

  const PASSCODE_HASH_KEY = 'sjay-cm-passcode-hash';
  const PASSCODE_LENGTH_KEY = 'sjay-cm-passcode-length';
  const LICENSE_KEY = 'blankdelay-controller-license-key';
  const LEGACY_PASSCODE_HASH_KEY = 'cuff-passcode-hash';
  const LEGACY_PASSCODE_LENGTH_KEY = 'cuff-passcode-length';
  const LEGACY_LICENSE_KEY = 'sjay-cm-license-key';
  const THEME_KEY = 'nova-color-theme';
  const PROFILE_KEY = 'nova-user-profile';
  const INTRO_KEY = 'nova-intro-enabled';
  const VALID_THEMES = new Set(['nova', 'black', 'silver', 'monochrome', 'god-of-war']);
  const DISCORD_KEYS_URL = 'https://discord.gg/5gyVpYMY9';

  function apiBridge() {
    return window.blank || window.sjay || window.aphrodite || null;
  }

  let passcodeMode = 'unlock';
  let passcodeDigits = [];
  let pendingPasscode = '';
  let selectedPasscodeLength = 6;
  let setupPasscodeLength = 6;
  let licenseStepMode = 'activate';

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }


  function hasLicense() {
    return !!getStoredLicense();
  }

  function saveLicense(licenseKey) {
    localStorage.setItem(LICENSE_KEY, licenseKey);
    try { localStorage.removeItem(LEGACY_LICENSE_KEY); } catch { /* ignore */ }
  }

  function getStoredLicense() {
    try {
      return localStorage.getItem(LICENSE_KEY)
        || localStorage.getItem(LEGACY_LICENSE_KEY)
        || '';
    } catch {
      return '';
    }
  }

  function clearLicense() {
    try {
      localStorage.removeItem(LICENSE_KEY);
      localStorage.removeItem(LEGACY_LICENSE_KEY);
    } catch { /* ignore */ }
  }

  function updateLicenseStepCopy() {
    const title = $('#novaLoginLicenseTitle');
    const lead = $('#novaLoginLicenseLead');
    const label = $('#novaLoginContinueLabel');
    const tip = $('#novaLoginKeyTip');

    if (licenseStepMode === 'reset-pin') {
      if (title) title.textContent = 'Verify your key';
      if (lead) lead.textContent = 'Confirm your license key to reset your access code. Your device binding stays the same.';
      if (label) label.textContent = 'Verify & reset';
      if (tip) tip.hidden = true;
      return;
    }

    if (title) title.textContent = 'Activate your key';
    if (lead) {
      lead.innerHTML = 'Paste your <strong>BLANK-XXXX-XXXX</strong> Discord key (or BD- purchase key) to unlock BlankDelay Controller Macro.';
    }
    if (label) label.textContent = 'Verify & unlock';
    if (tip) tip.hidden = true;
  }

  function updateKeyCharCount() {
    const keyInput = $('#novaLoginKey');
    const countEl = $('#novaLoginKeyCount');
    if (!keyInput || !countEl) return;
    const len = (keyInput.value || '').trim().length;
    countEl.textContent = `${len} ${len === 1 ? 'CHAR' : 'CHARS'}`;
  }

  function setKeyVisibility(show) {
    const keyInput = $('#novaLoginKey');
    const toggle = $('#novaLoginKeyToggle');
    if (!keyInput || !toggle) return;
    keyInput.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', show ? 'true' : 'false');
    toggle.setAttribute('aria-label', show ? 'Hide license key' : 'Show license key');
  }

  function normalizeLicenseKey(raw) {
    return String(raw || '').trim().toUpperCase();
  }

  function formatLicenseKey(raw) {
    const compact = normalizeLicenseKey(raw).replace(/[^A-Z0-9]/g, '');
    if (compact.startsWith('BLANK')) {
      const rest = compact.slice(5);
      const a = rest.slice(0, 4);
      const b = rest.slice(4, 8);
      if (!a) return 'BLANK';
      return b ? `BLANK-${a}-${b}` : `BLANK-${a}`;
    }
    if (compact.startsWith('BD')) {
      const rest = compact.slice(2);
      const a = rest.slice(0, 4);
      const b = rest.slice(4, 8);
      const c = rest.slice(8, 12);
      if (!a) return 'BD';
      if (!b) return `BD-${a}`;
      if (!c) return `BD-${a}-${b}`;
      return `BD-${a}-${b}-${c}`;
    }
    return normalizeLicenseKey(raw);
  }

  function validateLicenseKey(key) {
    const formatted = formatLicenseKey(key);
    return /^BLANK-[A-Z]{4}-[A-Z]{4}$/.test(formatted)
      || /^BD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(formatted);
  }

  function hasPasscode() {
    try {
      return !!(localStorage.getItem(PASSCODE_HASH_KEY) || localStorage.getItem(LEGACY_PASSCODE_HASH_KEY));
    } catch {
      return false;
    }
  }


  async function hashPasscode(code) {
    const data = new TextEncoder().encode(code + 'cuff-passcode-v1');
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function savePasscode(code, length) {
    const hash = await hashPasscode(code);
    localStorage.setItem(PASSCODE_HASH_KEY, hash);
    localStorage.setItem(PASSCODE_LENGTH_KEY, String(length === 4 ? 4 : 6));
    try {
      localStorage.removeItem(LEGACY_PASSCODE_HASH_KEY);
      localStorage.removeItem(LEGACY_PASSCODE_LENGTH_KEY);
    } catch { /* ignore */ }
  }

  function getStoredPasscodeLength() {
    try {
      const value = parseInt(
        localStorage.getItem(PASSCODE_LENGTH_KEY)
          || localStorage.getItem(LEGACY_PASSCODE_LENGTH_KEY),
        10
      );
      return value === 4 ? 4 : 6;
    } catch {
      return 6;
    }
  }

  function getActivePasscodeLength() {
    if (passcodeMode === 'unlock') return getStoredPasscodeLength();
    if (passcodeMode === 'confirm') return setupPasscodeLength;
    return selectedPasscodeLength;
  }

  async function verifyPasscode(code) {
    const stored = localStorage.getItem(PASSCODE_HASH_KEY)
      || localStorage.getItem(LEGACY_PASSCODE_HASH_KEY);
    if (!stored) return false;
    const hash = await hashPasscode(code);
    return hash === stored;
  }


  function showError(msg) {
    const passcodeStep = $('#novaLoginStepPasscode');
    const onPasscode = passcodeStep && !passcodeStep.hidden;
    const errorEl = onPasscode ? $('#novaLoginPasscodeError') : $('#novaLoginError');
    const otherEl = onPasscode ? $('#novaLoginError') : $('#novaLoginPasscodeError');
    if (otherEl) {
      otherEl.textContent = '';
      otherEl.classList.remove('is-visible');
    }
    if (!errorEl) return;
    if (msg) {
      errorEl.textContent = msg;
      errorEl.classList.add('is-visible');
    } else {
      errorEl.textContent = '';
      errorEl.classList.remove('is-visible');
    }
  }

  function clearPasscodeEntry() {
    passcodeDigits = [];
    updatePasscodeDots();
  }

  function renderPasscodeSlots(length) {
    const slots = $('#novaLoginPasscodeDots');
    const vault = $('#novaLoginPasscodeVault');
    if (!slots) return;

    const count = length === 4 ? 4 : 6;
    slots.innerHTML = '';
    for (let i = 0; i < count; i += 1) {
      slots.appendChild(document.createElement('span'));
    }

    slots.classList.toggle('nova-login__passcode-slots--4', count === 4);
    slots.classList.toggle('nova-login__passcode-slots--6', count === 6);
    vault?.classList.toggle('nova-login__passcode-vault--4', count === 4);
    vault?.classList.toggle('nova-login__passcode-vault--6', count === 6);
    updatePasscodeDots();
  }

  function updatePasscodeLengthPicker(length) {
    const picker = $('#novaLoginPasscodeLength');
    if (!picker) return;

    picker.querySelectorAll('[data-length]').forEach((btn) => {
      const active = parseInt(btn.getAttribute('data-length'), 10) === length;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function setPasscodeLengthPickerVisible(visible) {
    const picker = $('#novaLoginPasscodeLength');
    if (picker) picker.hidden = !visible;
  }

  function updatePasscodeDots() {
    const dots = $('#novaLoginPasscodeDots');
    if (!dots) return;
    const spans = dots.querySelectorAll('span');
    spans.forEach((dot, i) => {
      dot.classList.toggle('is-filled', i < passcodeDigits.length);
    });
  }

  function shakePasscode() {
    const dots = $('#novaLoginPasscodeDots');
    dots?.classList.remove('is-shake');
    void dots?.offsetWidth;
    dots?.classList.add('is-shake');
    window.setTimeout(() => dots?.classList.remove('is-shake'), 520);
  }

  function clearStoredPasscode() {
    try {
      localStorage.removeItem(PASSCODE_HASH_KEY);
      localStorage.removeItem(PASSCODE_LENGTH_KEY);
      localStorage.removeItem(LEGACY_PASSCODE_HASH_KEY);
      localStorage.removeItem(LEGACY_PASSCODE_LENGTH_KEY);
    } catch { /* ignore */ }
  }

  function setPasscodeResetVisible(visible) {
    const wrap = $('#novaLoginPasscodeResetWrap');
    if (wrap) wrap.hidden = !visible;
  }

  function resetPasscode() {
    licenseStepMode = 'reset-pin';
    pendingPasscode = '';
    showError('');
    goToStep('key');
    const keyInput = $('#novaLoginKey');
    if (keyInput) {
      const stored = getStoredLicense();
      keyInput.value = stored ? formatLicenseKey(stored) : '';
      keyInput.focus();
    }
  }

  function setPasscodeMode(mode) {
    passcodeMode = mode;
    const title = $('#novaLoginPasscodeTitle');
    const sub = $('#novaLoginPasscodeSub');

    const length = getActivePasscodeLength();
    const copy = {
      create: {
        title: 'Create your access code',
        sub: `Choose a ${length}-digit private code. Required every time you open BlankDelay Controller Macro.`,
      },
      confirm: {
        title: 'Confirm access code',
        sub: `Re-enter your ${setupPasscodeLength}-digit code to secure this device`,
      },
      unlock: {
        title: 'Welcome back',
        sub: 'Enter your access code to unlock BlankDelay Controller Macro',
      },
    };

    const cfg = copy[mode] || copy.unlock;
    if (title) title.textContent = cfg.title;
    if (sub) {
      sub.textContent = cfg.sub;
      sub.hidden = false;
    }

    setPasscodeLengthPickerVisible(mode === 'create');
    updatePasscodeLengthPicker(mode === 'create' ? selectedPasscodeLength : setupPasscodeLength);
    setPasscodeResetVisible(mode === 'unlock');
  }

  function goToStep(/* step */) {
    const keyStep = $('#novaLoginStepKey');
    const passcodeStep = $('#novaLoginStepPasscode');
    const shell = $('#novaLoginShell');
    if (!keyStep) return;

    keyStep.hidden = false;
    keyStep.classList.add('is-active');
    if (passcodeStep) {
      passcodeStep.hidden = true;
      passcodeStep.classList.remove('is-active');
    }
    shell?.classList.add('nova-login__shell--license');
    shell?.classList.remove('nova-login__shell--passcode');
    showError('');
    updateLicenseStepCopy();
    setKeyVisibility(false);
    const keyInput = $('#novaLoginKey');
    if (keyInput) {
      keyInput.value = '';
      updateKeyCharCount();
      keyInput.focus();
    }
  }

  function resolveInitialStep() {
    return 'key';
  }

  function initDeviceId() {
    const el = $('#novaLoginDeviceId');
    if (!el) return;

    const apply = (id) => {
      el.textContent = id || '—';
    };

    const nova = apiBridge();
    if (nova?.getLicenseHardware) {
      nova.getLicenseHardware()
        .then((res) => apply(res?.deviceId))
        .catch(() => apply('—'));
      return;
    }

    try {
      const cached = localStorage.getItem('sjay-device-id') || localStorage.getItem('cuff-device-id') || '';
      apply(cached ? cached.replace(/(.{4})(?=.)/g, '$1-') : '—');
    } catch {
      apply('—');
    }
  }

  function initParticles() {
    // Heavy canvas particles + software compositing (GPU off for stick latency)
    // make the login screen unusable — keep the canvas blank.
    const canvas = $('#novaLoginParticles');
    if (canvas) canvas.style.display = 'none';
    return null;
  }

  function initSettingsMenuParticles() {
    const canvas = $('#novaLoginSettingsParticles');
    if (canvas) canvas.style.display = 'none';
    return null;
  }

  let loginParticlesApi = null;
  let settingsMenuParticlesApi = null;
  function enterApp(loginEl) {
    try { void apiBridge()?.licenseUnlocked?.(); } catch (_) {}
    try { window.dispatchEvent(new Event('aphrodite:unlocked')); } catch (_) {}
    try { window.dispatchEvent(new Event('sjay:unlocked')); } catch (_) {}
    loginEl.classList.add('is-exiting');
    document.documentElement.classList.remove('nova-login-pending');
    document.documentElement.classList.add('nova-intro-pending');

    window.setTimeout(() => {
      loginEl.remove();
      const finish = () => {
        document.documentElement.classList.remove('nova-intro-pending');
        document.documentElement.classList.add('nova-authed');
      };
      const intro = window.NovaIntro?.play?.();

      if (intro && typeof intro.then === 'function') {
        intro.then(finish);
      } else {
        finish();
      }

      // Safety: never leave pointer-events disabled if intro fails to finish.
      window.setTimeout(finish, 5000);
    }, 220);
  }

  function openLoginModal(forceStep) {
    const loginEl = $('#novaLogin');
    if (!loginEl) return;

    if (forceStep !== 'key' && hasLicense()) {
      enterApp(loginEl);
      return;
    }

    const modal = $('#novaLoginModal');
    if (!modal) return;

    licenseStepMode = 'activate';
    goToStep('key');

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      modal.classList.add('is-open');
      loginParticlesApi?.resize?.();
    });
  }

  function closeLoginModal() {
    const modal = $('#novaLoginModal');
    if (!modal || !modal.classList.contains('is-open')) return;

    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    showError('');
    pendingPasscode = '';
    clearPasscodeEntry();

    window.setTimeout(() => {
      if (!modal.classList.contains('is-open')) {
        modal.hidden = true;
      }
    }, 300);

    $('#novaLoginLogoTrigger')?.focus();
  }

  async function onPasscodeComplete(code) {
    if (passcodeMode === 'create') {
      pendingPasscode = code;
      setupPasscodeLength = selectedPasscodeLength;
      goToStep('passcode-confirm');
      return;
    }

    if (passcodeMode === 'confirm') {
      if (code !== pendingPasscode) {
        showError('Passcodes do not match. Try again.');
        shakePasscode();
        clearPasscodeEntry();
        pendingPasscode = '';
        selectedPasscodeLength = setupPasscodeLength;
        goToStep('passcode-create');
        return;
      }

      try {
        await savePasscode(code, setupPasscodeLength);
        pendingPasscode = '';
        enterApp($('#novaLogin'));
      } catch {
        showError('Could not save passcode. Please try again.');
        clearPasscodeEntry();
      }
      return;
    }

    const ok = await verifyPasscode(code);
    if (!ok) {
      showError('Incorrect passcode.');
      shakePasscode();
      clearPasscodeEntry();
      return;
    }

    enterApp($('#novaLogin'));
  }

  function appendPasscodeDigit(digit) {
    const length = getActivePasscodeLength();
    if (passcodeDigits.length >= length) return;
    passcodeDigits.push(digit);
    updatePasscodeDots();

    if (passcodeDigits.length === length) {
      const code = passcodeDigits.join('');
      window.setTimeout(() => onPasscodeComplete(code), 120);
    }
  }

  function deletePasscodeDigit() {
    if (!passcodeDigits.length) return;
    passcodeDigits.pop();
    updatePasscodeDots();
    showError('');
  }

  function bindSettings() {
    const settingsEl = $('#novaLoginSettings');
    const settingsBackdrop = $('#novaLoginSettingsBackdrop');
    const settingsClose = $('#novaLoginSettingsClose');
    const themeSelect = $('#loginSettingsTheme');
    const displayNameInput = $('#loginSettingsDisplayName');
    const introToggle = $('#loginSettingsIntro');
    const storeLink = $('#loginSettingsStoreLink');

    if (storeLink) storeLink.href = DISCORD_KEYS_URL;

    function applyColorTheme(theme) {
      const next = VALID_THEMES.has(theme) ? theme : 'nova';
      if (next === 'nova') {
        delete document.documentElement.dataset.theme;
      } else {
        document.documentElement.dataset.theme = next;
      }
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch { /* ignore */ }
      if (themeSelect) {
        if (window.NovaThemeSelect?.setValue) {
          window.NovaThemeSelect.setValue(themeSelect, next);
        } else {
          themeSelect.value = next;
        }
      }
    }

    function readProfileName() {
      try {
        const raw = localStorage.getItem(PROFILE_KEY);
        if (!raw) return '';
        const profile = JSON.parse(raw);
        return (profile?.displayName || '').trim();
      } catch {
        return '';
      }
    }

    function saveProfileName(name) {
      if (!window.NovaNameFilter?.isDisplayNameAllowed?.(name)) return false;
      try {
        const raw = localStorage.getItem(PROFILE_KEY);
        const profile = raw ? JSON.parse(raw) : {};
        profile.displayName = name;
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
        return true;
      } catch {
        return false;
      }
    }

    function setLoginDisplayNameValidation(value) {
      const reason = window.NovaNameFilter?.getViolationReason?.(value) || null;
      const invalid = !!reason;
      if (displayNameInput) {
        displayNameInput.classList.toggle('is-invalid', invalid);
        displayNameInput.setAttribute('aria-invalid', invalid ? 'true' : 'false');
      }
      const errorEl = $('#loginSettingsDisplayNameError');
      if (errorEl) {
        errorEl.hidden = !invalid;
        if (invalid) errorEl.textContent = reason;
      }
      return !invalid;
    }

    function populateSettingsForm() {
      let theme = 'nova';
      try {
        theme = localStorage.getItem(THEME_KEY) || 'nova';
      } catch { /* ignore */ }
      applyColorTheme(theme);

      if (displayNameInput) displayNameInput.value = readProfileName();
      setLoginDisplayNameValidation(readProfileName());

      if (introToggle) {
        try {
          introToggle.checked = localStorage.getItem(INTRO_KEY) !== 'false';
        } catch {
          introToggle.checked = true;
        }
      }
    }

    function setLoginSettingsTab(tabId) {
      document.querySelectorAll('[data-login-tab]').forEach((btn) => {
        const active = btn.getAttribute('data-login-tab') === tabId;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      document.querySelectorAll('[data-login-pane]').forEach((pane) => {
        const active = pane.getAttribute('data-login-pane') === tabId;
        pane.classList.toggle('is-active', active);
        pane.hidden = !active;
      });
      settingsMenuParticlesApi?.resize?.();
    }

    function openLoginSettings(tabId = 'general') {
      closeLoginModal();
      if (!settingsEl) return;
      populateSettingsForm();
      setLoginSettingsTab(tabId);
      settingsEl.hidden = false;
      settingsEl.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => {
        settingsEl.classList.add('is-open');
        loginParticlesApi?.resize?.();
        settingsMenuParticlesApi?.resize?.();
        settingsMenuParticlesApi?.startLoop?.();
      });
    }

    function closeLoginSettings() {
      if (!settingsEl || !settingsEl.classList.contains('is-open')) return;
      settingsEl.classList.remove('is-open');
      settingsEl.setAttribute('aria-hidden', 'true');
      window.setTimeout(() => {
        if (!settingsEl.classList.contains('is-open')) settingsEl.hidden = true;
      }, 220);
    }

    $('#novaLoginSettingsBtn')?.addEventListener('click', () => openLoginSettings('general'));
    settingsBackdrop?.addEventListener('click', closeLoginSettings);
    settingsClose?.addEventListener('click', closeLoginSettings);

    document.querySelectorAll('[data-login-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setLoginSettingsTab(btn.getAttribute('data-login-tab') || 'general');
      });
    });

    const bindLoginThemeSelect = () => {
      if (!themeSelect) return;
      window.NovaThemeSelect?.bind?.(themeSelect, (theme) => applyColorTheme(theme));
    };
    if (window.NovaThemeSelect) {
      bindLoginThemeSelect();
    } else {
      window.addEventListener('load', bindLoginThemeSelect, { once: true });
    }

    displayNameInput?.addEventListener('input', () => {
      const value = (displayNameInput.value || '').trim();
      setLoginDisplayNameValidation(value);
    });

    displayNameInput?.addEventListener('change', () => {
      const value = (displayNameInput.value || '').trim();
      if (!setLoginDisplayNameValidation(value)) {
        displayNameInput.value = readProfileName();
        setLoginDisplayNameValidation(readProfileName());
        return;
      }
      saveProfileName(value);
    });

    introToggle?.addEventListener('change', () => {
      try {
        localStorage.setItem(INTRO_KEY, introToggle.checked ? 'true' : 'false');
      } catch { /* ignore */ }
    });


    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (settingsEl?.classList.contains('is-open')) {
        closeLoginSettings();
      }
    });

    populateSettingsForm();
  }

  function bindModal() {
    $('#novaLoginLogoTrigger')?.addEventListener('click', () => openLoginModal());
    $('#novaLoginCtaHint')?.addEventListener('click', () => openLoginModal());
    $('#novaLoginModalClose')?.addEventListener('click', closeLoginModal);
    $('#novaLoginModalBackdrop')?.addEventListener('click', closeLoginModal);

    document.addEventListener('keydown', (e) => {
      const modal = $('#novaLoginModal');
      if (!modal?.classList.contains('is-open')) return;

      if (e.key === 'Escape') {
        closeLoginModal();
        return;
      }

      const passcodeStep = $('#novaLoginStepPasscode');
      if (!passcodeStep || passcodeStep.hidden) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        appendPasscodeDigit(e.key);
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        deletePasscodeDigit();
      }
    });
  }

  async function onLicenseContinue() {
    const keyInput = $('#novaLoginKey');
    const continueBtn = $('#novaLoginContinue');
    const licenseKey = (keyInput?.value || '').trim();

    if (!licenseKey) {
      showError('Please enter a key.');
      keyInput?.focus();
      return;
    }

    const formattedKey = formatLicenseKey(licenseKey);
    if (!validateLicenseKey(formattedKey)) {
      showError('Enter a Discord key (BLANK-XXXX-XXXX) or your BD- purchase key.');
      keyInput?.focus();
      return;
    }
    const isReset = licenseStepMode === 'reset-pin';
    const bridge = apiBridge();
    const apiCall = isReset ? bridge?.validateLicense : bridge?.redeemLicense;

    if (!apiCall) {
      showError('License service unavailable. Restart BlankDelay Controller Macro.');
      return;
    }

    showError('');
    const tip = $('#novaLoginKeyTip');
    if (tip) {
      tip.hidden = false;
      tip.textContent = 'Verifying key…';
    }
    if (continueBtn) {
      continueBtn.disabled = true;
      continueBtn.classList.add('is-loading');
      const label = $('#novaLoginContinueLabel');
      if (label) label.textContent = 'Verifying…';
    }

    try {
      const result = await apiCall(formattedKey);
      if (!result?.ok) {
        if (tip) tip.textContent = result?.message || 'That key was rejected. Try again.';
        showError(result?.message || 'That key was rejected. Try again.');
        return;
      }

      saveLicense(formattedKey);
      try {
        await bridge?.saveSession?.({
          ok: true,
          authenticated: true,
          licenseKey: formattedKey,
        });
      } catch { /* ignore */ }

      if (tip) tip.textContent = 'Key accepted — unlocking…';
      showError('');

      if (isReset) {
        clearStoredPasscode();
        licenseStepMode = 'activate';
      }

      enterApp($('#novaLogin'));
    } catch {
      showError('Activation failed. Check that the Blank Discord bot is online.');
      if (tip) tip.textContent = 'Could not reach the Blank license server.';
    } finally {
      if (continueBtn) {
        continueBtn.disabled = false;
        continueBtn.classList.remove('is-loading');
        updateLicenseStepCopy();
      }
    }
  }

  async function verifyStoredLicenseOnBoot() {
    const stored = getStoredLicense();
    if (!stored) return;

    const validate = apiBridge()?.validateLicense;
    if (!validate) return;

    try {
      const result = await validate(stored);
      if (!result?.ok && result?.code !== 'OFFLINE') {
        clearLicense();
        clearStoredPasscode();
      }
    } catch { /* stay on splash */ }
  }

  function bindForm() {
    const keyInput = $('#novaLoginKey');
    const continueBtn = $('#novaLoginContinue');
    const keypad = $('#novaLoginKeypad');
    const getKeyLink = $('#novaLoginGetKey');
    const keyToggle = $('#novaLoginKeyToggle');

    if (getKeyLink) {
      getKeyLink.href = DISCORD_KEYS_URL;
      getKeyLink.addEventListener('click', (e) => {
        e.preventDefault();
        const open = apiBridge()?.openExternal;
        if (open) void open(DISCORD_KEYS_URL);
        else window.open(DISCORD_KEYS_URL, '_blank', 'noopener');
      });
    }

    keyInput?.addEventListener('input', updateKeyCharCount);

    keyToggle?.addEventListener('click', () => {
      setKeyVisibility(keyInput?.type === 'password');
    });

    keyInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onLicenseContinue();
      }
    });

    continueBtn?.addEventListener('click', onLicenseContinue);

    keypad?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-digit]');
      if (btn) {
        appendPasscodeDigit(btn.getAttribute('data-digit'));
        return;
      }
      if (e.target.closest('#novaLoginKeyDelete')) {
        deletePasscodeDigit();
      }
    });

    $('#novaLoginPasscodeReset')?.addEventListener('click', resetPasscode);

    $('#novaLoginPasscodeLength')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-length]');
      if (!btn || passcodeMode !== 'create') return;

      const length = parseInt(btn.getAttribute('data-length'), 10);
      if (length !== 4 && length !== 6) return;

      selectedPasscodeLength = length;
      updatePasscodeLengthPicker(length);
      renderPasscodeSlots(length);
      clearPasscodeEntry();
      setPasscodeMode('create');
    });
  }

  function bindLoginWindowControls() {
    document.querySelectorAll('#novaLogin [data-win]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const action = btn.dataset.win;
        if (action === 'minimize') {
          void apiBridge()?.minimize?.();
          return;
        }
        if (action === 'maximize' || action === 'fullscreen') {
          void apiBridge()?.fullscreen?.();
          return;
        }
        if (action === 'close') {
          void apiBridge()?.close?.();
        }
      });
    });
  }

  function init() {
    try { clearStoredPasscode(); } catch (_) {}
    bindLoginWindowControls();
    if (document.documentElement.classList.contains('nova-authed')) {
      $('#novaLogin')?.remove();
      return;
    }

    const loginEl = $('#novaLogin');
    if (!loginEl) return;

    initDeviceId();
    loginParticlesApi = initParticles();
    settingsMenuParticlesApi = initSettingsMenuParticles();
    bindSettings();
    bindModal();
    bindForm();
    verifyStoredLicenseOnBoot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
