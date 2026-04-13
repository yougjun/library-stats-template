import { useState, useCallback } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import axios from 'axios'
import dayjs from 'dayjs'

export interface PredictionValue {
  year_month: string
  predicted_value: number
  lower_bound: number
  upper_bound: number
  confidence: number
  weather_adjustment?: number
}

export interface PredictionResult {
  success: boolean
  predictions?: PredictionValue[]
  model_info?: {
    model_id: number
    name: string
    description: string
    mechanism: string
    formula: string
  }
  training_data_points?: number
  weather_correlation?: {
    avg_temp: number
    precipitation: number
    humidity: number
  }
  error?: string
}

interface UsePredictionOptions {
  floor: 'floor1' | 'floor23' | 'knowledge'
  dataType: 'visitor' | 'material' | 'program' | 'ai_library'
  filters?: Record<string, any>
}

const apiUrl = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : '')

export function usePrediction({ floor, dataType, filters = {} }: UsePredictionOptions) {
  const [selectedModel, setSelectedModel] = useState(1)
  const [weatherEnabled, setWeatherEnabled] = useState(false)
  const [predictions, setPredictions] = useState<Map<string, PredictionValue>>(new Map())

  const endpoint = floor === 'knowledge'
    ? `/api/predictions/${floor}/${dataType}`
    : `/api/predictions/${floor}/${dataType}`

  const generateMutation = useMutation({
    mutationFn: async (periods: number = 2) => {
      const currentMonth = dayjs().format('YYYY-MM')
      const nextMonth = dayjs().add(1, 'month').format('YYYY-MM')

      const response = await axios.post<PredictionResult>(
        `${apiUrl}${endpoint}`,
        {
          model_id: selectedModel,
          periods,
          filters,
          include_weather: weatherEnabled,
          target_months: [currentMonth, nextMonth]
        }
      )
      return response.data
    },
    onSuccess: (data) => {
      if (data.success && data.predictions) {
        const newPredictions = new Map<string, PredictionValue>()
        data.predictions.forEach(p => {
          newPredictions.set(p.year_month, p)
        })
        setPredictions(newPredictions)
      }
    }
  })

  const getPrediction = useCallback((yearMonth: string): PredictionValue | undefined => {
    return predictions.get(yearMonth)
  }, [predictions])

  const isPredicted = useCallback((yearMonth: string): boolean => {
    return predictions.has(yearMonth)
  }, [predictions])

  const isFutureMonth = useCallback((yearMonth: string): boolean => {
    const current = dayjs().startOf('month')
    const target = dayjs(yearMonth + '-01')
    return target.isAfter(current) || target.isSame(current)
  }, [])

  const getCurrentMonthPrediction = useCallback((): PredictionValue | undefined => {
    const currentMonth = dayjs().format('YYYY-MM')
    return predictions.get(currentMonth)
  }, [predictions])

  const getNextMonthPrediction = useCallback((): PredictionValue | undefined => {
    const nextMonth = dayjs().add(1, 'month').format('YYYY-MM')
    return predictions.get(nextMonth)
  }, [predictions])

  const generate = useCallback((periods: number = 2) => {
    generateMutation.mutate(periods)
  }, [generateMutation])

  return {
    selectedModel,
    setSelectedModel,
    weatherEnabled,
    setWeatherEnabled: () => setWeatherEnabled(!weatherEnabled),
    predictions,
    getPrediction,
    isPredicted,
    isFutureMonth,
    getCurrentMonthPrediction,
    getNextMonthPrediction,
    generate,
    loading: generateMutation.isPending,
    error: generateMutation.error,
    result: generateMutation.data,
    hasData: predictions.size > 0
  }
}

export function useTablePredictions(floor: 'floor1' | 'floor23') {
  const [selectedModel, setSelectedModel] = useState(1)
  const [weatherEnabled, setWeatherEnabled] = useState(false)

  const generateMutation = useMutation({
    mutationFn: async () => {
      const currentMonth = dayjs().format('YYYY-MM')
      const nextMonth = dayjs().add(1, 'month').format('YYYY-MM')

      const response = await axios.post(
        `${apiUrl}/api/predictions/${floor}/table`,
        {
          model_id: selectedModel,
          target_months: [currentMonth, nextMonth],
          include_weather: weatherEnabled
        }
      )
      return response.data
    }
  })

  return {
    selectedModel,
    setSelectedModel,
    weatherEnabled,
    toggleWeather: () => setWeatherEnabled(!weatherEnabled),
    generate: () => generateMutation.mutate(),
    loading: generateMutation.isPending,
    data: generateMutation.data,
    error: generateMutation.error
  }
}
