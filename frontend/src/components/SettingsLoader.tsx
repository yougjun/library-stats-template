import { useEffect, useState, useCallback } from 'react'
import { settingsApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import {
  setHolidays,
  setLibraryYearStartDate,
} from '../utils/libraryDays'
import { LoadingFallback } from './LoadingFallback'

let settingsLoaded = false

function applySettings(data: any) {
  if (data.holidays) setHolidays(data.holidays)
  if (data.library_year_start_date) setLibraryYearStartDate(data.library_year_start_date)
}

export function SettingsLoader({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)
  const { isAuthenticated } = useAuthStore()
  const hasAccessToken = isAuthenticated()

  const loadGlobalSettings = useCallback(async () => {
    if (settingsLoaded) {
      return
    }

    if (window.location.hostname.includes('github.io')) {
      settingsLoaded = true
      return
    }

    setIsLoading(true)
    try {
      const response = hasAccessToken
        ? await settingsApi.get()
        : await settingsApi.getPublic()
      applySettings(response.data)
      settingsLoaded = true
    } catch (error: unknown) {
      console.debug('Settings load skipped, using localStorage fallback')
    } finally {
      setIsLoading(false)
    }
  }, [hasAccessToken])

  useEffect(() => {
    loadGlobalSettings()
  }, [loadGlobalSettings])

  if (isLoading) {
    return <LoadingFallback />
  }

  return <>{children}</>
}

export function resetSettingsLoader() {
  settingsLoaded = false
}
