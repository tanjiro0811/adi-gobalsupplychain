import Badge from '../ui/Badge'

function UserMenu({ userName, notifications = 0, onLogout }) {
  return (
    <div className="user-menu">
      <Badge label={`${notifications} Alerts`} variant={notifications ? 'pending' : 'neutral'} />
      <Badge label={userName ?? 'User'} variant="active" />
      <button type="button" className="subtle-btn" onClick={onLogout}>
        Logout
      </button>
    </div>
  )
}

export default UserMenu
