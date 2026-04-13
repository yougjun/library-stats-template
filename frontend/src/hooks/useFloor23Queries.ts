import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { floor23Api } from '../services/api'
import { message } from 'antd'

export const floor23Keys = {
  all: ['floor23'] as const,
  visitor: (yearMonth: string) => [...floor23Keys.all, 'visitor', yearMonth] as const,
  materialType: (yearMonth: string) => [...floor23Keys.all, 'material-type', yearMonth] as const,
  materialSubject: (yearMonth: string) => [...floor23Keys.all, 'material-subject', yearMonth] as const,
  program: (yearMonth: string) => [...floor23Keys.all, 'program', yearMonth] as const,
  aiSmart: (yearMonth: string) => [...floor23Keys.all, 'ai-smart', yearMonth] as const,
  aiEquipment: (yearMonth: string, floor: string) => [...floor23Keys.all, 'ai-equipment', yearMonth, floor] as const,
}

export function useFloor23Visitor(yearMonth: string) {
  return useQuery({
    queryKey: floor23Keys.visitor(yearMonth),
    queryFn: () => floor23Api.getVisitor(yearMonth).then(res => res.data),
    enabled: !!yearMonth,
  })
}

export function useFloor23MaterialType(yearMonth: string) {
  return useQuery({
    queryKey: floor23Keys.materialType(yearMonth),
    queryFn: () => floor23Api.getMaterialType(yearMonth).then(res => res.data),
    enabled: !!yearMonth,
  })
}

export function useFloor23MaterialSubject(yearMonth: string) {
  return useQuery({
    queryKey: floor23Keys.materialSubject(yearMonth),
    queryFn: () => floor23Api.getMaterialSubject(yearMonth).then(res => res.data),
    enabled: !!yearMonth,
  })
}

export function useFloor23Program(yearMonth: string) {
  return useQuery({
    queryKey: floor23Keys.program(yearMonth),
    queryFn: () => floor23Api.getProgram(yearMonth).then(res => res.data),
    enabled: !!yearMonth,
  })
}

export function useFloor23AISmart(yearMonth: string) {
  return useQuery({
    queryKey: floor23Keys.aiSmart(yearMonth),
    queryFn: () => floor23Api.getAISmart(yearMonth).then(res => res.data),
    enabled: !!yearMonth,
  })
}

export function useFloor23AIEquipment(yearMonth: string, floor: string) {
  return useQuery({
    queryKey: floor23Keys.aiEquipment(yearMonth, floor),
    queryFn: () => floor23Api.getAIEquipment(yearMonth, floor).then(res => res.data),
    enabled: !!yearMonth && !!floor,
  })
}

export function useSaveFloor23Visitor(yearMonth: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: any) => floor23Api.saveVisitor(yearMonth, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: floor23Keys.visitor(yearMonth) })
      message.success('방문자 데이터 저장 완료')
    },
    onError: () => {
      message.error('방문자 데이터 저장 실패')
    },
  })
}

export function useSaveFloor23MaterialType(yearMonth: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: any) => floor23Api.saveMaterialType(yearMonth, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: floor23Keys.materialType(yearMonth) })
      message.success('자료 유형 데이터 저장 완료')
    },
    onError: () => {
      message.error('자료 유형 데이터 저장 실패')
    },
  })
}

export function useSaveFloor23MaterialSubject(yearMonth: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: any) => floor23Api.saveMaterialSubject(yearMonth, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: floor23Keys.materialSubject(yearMonth) })
      message.success('자료 주제 데이터 저장 완료')
    },
    onError: () => {
      message.error('자료 주제 데이터 저장 실패')
    },
  })
}

export function useSaveFloor23Program(yearMonth: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: any) => floor23Api.saveProgram(yearMonth, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: floor23Keys.program(yearMonth) })
      message.success('프로그램 데이터 저장 완료')
    },
    onError: () => {
      message.error('프로그램 데이터 저장 실패')
    },
  })
}

export function useSaveFloor23AISmart(yearMonth: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: any) => floor23Api.saveAISmart(yearMonth, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: floor23Keys.aiSmart(yearMonth) })
      message.success('AI 스마트 데이터 저장 완료')
    },
    onError: () => {
      message.error('AI 스마트 데이터 저장 실패')
    },
  })
}

export function useSaveFloor23AIEquipment(yearMonth: string, floor: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: any) => floor23Api.saveAIEquipment(yearMonth, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: floor23Keys.aiEquipment(yearMonth, floor) })
      message.success('AI 설비 데이터 저장 완료')
    },
    onError: () => {
      message.error('AI 설비 데이터 저장 실패')
    },
  })
}
