import { useNavigate, useLocation } from 'react-router-dom'
import { Button, Space } from 'antd'

interface FloorNavigationProps {
  yearMonth: string
}

export default function FloorNavigation({ yearMonth }: FloorNavigationProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path: string) => location.pathname.includes(path)
  const year = yearMonth.split('-')[0]

  const isOnFloor1 = location.pathname.includes('/statistics/floor1/')
  const isOnFloor23 = location.pathname.includes('/statistics/floor23/')

  return (
    <Space size="middle" style={{ marginBottom: 16 }}>
      <Button
        type={isActive('/statistics/knowledge/') && !isActive('/yearly') ? 'primary' : 'default'}
        onClick={() => navigate(`/statistics/knowledge/${yearMonth}`)}
      >
        지식정보기반과
      </Button>
      <Button
        type={isActive('/statistics/floor23/') && !isActive('/yearly') ? 'primary' : 'default'}
        onClick={() => navigate(`/statistics/floor23/${yearMonth}`)}
      >
        종합,인문예술자료실
      </Button>
      <Button
        type={isActive('/statistics/floor1/') && !isActive('/yearly') ? 'primary' : 'default'}
        onClick={() => navigate(`/statistics/floor1/${yearMonth}`)}
      >
        어린이자료실
      </Button>
      {/* 연간 통계 버튼 - 현재 페이지에 따라 다른 연간 통계로 이동 */}
      {isOnFloor1 && (
        <Button
          type={isActive('/yearly-floor1/') ? 'primary' : 'default'}
          onClick={() => navigate(`/statistics/yearly-floor1/${year}`)}
        >
          연간 통계
        </Button>
      )}
      {isOnFloor23 && (
        <Button
          type={isActive('/yearly-floor23/') ? 'primary' : 'default'}
          onClick={() => navigate(`/statistics/yearly-floor23/${year}`)}
        >
          연간 통계
        </Button>
      )}
    </Space>
  )
}
