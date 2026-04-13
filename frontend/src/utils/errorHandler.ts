import { AxiosError } from 'axios'

interface ApiErrorResponse {
  detail?: string
  message?: string
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined
    return data?.detail || data?.message || error.message || '오류가 발생했습니다'
  }
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

export function isAxiosError(error: unknown): error is AxiosError {
  return error instanceof AxiosError
}
