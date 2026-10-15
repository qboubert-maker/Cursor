import DiscordIcon from '../icons/DiscordIcon.jsx'

export default function AuthForm({ licenseKey, error, busy, onLicenseKey, onSubmit, onDiscord }) {
  return (
    <form className="blank-login__form" onSubmit={onSubmit}>
      <h1 className="blank-login__title">Welcome back</h1>
      <p className="blank-login__subtitle">Sign in to sync your license, referrals & discounts.</p>
      <div className="blank-login__fields">
        <label className="blank-login__field">
          <span>LICENSE KEY</span>
          <input
            type="text"
            name="license"
            autoComplete="off"
            spellCheck="false"
            placeholder="Enter your license key"
            value={licenseKey}
            onChange={(event) => onLicenseKey(event.target.value)}
          />
        </label>
      </div>
      <button type="submit" className="blank-login__submit rounded-full bg-gradient-to-r from-red-800 to-rose-900" disabled={busy}>
        {busy ? 'CHECKING…' : 'LOGIN'}
      </button>
      <p className="blank-login__error" role="status">{error}</p>
      <div className="blank-login__or" aria-hidden="true">or</div>
      <button type="button" className="blank-login__google" onClick={onDiscord}>
        <DiscordIcon width={18} height={18} />
        Join Discord
      </button>
    </form>
  )
}
