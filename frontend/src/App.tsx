import { BrowserRouter, Routes, Route, useParams, useLocation, Navigate, useNavigate } from 'react-router-dom'
import { ConfigProvider, message } from 'antd'
import koKR from 'antd/locale/ko_KR'
import { useEffect, useState, Suspense, useCallback } from 'react'
import { useAuthStore } from './store/authStore'
import { authApi } from './services/api'
import { startAccessSession } from './utils/libraryDays'
import { lazyWithRetry } from './utils/lazyWithRetry'
import { LoadingFallback } from './components/LoadingFallback'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ErrorPageWithParams } from './pages/ErrorPage'
import { SettingsLoader } from './components/SettingsLoader'
import { isAxiosError } from './utils/errorHandler'

const SitePasswordLogin = lazyWithRetry(() => import('./pages/SitePasswordLogin'))
const AccessModeSelection = lazyWithRetry(() => import('./pages/AccessModeSelection'))
const AccessCodeLogin = lazyWithRetry(() => import('./pages/AccessCodeLogin'))
const Floor1Dashboard = lazyWithRetry(() => import('./pages/Floor1Dashboard'))
const Floor23Dashboard = lazyWithRetry(() => import('./pages/Floor23Dashboard'))
const Floor1Input = lazyWithRetry(() => import('./pages/Floor1Input'))
const Floor23Input = lazyWithRetry(() => import('./pages/Floor23Input'))
const Statistics = lazyWithRetry(() => import('./pages/Statistics'))
const Floor1Stats = lazyWithRetry(() => import('./pages/Floor1Stats'))
const Floor23Stats = lazyWithRetry(() => import('./pages/Floor23Stats'))
const KnowledgeStats = lazyWithRetry(() => import('./pages/KnowledgeStats'))
const YearlyFloor1Stats = lazyWithRetry(() => import('./pages/YearlyFloor1Stats'))
const YearlyFloor23Stats = lazyWithRetry(() => import('./pages/YearlyFloor23Stats'))
const Prediction = lazyWithRetry(() => import('./pages/Prediction'))
const Floor1Prediction = lazyWithRetry(() => import('./pages/Floor1Prediction'))
const Floor23Prediction = lazyWithRetry(() => import('./pages/Floor23Prediction'))
const KnowledgePrediction = lazyWithRetry(() => import('./pages/KnowledgePrediction'))
const PredictionSummary = lazyWithRetry(() => import('./pages/PredictionSummary'))
const Settings = lazyWithRetry(() => import('./pages/Settings'))
const TemplateEditor = lazyWithRetry(() => import('./pages/TemplateEditor'))
const TemplateDrivenInput = lazyWithRetry(() => import('./pages/TemplateDrivenInput'))
const History = lazyWithRetry(() => import('./pages/History'))
const CalculationGuide = lazyWithRetry(() => import('./pages/CalculationGuide'))
const FloatingMenu = lazyWithRetry(() => import('./components/FloatingMenu'))

const isStaticDeploy = window.location.hostname.includes('github.io')

function SiteProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isSiteAuthenticated } = useAuthStore()
  if (!isStaticDeploy && !isSiteAuthenticated()) return <Navigate to="/" replace />
  return <SettingsLoader>{children}</SettingsLoader>
}

const getRoleBasedRedirectPath = (role?: string): string => {
  if (role?.includes('FLOOR23') || role?.includes('FLOOR2') || role?.includes('FLOOR3')) {
    return '/floor23/dashboard'
  } else if (role?.includes('FLOOR1')) {
    return '/floor1/dashboard'
  } else if (role === 'admin') {
    return '/floor1/dashboard'
  }
  return '/floor1/dashboard'
}

function DeviceAutoVerify({ children }: { children: React.ReactNode }) {
  const [isVerifying, setIsVerifying] = useState(true)
  const { setSiteToken, login } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const handleSiteAccess = useCallback((token: string) => {
    setSiteToken(token)
    if (location.pathname === '/') {
      navigate('/access-mode')
    }
  }, [setSiteToken, navigate, location.pathname])

  const handleEditAccess = useCallback((token: string, role: string) => {
    login(token, role)
    startAccessSession()

    const shouldRedirect = location.pathname === '/' || location.pathname === '/access-code-login'
    if (shouldRedirect) {
      navigate(getRoleBasedRedirectPath(role))
    }
  }, [login, navigate, location.pathname])

  const verifyRemember = useCallback(async () => {
    if (isStaticDeploy) {
      setSiteToken('static')
      login('static', 'admin')
      if (location.pathname === '/') {
        navigate('/floor1/dashboard')
      }
      setIsVerifying(false)
      return
    }

    try {
      const { data } = await authApi.verifyRemember()

      if (data.trusted && data.token) {
        if (data.access_type === 'site') {
          handleSiteAccess(data.token)
        } else if (data.access_type === 'edit') {
          if (data.access_role) {
            handleEditAccess(data.token, data.access_role)
          } else {
            message.error('Auto-login failed: missing access role.')
          }
        }
      }
    } catch (error: unknown) {
      if (isAxiosError(error) && (error.response?.status === 503 || error.message?.includes('maintenance'))) {
        navigate('/error/maintenance')
        return
      }
      if (isAxiosError(error) && error.response?.status === 500) {
        navigate('/error/500')
        return
      }
    } finally {
      setIsVerifying(false)
    }
  }, [handleSiteAccess, handleEditAccess, navigate, setSiteToken, login, location.pathname])

  useEffect(() => {
    verifyRemember()
  }, [verifyRemember])

  if (isVerifying) {
    return <LoadingFallback />
  }

  return <>{children}</>
}

function GlobalFloatingMenu() {
  const location = useLocation()
  const params = useParams<{ yearMonth?: string; year?: string }>()
  let floor: 'floor1' | 'floor23' | 'knowledge' | undefined
  let isYearly = false

  if (location.pathname.includes('/floor1')) floor = 'floor1'
  else if (location.pathname.includes('/floor23')) floor = 'floor23'
  else if (location.pathname.includes('/knowledge')) floor = 'knowledge'

  if (location.pathname.includes('/yearly-')) isYearly = true

  return <FloatingMenu yearMonth={params.yearMonth} year={params.year} floor={floor} isYearly={isYearly} />
}

function ErrorBoundaryWrapper({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  return <ErrorBoundary navigate={navigate}>{children}</ErrorBoundary>
}

function App() {
  return (
    <ConfigProvider locale={koKR}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <ErrorBoundaryWrapper>
          <DeviceAutoVerify>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/" element={isStaticDeploy ? <Navigate to="/floor1/dashboard" replace /> : <SitePasswordLogin />} />
                <Route path="/access-mode" element={<SiteProtectedRoute><AccessModeSelection /></SiteProtectedRoute>} />
                <Route path="/access-code-login" element={<SiteProtectedRoute><AccessCodeLogin /></SiteProtectedRoute>} />
                <Route path="/floor1/dashboard" element={<SiteProtectedRoute><Floor1Dashboard /></SiteProtectedRoute>} />
                <Route path="/floor23/dashboard" element={<SiteProtectedRoute><Floor23Dashboard /></SiteProtectedRoute>} />
                <Route path="/floor1/input/:yearMonth" element={<SiteProtectedRoute><Floor1Input /></SiteProtectedRoute>} />
                <Route path="/floor23/input/:yearMonth" element={<SiteProtectedRoute><Floor23Input /></SiteProtectedRoute>} />
                <Route path="/statistics/:yearMonth" element={<SiteProtectedRoute><Statistics /></SiteProtectedRoute>} />
                <Route path="/statistics/floor1/:yearMonth" element={<SiteProtectedRoute><Floor1Stats /></SiteProtectedRoute>} />
                <Route path="/statistics/floor23/:yearMonth" element={<SiteProtectedRoute><Floor23Stats /></SiteProtectedRoute>} />
                <Route path="/statistics/knowledge/:yearMonth" element={<SiteProtectedRoute><KnowledgeStats /></SiteProtectedRoute>} />
                <Route path="/statistics/yearly-floor1/:year" element={<SiteProtectedRoute><YearlyFloor1Stats /></SiteProtectedRoute>} />
                <Route path="/statistics/yearly-floor23/:year" element={<SiteProtectedRoute><YearlyFloor23Stats /></SiteProtectedRoute>} />
                <Route path="/prediction" element={<SiteProtectedRoute><Prediction /></SiteProtectedRoute>} />
                <Route path="/prediction/floor1/:yearMonth" element={<SiteProtectedRoute><Floor1Prediction /></SiteProtectedRoute>} />
                <Route path="/prediction/floor23/:yearMonth" element={<SiteProtectedRoute><Floor23Prediction /></SiteProtectedRoute>} />
                <Route path="/prediction/knowledge/:yearMonth" element={<SiteProtectedRoute><KnowledgePrediction /></SiteProtectedRoute>} />
                <Route path="/prediction/summary/:year" element={<SiteProtectedRoute><PredictionSummary /></SiteProtectedRoute>} />
                <Route path="/settings" element={<SiteProtectedRoute><Settings /></SiteProtectedRoute>} />
                <Route path="/template-editor" element={<SiteProtectedRoute><TemplateEditor /></SiteProtectedRoute>} />
                <Route path="/template-driven" element={<SiteProtectedRoute><TemplateDrivenInput /></SiteProtectedRoute>} />
                <Route path="/history" element={<SiteProtectedRoute><History /></SiteProtectedRoute>} />
                <Route path="/calculation-guide" element={<SiteProtectedRoute><CalculationGuide /></SiteProtectedRoute>} />
                <Route path="/error/:type" element={<ErrorPageWithParams />} />
                <Route path="/error" element={<Navigate to="/error/404" replace />} />
                <Route path="*" element={<Navigate to="/error/404" replace />} />
              </Routes>
            </Suspense>
          </DeviceAutoVerify>
          <Suspense fallback={null}>
            <GlobalFloatingMenu />
          </Suspense>
        </ErrorBoundaryWrapper>
      </BrowserRouter>
    </ConfigProvider>
  )
}

export default App
