import { useState, useEffect } from 'react'
import { Select, Button, Space, Tooltip, Spin, Tag } from 'antd'
import {
  LineChartOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  CloudOutlined
} from '@ant-design/icons'
import axios from 'axios'

const { Option } = Select

export interface PredictionModel {
  model_id: number
  name: string
  description: string
  mechanism: string
  formula: string
}

interface ModelSelectionPanelProps {
  selectedModel: number
  onModelChange: (modelId: number) => void
  onGenerate: () => void
  onShowSummary: () => void
  loading: boolean
  hasData: boolean
  weatherEnabled?: boolean
  onWeatherToggle?: () => void
}

function ModelSelectionPanel({
  selectedModel,
  onModelChange,
  onGenerate,
  onShowSummary,
  loading,
  hasData,
  weatherEnabled = false,
  onWeatherToggle
}: ModelSelectionPanelProps) {
  const [models, setModels] = useState<PredictionModel[]>([])
  const [loadingModels, setLoadingModels] = useState(true)

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
    } finally {
      setLoadingModels(false)
    }
  }

  const selectedModelInfo = models.find(m => m.model_id === selectedModel)

  if (loadingModels) {
    return <Spin size="small" />
  }

  return (
    <Space size="middle" wrap>
      <Space>
        <span style={{ fontWeight: 500 }}>예측 모델:</span>
        <Select
          value={selectedModel}
          onChange={onModelChange}
          style={{ width: 280 }}
          disabled={loading}
        >
          {models.map(model => (
            <Option key={model.model_id} value={model.model_id}>
              <Space>
                <Tag color="blue" style={{ margin: 0 }}>{model.model_id}</Tag>
                {model.name}
              </Space>
            </Option>
          ))}
        </Select>
      </Space>

      <Tooltip title={selectedModelInfo?.description}>
        <Button
          icon={<InfoCircleOutlined />}
          onClick={onShowSummary}
        >
          상세정보
        </Button>
      </Tooltip>

      {onWeatherToggle && (
        <Tooltip title="날씨 데이터를 예측에 반영합니다">
          <Button
            icon={<CloudOutlined />}
            type={weatherEnabled ? 'primary' : 'default'}
            onClick={onWeatherToggle}
          >
            날씨 보정 {weatherEnabled ? 'ON' : 'OFF'}
          </Button>
        </Tooltip>
      )}

      <Button
        type="primary"
        icon={loading ? <ReloadOutlined spin /> : <ThunderboltOutlined />}
        onClick={onGenerate}
        loading={loading}
        disabled={loading}
      >
        {hasData ? '예측 갱신' : '예측 생성'}
      </Button>
    </Space>
  )
}

export default ModelSelectionPanel
