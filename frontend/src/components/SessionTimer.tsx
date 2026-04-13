import { useState, useEffect } from 'react'
import { Alert } from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'
import { getSessionRemainingTime, isAccessSessionValid, endAccessSession, renewAccessSession } from '../utils/libraryDays'
import { useNavigate } from 'react-router-dom'

export default function SessionTimer() {
  const [remainingTime, setRemainingTime] = useState(getSessionRemainingTime())
  const navigate = useNavigate()

  useEffect(() => {
    const handleUserActivity = () => {
      renewAccessSession()
      setRemainingTime(getSessionRemainingTime())
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(event => {
      window.addEventListener(event, handleUserActivity)
    })

    if (!isAccessSessionValid()) {
      return () => {
        events.forEach(event => {
          window.removeEventListener(event, handleUserActivity)
        })
      }
    }

    const interval = setInterval(() => {
      const time = getSessionRemainingTime()
      setRemainingTime(time)

      if (time <= 0) {
        clearInterval(interval)
        endAccessSession()
        navigate('/access-code')
      }
    }, 1000)

    return () => {
      clearInterval(interval)
      events.forEach(event => {
        window.removeEventListener(event, handleUserActivity)
      })
    }
  }, [navigate])

  const minutes = Math.floor(remainingTime / 60)
  const seconds = remainingTime % 60

  const alertType = minutes < 5 ? 'warning' : 'info'

  return (
    <div style={{ minHeight: 55, marginBottom: 16 }}>
      {remainingTime > 0 && (
        <Alert
          message={
            <span>
              <ClockCircleOutlined style={{ marginRight: 8 }} />
              남은 시간: {minutes}분 {seconds}초
            </span>
          }
          type={alertType}
          showIcon={false}
          style={{
            textAlign: 'center'
          }}
        />
      )}
    </div>
  )
}
