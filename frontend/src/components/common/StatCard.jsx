function StatCard({ label, value, trend, accent = '#0f766e' }) {
  return (
    <article
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: 16,
        background: '#ffffff',
      }}
    >
      <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>{label}</p>
      <h3 style={{ margin: '8px 0 4px', color: '#0f172a', fontSize: 26 }}>{value}</h3>
      <p style={{ margin: 0, color: accent, fontSize: 12 }}>{trend}</p>
    </article>
  )
}

export default StatCard
