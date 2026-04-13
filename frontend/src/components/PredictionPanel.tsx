import { useState, useEffect } from 'react'
import { Card, Select, Button, Table, Alert, Spin, Modal, Typography, Space, Tag, Divider } from 'antd'
import { LineChartOutlined, InfoCircleOutlined, RocketOutlined, CloudOutlined } from '@ant-design/icons'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import WeatherCorrelation from './WeatherCorrelation'
import dayjs from 'dayjs'
import { getErrorMessage } from '../utils/errorHandler'

const { Title, Text, Paragraph } = Typography
const { Option } = Select

interface PredictionModel {
  model_id: number
  name: string
  description: string
  mechanism: string
}

interface Prediction {
  year_month: string
  predicted_value: number
  lower_bound: number
  upper_bound: number
  confidence: number
}

interface PredictionResult {
  success: boolean
  predictions?: Prediction[]
  model_info?: PredictionModel
  training_data_points?: number
  error?: string
}

interface PredictionPanelProps {
  endpoint: string
  title: string
  filters?: Record<string, any>
  token: string
}

export default function PredictionPanel({ endpoint, title, filters = {}, token }: PredictionPanelProps) {
  const [models, setModels] = useState<PredictionModel[]>([])
  const [selectedModel, setSelectedModel] = useState<number>(1)
  const [loading, setLoading] = useState(false)
  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const [showMechanism, setShowMechanism] = useState(false)
  const [showWeatherCorrelation, setShowWeatherCorrelation] = useState(false)

  useEffect(() => {
    fetchModels()
  }, [])

  const fetchModels = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
      const response = await axios.get(`${apiUrl}/api/predictions/models`)
      if (response.data.success) {
        setModels(response.data.models)
      }
    } catch (error: unknown) {
      console.error('Failed to fetch models:', error)
    }
  }

  const generatePrediction = async () => {
    setLoading(true)
    setPrediction(null)

    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
      const response = await axios.post(
        `${apiUrl}${endpoint}`,
        {
          model_id: selectedModel,
          periods: 1,
          filters: filters
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      setPrediction(response.data)
    } catch (error: unknown) {
      setPrediction({
        success: false,
        error: getErrorMessage(error)
      })
    } finally {
      setLoading(false)
    }
  }

  const selectedModelInfo = models.find(m => m.model_id === selectedModel)

  const columns = [
    {
      title: '예측 월',
      dataIndex: 'year_month',
      key: 'year_month',
      align: 'center' as const,
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '예측값',
      dataIndex: 'predicted_value',
      key: 'predicted_value',
      align: 'center' as const,
      render: (value: number) => (
        <Tag color="blue" style={{ fontSize: '14px', padding: '4px 12px' }}>
          {value.toLocaleString()}
        </Tag>
      )
    },
    {
      title: '하한값',
      dataIndex: 'lower_bound',
      key: 'lower_bound',
      align: 'center' as const,
      render: (value: number) => <Text type="secondary">{value.toLocaleString()}</Text>
    },
    {
      title: '상한값',
      dataIndex: 'upper_bound',
      key: 'upper_bound',
      align: 'center' as const,
      render: (value: number) => <Text type="secondary">{value.toLocaleString()}</Text>
    },
    {
      title: '신뢰구간',
      dataIndex: 'confidence',
      key: 'confidence',
      align: 'center' as const,
      render: (value: number) => <Tag color="green">{value}%</Tag>
    }
  ]

  return (
    <Card
      title={
        <Space>
          <RocketOutlined />
          {title}
        </Space>
      }
      style={{ marginTop: '24px' }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Text strong>예측 모델 선택:</Text>
          <div style={{ marginTop: '8px' }}>
            <Space>
              <Select
                value={selectedModel}
                onChange={setSelectedModel}
                style={{ width: 300 }}
              >
                {models.map(model => (
                  <Option key={model.model_id} value={model.model_id}>
                    Model {model.model_id}: {model.name}
                  </Option>
                ))}
              </Select>

              <Button
                type="primary"
                icon={<LineChartOutlined />}
                onClick={generatePrediction}
                loading={loading}
              >
                예측 생성
              </Button>

              {selectedModelInfo && (
                <Button
                  icon={<InfoCircleOutlined />}
                  onClick={() => setShowMechanism(true)}
                >
                  모델 설명
                </Button>
              )}

              <Button
                icon={<CloudOutlined />}
                onClick={() => setShowWeatherCorrelation(true)}
              >
                날씨 상관관계 보기
              </Button>
            </Space>
          </div>

          {selectedModelInfo && (
            <Alert
              message={selectedModelInfo.description}
              type="info"
              showIcon
              style={{ marginTop: '12px' }}
            />
          )}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '16px' }}>
              <Text>모델 학습 및 예측 중...</Text>
            </div>
          </div>
        )}

        {prediction && !loading && (
          <>
            {prediction.success ? (
              <div>
                <Alert
                  message={`학습 데이터: ${prediction.training_data_points}개월 사용`}
                  type="success"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />

                <div className="black-bordered-table">
                  <Table
                    dataSource={prediction.predictions}
                    columns={columns}
                    pagination={false}
                    bordered
                    size="middle"
                    rowKey="year_month"
                  />
                </div>

                <Divider />

                <Alert
                  message="예측 안내"
                  description={
                    <div>
                      <p>• 예측값은 과거 데이터 패턴을 기반으로 산출된 예상값입니다.</p>
                      <p>• 신뢰구간(하한값~상한값)은 실제 값이 속할 것으로 예상되는 범위입니다.</p>
                      <p>• 외부 요인(휴일, 이벤트, 특별한 상황)에 따라 실제값과 차이가 발생할 수 있습니다.</p>
                      <p>• 참고용으로만 사용하시기 바랍니다.</p>
                    </div>
                  }
                  type="warning"
                  showIcon
                />
              </div>
            ) : (
              <Alert
                message="예측 실패"
                description={prediction.error}
                type="error"
                showIcon
              />
            )}
          </>
        )}
      </Space>

      <Modal
        title={selectedModelInfo ? `${selectedModelInfo.name} - 작동 원리` : '모델 설명'}
        open={showMechanism}
        onCancel={() => setShowMechanism(false)}
        footer={[
          <Button key="close" onClick={() => setShowMechanism(false)}>
            닫기
          </Button>
        ]}
        width={800}
      >
        {selectedModelInfo && (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <Title level={4}>{selectedModelInfo.name}</Title>
            <Paragraph>{selectedModelInfo.description}</Paragraph>
            <Divider />
            <div style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              backgroundColor: '#f5f5f5',
              padding: '16px',
              borderRadius: '4px'
            }}>
              <ReactMarkdown>{selectedModelInfo.mechanism}</ReactMarkdown>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="날씨 상관관계 분석"
        open={showWeatherCorrelation}
        onCancel={() => setShowWeatherCorrelation(false)}
        footer={[
          <Button key="close" onClick={() => setShowWeatherCorrelation(false)}>
            닫기
          </Button>
        ]}
        width={1000}
      >
        <WeatherCorrelation
          startDate={dayjs().subtract(12, 'month').format('YYYY-MM-DD')}
          endDate={dayjs().format('YYYY-MM-DD')}
          libraryData={[]}
        />
      </Modal>
    </Card>
  )
}
