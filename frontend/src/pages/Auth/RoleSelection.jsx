import './roleselection.css'

const ROLES = [
  {
    id: 'Admin',
    icon: '👨‍💼',
    title: 'Admin',
    description: 'Full system control and oversight',
  },
  {
    id: 'Manufacturer',
    icon: '🏭',
    title: 'Manufacturer',
    description: 'Production and batch management',
  },
  {
    id: 'Transporter',
    icon: '🚚',
    title: 'Transporter',
    description: 'Fleet tracking and logistics',
  },
  {
    id: 'Dealer',
    icon: '🤝',
    title: 'Dealer',
    description: 'Distribution and wholesale',
  },
  {
    id: 'RetailShop',
    icon: '🏪',
    title: 'Retail Shop',
    description: 'POS and inventory management',
  },
]

function RoleSelection({ selectedRole, onSelectRole, onSelect, onBack }) {
  const handleSelect = onSelectRole || onSelect

  return (
    <main className="role-selection-scene role-selection-theme-matrix">
      <div className="role-selection-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      <section className="role-selection-container">
        <div className="role-selection-header">
          <h1 className="role-selection-title">Choose Your Role</h1>
          <p className="role-selection-subtitle">
            Select your role to access the appropriate dashboard and features
          </p>
        </div>

        <div className="role-grid">
          {ROLES.map((role) => {
            const active = role.id === selectedRole
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => handleSelect?.(role.id)}
                className={`role-card ${active ? 'active' : ''}`}
              >
                <div className="role-card-icon">{role.icon}</div>
                <h3 className="role-card-title">{role.title}</h3>
                <p className="role-card-description">{role.description}</p>
                <div className="role-card-arrow">→</div>
                {active && <div className="role-card-checkmark">✓</div>}
              </button>
            )
          })}
        </div>

        <div className="role-selection-actions">
          <button type="button" onClick={onBack} className="btn-back">
            ← Back to Homepage
          </button>
        </div>

      </section>
    </main>
  )
}

export default RoleSelection
