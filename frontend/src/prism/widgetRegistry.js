import { createWidgetRegistry } from '../dynamic-ui/registry'
import { registerBuiltInWidgets } from '../dynamic-ui/widgets'
import LegacyComponent from './widgets/LegacyComponent'

export function createPrismWidgetRegistry() {
  const registry = createWidgetRegistry()
  registerBuiltInWidgets(registry)
  registry.register('LegacyComponent', LegacyComponent)
  return registry
}

