import { Card, Radio, Space, Typography, Tag, Alert } from 'antd'
import { FunctionOutlined } from '@ant-design/icons'
import { useDashboardStore } from '../../store/dashboardStore'

const { Text, Paragraph } = Typography

interface ModelSelectorProps {
  loading?: boolean
}

export default function ModelSelector({ loading = false }: ModelSelectorProps) {
  const { selectedModel, setSelectedModel, predictionData } = useDashboardStore()

  const models = [
    {
      id: 1,
      name: 'Model 1: 시계열 패턴 분해 예측',
      tag: 'blue',
      description: '시계열 데이터를 추세, 계절성, 잔차로 분해하여 미래 값을 예측합니다.',
      details: '장기 추세와 반복되는 패턴을 잘 포착하며, 안정적인 데이터에 적합합니다.'
    },
    {
      id: 2,
      name: 'Model 2: 계절성 자기회귀 통합 이동평균 (SARIMA)',
      tag: 'green',
      description: '과거 데이터의 자기상관성과 계절성을 고려하여 예측합니다.',
      details: '계절적 변동이 큰 데이터에 효과적이며, 단기 예측에 강점이 있습니다.'
    },
    {
      id: 3,
      name: 'Model 3: 가중 평균 추세 예측',
      tag: 'orange',
      description: '최근 데이터에 더 높은 가중치를 부여하여 추세를 예측합니다.',
      details: '최신 트렌드 변화에 민감하게 반응하며, 변화가 큰 데이터에 적합합니다.'
    }
  ]

  const visitorModelInfo = predictionData.visitor[selectedModel]?.model_info
  const hasData = Object.keys(predictionData.visitor).length > 0

  return (
    <Card
      title={
        <Space>
          <FunctionOutlined />
          <span>예측 모델 선택</span>
        </Space>
      }
      size="small"
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {loading && (
          <Alert
            message="예측 데이터 생성 중..."
            description="3가지 모델을 사용하여 예측을 수행하고 있습니다. 잠시만 기다려주세요."
            type="info"
            showIcon
          />
        )}

        {!loading && hasData && (
          <Alert
            message="예측 데이터 준비 완료"
            description="아래에서 원하는 예측 모델을 선택하세요. 각 모델은 서로 다른 방식으로 미래를 예측합니다."
            type="success"
            showIcon
          />
        )}

        <Radio.Group
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          style={{ width: '100%' }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            {models.map((model) => (
              <Card
                key={model.id}
                size="small"
                style={{
                  backgroundColor: selectedModel === model.id ? '#f0f5ff' : '#fafafa',
                  border: selectedModel === model.id ? '2px solid #1890ff' : '1px solid #d9d9d9',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedModel(model.id)}
              >
                <Radio value={model.id}>
                  <Space direction="vertical" size={4}>
                    <Space>
                      <Tag color={model.tag}>Model {model.id}</Tag>
                      <Text strong>{model.name.split(':')[1]}</Text>
                    </Space>
                    <Text type="secondary" style={{ fontSize: '13px', marginLeft: 24 }}>
                      {model.description}
                    </Text>
                    <Text style={{ fontSize: '12px', marginLeft: 24, color: '#666' }}>
                      💡 {model.details}
                    </Text>
                  </Space>
                </Radio>
              </Card>
            ))}
          </Space>
        </Radio.Group>

        {visitorModelInfo && visitorModelInfo.formula && (
          <Card size="small" style={{ backgroundColor: '#f9f9f9', marginTop: 8 }}>
            <Text strong style={{ fontSize: '12px' }}>
              📐 선택된 모델의 수식:
            </Text>
            <Paragraph
              style={{
                fontFamily: 'monospace',
                fontSize: '11px',
                marginTop: 8,
                marginBottom: 0,
                whiteSpace: 'pre-line',
                color: '#333'
              }}
            >
              {visitorModelInfo.formula}
            </Paragraph>
          </Card>
        )}
      </Space>
    </Card>
  )
}
