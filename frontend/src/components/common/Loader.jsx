function Loader({ label = 'Loading...' }) {
  return (
    <section className="card">
      <div className="ai-toast">
        <span>...</span>
        <span>{label}</span>
      </div>
    </section>
  )
}

export default Loader
