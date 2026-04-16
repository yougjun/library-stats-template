import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Table, Typography, Divider, Tag, Progress, Spin, Alert, Button } from 'antd'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  LineChartOutlined,
  CloudOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons'
import axios from 'axios'
import dayjs from 'dayjs'
import WeatherCorrelation from '../components/WeatherCorrelation'
import SessionTimer from '../components/SessionTimer'
import { isAccessCodeSession } from '../utils/libraryDays'
import '../styles/table.css'

const { Title, Paragraph, Text } = Typography

interface ModelInfo {
  model_id: number
  name: string
  description: string
  mechanism: string
  formula: string
}

export default function PredictionSummary() {
  const { year } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const floor = searchParams.get('floor') || 'floor1'

  const [models, setModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [accuracyData, setAccuracyData] = useState<any[]>([])

  useEffect(() => {
    fetchModels()
    calculateAccuracy()
  }, [year, floor])

  const fetchModels = async () => {
    if (window.location.hostname.includes('github.io')) {
      setModels([])
      setLoading(false)
      return
    }
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
      const response = await axios.get(`${apiUrl}/api/predictions/models`)
      if (response.data.success) {
        setModels(response.data.models)
      }
    } catch (error: unknown) {
      console.error('Failed to fetch models:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateAccuracy = async () => {
    if (window.location.hostname.includes('github.io')) {
      setAccuracyData([])
      return
    }
    const months = []
    for (let i = 1; i <= 12; i++) {
      const month = `${year}-${String(i).padStart(2, '0')}`
      if (month < dayjs().format('YYYY-MM')) {
        months.push(month)
      }
    }

    const accuracyResults = []
    for (const month of months.slice(-6)) {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
        const response = await axios.get(
          `${apiUrl}/api/predictions/compare/${floor}/${month}?model_id=1`
        )
        if (response.data.success && response.data.comparison) {
          const comp = response.data.comparison
          let withinBounds = 0
          let total = 0

          const visitorValues = Object.values(comp.visitor || {}) as Array<{ within_bounds?: boolean }>
          visitorValues.forEach((v) => {
            total++
            if (v.within_bounds) withinBounds++
          })

          accuracyResults.push({
            month,
            accuracy: total > 0 ? Math.round((withinBounds / total) * 100) : 0,
            total,
            withinBounds
          })
        }
      } catch (error: unknown) {
        console.error(`Failed to calculate accuracy for ${month}:`, error)
      }
    }

    setAccuracyData(accuracyResults)
  }

  const modelColumns = [
    {
      title: 'ID',
      dataIndex: 'model_id',
      key: 'model_id',
      width: 60,
      render: (id: number) => <Tag color="blue">{id}</Tag>
    },
    {
      title: '모델명',
      dataIndex: 'name',
      key: 'name',
      width: 200
    },
    {
      title: '설명',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => (
        <Text style={{ fontSize: 12 }}>{text.slice(0, 100)}...</Text>
      )
    },
    {
      title: '최소 데이터',
      key: 'min_data',
      width: 100,
      render: (_: any, record: ModelInfo) => {
        const minData = record.model_id === 1 ? '3개월' : record.model_id === 2 ? '12개월' : '6개월'
        return <Tag>{minData}</Tag>
      }
    }
  ]

  const accuracyColumns = [
    {
      title: '월',
      dataIndex: 'month',
      key: 'month',
      width: 100
    },
    {
      title: '정확도',
      dataIndex: 'accuracy',
      key: 'accuracy',
      width: 150,
      render: (value: number) => (
        <Progress
          percent={value}
          size="small"
          status={value >= 70 ? 'success' : value >= 50 ? 'normal' : 'exception'}
        />
      )
    },
    {
      title: '신뢰구간 내',
      key: 'bounds',
      render: (_: any, record: any) => (
        <span>
          {record.withinBounds} / {record.total}
          {record.accuracy >= 70 ? (
            <CheckCircleOutlined style={{ color: '#52c41a', marginLeft: 8 }} />
          ) : (
            <CloseCircleOutlined style={{ color: '#ff4d4f', marginLeft: 8 }} />
          )}
        </span>
      )
    }
  ]

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      {isAccessCodeSession() && <SessionTimer />}

      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16 }}
      >
        돌아가기
      </Button>

      <Card style={{ marginBottom: 24 }}>
        <Title level={2} style={{ textAlign: 'center', color: '#1890ff' }}>
          <ExperimentOutlined /> 예측 분석 요약
        </Title>
        <Paragraph style={{ textAlign: 'center', color: '#666' }}>
          {year}년 {floor === 'floor1' ? '어린이자료실' : '종합·인문예술자료실'} 예측 성능 분석
        </Paragraph>
      </Card>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card
            title={<><LineChartOutlined /> 예측 모델 정보</>}
            style={{ height: '100%' }}
          >
            <Table
              dataSource={models}
              columns={modelColumns}
              pagination={false}
              size="small"
              rowKey="model_id"
            />

            <Divider />

            {models.map(model => (
              <Card
                key={model.model_id}
                type="inner"
                title={`모델 ${model.model_id}: ${model.name}`}
                style={{ marginBottom: 16 }}
                size="small"
              >
                <div style={{ fontSize: 12 }}>
                  <strong>작동 원리:</strong>
                  <Paragraph style={{ whiteSpace: 'pre-wrap', fontSize: 11, marginTop: 8 }}>
                    {model.mechanism}
                  </Paragraph>
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ fontSize: 12 }}>
                  <strong>수학적 공식:</strong>
                  <pre style={{
                    backgroundColor: '#f5f5f5',
                    padding: 8,
                    borderRadius: 4,
                    fontSize: 10,
                    overflow: 'auto'
                  }}>
                    {model.formula}
                  </pre>
                </div>
              </Card>
            ))}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={<><CheckCircleOutlined /> 예측 정확도 (최근 6개월)</>}
            style={{ marginBottom: 24 }}
          >
            {accuracyData.length > 0 ? (
              <>
                <Table
                  dataSource={accuracyData}
                  columns={accuracyColumns}
                  pagination={false}
                  size="small"
                  rowKey="month"
                />

                <Divider />

                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="평균 정확도"
                      value={Math.round(
                        accuracyData.reduce((sum, d) => sum + d.accuracy, 0) / accuracyData.length
                      )}
                      suffix="%"
                      valueStyle={{
                        color: accuracyData.reduce((sum, d) => sum + d.accuracy, 0) / accuracyData.length >= 70
                          ? '#52c41a'
                          : '#faad14'
                      }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="분석 월 수"
                      value={accuracyData.length}
                      suffix="개월"
                    />
                  </Col>
                </Row>
              </>
            ) : (
              <Alert
                message="정확도 데이터 없음"
                description="과거 예측 비교 데이터가 충분하지 않습니다."
                type="info"
                showIcon
              />
            )}
          </Card>

          <Card title={<><CloudOutlined /> 날씨 상관관계 분석</>}>
            <WeatherCorrelation
              startDate={dayjs(`${year}-01-01`).format('YYYY-MM-DD')}
              endDate={dayjs(`${year}-12-31`).format('YYYY-MM-DD')}
              libraryData={[]}
            />

            <Divider />

            <Alert
              message="날씨 보정 기능"
              description={
                <div style={{ fontSize: 12 }}>
                  <p>예측 생성 시 '날씨 보정' 옵션을 활성화하면:</p>
                  <ul>
                    <li>기온이 높을수록 방문자 수 예측 증가/감소</li>
                    <li>강수량이 많을수록 방문자 수 예측 감소</li>
                    <li>날씨와 도서관 이용 간 상관관계 반영</li>
                  </ul>
                </div>
              }
              type="info"
              showIcon
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 24 }}>
        <Title level={4}>예측 결과 해석 가이드</Title>
        <Row gutter={[24, 16]}>
          <Col xs={24} md={8}>
            <Card type="inner" size="small">
              <Statistic
                title="신뢰구간 (80%)"
                value="하한~상한"
                valueStyle={{ fontSize: 16 }}
              />
              <Paragraph style={{ fontSize: 12, marginTop: 8 }}>
                예측값이 이 범위 내에 있을 확률이 80%입니다.
                범위가 좁을수록 예측 신뢰도가 높습니다.
              </Paragraph>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card type="inner" size="small">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag color="green">정확</Tag>
                <Tag color="orange">근접</Tag>
                <Tag color="red">오차</Tag>
              </div>
              <Paragraph style={{ fontSize: 12, marginTop: 8 }}>
                과거 예측 비교 시:
                녹색은 신뢰구간 내,
                노란색은 ±20% 이내,
                빨간색은 ±20% 초과
              </Paragraph>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card type="inner" size="small">
              <Statistic
                title="권장 모델"
                value="상황별 선택"
                valueStyle={{ fontSize: 16 }}
              />
              <Paragraph style={{ fontSize: 12, marginTop: 8 }}>
                데이터 12개월 이상: 모델 2 (SARIMA)
                데이터 6-12개월: 모델 1 (Prophet)
                데이터 3-6개월: 모델 3 (지수평활)
              </Paragraph>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  )
}
