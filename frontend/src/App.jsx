import { useEffect, useMemo, useState } from 'react'
import { authApi } from './api/axiosInstance'
import {
  useAuthStore,
  selectAuthState,
  setUserSession,
  enterGuest,
  logout,
} from './store/useAuthStore'

import Homepage from './pages/Landing/Homepage'
import Login from './pages/Auth/Login'
import Signup from './pages/Auth/Signup'
import GuestForm from './pages/Auth/GuestForm'
import RoleSelection from './pages/Auth/RoleSelectionDynamic'
import FeedbackForm from './pages/Feedback/Feedbackform'
import PrismPage from './pages/PrismPage'
import { DEFAULT_PATH_BY_ROLE } from './components/layout/navConfig'

const ROLE_TO_API = {
  Admin: 'admin',
  Manufacturer: 'manufacturer',
  Transporter: 'transporter',
  Dealer: 'dealer',
  RetailShop: 'retail_shop',
}

const PRISM_PATH_PREFIX = '/prismpage/'

const LEGACY_PATH_TO_PAGE_ID = Object.freeze({
  '/admin': 'adminDashboard',
  '/admin/dashboard': 'adminDashboard',
  '/admin/analytics': 'adminAnalytics',
  '/admin/blockchain': 'adminBlockchain',
  '/admin/blockchainmonitor': 'adminBlockchain',
  '/admin/reports': 'adminReports',
  '/admin/systemreports': 'adminReports',

  '/manufacturer': 'manufacturerOverview',
  '/manufacturer/dashboard': 'manufacturerOverview',
  '/manufacturer/production': 'manufacturerProduction',
  '/manufacturer/inventory': 'manufacturerInventory',
  '/manufacturer/analytics': 'manufacturerAnalytics',
  '/manufacturer/blockchain': 'manufacturerBlockchain',
  '/manufacturer/ledger': 'manufacturerBlockchain',

  '/transporter': 'transporterOverview',
  '/transporter/dashboard': 'transporterOverview',
  '/transporter/map': 'transporterMap',
  '/transporter/analytics': 'transporterAnalytics',
  '/transporter/ai-routes': 'transporterAnalytics',
  '/transporter/fleet': 'transporterFleet',
  '/transporter/shipments': 'transporterShipments',
  '/transporter/shipment': 'transporterShipments',

  '/dealer': 'dealerDashboard',
  '/dealer/dashboard': 'dealerDashboard',
  '/dealer/analytics': 'dealerAnalytics',
  '/dealer/orders': 'dealerOrders',
  '/dealer/wholesale': 'dealerOrders',
  '/dealer/arrivals': 'dealerArrivals',
  '/dealer/inventory': 'dealerInventory',
  '/dealer/verification': 'dealerInventory',

  '/retail': 'retailOverview',
  '/retail/dashboard': 'retailOverview',
  '/retail/scanner': 'retailScanner',
  '/retail/inventory': 'retailInventory',
  '/retail/verification': 'retailInventory',
  '/retail/sales': 'retailSales',
  '/retail/pos': 'retailPos',
})

function normalizePath(pathname) {
  const normalized = String(pathname || '/').trim().toLowerCase()
  if (!normalized.startsWith('/')) return `/${normalized}`
  return normalized
}

function toPrismPath(pageId) {
  const normalized = String(pageId || '').trim()
  if (!normalized) return ''
  return `${PRISM_PATH_PREFIX}${encodeURIComponent(normalized)}`
}

function mapPathToPrism(pathname) {
  const raw = String(pathname || '/')
  if (raw.toLowerCase().startsWith(PRISM_PATH_PREFIX)) {
    return raw
  }
  const pageId = LEGACY_PATH_TO_PAGE_ID[normalizePath(raw)]
  return pageId ? toPrismPath(pageId) : raw
}

function parsePrismPageId(pathname) {
  const raw = String(pathname || '')
  const lower = raw.toLowerCase()
  if (!lower.startsWith(PRISM_PATH_PREFIX)) return ''
  const remainder = raw.slice(PRISM_PATH_PREFIX.length)
  const pageId = remainder.split('/')[0]
  return decodeURIComponent(pageId || '').trim()
}

function normalizeRole(role) {
  const map = {
    admin: 'Admin',
    manufacturer: 'Manufacturer',
    transporter: 'Transporter',
    dealer: 'Dealer',
    retail_shop: 'RetailShop',
  }
  return map[role] ?? role
}

function App() {
  const auth = useAuthStore(selectAuthState)
  const [screen, setScreen] = useState('home')
  const [pendingRole, setPendingRole] = useState('Admin')
  const [entryIntent, setEntryIntent] = useState('login')
  const [logoutFeedbackPrefill, setLogoutFeedbackPrefill] = useState(null)
  const [currentPath, setCurrentPath] = useState(() =>
    typeof window === 'undefined' ? '/' : mapPathToPrism(window.location.pathname),
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handlePopState = () => {
      const mapped = mapPathToPrism(window.location.pathname)
      if (mapped !== window.location.pathname) {
        window.history.replaceState({}, '', mapped)
      }
      setCurrentPath(mapped)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (path, { replace = false } = {}) => {
    if (typeof window === 'undefined') {
      return
    }
    const mapped = mapPathToPrism(path)
    const current = window.location.pathname
    if (current !== mapped) {
      const fn = replace ? window.history.replaceState : window.history.pushState
      fn.call(window.history, {}, '', mapped)
    }
    setCurrentPath(mapped)
  }

  const handleLogout = () => {
    const activeUser = auth.user
    const activeRole = auth.role

    setLogoutFeedbackPrefill({
      name: activeUser?.name || '',
      email: activeUser?.email || '',
      role: activeRole === 'RetailShop' ? 'Retail Shop' : activeRole || '',
      source: 'logout_form',
    })

    logout()
    setScreen('feedback')
    setEntryIntent('login')
    navigate('/feedback')
  }

  const openRoleSelection = (intent) => {
    setEntryIntent(intent)
    setPendingRole((previousRole) => (
      intent !== 'login' && previousRole === 'Admin' ? 'Manufacturer' : previousRole
    ))
    setScreen('role-selection')
  }

  const prismPageId = useMemo(() => parsePrismPageId(currentPath), [currentPath])

  useEffect(() => {
    if (!auth.role) return
    if (!auth.user && !auth.isGuest) return

    if (currentPath === '/' || !prismPageId) {
      const fallback = DEFAULT_PATH_BY_ROLE[auth.role] ?? '/'
      navigate(fallback, { replace: true })
      return
    }

    const mapped = mapPathToPrism(currentPath)
    if (mapped !== currentPath) {
      navigate(mapped, { replace: true })
    }
  }, [auth.isGuest, auth.role, auth.user, currentPath, prismPageId])

  if (screen === 'feedback') {
    return (
      <FeedbackForm
        initialData={logoutFeedbackPrefill}
        onSubmitted={() => {
          setLogoutFeedbackPrefill(null)
          setScreen('home')
          navigate('/')
        }}
      />
    )
  }

  if ((auth.user && auth.role) || (auth.isGuest && auth.role)) {
    if (prismPageId) {
      return (
        <PrismPage
          pageId={prismPageId}
          user={auth.user}
          role={auth.role}
          isGuest={auth.isGuest}
          onLogout={handleLogout}
          onNavigate={navigate}
          currentPath={currentPath}
        />
      )
    }

    return (
      <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        Loading page...
      </main>
    )
  }

  if (screen === 'login') {
    return (
      <Login
        role={pendingRole}
        onBack={() => openRoleSelection('login')}
        onSignupClick={() => openRoleSelection('signup')}
        onGuestClick={() => openRoleSelection('guest')}
        onSubmit={async ({ email, password }) => {
          const data = await authApi.login({
            email,
            password,
            role: ROLE_TO_API[pendingRole],
          })

          const normalizedRole = normalizeRole(data.role)
          navigate(DEFAULT_PATH_BY_ROLE[normalizedRole] ?? '/', { replace: true })

          setUserSession({
            user: { ...data.user, token: data.access_token },
            role: normalizedRole,
          })
        }}
      />
    )
  }

  if (screen === 'signup') {
    return (
      <Signup
        role={pendingRole}
        onBack={() => setScreen(entryIntent === 'signup' ? 'role-selection' : 'login')}
        onLoginClick={() => {
          setEntryIntent('login')
          setScreen('login')
        }}
        onSubmit={async ({ name, email, password }) => {
          const data = await authApi.signup({
            name,
            email,
            password,
            role: ROLE_TO_API[pendingRole],
          })

          const normalizedRole = normalizeRole(data.role)
          navigate(DEFAULT_PATH_BY_ROLE[normalizedRole] ?? '/', { replace: true })

          setUserSession({
            user: { ...data.user, token: data.access_token },
            role: normalizedRole,
          })
        }}
      />
    )
  }

  if (screen === 'guest') {
    return (
      <GuestForm
        role={pendingRole}
        onBack={() => setScreen('role-selection')}
        onSubmit={async (guestData) => {
          const apiRole = ROLE_TO_API[guestData.role] || ROLE_TO_API[pendingRole] || 'dealer'
          try {
            await authApi.guestEntry({
              name: guestData.user?.name || 'Guest User',
              email: guestData.user?.email || 'guest@example.com',
              company: guestData.user?.company || 'Guest Company',
              phone: guestData.user?.phone || 'N/A',
              role: apiRole,
            })
          } catch (error) {
            // Do not block guest access if backend persistence is temporarily unavailable.
            console.warn('Guest form persistence failed:', error)
          }

          enterGuest(guestData.role, guestData.user?.name)
          navigate(DEFAULT_PATH_BY_ROLE[guestData.role] ?? '/', { replace: true })
        }}
      />
    )
  }

  if (screen === 'role-selection') {
    return (
      <RoleSelection
        selectedRole={pendingRole}
        includeAdmin={entryIntent === 'login'}
        onBack={() => {
          setEntryIntent('login')
          setScreen('home')
        }}
        onSelectRole={(role) => {
          setPendingRole(role)
          if (entryIntent === 'guest') {
            setScreen('guest')
            return
          }

          if (entryIntent === 'signup') {
            setScreen('signup')
            return
          }

          setScreen('login')
        }}
      />
    )
  }

  return (
    <Homepage
      onGuestEntry={() => openRoleSelection('guest')}
      onLoginClick={() => openRoleSelection('login')}
      onSignupClick={() => openRoleSelection('signup')}
    />
  )
}

export default App
