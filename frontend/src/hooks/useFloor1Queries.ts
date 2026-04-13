import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { floor1Api } from '../services/api'
import { message } from 'antd'

export const floor1Keys = {
  all: ['floor1'] as const,
  visitor: (yearMonth: string) => [...floor1Keys.all, 'visitor', yearMonth] as const,
  material: (yearMonth: string) => [...floor1Keys.all, 'material', yearMonth] as const,
  program: (yearMonth: string) => [...floor1Keys.all, 'program', yearMonth] as const,
  aiLibrary: (yearMonth: string) => [...floor1Keys.all, 'ai-library', yearMonth] as const,
  passIssuer: (yearMonth: string) => [...floor1Keys.all, 'pass-issuer', yearMonth] as const,
  gateTag: (yearMonth: string) => [...floor1Keys.all, 'gate-tag', yearMonth] as const,
  regularMember: (yearMonth: string) => [...floor1Keys.all, 'regular-member', yearMonth] as const,
}

export function useFloor1Visitor(yearMonth: string) {
  return useQuery({
    queryKey: floor1Keys.visitor(yearMonth),
    queryFn: () => floor1Api.getVisitor(yearMonth).then(res => res.data),
    enabled: !!yearMonth,
  })
}

export function useFloor1Material(yearMonth: string) {
  return useQuery({
    queryKey: floor1Keys.material(yearMonth),
    queryFn: () => floor1Api.getMaterial(yearMonth).then(res => res.data),
    enabled: !!yearMonth,
  })
}

export function useFloor1Program(yearMonth: string) {
  return useQuery({
    queryKey: floor1Keys.program(yearMonth),
    queryFn: () => floor1Api.getProgram(yearMonth).then(res => res.data),
    enabled: !!yearMonth,
  })
}

export function useFloor1AILibrary(yearMonth: string) {
  return useQuery({
    queryKey: floor1Keys.aiLibrary(yearMonth),
    queryFn: () => floor1Api.getAILibrary(yearMonth).then(res => res.data),
    enabled: !!yearMonth,
  })
}

export function useFloor1PassIssuer(yearMonth: string) {
  return useQuery({
    queryKey: floor1Keys.passIssuer(yearMonth),
    queryFn: () => floor1Api.getPassIssuer(yearMonth).then(res => res.data),
    enabled: !!yearMonth,
  })
}

export function useFloor1GateTag(yearMonth: string) {
  return useQuery({
    queryKey: floor1Keys.gateTag(yearMonth),
    queryFn: () => floor1Api.getGateTag(yearMonth).then(res => res.data),
    enabled: !!yearMonth,
  })
}

export function useFloor1RegularMember(yearMonth: string) {
  return useQuery({
    queryKey: floor1Keys.regularMember(yearMonth),
    queryFn: () => floor1Api.getRegularMember(yearMonth).then(res => res.data),
    enabled: !!yearMonth,
  })
}

export function useSaveFloor1Visitor(yearMonth: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: any) => floor1Api.saveVisitor(yearMonth, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: floor1Keys.visitor(yearMonth) })
      message.success('방문자 데이터 저장 완료')
    },
    onError: () => {
      message.error('방문자 데이터 저장 실패')
    },
  })
}

export function useSaveFloor1Material(yearMonth: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: any) => floor1Api.saveMaterial(yearMonth, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: floor1Keys.material(yearMonth) })
      message.success('자료 데이터 저장 완료')
    },
    onError: () => {
      message.error('자료 데이터 저장 실패')
    },
  })
}

export function useSaveFloor1Program(yearMonth: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: any) => floor1Api.saveProgram(yearMonth, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: floor1Keys.program(yearMonth) })
      message.success('프로그램 데이터 저장 완료')
    },
    onError: () => {
      message.error('프로그램 데이터 저장 실패')
    },
  })
}

export function useSaveFloor1AILibrary(yearMonth: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: any) => floor1Api.saveAILibrary(yearMonth, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: floor1Keys.aiLibrary(yearMonth) })
      message.success('AI 도서관 데이터 저장 완료')
    },
    onError: () => {
      message.error('AI 도서관 데이터 저장 실패')
    },
  })
}

export function useSaveFloor1PassIssuer(yearMonth: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: any) => floor1Api.savePassIssuer(yearMonth, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: floor1Keys.passIssuer(yearMonth) })
      message.success('출입증 발급 데이터 저장 완료')
    },
    onError: () => {
      message.error('출입증 발급 데이터 저장 실패')
    },
  })
}

export function useSaveFloor1GateTag(yearMonth: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: any) => floor1Api.saveGateTag(yearMonth, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: floor1Keys.gateTag(yearMonth) })
      message.success('출입문 태그 데이터 저장 완료')
    },
    onError: () => {
      message.error('출입문 태그 데이터 저장 실패')
    },
  })
}

export function useSaveFloor1RegularMember(yearMonth: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: any) => floor1Api.saveRegularMember(yearMonth, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: floor1Keys.regularMember(yearMonth) })
      message.success('정기회원 데이터 저장 완료')
    },
    onError: () => {
      message.error('정기회원 데이터 저장 실패')
    },
  })
}
