import { useEffect } from 'react'

const prefetchedRoutes = new Set<string>()

export function usePrefetchRoute(routePath: string, condition = true) {
  useEffect(() => {
    if (!condition || prefetchedRoutes.has(routePath)) return

    prefetchedRoutes.add(routePath)

    if (routePath.includes('template-driven')) {
      import('../pages/TemplateDrivenInput')
    } else if (routePath.includes('template-editor')) {
      import('../pages/TemplateEditor')
    } else if (routePath.includes('settings')) {
      import('../pages/Settings')
    }
  }, [routePath, condition])
}
