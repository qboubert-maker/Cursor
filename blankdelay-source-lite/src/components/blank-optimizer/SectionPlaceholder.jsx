export default function SectionPlaceholder({ section }) {
  return (
    <section className="blank-section">
      <div className="blank-section__glow" aria-hidden="true" />
      <div className="blank-section__body">
        <span className="blank-section__icon" aria-hidden="true">{section.icon}</span>
        <h1>{section.label}</h1>
        <p>{section.blurb}</p>
        <span className="blank-section__soon">Coming soon to The Blank Optimizer</span>
      </div>
    </section>
  )
}
