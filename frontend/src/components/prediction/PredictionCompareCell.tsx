import { Tooltip } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined, CheckCircleOutlined } from '@ant-design/icons'

interface PredictionCompareCellProps {
  predicted: number
  actual: number
  lowerBound?: number
  upperBound?: number
}

export default function PredictionCompareCell({
  predicted,
  actual,
  lowerBound,
  upperBound
}: PredictionCompareCellProps) {
  const diff = actual - predicted
  const diffPercent = predicted > 0 ? ((diff / predicted) * 100) : 0
  const absDiffPercent = Math.abs(diffPercent)

  const isWithinBounds = lowerBound !== undefined && upperBound !== undefined
    ? (actual >= lowerBound && actual <= upperBound)
    : absDiffPercent <= 10

  const getAccuracyColor = () => {
    if (isWithinBounds) return '#52c41a'
    if (absDiffPercent <= 20) return '#faad14'
    return '#ff4d4f'
  }

  const getAccuracyLabel = () => {
    if (isWithinBounds) return '정확'
    if (absDiffPercent <= 20) return '근접'
    return '오차'
  }

  const tooltipContent = (
    <div style={{ fontSize: '12px' }}>
      <div>예측값: {predicted.toLocaleString()}</div>
      <div>실제값: <strong>{actual.toLocaleString()}</strong></div>
      <div>차이: {diff > 0 ? '+' : ''}{diff.toLocaleString()} ({diffPercent > 0 ? '+' : ''}{diffPercent.toFixed(1)}%)</div>
      {lowerBound !== undefined && upperBound !== undefined && (
        <div>신뢰구간: {lowerBound.toLocaleString()} ~ {upperBound.toLocaleString()}</div>
      )}
      <div style={{ marginTop: 4, color: getAccuracyColor() }}>
        {isWithinBounds ? '✓ 신뢰구간 내' : '✗ 신뢰구간 외'}
      </div>
    </div>
  )

  return (
    <Tooltip title={tooltipContent} placement="top">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <div style={{
          fontWeight: 600,
          fontSize: '13px',
          color: '#000'
        }}>
          {actual.toLocaleString()}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          fontSize: '10px',
          color: getAccuracyColor(),
          backgroundColor: `${getAccuracyColor()}15`,
          padding: '1px 4px',
          borderRadius: 3
        }}>
          {diff > 0 ? (
            <ArrowUpOutlined style={{ fontSize: 8 }} />
          ) : diff < 0 ? (
            <ArrowDownOutlined style={{ fontSize: 8 }} />
          ) : (
            <CheckCircleOutlined style={{ fontSize: 8 }} />
          )}
          <span>
            {diff !== 0 ? `${diff > 0 ? '+' : ''}${diffPercent.toFixed(0)}%` : '='}
          </span>
        </div>
        <div style={{
          fontSize: '9px',
          color: '#999',
          textDecoration: 'line-through'
        }}>
          예측: {predicted.toLocaleString()}
        </div>
      </div>
    </Tooltip>
  )
}
