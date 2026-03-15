import { ROLE_LINKS } from './navConfig'

function Sidebar({ role, activeLink = 'Dashboard', onNavigate }) {
  const links = ROLE_LINKS[role] ?? ['Dashboard']

  return (
    <aside className="nav-sidebar">
      <div className="brand-block">
        <p className="brand-name">Global Chain MS</p>
        <p className="brand-role">{role ?? 'Portal'}</p>
      </div>

      <nav className="nav-links">
        {links.map((link) => (
          <button
            key={link}
            type="button"
            className="nav-link"
            data-active={link === activeLink}
            onClick={() => onNavigate?.(link)}
          >
            {link}
          </button>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
