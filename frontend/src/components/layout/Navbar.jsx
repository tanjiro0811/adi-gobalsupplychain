function Navbar({ userName, notifications = 0, onLogout }) {
  return (
    <header
      style={{
        padding: '14px 18px',
        borderBottom: '1px solid #e2e8f0',
        background: '#ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div>
        <strong style={{ color: '#0f172a' }}>{userName ?? 'User'}</strong>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span
          style={{
            fontSize: 12,
            padding: '4px 8px',
            borderRadius: 999,
            border: '1px solid #cbd5e1',
            color: '#334155',
          }}
        >
          Notifications: {notifications}
        </span>
        <button
          type="button"
          onClick={onLogout}
          style={{
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            padding: '6px 10px',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </div>
    </header>
  )
}

export default Navbar
