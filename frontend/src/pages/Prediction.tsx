import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { Spin } from 'antd'

export default function Prediction() {
  const navigate = useNavigate()

  useEffect(() => {
    const currentMonth = dayjs().format('YYYY-MM')
    navigate(`/prediction/knowledge/${currentMonth}`, { replace: true })
  }, [navigate])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <Spin size="large" />
    </div>
  )
}
