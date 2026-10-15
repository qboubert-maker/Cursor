const LOGO = `${import.meta.env.BASE_URL}Blank Delay Logo.png`

export default function LoginHeader({ children }) {
  const win = window.optimizerWindow

  return (
    <header className="blank-login__bar">
      <div className="blank-login__brand">
        <span className="blank-login__mark" aria-hidden="true">
          <img src={LOGO} alt="" />
        </span>
        <span>BLANK OPTIMIZER</span>
      </div>
      {children}
      <div className="blank-login__chrome">
        <button type="button" aria-label="Minimize" onClick={() => win?.minimize()}>–</button>
        <button type="button" aria-label="Full screen" onClick={() => win?.maximize()}>□</button>
        <button type="button" aria-label="Close" onClick={() => win?.close()}>×</button>
      </div>
    </header>
  )
}
