import { useState, useEffect } from 'react'
import { Table, Alert, Spin, Typography, Tag } from 'antd'
import { useWeatherCorrelation } from '../hooks/useWeatherQueries'

const { Text } = Typography

interface WeatherCorrelationProps {
  startDate: string
  endDate: string
  libraryData: any[]
}

interface CorrelationData {
  weather_metric: string
  library_metric: string
  correlation: number
  interpretation: string
}

export default function WeatherCorrelation({ startDate, endDate, libraryData }: WeatherCorrelationProps) {
  const { mutate: fetchCorrelation, data, isPending, isError, error } = useWeatherCorrelation()
  const [correlationData, setCorrelationData] = useState<CorrelationData[]>([])

  useEffect(() => {
    if (startDate && endDate && libraryData.length > 0) {
      fetchCorrelation({ startDate, endDate, libraryData })
    }
  }, [startDate, endDate, libraryData])

  useEffect(() => {
    if (data?.correlations) {
      setCorrelationData(data.correlations)
    }
  }, [data])

  const getCorrelationColor = (correlation: number): string => {
    const absCorr = Math.abs(correlation)
    if (absCorr >= 0.7) return correlation > 0 ? '#52c41a' : '#ff4d4f'
    if (absCorr >= 0.4) return correlation > 0 ? '#95de64' : '#ff7875'
    return '#d9d9d9'
  }

  const getCorrelationTag = (correlation: number) => {
    const absCorr = Math.abs(correlation)
    let strength = '약함'
    if (absCorr >= 0.7) strength = '강함'
    else if (absCorr >= 0.4) strength = '중간'

    return (
      <Tag color={getCorrelationColor(correlation)} style={{ fontSize: '13px', padding: '2px 8px' }}>
        {correlation.toFixed(3)} ({strength})
      </Tag>
    )
  }

  const columns = [
    {
      title: '날씨 지표',
      dataIndex: 'weather_metric',
      key: 'weather_metric',
      width: '25%',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '도서관 지표',
      dataIndex: 'library_metric',
      key: 'library_metric',
      width: '25%',
      render: (text: string) => <Text>{text}</Text>
    },
    {
      title: '상관계수',
      dataIndex: 'correlation',
      key: 'correlation',
      width: '20%',
      align: 'center' as const,
      render: (value: number) => getCorrelationTag(value)
    },
    {
      title: '해석',
      dataIndex: 'interpretation',
      key: 'interpretation',
      width: '30%',
      render: (text: string) => (
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {text}
        </Text>
      )
    }
  ]

  if (isPending) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>
          <Text>날씨 상관관계 분석 중...</Text>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <Alert
        message="상관관계 분석 실패"
        description={error?.message || '날씨 데이터를 불러오는데 실패했습니다'}
        type="error"
        showIcon
      />
    )
  }

  if (!correlationData || correlationData.length === 0) {
    return (
      <Alert
        message="데이터 없음"
        description="표시할 상관관계 데이터가 없습니다"
        type="info"
        showIcon
      />
    )
  }

  return (
    <div>
      <Alert
        message="날씨-도서관 이용 상관관계 분석"
        description="날씨 조건과 도서관 이용 지표 간의 통계적 상관관계를 보여줍니다. 양수는 정적 상관관계, 음수는 부적 상관관계를 나타냅니다."
        type="info"
        showIcon
        style={{ marginBottom: '16px' }}
      />

      <Table
        dataSource={correlationData}
        columns={columns}
        pagination={false}
        bordered
        size="small"
        rowKey={(record) => `${record.weather_metric}-${record.library_metric}`}
      />

      <div style={{ marginTop: '16px', padding: '12px', background: '#fafafa', borderRadius: '4px' }}>
        <Text strong style={{ fontSize: '13px' }}>상관계수 해석 가이드:</Text>
        <div style={{ marginTop: '8px', fontSize: '12px', lineHeight: '1.8' }}>
          <div><Tag color="#52c41a">0.7 이상</Tag> 강한 정적 상관관계 (날씨 증가 시 이용 증가)</div>
          <div><Tag color="#95de64">0.4~0.7</Tag> 중간 정적 상관관계</div>
          <div><Tag color="#d9d9d9">-0.4~0.4</Tag> 약한 상관관계</div>
          <div><Tag color="#ff7875">-0.7~-0.4</Tag> 중간 부적 상관관계</div>
          <div><Tag color="#ff4d4f">-0.7 이하</Tag> 강한 부적 상관관계 (날씨 증가 시 이용 감소)</div>
        </div>
      </div>
    </div>
  )
}
