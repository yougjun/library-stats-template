import dayjs from 'dayjs'
import holidaysData from '../data/holidays.json'

interface HolidayEntry {
  start_date: string
  end_date: string
  condition?: string
}

export const getHolidays = (): HolidayEntry[] => {
  const stored = localStorage.getItem('library_holidays')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof parsed[0] === 'string') {
          const migrated = parsed.map(date => ({
            start_date: date,
            end_date: date,
            condition: ''
          }))
          setHolidays(migrated)
          return migrated
        }
        return parsed
      }
    } catch (e) {
      console.error('Failed to parse holidays from localStorage', e)
    }
  }
  setHolidays(holidaysData)
  return holidaysData
}

const isDateInHolidayRange = (date: string, holidays: HolidayEntry[]): boolean => {
  const dateObj = dayjs(date)
  for (const holiday of holidays) {
    const start = dayjs(holiday.start_date)
    const end = dayjs(holiday.end_date)
    if ((dateObj.isAfter(start) || dateObj.isSame(start, 'day')) &&
        (dateObj.isBefore(end) || dateObj.isSame(end, 'day'))) {
      return true
    }
  }
  return false
}

export const calculateOpenDays = (yearMonth: string): number => {
  const [year, month] = yearMonth.split('-').map(Number)
  const libraryStartDate = getLibraryYearStartDate(yearMonth)
  const startYear = libraryStartDate.split('-')[0]
  const adjustedStart = startYear !== String(year)
    ? `${year}${libraryStartDate.substring(4)}`
    : libraryStartDate
  const startDate = dayjs(adjustedStart)
  const endDate = dayjs(`${year}-${month.toString().padStart(2, '0')}-01`).endOf('month')

  const holidays = getHolidays()
  let openDays = 0

  let current = startDate
  while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
    const dayOfWeek = current.day()
    const dateStr = current.format('YYYY-MM-DD')

    if (dayOfWeek !== 1 && !isDateInHolidayRange(dateStr, holidays)) {
      openDays++
    }

    current = current.add(1, 'day')
  }

  return openDays
}

export const calculateOpenDaysFromDate = (startDateStr: string, yearMonth: string): number => {
  const [year, month] = yearMonth.split('-').map(Number)
  const startDate = dayjs(startDateStr)
  const endDate = dayjs(`${year}-${month.toString().padStart(2, '0')}-01`).endOf('month')

  const holidays = getHolidays()
  let openDays = 0

  let current = startDate
  while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
    const dayOfWeek = current.day()
    const dateStr = current.format('YYYY-MM-DD')

    if (dayOfWeek !== 1 && !isDateInHolidayRange(dateStr, holidays)) {
      openDays++
    }

    current = current.add(1, 'day')
  }

  return openDays
}

export const getDateRangeString = (yearMonth: string): string => {
  const [year, month] = yearMonth.split('-').map(Number)
  const libraryStartDate = getLibraryYearStartDate(yearMonth)
  const startYear = libraryStartDate.split('-')[0]
  const adjustedStart = startYear !== String(year)
    ? `${year}${libraryStartDate.substring(4)}`
    : libraryStartDate
  const startDate = dayjs(adjustedStart)
  const endDate = dayjs(`${year}-${month.toString().padStart(2, '0')}-01`).endOf('month')

  const dayNames = ['일', '월', '화', '수', '목', '금', '토']

  const startStr = `${startDate.month() + 1}.${startDate.date()}. (${dayNames[startDate.day()]})`
  const endStr = `${month}.${endDate.date()}.(${dayNames[endDate.day()]})`

  return `${startStr} ~ ${endStr}`
}

export const getOperationPeriod = (yearMonth: string): string => {
  const [year, month] = yearMonth.split('-').map(Number)
  const startDate = dayjs(`${year}-${month.toString().padStart(2, '0')}-01`)
  const endDate = startDate.endOf('month')

  return `${startDate.format('YYYY-MM-DD')} ~ ${endDate.format('YYYY-MM-DD')}`
}

export const getReadingMultiplier = (floor: 'floor1' | 'floor23' = 'floor1'): number => {
  const key = `reading_multiplier_${floor}`
  const stored = localStorage.getItem(key)
  const defaultValue = floor === 'floor23' ? 2.0 : 1.7
  return stored ? parseFloat(stored) : defaultValue
}

export const setReadingMultiplier = (floor: 'floor1' | 'floor23', value: number): void => {
  const key = `reading_multiplier_${floor}`
  localStorage.setItem(key, value.toString())
}

export const getUpdateDateFormat = (): string => {
  const stored = localStorage.getItem('update_date_format')
  return stored || 'YYYY-MM-DD HH:MM:SS'
}

export const setUpdateDateFormat = (format: string): void => {
  localStorage.setItem('update_date_format', format)
}

export const getLibraryYearStartDate = (currentYearMonth: string): string => {
  const stored = localStorage.getItem('library_year_start_date')
  if (stored) return stored

  const year = currentYearMonth.split('-')[0]
  return `${year}-01-01`
}

export const setLibraryYearStartDate = (date: string): void => {
  localStorage.setItem('library_year_start_date', date)
}

export const getKoreanDayOfWeek = (date: string): string => {
  const dayOfWeek = dayjs(date).day()
  const koreanDays = ['일', '월', '화', '수', '목', '금', '토']
  return koreanDays[dayOfWeek]
}

export const setHolidays = (holidays: HolidayEntry[]): void => {
  localStorage.setItem('library_holidays', JSON.stringify(holidays))
}

export const startAccessSession = (): void => {
  const expiryTime = dayjs().add(1, 'hour').valueOf()
  localStorage.setItem('access_session_expiry', expiryTime.toString())
  localStorage.setItem('access_session_active', 'true')
}

export const renewAccessSession = (): void => {
  if (isAccessSessionValid()) {
    const expiryTime = dayjs().add(1, 'hour').valueOf()
    localStorage.setItem('access_session_expiry', expiryTime.toString())
  }
}

export const isAccessSessionValid = (): boolean => {
  const expiryTime = localStorage.getItem('access_session_expiry')
  const isActive = localStorage.getItem('access_session_active')

  if (!expiryTime || isActive !== 'true') {
    return false
  }

  const now = dayjs().valueOf()
  if (now > parseInt(expiryTime)) {
    endAccessSession()
    return false
  }

  return true
}

export const getSessionRemainingTime = (): number => {
  const expiryTime = localStorage.getItem('access_session_expiry')
  if (!expiryTime) {
    return 0
  }

  const now = dayjs().valueOf()
  const expiry = parseInt(expiryTime)
  const remaining = Math.max(0, expiry - now)

  return Math.floor(remaining / 1000)
}

export const endAccessSession = (): void => {
  localStorage.removeItem('access_session_expiry')
  localStorage.removeItem('access_session_active')
}

export const isAccessCodeSession = (): boolean => {
  return localStorage.getItem('access_session_active') === 'true'
}

export const getGateStartDate = (): string => {
  const stored = localStorage.getItem('gate_start_date')
  return stored !== null ? stored : ''
}

export const setGateStartDate = (date: string): void => {
  localStorage.setItem('gate_start_date', date)
}

export const getShowReopenDate = (): boolean => {
  const stored = localStorage.getItem('show_reopen_date')
  return stored !== null ? stored === 'true' : true
}

export const setShowReopenDate = (show: boolean): void => {
  localStorage.setItem('show_reopen_date', String(show))
}

export const getShowReopenDateUntil = (): string => {
  return localStorage.getItem('show_reopen_date_until') || '2025-12'
}

export const setShowReopenDateUntil = (until: string): void => {
  localStorage.setItem('show_reopen_date_until', until)
}

export function getCalculationCutoffDate(): string {
  return localStorage.getItem('calculationCutoffDate') || '2025-10'
}

export function setCalculationCutoffDate(date: string) {
  localStorage.setItem('calculationCutoffDate', date)
}

export function getFloor1AIAutomation(): {
  enabled: boolean
  airProjectionMultiplier: number
  fingerStoryMultiplier: number
  arBookMultiplier: number
} {
  const stored = localStorage.getItem('floor1_ai_automation')
  if (stored) {
    return JSON.parse(stored)
  }
  return {
    enabled: false,
    airProjectionMultiplier: 0.2,
    fingerStoryMultiplier: 0.5,
    arBookMultiplier: 0.1
  }
}

export function setFloor1AIAutomation(settings: {
  enabled: boolean
  airProjectionMultiplier: number
  fingerStoryMultiplier: number
  arBookMultiplier: number
}) {
  localStorage.setItem('floor1_ai_automation', JSON.stringify(settings))
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'floor1_ai_automation',
    newValue: JSON.stringify(settings),
    storageArea: localStorage
  }))
}

export function getFloor1KLASAutomation(): {
  enabled: boolean
} {
  const stored = localStorage.getItem('floor1_klas_automation')
  if (stored) {
    return JSON.parse(stored)
  }
  return {
    enabled: false
  }
}

export function setFloor1KLASAutomation(settings: {
  enabled: boolean
}) {
  localStorage.setItem('floor1_klas_automation', JSON.stringify(settings))
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'floor1_klas_automation',
    newValue: JSON.stringify(settings),
    storageArea: localStorage
  }))
}

export function getFloor23KLASAutomation(): {
  enabled: boolean
} {
  const stored = localStorage.getItem('floor23_klas_automation')
  if (stored) {
    return JSON.parse(stored)
  }
  return {
    enabled: false
  }
}

export function setFloor23KLASAutomation(settings: {
  enabled: boolean
}) {
  localStorage.setItem('floor23_klas_automation', JSON.stringify(settings))
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'floor23_klas_automation',
    newValue: JSON.stringify(settings),
    storageArea: localStorage
  }))
}

export function getDefaultStatsMonth(floor: 'floor1' | 'floor23' | 'knowledge'): string {
  const sessionKey = `last_viewed_${floor}_month`
  const lastViewed = sessionStorage.getItem(sessionKey)

  if (lastViewed) {
    return lastViewed
  }

  return dayjs().subtract(1, 'month').format('YYYY-MM')
}
