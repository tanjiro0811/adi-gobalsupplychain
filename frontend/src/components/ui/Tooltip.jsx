function Tooltip({ label, text }) {
  return (
    <span title={text} style={{ cursor: 'help', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {label}
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: '1px solid #94a3b8',
          color: '#64748b',
          display: 'grid',
          placeItems: 'center',
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        ?
      </span>
    </span>
  )
}

export default Tooltip
