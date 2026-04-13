import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../services/api'

export const statsKeys = {
  all: ['statistics'] as const,
  monthly: (yearMonth: string) => [...statsKeys.all, 'monthly', yearMonth] as const,
  floor1Cumulative: (yearMonth: string) => [...statsKeys.all, 'floor1', 'cumulative', yearMonth] as const,
  floor23Cumulative: (yearMonth: string) => [...statsKeys.all, 'floor23', 'cumulative', yearMonth] as const,
  knowledge: (yearMonth: string) => [...statsKeys.all, 'knowledge', yearMonth] as const,
}

export function useMonthlyStats(yearMonth: string) {
  return useQuery({
    queryKey: statsKeys.monthly(yearMonth),
    queryFn: () => statsApi.getMonthly(yearMonth).then(res => res.data),
    enabled: !!yearMonth,
  })
}

export function useFloor1Cumulative(yearMonth: string) {
  return useQuery({
    queryKey: statsKeys.floor1Cumulative(yearMonth),
    queryFn: () => statsApi.getFloor1Cumulative(yearMonth).then(res => res.data),
    enabled: !!yearMonth,
  })
}

export function useFloor23Cumulative(yearMonth: string) {
  return useQuery({
    queryKey: statsKeys.floor23Cumulative(yearMonth),
    queryFn: () => statsApi.getFloor23Cumulative(yearMonth).then(res => res.data),
    enabled: !!yearMonth,
  })
}

export function useKnowledgeStats(yearMonth: string) {
  return useQuery({
    queryKey: statsKeys.knowledge(yearMonth),
    queryFn: () => statsApi.getKnowledge(yearMonth).then(res => res.data),
    enabled: !!yearMonth,
  })
}
