import { Modal, Space, Checkbox, Select, Button, Divider, message, Segmented } from 'antd'
import { DownloadOutlined, PrinterOutlined, CloseOutlined } from '@ant-design/icons'
import { useState, useRef, cloneElement, isValidElement, Children } from 'react'
import html2canvas from 'html2canvas'

interface ChartMaximizedModalProps {
  visible: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  chartData?: any[]
  dataMode?: 'actual' | 'prediction' | 'both'
  onDataModeChange?: (mode: 'actual' | 'prediction' | 'both') => void
  showPredictionToggle?: boolean
}

export default function ChartMaximizedModal({
  visible,
  title,
  onClose,
  children,
  chartData = [],
  dataMode = 'actual',
  onDataModeChange,
  showPredictionToggle = false
}: ChartMaximizedModalProps) {
  const [showGrid, setShowGrid] = useState(true)
  const [showLabels, setShowLabels] = useState(false)
  const [showAnimation, setShowAnimation] = useState(true)
  const [interval, setInterval] = useState<'month' | 'quarter' | 'year'>('month')
  const chartRef = useRef<HTMLDivElement>(null)

  const handleDownloadPNG = async () => {
    if (!chartRef.current) return

    try {
      message.loading({ content: 'PNG 생성 중...', key: 'png-download' })

      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true
      })

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.download = `${title.replace(/\s+/g, '_')}.png`
          link.href = url
          link.click()
          URL.revokeObjectURL(url)
          message.success({ content: 'PNG 다운로드 완료', key: 'png-download', duration: 2 })
        }
      }, 'image/png')
    } catch (error: unknown) {
      console.error('PNG export failed:', error)
      message.error({ content: 'PNG 다운로드 실패', key: 'png-download', duration: 2 })
    }
  }

  const handleDownloadCSV = () => {
    if (!chartData || chartData.length === 0) {
      console.log('No chart data available for CSV export')
      return
    }

    const headers = Object.keys(chartData[0])
    const csvContent = [
      headers.join(','),
      ...chartData.map(row =>
        headers.map(header => {
          const value = row[header]
          return typeof value === 'string' && value.includes(',')
            ? `"${value}"`
            : value
        }).join(',')
      )
    ].join('\n')

    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `${title.replace(/\s+/g, '_')}.csv`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <Modal
      title={
        <Space>
          <span>{title}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width="90vw"
      style={{ top: 20 }}
      footer={
        <Button onClick={onClose} icon={<CloseOutlined />}>
          닫기
        </Button>
      }
    >
      {/* Dynamic options panel */}
      <div style={{ marginBottom: 16 }}>
        <Space wrap style={{ width: '100%' }}>
          {showPredictionToggle && onDataModeChange && (
            <>
              <Segmented
                size="small"
                value={dataMode}
                onChange={(value) => onDataModeChange(value as 'actual' | 'prediction' | 'both')}
                options={[
                  { label: '실제', value: 'actual' },
                  { label: '예측', value: 'prediction' },
                  { label: '비교', value: 'both' }
                ]}
              />
              <Divider type="vertical" />
            </>
          )}
          <Checkbox
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
          >
            격자선 표시
          </Checkbox>
          <Checkbox
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
          >
            데이터 레이블 표시
          </Checkbox>
          <Checkbox
            checked={showAnimation}
            onChange={(e) => setShowAnimation(e.target.checked)}
          >
            애니메이션
          </Checkbox>

          <Divider type="vertical" />

          <Select
            value={interval}
            onChange={(value) => setInterval(value)}
            style={{ width: 120 }}
            size="small"
            options={[
              { value: 'month', label: '간격: 월별' },
              { value: 'quarter', label: '간격: 분기별' },
              { value: 'year', label: '간격: 연도별' }
            ]}
          />

          <Divider type="vertical" />

          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={handleDownloadPNG}
          >
            PNG 다운로드
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={handleDownloadCSV}
          >
            CSV 다운로드
          </Button>
          <Button
            size="small"
            icon={<PrinterOutlined />}
            onClick={handlePrint}
          >
            인쇄
          </Button>
        </Space>
      </div>

      {/* Maximized chart area */}
      <div
        ref={chartRef}
        style={{
          height: 'calc(90vh - 200px)',
          minHeight: '500px'
        }}
      >
        {Children.map(children, (child) => {
          if (isValidElement(child)) {
            return cloneElement(child, {
              showGrid,
              showLabels,
              showAnimation,
              interval
            } as any)
          }
          return child
        })}
      </div>
    </Modal>
  )
}
