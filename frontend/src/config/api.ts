/**
 * API Configuration
 * Centralized configuration for API endpoints
 */

const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }

  return ''
}

export const API_BASE_URL = getApiBaseUrl()

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: false,
}
