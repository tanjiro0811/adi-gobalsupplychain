export const ROLE_LINKS = {
  Admin: ['Dashboard', 'Analytics', 'Blockchain Monitor', 'Reports'],
  Manufacturer: ['Dashboard', 'Production', 'AI Forecast', 'Ledger Feed', 'Inventory'],
  Transporter: ['Dashboard', 'Live Map', 'AI Routes', 'Fleet Alerts', 'Shipments'],
  Dealer: ['Dashboard', 'Analytics', 'Orders', 'Inventory', 'Arrivals'],
  RetailShop: ['Dashboard', 'Scanner', 'Verification', 'Sales', 'POS'],
}

export const PATH_BY_ROLE_LINK = {
  Admin: {
    Dashboard: '/admin/dashboard',
    Analytics: '/admin/analytics',
    'Blockchain Monitor': '/admin/blockchain',
    Reports: '/admin/reports',
  },
  Manufacturer: {
    Dashboard: '/manufacturer/dashboard',
    Production: '/manufacturer/production',
    'AI Forecast': '/manufacturer/analytics',
    'Ledger Feed': '/manufacturer/blockchain',
    Inventory: '/manufacturer/inventory',
  },
  Transporter: {
    Dashboard: '/transporter/dashboard',
    'Live Map': '/transporter/map',
    'AI Routes': '/transporter/analytics',
    'Fleet Alerts': '/transporter/fleet',
    Shipments: '/transporter/shipments',
  },
  Dealer: {
    Dashboard: '/dealer/dashboard',
    Analytics: '/dealer/analytics',
    Orders: '/dealer/orders',
    Inventory: '/dealer/inventory',
    Arrivals: '/dealer/arrivals',
  },
  RetailShop: {
    Dashboard: '/retail/dashboard',
    Scanner: '/retail/scanner',
    Verification: '/retail/inventory',
    Sales: '/retail/sales',
    POS: '/retail/pos',
  },
}

export const SOCKET_USER_BY_ROLE = {
  Admin: 'admin',
  Manufacturer: 'manufacturer',
  Transporter: 'transporter',
  Dealer: 'dealer',
  RetailShop: 'retail_shop',
}

export const DEFAULT_PATH_BY_ROLE = {
  Admin: PATH_BY_ROLE_LINK.Admin.Dashboard,
  Manufacturer: PATH_BY_ROLE_LINK.Manufacturer.Dashboard,
  Transporter: PATH_BY_ROLE_LINK.Transporter.Dashboard,
  Dealer: PATH_BY_ROLE_LINK.Dealer.Dashboard,
  RetailShop: PATH_BY_ROLE_LINK.RetailShop.Dashboard,
}
