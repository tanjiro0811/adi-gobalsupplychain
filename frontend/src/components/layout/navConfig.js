import NAV_CONFIG from '../../config/ui/navigation.json'

export const ROLE_LINKS = NAV_CONFIG.ROLE_LINKS
export const PATH_BY_ROLE_LINK = NAV_CONFIG.PATH_BY_ROLE_LINK
export const SOCKET_USER_BY_ROLE = NAV_CONFIG.SOCKET_USER_BY_ROLE

export const DEFAULT_PATH_BY_ROLE = Object.freeze({
  Admin: PATH_BY_ROLE_LINK.Admin.Dashboard,
  Manufacturer: PATH_BY_ROLE_LINK.Manufacturer.Dashboard,
  Transporter: PATH_BY_ROLE_LINK.Transporter.Dashboard,
  Dealer: PATH_BY_ROLE_LINK.Dealer.Dashboard,
  RetailShop: PATH_BY_ROLE_LINK.RetailShop.Dashboard,
})
