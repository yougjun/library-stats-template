import { useState } from 'react'
import { Button, message } from 'antd'
import {
  DownloadOutlined,
  MenuOutlined,
  HomeOutlined,
  CalendarOutlined,
  SettingOutlined,
  BarChartOutlined,
  LogoutOutlined,
  DashboardOutlined,
  LoginOutlined,
  RobotOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import { isAccessCodeSession, endAccessSession, getDefaultStatsMonth } from '../utils/libraryDays'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../services/api'
import dayjs from 'dayjs'
import '../styles/floating-menu.css'
import ChatWidget from './ChatWidget'
import { DOWNLOAD_FILENAME } from '../config/library'

interface FloatingMenuProps {
  yearMonth?: string
  year?: string
  floor?: 'floor1' | 'floor23' | 'knowledge'
  isYearly?: boolean
}

const menuButtonStyle: React.CSSProperties = {
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  backgroundColor: '#fff',
  border: '1px solid #e8e8e8',
  borderRadius: '8px',
  padding: '8px 16px',
  height: 'auto',
  fontWeight: 500,
  transition: 'all 0.2s ease',
  minWidth: '180px'
}

const handleMenuButtonHover = (e: React.MouseEvent<HTMLElement>, isEnter: boolean) => {
  if (isEnter) {
    e.currentTarget.style.transform = 'translateX(-4px)'
    e.currentTarget.style.boxShadow = '0 6px 16px rgba(22, 119, 255, 0.2)'
    e.currentTarget.style.borderColor = '#1677ff'
  } else {
    e.currentTarget.style.transform = 'translateX(0)'
    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
    e.currentTarget.style.borderColor = '#e8e8e8'
  }
}

export default function FloatingMenu({ yearMonth, year, floor, isYearly = false }: FloatingMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const hasAccessSession = isAccessCodeSession()
  const { isSiteAuthenticated, role } = useAuthStore()

  if (location.pathname === '/' || location.pathname === '/access-mode' || location.pathname === '/access-code-login') {
    return null
  }

  const handleDownloadCurrentExcel = async () => {
    if (!yearMonth) {
      message.error('yearMonth가 필요합니다')
      return
    }

    setDownloading(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
      const response = await axios.get(
        `${apiUrl}/api/excel/download/${yearMonth}`,
        { responseType: 'blob' }
      )

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${DOWNLOAD_FILENAME}_${yearMonth}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      message.success('엑셀 파일 다운로드 완료')
    } catch (error: unknown) {
      message.error('엑셀 다운로드 실패')
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadAllExcel = async () => {
    if (!yearMonth) {
      message.error('yearMonth가 필요합니다')
      return
    }

    setDownloadingAll(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
      const response = await axios.get(
        `${apiUrl}/api/excel/download-all/${yearMonth}`,
        { responseType: 'blob' }
      )

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${DOWNLOAD_FILENAME}_all_${yearMonth}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      message.success('전체 통계 엑셀 다운로드 완료')
    } catch (error: unknown) {
      message.error('전체 통계 다운로드 실패')
    } finally {
      setDownloadingAll(false)
    }
  }

  const handleNavigateToMonthly = () => {
    if (!floor || !year) return

    setIsOpen(false)

    if (floor === 'floor1') {
      const targetMonth = getDefaultStatsMonth('floor1')
      navigate(`/statistics/floor1/${targetMonth}`)
    } else if (floor === 'floor23') {
      const targetMonth = getDefaultStatsMonth('floor23')
      navigate(`/statistics/floor23/${targetMonth}`)
    } else if (floor === 'knowledge') {
      const targetMonth = getDefaultStatsMonth('knowledge')
      navigate(`/statistics/knowledge/${targetMonth}`)
    }
  }

  const handleNavigateToYearly = () => {
    if (!floor || !yearMonth) return

    const currentYear = yearMonth.split('-')[0]

    setIsOpen(false)
    if (floor === 'floor1') {
      navigate(`/statistics/yearly-floor1/${currentYear}`)
    } else if (floor === 'floor23') {
      navigate(`/statistics/yearly-floor23/${currentYear}`)
    } else if (floor === 'knowledge') {
      navigate(`/statistics/yearly-knowledge/${currentYear}`)
    }
  }

  const handleNavigateToHome = () => {
    setIsOpen(false)
    navigate('/access-mode')
  }

  const handleLogin = () => {
    setIsOpen(false)
    navigate('/access-code-login')
  }

  const handleLogout = async () => {
    setIsOpen(false)

    try {
      await authApi.forgetMe()
    } catch (error: unknown) {
      console.debug('Token revocation failed or not needed:', error)
    }

    endAccessSession()
    navigate('/')
  }

  const handleGoToStats = () => {
    setIsOpen(false)

    if (floor === 'floor23') {
      const targetMonth = getDefaultStatsMonth('floor23')
      navigate(`/statistics/floor23/${targetMonth}`)
    } else if (floor === 'knowledge') {
      const targetMonth = getDefaultStatsMonth('knowledge')
      navigate(`/statistics/knowledge/${targetMonth}`)
    } else {
      const targetMonth = getDefaultStatsMonth('floor1')
      navigate(`/statistics/floor1/${targetMonth}`)
    }
  }

  const handleGoToSettings = () => {
    setIsOpen(false)
    navigate('/settings')
  }

  const handleGoToDashboard = () => {
    setIsOpen(false)
    if (floor === 'floor23' || role?.includes('FLOOR23')) {
      navigate('/floor23/dashboard')
    } else {
      navigate('/floor1/dashboard')
    }
  }

  const handleGoToCalculationGuide = () => {
    setIsOpen(false)
    navigate('/calculation-guide')
  }

  const handleGoToPrediction = () => {
    setIsOpen(false)
    navigate('/prediction')
  }

  return (
    <>
      {/* Floating Menu Button */}
      <div className="floating-menu-container" style={{
        position: 'fixed',
        zIndex: 1000
      }}>
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<MenuOutlined />}
          onClick={() => setIsOpen(!isOpen)}
          className="floating-menu-button"
          style={{
            boxShadow: '0 6px 20px rgba(22, 119, 255, 0.4)',
            background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
            border: 'none',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1) rotate(90deg)'
            e.currentTarget.style.boxShadow = '0 8px 25px rgba(22, 119, 255, 0.6)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1) rotate(0deg)'
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(22, 119, 255, 0.4)'
          }}
        />
      </div>

      {/* Backdrop overlay when menu is open */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.2)',
            zIndex: 998,
            backdropFilter: 'blur(2px)',
            animation: 'fadeIn 0.2s ease'
          }}
        />
      )}

      {/* Floating Menu Items */}
      {isOpen && (
        <div className="floating-menu-items" style={{
          position: 'fixed',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          animation: 'slideUp 0.3s ease'
        }}>
          {/* Excel Download Buttons - show on stats pages for both sessions */}
          {location.pathname.startsWith('/statistics') && !isYearly && yearMonth && (
            <>
              {/* Download Current Page Excel */}
              <Button
                type="default"
                icon={<DownloadOutlined />}
                onClick={handleDownloadCurrentExcel}
                loading={downloading}
                className="floating-menu-item"
                style={menuButtonStyle}
                onMouseEnter={(e) => handleMenuButtonHover(e, true)}
                onMouseLeave={(e) => handleMenuButtonHover(e, false)}
              >
                현재 페이지 다운로드
              </Button>

              {/* Download All Statistics Excel */}
              <Button
                type="default"
                icon={<DownloadOutlined />}
                onClick={handleDownloadAllExcel}
                loading={downloadingAll}
                className="floating-menu-item"
                style={menuButtonStyle}
                onMouseEnter={(e) => handleMenuButtonHover(e, true)}
                onMouseLeave={(e) => handleMenuButtonHover(e, false)}
              >
                전체 통계 다운로드
              </Button>
            </>
          )}

          {/* Access Session Menu Items */}
          {hasAccessSession && (
            <>
              {/* Go to Dashboard - only if not already on dashboard page */}
              {!location.pathname.includes('/dashboard') && (
                <Button
                  type="default"
                  icon={<DashboardOutlined />}
                  onClick={handleGoToDashboard}
                  style={menuButtonStyle}
                  onMouseEnter={(e) => handleMenuButtonHover(e, true)}
                  onMouseLeave={(e) => handleMenuButtonHover(e, false)}
                >
                  대시보드
                </Button>
              )}

              {/* Go to Statistics - only if not already on stats page */}
              {!location.pathname.startsWith('/statistics') && (
                <Button
                  type="default"
                  icon={<BarChartOutlined />}
                  onClick={handleGoToStats}
                  style={menuButtonStyle}
                onMouseEnter={(e) => handleMenuButtonHover(e, true)}
                onMouseLeave={(e) => handleMenuButtonHover(e, false)}
                >
                  통계 보기
                </Button>
              )}

              {/* Go to Settings - only if not already on settings page */}
              {!location.pathname.startsWith('/settings') && (
                <Button
                  type="default"
                  icon={<SettingOutlined />}
                  onClick={handleGoToSettings}
                  style={menuButtonStyle}
                onMouseEnter={(e) => handleMenuButtonHover(e, true)}
                onMouseLeave={(e) => handleMenuButtonHover(e, false)}
                >
                  설정
                </Button>
              )}


              {/* Logout */}
              <Button
                type="default"
                icon={<LogoutOutlined />}
                onClick={handleLogout}
                style={menuButtonStyle}
                onMouseEnter={(e) => handleMenuButtonHover(e, true)}
                onMouseLeave={(e) => handleMenuButtonHover(e, false)}
              >
                로그아웃
              </Button>
            </>
          )}

          {/* Navigation Buttons - show for all users on stats pages */}
          {location.pathname.startsWith('/statistics') && (
            <>
              {/* Navigate to Yearly Stats - only for monthly stats */}
              {!isYearly && yearMonth && floor && (
                <Button
                  type="default"
                  icon={<CalendarOutlined />}
                  onClick={handleNavigateToYearly}
                  style={menuButtonStyle}
                onMouseEnter={(e) => handleMenuButtonHover(e, true)}
                onMouseLeave={(e) => handleMenuButtonHover(e, false)}
                >
                  연간 통계 보기
                </Button>
              )}

              {/* Navigate to Monthly Stats - only for yearly stats */}
              {isYearly && year && floor && (
                <Button
                  type="default"
                  icon={<CalendarOutlined />}
                  onClick={handleNavigateToMonthly}
                  style={menuButtonStyle}
                onMouseEnter={(e) => handleMenuButtonHover(e, true)}
                onMouseLeave={(e) => handleMenuButtonHover(e, false)}
                >
                  월계 통계 보기
                </Button>
              )}
            </>
          )}

          {/* Login button for non-access sessions (site authenticated but no access code) */}
          {!hasAccessSession && isSiteAuthenticated() && (
            <Button
              type="primary"
              icon={<LoginOutlined />}
              onClick={handleLogin}
              style={{...menuButtonStyle, backgroundColor: '#1677ff', color: '#fff', borderColor: '#1677ff'}}
              onMouseEnter={(e) => handleMenuButtonHover(e, true)}
              onMouseLeave={(e) => handleMenuButtonHover(e, false)}
            >
              로그인하기
            </Button>
          )}

          {/* Home button for non-access sessions */}
          {!hasAccessSession && (
            <Button
              type="default"
              icon={<HomeOutlined />}
              onClick={handleNavigateToHome}
              style={menuButtonStyle}
                onMouseEnter={(e) => handleMenuButtonHover(e, true)}
                onMouseLeave={(e) => handleMenuButtonHover(e, false)}
            >
              메인으로
            </Button>
          )}

          <Button
            type="default"
            icon={<RobotOutlined />}
            onClick={() => { setIsOpen(false); setChatOpen(true); }}
            style={menuButtonStyle}
            onMouseEnter={(e) => handleMenuButtonHover(e, true)}
            onMouseLeave={(e) => handleMenuButtonHover(e, false)}
          >
            AI 도우미
          </Button>
        </div>
      )}

      <ChatWidget isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  )
}
