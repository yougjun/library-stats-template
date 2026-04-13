import { Button } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import FloorNavigation from './FloorNavigation'
import SessionTimer from './SessionTimer'
import { isAccessCodeSession, calculateOpenDays, getDateRangeString, getOperationPeriod } from '../utils/libraryDays'

interface StatisticsHeaderProps {
  yearMonth: string
  dataType: string
}

export default function StatisticsHeader({ yearMonth, dataType }: StatisticsHeaderProps) {
  const navigate = useNavigate()
  const openDays = calculateOpenDays(yearMonth)
  const dateRangeStr = getDateRangeString(yearMonth)
  const operationPeriod = getOperationPeriod(yearMonth)

  return (
    <>
      {isAccessCodeSession() && <SessionTimer />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <FloorNavigation yearMonth={yearMonth} />
        {isAccessCodeSession() && (
          <Button
            icon={<SettingOutlined />}
            onClick={() => navigate('/settings')}
          >
            설정으로 돌아가기
          </Button>
        )}
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
        padding: '12px',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px'
      }}>
        <div style={{ fontSize: '16px', fontWeight: '500' }}>
          {dateRangeStr} 개관 {openDays} 일째
        </div>
        <div style={{ textAlign: 'right', fontSize: '12px', color: '#666' }}>
          <div>운영기간: {operationPeriod}</div>
        </div>
      </div>
    </>
  )
}
