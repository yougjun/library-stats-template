import { create } from 'zustand'
import axios from 'axios'
import { getErrorMessage } from '../utils/errorHandler'

interface PredictionResult {
  success: boolean
  predictions?: Array<{
    year_month: string
    predicted_value: number
    lower_bound: number
    upper_bound: number
    confidence: number
  }>
  model_info?: {
    model_id: number
    name: string
    description: string
    mechanism: string
    formula: string
  }
  training_data_points?: number
  error?: string
}

interface DashboardState {
  chartMode: 'actual' | 'prediction' | 'comparison'

  selectedModel: number

  predictionData: {
    visitor: {
      [modelId: number]: PredictionResult | null
    }
    material: {
      [modelId: number]: PredictionResult | null
    }
    program: {
      [modelId: number]: PredictionResult | null
    }
  }

  loading: boolean

  maximizedChart: string | null

  setChartMode: (mode: 'actual' | 'prediction' | 'comparison') => void
  setSelectedModel: (model: number) => void
  fetchPredictions: (floor: 'floor1' | 'floor23', token: string) => Promise<void>
  maximizeChart: (chartId: string | null) => void
  reset: () => void
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  chartMode: 'actual',
  selectedModel: 1,
  predictionData: {
    visitor: {},
    material: {},
    program: {}
  },
  loading: false,
  maximizedChart: null,

  setChartMode: (mode) => set({ chartMode: mode }),

  setSelectedModel: (model) => set({ selectedModel: model }),

  fetchPredictions: async (floor, token) => {
    if (window.location.hostname.includes('github.io')) {
      return
    }
    set({ loading: true })
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
      const periods = 1

      const requests = []
      for (let modelId = 1; modelId <= 3; modelId++) {
        requests.push(
          axios.post(
            `${apiUrl}/api/predictions/${floor}/visitor`,
            { model_id: modelId, periods },
            { headers: { Authorization: `Bearer ${token}` } }
          ),
          axios.post(
            `${apiUrl}/api/predictions/${floor}/material`,
            { model_id: modelId, periods },
            { headers: { Authorization: `Bearer ${token}` } }
          )
        )
      }

      const results = await Promise.all(requests)

      const visitorData: { [key: number]: PredictionResult } = {}
      const materialData: { [key: number]: PredictionResult } = {}

      for (let i = 0; i < 3; i++) {
        const modelId = i + 1
        visitorData[modelId] = results[i * 2].data
        materialData[modelId] = results[i * 2 + 1].data
      }

      set({
        predictionData: {
          visitor: visitorData,
          material: materialData,
          program: {}
        },
        loading: false
      })
    } catch (error: unknown) {
      console.error('Failed to fetch predictions:', getErrorMessage(error))
      set({ loading: false })
    }
  },

  maximizeChart: (chartId) => set({ maximizedChart: chartId }),

  reset: () => set({
    chartMode: 'actual',
    selectedModel: 1,
    predictionData: {
      visitor: {},
      material: {},
      program: {}
    },
    loading: false,
    maximizedChart: null
  })
}))
