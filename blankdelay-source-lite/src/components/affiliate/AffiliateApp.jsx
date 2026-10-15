import { useEffect, useState } from 'react'
import { CHECKOUT_PRODUCTS, formatPrice } from '../../lib/checkoutCatalog'
import AffiliateSky from './AffiliateSky'
import './affiliate.css'

const LOGO = '/Blank%20Delay%20Logo.png'
const LINK_ROOT = 'BlankDelay.com'

const money = (cents) => formatPrice(Math.round(cents || 0))

const when = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function useCount(value) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const from = 0
    const started = performance.now()
    let frame = 0
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / 800)
      const eased = 1 - (1 - progress) ** 3
      setShown(from + (value - from) * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return shown
}

function Metric({ label, value, money: asMoney }) {
  const shown = useCount(value)
  return (
    <article className="affiliate__card">
      <span>{label}</span>
      <strong>{asMoney ? money(shown) : Math.round(shown).toLocaleString('en-US')}</strong>
    </article>
  )
}

async function post(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed')
    error.code = data.code || ''
    throw error
  }
  return data
}

function BannedNotice({ onClose }) {
  return (
    <div className="affiliate__ban" role="dialog" aria-modal="true" aria-labelledby="affiliate-ban-title">
      <button className="affiliate__ban-backdrop" type="button" aria-label="Close" onClick={onClose} />
      <div className="affiliate__ban-card">
        <span className="affiliate__mark affiliate__seal" aria-hidden="true">
          <img src={LOGO} alt="" />
        </span>
        <p className="affiliate__eyebrow">Blank Delay</p>
        <h2 id="affiliate-ban-title">You have been banned</h2>
        <p>You have been banned for violating the terms of service of our company's policy.</p>
        <button className="affiliate__primary" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}

function AuthScreen({ onReady, onBanned }) {
  const [mode, setMode] = useState('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const path = mode === 'signup' ? '/api/affiliate/signup' : mode === 'program' ? '/api/affiliate/admin-key' : '/api/affiliate/login'
      const data = await post(path, mode === 'program' ? { key } : { name, email, password })
      onReady(data.user)
    } catch (err) {
      if (err.code === 'banned') onBanned()
      else setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="affiliate__auth" onSubmit={submit}>
      <span className="affiliate__mark affiliate__seal" aria-hidden="true">
        <img src={LOGO} alt="" />
      </span>
      <p className="affiliate__eyebrow">Blank Delay</p>
      <h1>
        {mode === 'program' ? 'Program login' : mode === 'signup' ? 'Create your affiliate account' : 'Affiliate login'}
      </h1>
      <p>
        {mode === 'program'
          ? 'Enter the Affiliate Admin key from the Blank Delay Discord bot.'
          : 'Earn 10% of every sale that comes through your link.'}
      </p>
      <div className="affiliate__switch">
        <button type="button" aria-pressed={mode === 'signup'} onClick={() => setMode('signup')}>
          Sign up
        </button>
        <button type="button" aria-pressed={mode === 'login'} onClick={() => setMode('login')}>
          Log in
        </button>
        <button type="button" aria-pressed={mode === 'program'} onClick={() => setMode('program')}>
          Program
        </button>
      </div>
      {mode === 'program' ? (
        <label className="affiliate__field">
          Admin key
          <input
            value={key}
            onChange={(event) => setKey(event.target.value.toUpperCase())}
            autoComplete="off"
            spellCheck={false}
            placeholder="BLANK-AA-XXXX-XXXX"
            required
          />
        </label>
      ) : (
        <>
          {mode === 'signup' ? (
            <label className="affiliate__field">
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
            </label>
          ) : null}
          <label className="affiliate__field">
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          </label>
          <label className="affiliate__field">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={8}
              required
            />
          </label>
        </>
      )}
      {error ? <p className="affiliate__error">{error}</p> : null}
      <button className="affiliate__primary" type="submit" disabled={busy}>
        {busy ? 'Please wait' : mode === 'program' ? 'Enter program' : mode === 'signup' ? 'Create account' : 'Log in'}
      </button>
    </form>
  )
}

function Dashboard({ user, onLogout, onBanned }) {
  const [stats, setStats] = useState(null)
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const response = await fetch('/api/affiliate/stats')
    const data = await response.json().catch(() => ({}))
    if (data.code === 'banned') {
      onBanned()
      return
    }
    if (response.status === 401) {
      onLogout()
      return
    }
    if (!response.ok) throw new Error(data.error || 'Dashboard could not be loaded.')
    setStats(data)
    setSlug(data.slug || '')
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
    const timer = setInterval(() => {
      load().catch(() => {})
    }, 8000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 1800)
    return () => clearTimeout(timer)
  }, [toast])

  const link = stats?.slug ? `https://blankdelay.com/${stats.slug}` : ''

  const saveLink = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await post('/api/affiliate/create-link', { slug })
      await load()
      setToast('Link saved')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      const field = document.createElement('textarea')
      field.value = link
      document.body.appendChild(field)
      field.select()
      document.execCommand('copy')
      field.remove()
    }
    setToast('Link copied')
  }

  return (
    <>
      <header className="affiliate__stage">
        <p className="affiliate__eyebrow">10% of every sale</p>
        <h1>
          Affiliate
          <span className="affiliate__outline"> desk</span>
        </h1>
        <p>{user.name}, your link, clicks, and commission live here.</p>
      </header>
      <section className="affiliate__metrics" aria-label="Affiliate totals">
        <Metric label="Total earnings" value={stats?.totalEarningsCents || 0} money />
        <Metric label="Link clicks" value={stats?.clicks || 0} />
        <Metric label="Conversions" value={stats?.conversions || 0} />
      </section>

      <form className="affiliate__link" onSubmit={saveLink}>
        <p className="affiliate__eyebrow">10% commission</p>
        <h2>Your referral link</h2>
        <p>Add the name after {LINK_ROOT}. Shoppers who buy through it credit 10% of the sale to {user.name}.</p>
        <div className="affiliate__row">
          <label className="affiliate__field">
            Handle
            <span className="affiliate__handle">
              <span>{LINK_ROOT}/</span>
              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24))}
                placeholder="yourname"
                required
              />
            </span>
          </label>
          <button className="affiliate__ghost" type="submit" disabled={busy}>
            Save link
          </button>
        </div>
        {link ? (
          <div className="affiliate__url">
            <span>{link}</span>
            <button className="affiliate__copy" type="button" onClick={copy}>
              Copy
            </button>
          </div>
        ) : null}
        {error ? <p className="affiliate__error">{error}</p> : null}
      </form>

      <div className="affiliate__ledger">
      <section className="affiliate__panel">
        <h2>Sales</h2>
        {stats?.sales?.length ? (
          <div className="affiliate__table-wrap">
            <table className="affiliate__table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Sale</th>
                  <th>Commission</th>
                </tr>
              </thead>
              <tbody>
                {stats.sales.map((sale) => (
                  <tr key={sale.id}>
                    <td>{sale.orderId.slice(0, 18)}</td>
                    <td>{when(sale.createdAt)}</td>
                    <td>{CHECKOUT_PRODUCTS[sale.productId]?.name || sale.productId || 'Blank Delay'}</td>
                    <td>{money(sale.totalCents)}</td>
                    <td>{money(sale.commissionCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="affiliate__empty">Completed purchases from your link show up here.</p>
        )}
      </section>

      <section className="affiliate__panel">
        <h2>Clicks</h2>
        {stats?.clicksLog?.length ? (
          <div className="affiliate__table-wrap">
            <table className="affiliate__table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Device</th>
                </tr>
              </thead>
              <tbody>
                {stats.clicksLog.map((click) => (
                  <tr key={click.id}>
                    <td>{when(click.createdAt)}</td>
                    <td>{click.device || 'Visit'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="affiliate__empty">Every device that opens the link counts, including phones. The same browser counts once every 24 hours.</p>
        )}
      </section>
      </div>
      {toast ? <div className="affiliate__toast">{toast}</div> : null}
    </>
  )
}

function ProgramBoard({ query }) {
  const [roster, setRoster] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    fetch('/api/affiliate/roster')
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'The program list could not be loaded.')
        setRoster(data)
      })
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, 8000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 2400)
    return () => clearTimeout(timer)
  }, [notice])

  const resetEarnings = async (userId, label) => {
    const message = userId
      ? `Reset earnings for ${label} to $0?`
      : "Reset every affiliate's earnings to $0?"
    if (!window.confirm(message)) return
    setBusy(true)
    setError('')
    try {
      const data = await post('/api/affiliate/reset-earnings', userId ? { userId } : {})
      setRoster(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const setBan = async (person) => {
    const message = person.banned
      ? `Unban ${person.email}? They can sign in again. Their old link stays removed.`
      : `Ban ${person.email} and remove their affiliate link? They will be emailed.`
    if (!window.confirm(message)) return
    setBusy(true)
    setError('')
    try {
      const data = await post(person.banned ? '/api/affiliate/unban' : '/api/affiliate/ban', { email: person.email })
      setRoster(data)
      setNotice(person.banned ? 'Unbanned' : data.emailed ? 'Banned and emailed' : 'Banned. The notice email could not be sent.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const needle = query.trim().toLowerCase()
  const people = (roster?.people || []).filter((person) => !needle || person.email.toLowerCase().includes(needle))
  const emptyCopy = !roster
    ? 'Loading the program.'
    : roster.people.length && !people.length
      ? 'No affiliate uses that email.'
      : 'No affiliates have joined yet.'

  return (
    <>
      <header className="affiliate__stage">
        <p className="affiliate__eyebrow">Program Admin</p>
        <h1>
          Affiliate
          <span className="affiliate__outline"> earnings</span>
        </h1>
        <p>Everyone in the program, and the commission each link has earned.</p>
      </header>
      <section className="affiliate__metrics" aria-label="Program totals">
        <Metric label="Program earnings" value={roster?.totalEarningsCents || 0} money />
        <Metric label="Affiliates" value={roster?.affiliates ?? roster?.people?.filter((person) => !person.banned).length ?? 0} />
        <Metric label="Sales" value={roster?.conversions || 0} />
      </section>
      <section className="affiliate__panel">
        <div className="affiliate__split">
          <div>
            <h2>Reset earnings</h2>
            <p>Set one member back to $0, or clear every commission in the program. Clicks and sales stay on the record.</p>
          </div>
          <button className="affiliate__ghost" type="button" disabled={busy || !roster?.people?.length} onClick={() => resetEarnings('', '')}>
            Reset everyone's earnings
          </button>
        </div>
      </section>
      <section className="affiliate__panel">
        <h2>Affiliates</h2>
        {error ? <p className="affiliate__error">{error}</p> : null}
        {people.length ? (
          <div className="affiliate__table-wrap">
            <table className="affiliate__table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Link</th>
                  <th>Clicks</th>
                  <th>Sales</th>
                  <th>Earnings</th>
                  <th>Reset</th>
                  <th>Ban</th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person.id} className={person.banned ? 'is-banned' : undefined}>
                    <td>{person.name}</td>
                    <td>{person.email}</td>
                    <td>
                      {person.banned ? (
                        'Removed'
                      ) : person.slug ? (
                        <span className="affiliate__linkname">
                          <em>Has link</em>
                          <strong>{person.slug}</strong>
                        </span>
                      ) : (
                        'No link'
                      )}
                    </td>
                    <td>{person.clicks.toLocaleString('en-US')}</td>
                    <td>{person.conversions.toLocaleString('en-US')}</td>
                    <td>{money(person.totalEarningsCents)}</td>
                    <td>
                      {String(person.id).startsWith('banned:') ? (
                        '—'
                      ) : (
                        <button className="affiliate__mini" type="button" disabled={busy} onClick={() => resetEarnings(person.id, person.name)}>
                          Reset
                        </button>
                      )}
                    </td>
                    <td>
                      <button className="affiliate__mini" type="button" disabled={busy} onClick={() => setBan(person)}>
                        {person.banned ? 'Unban' : 'Ban'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="affiliate__empty">{emptyCopy}</p>
        )}
      </section>
      {notice ? <div className="affiliate__toast">{notice}</div> : null}
    </>
  )
}

export default function AffiliateApp() {
  const [user, setUser] = useState(undefined)
  const [query, setQuery] = useState('')
  const [banned, setBanned] = useState(false)

  useEffect(() => {
    document.title = 'Affiliates — Blank Delay'
    fetch('/api/affiliate/me')
      .then((response) => response.json())
      .then((data) => {
        if (data.banned) {
          setBanned(true)
          setUser(null)
          return
        }
        setUser(data.user || null)
      })
      .catch(() => setUser(null))
  }, [])

  const logout = async () => {
    await fetch('/api/affiliate/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
    setQuery('')
  }

  return (
    <div className="affiliate">
      <AffiliateSky />
      <div className="affiliate__veil" />
      <div className="affiliate__grain" />
      <div className="affiliate__content">
      <header className="affiliate__bar">
        <a className="affiliate__brand" href="/" aria-label="Blank Delay">
          <span className="affiliate__mark">
            <img src={LOGO} alt="" />
          </span>
          <strong>BLANK DELAY</strong>
        </a>
        <nav className="affiliate__nav">
          {user?.role === 'admin' ? (
            <label className="affiliate__search">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search email"
                aria-label="Search affiliate emails"
                spellCheck={false}
              />
            </label>
          ) : null}
          {user ? <span>{user.role === 'admin' ? 'Program Admin' : user.email}</span> : null}
          <a href="/">Store</a>
          {user ? (
            <button className="affiliate__text-button" type="button" onClick={logout}>
              Log out
            </button>
          ) : null}
        </nav>
      </header>
      <main className="affiliate__main">
        {user === undefined ? <p className="affiliate__empty">Loading your dashboard.</p> : null}
        {user === null ? <AuthScreen onReady={setUser} onBanned={() => setBanned(true)} /> : null}
        {user?.role === 'admin' ? <ProgramBoard query={query} /> : null}
        {user && user.role !== 'admin' ? <Dashboard user={user} onLogout={() => setUser(null)} onBanned={() => { setUser(null); setBanned(true) }} /> : null}
      </main>
      </div>
      {banned ? <BannedNotice onClose={() => setBanned(false)} /> : null}
    </div>
  )
}
