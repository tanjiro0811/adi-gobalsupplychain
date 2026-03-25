import { lazy } from 'react'

export const legacyComponents = Object.freeze({
  AdminDashboard: lazy(() => import('../pages/Admin/Dashboard')),
  AdminAnalytics: lazy(() => import('../pages/Admin/Analytics')),
  AdminBlockchainMonitor: lazy(() => import('../pages/Admin/BlockchainMonitor')),
  AdminSystemReport: lazy(() => import('../pages/Admin/Systemreport')),
  ManufacturerDashboard: lazy(() => import('../pages/Manufacturer/Dashboard')),
  TransporterDashboard: lazy(() => import('../pages/Transporter/Dashboard')),
  DealerDashboard: lazy(() => import('../pages/Dealer/Dashboard')),
  DealerOrders: lazy(() => import('../pages/Dealer/Orders')),
  DealerArrivals: lazy(() => import('../pages/Dealer/Arrivals')),
  DealerInventory: lazy(() => import('../pages/Dealer/Inventory')),
  DealerAnalytics: lazy(() => import('../pages/Dealer/Analytics')),
  RetailShopDashboard: lazy(() => import('../pages/RetailShop/Dashboard')),
})

