import { Card, Space, Button, Segmented } from 'antd'
import { ExpandOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useDashboardStore } from '../../store/dashboardStore'

interface ChartContainerProps {
  title: string
  chartId: string
  onMaximize?: () => void
  children: React.ReactNode
  showPredictionToggle?: boolean
  dataMode?: 'actual' | 'prediction' | 'both'
  onDataModeChange?: (mode: 'actual' | 'prediction' | 'both') => void
}

export default function ChartContainer({
  title,
  chartId,
  onMaximize,
  children,
  showPredictionToggle = false,
  dataMode: propDataMode,
  onDataModeChange
}: ChartContainerProps) {
  const maximizeChart = useDashboardStore(state => state.maximizeChart)
  const [localDataMode, setLocalDataMode] = useState<'actual' | 'prediction' | 'both'>('actual')

  const dataMode = propDataMode !== undefined ? propDataMode : localDataMode

  const handleDataModeChange = (mode: 'actual' | 'prediction' | 'both') => {
    if (onDataModeChange) {
      onDataModeChange(mode)
    } else {
      setLocalDataMode(mode)
    }
  }

  const handleMaximize = () => {
    if (onMaximize) {
      onMaximize()
    } else {
      maximizeChart(chartId)
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.ant-segmented, .ant-btn')) {
      return
    }
    handleMaximize()
  }

  return (
    <Card
      title={title}
      size="small"
      extra={
        <Space>
          {showPredictionToggle && (
            <Segmented
              size="small"
              value={dataMode}
              onChange={handleDataModeChange}
              options={[
                { label: '실제', value: 'actual' },
                { label: '예측', value: 'prediction' },
                { label: '비교', value: 'both' }
              ]}
            />
          )}
          <Button
            size="small"
            icon={<ExpandOutlined />}
            onClick={handleMaximize}
            title="차트 확대 (더블클릭)"
          />
        </Space>
      }
      onDoubleClick={handleDoubleClick}
      style={{ cursor: 'pointer' }}
    >
      {children}
    </Card>
  )
}
