import DynamicUIProvider from '../../dynamic-ui/DynamicUIProvider'
import DynamicPage from '../../dynamic-ui/DynamicPage'
import { createWidgetRegistry } from '../../dynamic-ui/registry'
import { registerBuiltInWidgets } from '../../dynamic-ui/widgets'
import ROLE_SELECTION_CONFIG from '../../config/ui/roleSelection.json'

import './roleselection.css'

function RoleLogoWidget({ roleId }) {
  const normalized = String(roleId || '').trim().toLowerCase()
  const shared = {
    className: 'role-card-logo-svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': 'true',
    focusable: 'false',
  }

  const fill = {
    fill: 'currentColor',
    opacity: 0.18,
  }

  const stroke = {
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }

  if (normalized === 'admin') {
    return (
      <svg {...shared}>
        <path {...fill} d="M12 2l7 4v6c0 5-3 9-7 10C8 21 5 17 5 12V6l7-4z" />
        <path {...stroke} d="M12 2l7 4v6c0 5-3 9-7 10C8 21 5 17 5 12V6l7-4z" />
        <path {...stroke} d="M9.5 12l1.8 1.8L14.8 10" />
      </svg>
    )
  }

  if (normalized === 'manufacturer') {
    return (
      <svg {...shared}>
        <path {...fill} d="M3 21V10l6 3v-3l6 3v-3l6 3v8H3z" />
        <path {...stroke} d="M3 21V10l6 3v-3l6 3v-3l6 3v8H3z" />
        <path {...stroke} d="M7 21v-4" />
        <path {...stroke} d="M11 21v-4" />
        <path {...stroke} d="M15 21v-4" />
      </svg>
    )
  }

  if (normalized === 'transporter') {
    return (
      <svg {...shared}>
        <path {...fill} d="M3 17V7h11v10H3z" />
        <path {...fill} d="M14 11h4l3 3v3h-7v-6z" />
        <path {...stroke} d="M3 17V7h11v10H3z" />
        <path {...stroke} d="M14 11h4l3 3v3h-7v-6z" />
        <path {...stroke} d="M7 17a2 2 0 1 0 0.01 0" />
        <path {...stroke} d="M18 17a2 2 0 1 0 0.01 0" />
      </svg>
    )
  }

  if (normalized === 'dealer') {
    return (
      <svg {...shared}>
        <path {...fill} d="M4 10h16l-1 10H5L4 10z" />
        <path {...stroke} d="M4 10h16l-1 10H5L4 10z" />
        <path {...stroke} d="M3 10l2-6h14l2 6" />
        <path {...stroke} d="M9 20v-6h6v6" />
      </svg>
    )
  }

  if (normalized === 'retailshop') {
    return (
      <svg {...shared}>
        <path {...fill} d="M6 6h15l-2 8H7L6 6z" />
        <path {...stroke} d="M6 6h15l-2 8H7L6 6z" />
        <path {...stroke} d="M6 6L5 3H3" />
        <path {...stroke} d="M9 20a1.5 1.5 0 1 0 0.01 0" />
        <path {...stroke} d="M18 20a1.5 1.5 0 1 0 0.01 0" />
      </svg>
    )
  }

  return null
}

const ROLE_SELECTION_REGISTRY = (() => {
  const registry = createWidgetRegistry()
  registerBuiltInWidgets(registry)
  registry.register('RoleLogo', RoleLogoWidget)
  return registry
})()

function toCssKey(roleId) {
  const normalized = String(roleId || '').trim().toLowerCase()
  return ROLE_SELECTION_CONFIG.cssKeyByRole?.[normalized] || normalized
}

export default function RoleSelectionDynamic({
  selectedRole,
  onSelectRole,
  onSelect,
  onBack,
  includeAdmin = true,
}) {
  const handleSelect = onSelectRole || onSelect
  const roles = Array.isArray(ROLE_SELECTION_CONFIG.roles) ? ROLE_SELECTION_CONFIG.roles : []
  const visibleRoles = (includeAdmin ? roles : roles.filter((role) => role.id !== 'Admin')).map((role) => ({
    ...role,
    cssKey: toCssKey(role.id),
  }))

  const actions = {
    selectRole: (roleId) => handleSelect?.(roleId),
    back: () => onBack?.(),
  }

  const data = {
    title: ROLE_SELECTION_CONFIG.title || 'Choose Your Role',
    subtitle: ROLE_SELECTION_CONFIG.subtitle || '',
    backLabel: ROLE_SELECTION_CONFIG.backLabel || 'Back to Homepage',
    roles: visibleRoles,
    selectedRole,
  }

  return (
    <DynamicUIProvider registry={ROLE_SELECTION_REGISTRY} data={data} actions={actions}>
      <DynamicPage src="/dynamic-pages/roleSelection.json" fallback={null} />
    </DynamicUIProvider>
  )
}
