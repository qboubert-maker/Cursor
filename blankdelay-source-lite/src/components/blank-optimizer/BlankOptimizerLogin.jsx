import { useEffect, useState } from 'react'
import AuthForm from './AuthForm.jsx'
import CharacterPanel from './CharacterPanel.jsx'
import OptimizerSocials from './OptimizerSocials.jsx'
import ControllerInput from './ControllerInput.jsx'
import GameLibrary from './GameLibrary.jsx'
import LoginHeader from './LoginHeader.jsx'
import RadialNav from './RadialNav.jsx'
import ClipsPage from './ClipsPage.jsx'
import TeamPage from './TeamPage.jsx'
import TweaksPage from './TweaksPage.jsx'
import KeyboardPage from './KeyboardPage.jsx'
import OptimizerSettings from './OptimizerSettings.jsx'
import SectionPlaceholder from './SectionPlaceholder.jsx'
import { useClipCapture } from './useClipCapture.js'
import { loadTweakState } from './tweakState.js'
import { SECTIONS } from './sections.jsx'
import './blank-optimizer.css'

export default function BlankOptimizerLogin() {
  const [licenseKey, setLicenseKey] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [checking, setChecking] = useState(true)
  const [page, setPage] = useState('dashboard')
  const [pad, setPad] = useState('ps5')
  const [controllerReady, setControllerReady] = useState(false)
  const clips = useClipCapture({ enabled: signedIn, onShow: () => setPage('clips') })

  useEffect(() => {
    if (page === 'controller') setControllerReady(true)
  }, [page])

  useEffect(() => {
    if (!signedIn) return undefined
    let idle = 0
    const timer = window.setTimeout(() => {
      const warm = () => {
        setControllerReady(true)
        loadTweakState()
      }
      if (window.requestIdleCallback) idle = window.requestIdleCallback(warm, { timeout: 2500 })
      else warm()
    }, 900)
    return () => {
      window.clearTimeout(timer)
      if (idle) window.cancelIdleCallback(idle)
    }
  }, [signedIn])

  useEffect(() => {
    const restore = window.optimizerWindow?.restoreLicense
    if (!restore) {
      setChecking(false)
      return
    }
    restore()
      .then((result) => setSignedIn(Boolean(result?.ok)))
      .finally(() => setChecking(false))
  }, [])

  const onSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    if (!licenseKey.trim()) {
      setError('Enter your license key.')
      return
    }
    const redeem = window.optimizerWindow?.redeemLicense
    if (!redeem) {
      setError('Open The Blank Optimizer desktop app to sign in.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await redeem(licenseKey)
      if (result?.ok) {
        setSignedIn(true)
        setLicenseKey('')
      } else {
        setError(result?.message || 'That key was rejected.')
      }
    } catch {
      setError('Could not reach the Blank license bot.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={`blank-login${signedIn ? ' is-signed-in' : ''}`}>
      <div className="blank-login__atmosphere" />
      <LoginHeader>
        {signedIn && page === 'controller' ? (
          <div className="blank-login__switch" role="tablist" aria-label="Controller">
            <button type="button" role="tab" aria-selected={pad === 'ps5'} className={pad === 'ps5' ? 'is-on' : ''} onClick={() => setPad('ps5')}>PlayStation</button>
            <button type="button" role="tab" aria-selected={pad === 'xbox'} className={pad === 'xbox' ? 'is-on' : ''} onClick={() => setPad('xbox')}>Xbox</button>
          </div>
        ) : null}
      </LoginHeader>
      {checking ? null : signedIn ? (
        <>
          {page === 'dashboard' ? (
            <GameLibrary />
          ) : page === 'socials' ? (
            <OptimizerSocials />
          ) : page === 'clips' ? (
            <ClipsPage clips={clips} />
          ) : page === 'team' ? (
            <TeamPage />
          ) : page === 'tweaks' ? (
            <TweaksPage />
          ) : page === 'keyboard' ? (
            <KeyboardPage />
          ) : page === 'settings' ? (
            <OptimizerSettings />
          ) : page !== 'controller' && SECTIONS.some((section) => section.id === page) ? (
            <SectionPlaceholder section={SECTIONS.find((section) => section.id === page)} />
          ) : null}
          {controllerReady ? (
            <div className={page === 'controller' ? 'blank-pad-layer' : 'blank-pad-layer is-parked'} aria-hidden={page !== 'controller'}>
              <ControllerInput pad={pad} onPadChange={setPad} live={page === 'controller'} />
            </div>
          ) : null}
          <RadialNav active={page} onSelect={setPage} />
        </>
      ) : (
        <section className="blank-login__card rounded-2xl border border-red-900/30 bg-black/60">
          <div className="blank-login__grid">
            <CharacterPanel />
            <AuthForm
              licenseKey={licenseKey}
              error={error}
              busy={busy}
              onLicenseKey={setLicenseKey}
              onSubmit={onSubmit}
              onDiscord={() => window.optimizerWindow?.openDiscord?.()}
            />
          </div>
        </section>
      )}
    </main>
  )
}
