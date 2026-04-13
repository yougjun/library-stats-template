import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { weatherApi } from '../services/api'

export const useWeatherData = (startDate: string, endDate: string, enabled = true) => {
  return useQuery({
    queryKey: ['weather', startDate, endDate],
    queryFn: () => weatherApi.getWeatherData(startDate, endDate),
    enabled: enabled && !!startDate && !!endDate
  })
}

export const useFetchWeather = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ startDate, endDate, stationId }: { startDate: string; endDate: string; stationId?: number }) =>
      weatherApi.fetchWeather(startDate, endDate, stationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weather'] })
    }
  })
}

export const useWeatherCorrelation = () => {
  return useMutation({
    mutationFn: ({ startDate, endDate, libraryData }: { startDate: string; endDate: string; libraryData: any[] }) =>
      weatherApi.getWeatherCorrelation(startDate, endDate, libraryData)
  })
}
