const CLASS_BY_VARIANT = {
  active: 'pill active',
  pending: 'pill pending',
  suspended: 'pill suspended',
  neutral: 'pill',
}

function Badge({ label, variant = 'neutral' }) {
  return <span className={CLASS_BY_VARIANT[variant] ?? CLASS_BY_VARIANT.neutral}>{label}</span>
}

export default Badge
