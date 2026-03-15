import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
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
import RoleSelection from './pages/Auth/RoleSelection'
import FeedbackForm from './pages/Feedback/Feedbackform'

const AdminDashboard = lazy(() => import('./pages/Admin/Dashboard'))
const AdminAnalytics = lazy(() => import('./pages/Admin/Analytics'))
const AdminBlockchainMonitor = lazy(() => import('./pages/Admin/BlockchainMonitor'))
const AdminSystemReport = lazy(() => import('./pages/Admin/Systemreport'))
const AIChat = lazy(() => import('./pages/Shared/AIChat'))
const ManufacturerDashboard = lazy(() => import('./pages/Manufacturer/Dashboard'))
const TransporterDashboard = lazy(() => import('./pages/Transporter/Dashboard'))
const DealerDashboard = lazy(() => import('./pages/Dealer/Dashboard'))
const DealerOrders = lazy(() => import('./pages/Dealer/Orders'))
const DealerArrivals = lazy(() => import('./pages/Dealer/Arrivals'))
const DealerInventory = lazy(() => import('./pages/Dealer/Inventory'))
const DealerAnalytics = lazy(() => import('./pages/Dealer/Analytics'))
const RetailShopDashboard = lazy(() => import('./pages/RetailShop/Dashboard'))

const ROLE_TO_API = {
  Admin: 'admin',
  Manufacturer: 'manufacturer',
  Transporter: 'transporter',
  Dealer: 'dealer',
  RetailShop: 'retail_shop',
}

const DEFAULT_PATH_BY_ROLE = {
  Admin: '/admin/dashboard',
  Manufacturer: '/manufacturer/dashboard',
  Transporter: '/transporter/dashboard',
  Dealer: '/dealer/dashboard',
  RetailShop: '/retail/dashboard',
}

function getRoleView(role, pathname) {
  const normalizedPath = String(pathname || '').toLowerCase()

  if (role === 'Admin') {
    if (normalizedPath === '/admin/chat') {
      return { Component: AIChat, viewProps: { role: 'Admin' } }
    }
    const map = {
      '/admin': AdminDashboard,
      '/admin/dashboard': AdminDashboard,
      '/admin/analytics': AdminAnalytics,
      '/admin/blockchain': AdminBlockchainMonitor,
      '/admin/blockchainmonitor': AdminBlockchainMonitor,
      '/admin/reports': AdminSystemReport,
      '/admin/systemreports': AdminSystemReport,
    }
    return { Component: map[normalizedPath] ?? AdminDashboard, viewProps: {} }
  }

  if (role === 'Manufacturer') {
    if (normalizedPath === '/manufacturer/chat') {
      return { Component: AIChat, viewProps: { role: 'Manufacturer' } }
    }
    const viewByPath = {
      '/manufacturer': 'overview',
      '/manufacturer/dashboard': 'overview',
      '/manufacturer/production': 'production',
      '/manufacturer/inventory': 'inventory',
      '/manufacturer/analytics': 'analytics',
      '/manufacturer/blockchain': 'blockchain',
      '/manufacturer/ledger': 'blockchain',
    }
    return {
      Component: ManufacturerDashboard,
      viewProps: { initialView: viewByPath[normalizedPath] ?? 'overview' },
    }
  }

  if (role === 'Transporter') {
    if (normalizedPath === '/transporter/chat') {
      return { Component: AIChat, viewProps: { role: 'Transporter' } }
    }
    const viewByPath = {
      '/transporter': 'overview',
      '/transporter/dashboard': 'overview',
      '/transporter/map': 'map',
      '/transporter/analytics': 'analytics',
      '/transporter/ai-routes': 'analytics',
      '/transporter/fleet': 'fleet',
      '/transporter/shipments': 'shipments',
      '/transporter/shipment': 'shipments',
    }
    return {
      Component: TransporterDashboard,
      viewProps: { initialView: viewByPath[normalizedPath] ?? 'overview' },
    }
  }

  if (role === 'Dealer') {
    if (normalizedPath === '/dealer/chat') {
      return { Component: AIChat, viewProps: { role: 'Dealer' } }
    }
    const map = {
      '/dealer': DealerDashboard,
      '/dealer/dashboard': DealerDashboard,
      '/dealer/orders': DealerOrders,
      '/dealer/wholesale': DealerOrders,
      '/dealer/arrivals': DealerArrivals,
      '/dealer/inventory': DealerInventory,
      '/dealer/verification': DealerInventory,
      '/dealer/analytics': DealerAnalytics,
    }
    return { Component: map[normalizedPath] ?? DealerDashboard, viewProps: {} }
  }

  if (role === 'RetailShop') {
    if (normalizedPath === '/retail/chat') {
      return { Component: AIChat, viewProps: { role: 'RetailShop' } }
    }
    const viewByPath = {
      '/retail': 'overview',
      '/retail/dashboard': 'overview',
      '/retail/scanner': 'scanner',
      '/retail/inventory': 'inventory',
      '/retail/verification': 'inventory',
      '/retail/sales': 'sales',
      '/retail/pos': 'pos',
    }
    return {
      Component: RetailShopDashboard,
      viewProps: { initialView: viewByPath[normalizedPath] ?? 'overview' },
    }
  }

  return { Component: null, viewProps: {} }
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
    typeof window === 'undefined' ? '/' : window.location.pathname,
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handlePopState = () => setCurrentPath(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (path) => {
    if (typeof window === 'undefined') {
      return
    }
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path)
    }
    setCurrentPath(path)
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

  const { Component: Dashboard, viewProps } = useMemo(() => {
    return getRoleView(auth.role, currentPath)
  }, [auth.role, currentPath])

  const dashboardFallback = (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>Loading dashboard...</main>
  )

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

  if (auth.isGuest && Dashboard) {
    return (
      <Suspense fallback={dashboardFallback}>
        <Dashboard
          user={auth.user}
          onLogout={handleLogout}
          isGuest={true}
          onNavigate={navigate}
          currentPath={currentPath}
          {...viewProps}
        />
      </Suspense>
    )
  }

  if (Dashboard && auth.user && !auth.isGuest) {
    return (
      <Suspense fallback={dashboardFallback}>
        <Dashboard
          user={auth.user}
          onLogout={handleLogout}
          onNavigate={navigate}
          currentPath={currentPath}
          {...viewProps}
        />
      </Suspense>
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
          navigate(DEFAULT_PATH_BY_ROLE[normalizedRole] ?? '/')

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
        onSubmit={async ({ name, email, password }) => {
          const data = await authApi.signup({
            name,
            email,
            password,
            role: ROLE_TO_API[pendingRole],
          })

          const normalizedRole = normalizeRole(data.role)
          navigate(DEFAULT_PATH_BY_ROLE[normalizedRole] ?? '/')

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
          navigate(DEFAULT_PATH_BY_ROLE[guestData.role] ?? '/')
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
