import { test, expect } from '@playwright/test'

const GH_PAGES = 'https://yougjun.github.io/library-stats-template'
const LOCAL = 'http://127.0.0.1:3199'

test.describe('GitHub Pages — Bundle Verification', () => {

  test('site loads (HTTP 200)', async ({ page }) => {
    const resp = await page.goto(GH_PAGES)
    expect(resp?.status()).toBe(200)
    await expect(page).toHaveTitle(/도서|통계/i)
  })

  test('JS bundle includes template-driven route definition', async ({ page }) => {
    const matchingChunks: string[] = []
    page.on('response', async (resp) => {
      if (resp.url().endsWith('.js') && resp.url().includes('/assets/')) {
        try {
          const body = await resp.text()
          if (body.includes('template-driven')) {
            matchingChunks.push(resp.url())
          }
        } catch { /* stream consumed */ }
      }
    })

    await page.goto(GH_PAGES)
    await page.waitForLoadState('networkidle')
    expect(matchingChunks.length).toBeGreaterThan(0)
  })

  test('JS bundle includes templateDrivenApi methods', async ({ page }) => {
    const matchingChunks: string[] = []
    page.on('response', async (resp) => {
      if (resp.url().endsWith('.js') && resp.url().includes('/assets/')) {
        try {
          const body = await resp.text()
          if (body.includes('template-driven/upload') || body.includes('template-driven/configs')) {
            matchingChunks.push(resp.url())
          }
        } catch { /* stream consumed */ }
      }
    })

    await page.goto(GH_PAGES)
    await page.waitForLoadState('networkidle')
    expect(matchingChunks.length).toBeGreaterThan(0)
  })

  test('sub-paths serve 404.html SPA fallback (standard GH Pages)', async ({ page }) => {
    const resp = await page.goto(`${GH_PAGES}/template-driven`)
    // GH Pages returns 404 status but serves the SPA fallback
    expect(resp?.status()).toBe(404)
    const title = await page.title()
    expect(title).toMatch(/도서|통계/i)
  })

})

test.describe('Local Preview — Runtime Verification', () => {

  test('root loads and React mounts', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto(LOCAL)
    await page.waitForLoadState('networkidle')

    const root = page.locator('#root')
    await expect(root).toBeAttached()

    const childCount = await root.evaluate(el => el.children.length)
    expect(childCount).toBeGreaterThan(0)
  })

  test('/template-driven renders without crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto(`${LOCAL}/template-driven`)
    await page.waitForLoadState('networkidle')

    const root = page.locator('#root')
    await expect(root).toBeAttached()

    const fatalErrors = errors.filter(e =>
      !e.includes('fetch') &&
      !e.includes('network') &&
      !e.includes('401') &&
      !e.includes('Failed to fetch') &&
      !e.includes('NetworkError') &&
      !e.includes('ECONNREFUSED')
    )
    expect(fatalErrors).toHaveLength(0)
  })

  test('/template-editor renders without crash', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto(`${LOCAL}/template-editor`)
    await page.waitForLoadState('networkidle')

    const root = page.locator('#root')
    await expect(root).toBeAttached()

    const fatalErrors = errors.filter(e =>
      !e.includes('fetch') &&
      !e.includes('network') &&
      !e.includes('401') &&
      !e.includes('Failed to fetch') &&
      !e.includes('NetworkError') &&
      !e.includes('ECONNREFUSED')
    )
    expect(fatalErrors).toHaveLength(0)
  })

  test('no fatal JS errors on key routes', async ({ page }) => {
    const routes = ['/', '/template-driven', '/template-editor']

    for (const route of routes) {
      const errors: string[] = []
      page.on('pageerror', (err) => errors.push(err.message))

      await page.goto(`${LOCAL}${route}`)
      await page.waitForLoadState('networkidle')

      const fatalErrors = errors.filter(e =>
        !e.includes('fetch') &&
        !e.includes('network') &&
        !e.includes('401') &&
        !e.includes('Failed to fetch') &&
        !e.includes('NetworkError') &&
        !e.includes('ECONNREFUSED')
      )
      expect(fatalErrors).toHaveLength(0)
    }
  })

})
