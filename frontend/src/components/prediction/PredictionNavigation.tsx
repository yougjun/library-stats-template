import { useNavigate, useLocation } from 'react-router-dom'
import { Button, Space } from 'antd'
import { BarChartOutlined } from '@ant-design/icons'

interface PredictionNavigationProps {
  yearMonth: string
}

export default function PredictionNavigation({ yearMonth }: PredictionNavigationProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path: string) => location.pathname.includes(path)
  const year = yearMonth.split('-')[0]

  const isOnFloor1 = location.pathname.includes('/prediction/floor1/')
  const isOnFloor23 = location.pathname.includes('/prediction/floor23/')

  return (
    <Space size="middle" style={{ marginBottom: 16 }}>
      <Button
        type={isActive('/prediction/knowledge/') ? 'primary' : 'default'}
        onClick={() => navigate(`/prediction/knowledge/${yearMonth}`)}
      >
        지식정보기반과
      </Button>
      <Button
        type={isActive('/prediction/floor23/') ? 'primary' : 'default'}
        onClick={() => navigate(`/prediction/floor23/${yearMonth}`)}
      >
        종합,인문예술자료실
      </Button>
      <Button
        type={isActive('/prediction/floor1/') ? 'primary' : 'default'}
        onClick={() => navigate(`/prediction/floor1/${yearMonth}`)}
      >
        어린이자료실
      </Button>
      {(isOnFloor1 || isOnFloor23) && (
        <Button
          type={isActive('/prediction/summary/') ? 'primary' : 'default'}
          icon={<BarChartOutlined />}
          onClick={() => navigate(`/prediction/summary/${year}?floor=${isOnFloor1 ? 'floor1' : 'floor23'}`)}
        >
          예측 분석 요약
        </Button>
      )}
    </Space>
  )
}
