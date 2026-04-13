import { Tooltip, Progress } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'

interface PredictionCellProps {
  value: number
  lowerBound: number
  upperBound: number
  confidence?: number
  showInterval?: boolean
}

export default function PredictionCell({
  value,
  lowerBound,
  upperBound,
  confidence = 80,
  showInterval = true
}: PredictionCellProps) {
  const range = upperBound - lowerBound
  const valuePosition = range > 0 ? ((value - lowerBound) / range) * 100 : 50

  const tooltipContent = (
    <div style={{ fontSize: '12px' }}>
      <div>예측값: <strong>{value.toLocaleString()}</strong></div>
      <div>하한: {lowerBound.toLocaleString()}</div>
      <div>상한: {upperBound.toLocaleString()}</div>
      <div>신뢰도: {confidence}%</div>
    </div>
  )

  return (
    <Tooltip title={tooltipContent} placement="top">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <div style={{
          color: '#1890ff',
          fontWeight: 600,
          fontSize: '13px'
        }}>
          {value.toLocaleString()}
        </div>
        {showInterval && (
          <div style={{
            width: '100%',
            maxWidth: 80,
            position: 'relative',
            height: 8,
            backgroundColor: '#f0f0f0',
            borderRadius: 4,
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: '100%',
              background: 'linear-gradient(90deg, #bae7ff 0%, #1890ff 50%, #bae7ff 100%)',
              opacity: 0.6
            }} />
            <div style={{
              position: 'absolute',
              left: `${valuePosition}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 6,
              height: 6,
              backgroundColor: '#1890ff',
              borderRadius: '50%',
              border: '1px solid #fff'
            }} />
          </div>
        )}
        {showInterval && (
          <div style={{ fontSize: '9px', color: '#999', whiteSpace: 'nowrap' }}>
            {lowerBound.toLocaleString()}~{upperBound.toLocaleString()}
          </div>
        )}
      </div>
    </Tooltip>
  )
}
