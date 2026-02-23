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
import RoleSelection from './pages/Auth/RoleSelection'

import AdminDashboard from './pages/Admin/Dashboard'
import AdminAnalytics from './pages/Admin/Analytics'
import AdminBlockchainMonitor from './pages/Admin/BlockchainMonitor'
import AdminSystemReport from './pages/Admin/Systemreport'
import ManufacturerDashboard from './pages/Manufacturer/Dashboard'
import TransporterDashboard from './pages/Transporter/Dashboard'
import DealerDashboard from './pages/Dealer/Dashboard'
import DealerOrders from './pages/Dealer/Orders'
import DealerArrivals from './pages/Dealer/Arrivals'
import DealerInventory from './pages/Dealer/Inventory'
import DealerAnalytics from './pages/Dealer/Analytics'
import RetailShopDashboard from './pages/RetailShop/Dashboard'

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
    logout()
    setScreen('home')
    setEntryIntent('login')
    navigate('/')
  }

  const { Component: Dashboard, viewProps } = useMemo(() => {
    return getRoleView(auth.role, currentPath)
  }, [auth.role, currentPath])

  if (auth.isGuest && Dashboard) {
    return (
      <Dashboard
        user={auth.user}
        onLogout={handleLogout}
        isGuest={true}
        onNavigate={navigate}
        currentPath={currentPath}
        {...viewProps}
      />
    )
  }

  if (Dashboard && auth.user && !auth.isGuest) {
    return (
      <Dashboard
        user={auth.user}
        onLogout={handleLogout}
        onNavigate={navigate}
        currentPath={currentPath}
        {...viewProps}
      />
    )
  }

  if (screen === 'login') {
    return (
      <Login
        role={pendingRole}
        onBack={() => {
          setEntryIntent('login')
          setScreen('role-selection')
        }}
        onSignupClick={() => {
          setEntryIntent('signup')
          setScreen('signup')
        }}
        onGuestClick={() => {
          setEntryIntent('guest')
          setScreen('guest')
        }}
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
      onGuestEntry={() => {
        setEntryIntent('guest')
        setScreen('role-selection')
      }}
      onLoginClick={() => {
        setEntryIntent('login')
        setScreen('role-selection')
      }}
      onSignupClick={() => {
        setEntryIntent('signup')
        setScreen('role-selection')
      }}
    />
  )
}

export default App
