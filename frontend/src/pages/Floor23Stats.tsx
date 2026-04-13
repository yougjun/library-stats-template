import { useState, useEffect } from 'react'
import { Card, Table, Button, message, DatePicker } from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import { SettingOutlined, EditOutlined, DownloadOutlined, DashboardOutlined } from '@ant-design/icons'
import { statsApi, floor23Api, settingsApi, type Floor23AISmartRecord, type Floor23VisitorRecord, type Floor23MaterialSubjectRecord, type Floor23MaterialTypeRecord, type Floor23ProgramRecord, type Floor23AIEquipmentRecord, type HeaderAliasConfig } from '../services/api'
import dayjs, { Dayjs } from 'dayjs'
import axios from 'axios'
import type { ColumnsType } from 'antd/es/table'
import FloorNavigation from '../components/FloorNavigation'
import { EditableCell } from '../components/EditableCell'
import SessionTimer from '../components/SessionTimer'
import { useAuthStore } from '../store/authStore'
import {
  calculateOpenDays,
  getDateRangeString,
  getOperationPeriod,
  isAccessCodeSession,
  getReadingMultiplier,
  getUpdateDateFormat,
  getLibraryYearStartDate,
  getHolidays
} from '../utils/libraryDays'
import '../styles/table.css'
import { DOWNLOAD_FILENAME } from '../config/library'

interface SubjectData {
  type_000: number
  type_100: number
  type_200: number
  type_300: number
  type_400: number
  type_500: number
  type_600: number
  type_700: number
  type_800: number
  type_900: number
  etc: number
  [key: string]: number
}

interface VisitorCategoryData {
  대출: number
  열람: number
  책바다: number
  책나래: number
  만화책마루: number
  영어책마루: number
  다봄자료실: number
  인문예술자료실: number
  멀티미디어존: number
  간행물존: number
  영화: number
  음악: number
  디지털갤러리: number
  전체: number
  [key: string]: number
}

interface ProgramMapData {
  session_count: number
  participant_count: number
}

interface VisitorAgeRow {
  loan: number
  reading: number
  bookbada: number
  booknare: number
  comic: number
  english: number
  dabom: number
  humanities: number
  multimedia: number
  periodical: number
  movie: number
  music: number
  gallery: number
  total: number
  [key: string]: number
}

interface VisitorByAge {
  infant_elementary: VisitorAgeRow
  middle_high: VisitorAgeRow
  adult: VisitorAgeRow
  [key: string]: VisitorAgeRow
}

interface VisitorDisplayRow {
  key: number
  category: string
  infant_elementary: number
  middle_high: number
  adult: number
  sum: number
  cumulative: number
}

interface MaterialDisplayRow {
  key: number
  room: string
  type_000: number
  type_100: number
  type_200: number
  type_300: number
  type_400: number
  type_500: number
  type_600: number
  type_700: number
  type_800: number
  type_900: number
  etc: number
  sum: number
  cumulative?: number
}

interface AISmartDisplayRow {
  key: number
  item: string
  monthly: number
  cumulative: number
}

interface AIEquipmentDisplayRow {
  key: number
  floor: string
  bookbot: number
  book_kiosk: number
  laptop: number
  tablet: number
  book_scanner: number
  enews: number
  sum: number
  cumulative?: number
}

interface ProgramDisplayRow {
  key: number
  category: string
  session_count: number
  participant_count: number
  cumulative_sessions?: number
  cumulative_participants?: number
}

interface Floor23CumulativeData {
  visitor?: Array<{ age_group?: string; category?: string; user_count?: number }>
  visitor_totals?: { loan_cumulative?: number; reading_cumulative?: number; total_cumulative?: number }
  material_subject?: Array<{ room_type?: string; [key: string]: number | string | undefined }>
  material_type?: Array<{ room_type?: string; material_type?: string; count?: number }>
  program?: Array<{ program_name?: string; session_count?: number; participant_count?: number }>
  ai_smart?: Array<{ literature_vending?: number; unmanned_card_issuer?: number; smart_loan_users?: number; smart_return_users?: number; smart_reservation_users?: number }>
  ai_equipment?: Array<{ floor?: string; bookbot?: number; book_kiosk?: number; laptop?: number; tablet?: number; book_scanner?: number; enews?: number }>
}

const renderNumber = (v: number | undefined) => Math.round(v || 0).toLocaleString()

export default function Floor23Stats() {
  const { yearMonth } = useParams()
  const navigate = useNavigate()
  const { role, token } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs(yearMonth))
  const [visitorData, setVisitorData] = useState<Record<string, unknown>[]>([])
  const [materialSubjectData, setMaterialSubjectData] = useState<Record<string, unknown>[]>([])
  const [materialTypeGeneralData, setMaterialTypeGeneralData] = useState<Record<string, unknown>[]>([])
  const [materialTypeHumanitiesData, setMaterialTypeHumanitiesData] = useState<Record<string, unknown>[]>([])
  const [programData, setProgramData] = useState<Record<string, unknown>[]>([])
  const [aiSmartLibraryData, setAISmartLibraryData] = useState<Record<string, unknown>[]>([])
  const [aiEquipmentData, setAIEquipmentData] = useState<Record<string, unknown>[]>([])
  const [lastUpdateDate, setLastUpdateDate] = useState<string>('')
  const [headerAliases, setHeaderAliases] = useState<HeaderAliasConfig>({})

  useEffect(() => {
    const fetchHeaderAliases = async () => {
      try {
        const res = await settingsApi.get()
        if (res.data.header_aliases) {
          setHeaderAliases(res.data.header_aliases)
        }
      } catch (error) {
        console.error('Failed to load header aliases:', error)
      }
    }
    fetchHeaderAliases()
  }, [])

  useEffect(() => {
    if (yearMonth) {
      sessionStorage.setItem('last_viewed_floor23_month', yearMonth)
      setVisitorData([])
      setMaterialSubjectData([])
      setMaterialTypeGeneralData([])
      setMaterialTypeHumanitiesData([])
      setProgramData([])
      setAISmartLibraryData([])
      setAIEquipmentData([])
      setLastUpdateDate('')
    }
    loadData()
  }, [yearMonth])

  useEffect(() => {
    let lastFetchTime = Date.now()
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now()
        if (now - lastFetchTime > 30000) {
          lastFetchTime = now
          loadData()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const floor23Multiplier = getReadingMultiplier('floor23')

      const visitorRes = await floor23Api.getVisitor(yearMonth!)
      const materialTypeRes = await floor23Api.getMaterialType(yearMonth!)
      const materialSubjectRes = await floor23Api.getMaterialSubject(yearMonth!)
      const programRes = await floor23Api.getProgram(yearMonth!)
      const aiSmartRes = await floor23Api.getAISmart(yearMonth!)
      const aiEquipmentFloor2Res = await floor23Api.getAIEquipment(yearMonth!, 'floor2')
      const aiEquipmentFloor3Res = await floor23Api.getAIEquipment(yearMonth!, 'floor3')

      const cumulativeRes = await statsApi.getFloor23Cumulative(yearMonth!)
      const cumulativeData = cumulativeRes.data as Floor23CumulativeData

      const monthVisitorByAge: VisitorByAge = {
        'infant_elementary': { loan: 0, reading: 0, bookbada: 0, booknare: 0, comic: 0, english: 0, dabom: 0, humanities: 0, multimedia: 0, periodical: 0, movie: 0, music: 0, gallery: 0, total: 0 },
        'middle_high': { loan: 0, reading: 0, bookbada: 0, booknare: 0, comic: 0, english: 0, dabom: 0, humanities: 0, multimedia: 0, periodical: 0, movie: 0, music: 0, gallery: 0, total: 0 },
        'adult': { loan: 0, reading: 0, bookbada: 0, booknare: 0, comic: 0, english: 0, dabom: 0, humanities: 0, multimedia: 0, periodical: 0, movie: 0, music: 0, gallery: 0, total: 0 }
      }

      const catMap: Record<string, string> = {
        '자료이용': 'loan',
        '책바다': 'bookbada',
        '책나래': 'booknare',
        '만화책마루': 'comic',
        '영어책마루': 'english',
        '다봄자료실': 'dabom',
        '인문예술자료실': 'humanities',
        '멀티미디어존': 'multimedia',
        '간행물존': 'periodical',
        '영화': 'movie',
        '음악': 'music',
        '디지털갤러리': 'gallery'
      }

      if (visitorRes.data && Array.isArray(visitorRes.data)) {
        visitorRes.data.forEach((item: Floor23VisitorRecord) => {
          if (item.age_group && item.age_group !== 'sum' && monthVisitorByAge[item.age_group]) {
          const key = catMap[item.category || '']
          if (key) {
            monthVisitorByAge[item.age_group][key] = item.user_count || 0
          }
        }
      })
      }

      Object.keys(monthVisitorByAge).forEach(ageGroup => {
        monthVisitorByAge[ageGroup].reading = Math.round(monthVisitorByAge[ageGroup].loan * floor23Multiplier)
      })

      Object.keys(monthVisitorByAge).forEach(ageGroup => {
        const row = monthVisitorByAge[ageGroup]
        row.total = row.loan + row.reading + row.bookbada + row.booknare + row.comic +
                    row.english + row.dabom + row.humanities + row.multimedia +
                    row.periodical + row.movie + row.music + row.gallery
      })

      const monthSumVisitor = {
        loan: monthVisitorByAge['infant_elementary'].loan + monthVisitorByAge['middle_high'].loan + monthVisitorByAge['adult'].loan,
        reading: monthVisitorByAge['infant_elementary'].reading + monthVisitorByAge['middle_high'].reading + monthVisitorByAge['adult'].reading,
        bookbada: monthVisitorByAge['infant_elementary'].bookbada + monthVisitorByAge['middle_high'].bookbada + monthVisitorByAge['adult'].bookbada,
        booknare: monthVisitorByAge['infant_elementary'].booknare + monthVisitorByAge['middle_high'].booknare + monthVisitorByAge['adult'].booknare,
        comic: monthVisitorByAge['infant_elementary'].comic + monthVisitorByAge['middle_high'].comic + monthVisitorByAge['adult'].comic,
        english: monthVisitorByAge['infant_elementary'].english + monthVisitorByAge['middle_high'].english + monthVisitorByAge['adult'].english,
        dabom: monthVisitorByAge['infant_elementary'].dabom + monthVisitorByAge['middle_high'].dabom + monthVisitorByAge['adult'].dabom,
        humanities: monthVisitorByAge['infant_elementary'].humanities + monthVisitorByAge['middle_high'].humanities + monthVisitorByAge['adult'].humanities,
        multimedia: monthVisitorByAge['infant_elementary'].multimedia + monthVisitorByAge['middle_high'].multimedia + monthVisitorByAge['adult'].multimedia,
        periodical: monthVisitorByAge['infant_elementary'].periodical + monthVisitorByAge['middle_high'].periodical + monthVisitorByAge['adult'].periodical,
        movie: monthVisitorByAge['infant_elementary'].movie + monthVisitorByAge['middle_high'].movie + monthVisitorByAge['adult'].movie,
        music: monthVisitorByAge['infant_elementary'].music + monthVisitorByAge['middle_high'].music + monthVisitorByAge['adult'].music,
        gallery: monthVisitorByAge['infant_elementary'].gallery + monthVisitorByAge['middle_high'].gallery + monthVisitorByAge['adult'].gallery,
        total: monthVisitorByAge['infant_elementary'].total + monthVisitorByAge['middle_high'].total + monthVisitorByAge['adult'].total,
        cumulative: 0
      }

      const cumulativeByAge: VisitorByAge = {
        'infant_elementary': { loan: 0, reading: 0, bookbada: 0, booknare: 0, comic: 0, english: 0, dabom: 0, humanities: 0, multimedia: 0, periodical: 0, movie: 0, music: 0, gallery: 0, total: 0 },
        'middle_high': { loan: 0, reading: 0, bookbada: 0, booknare: 0, comic: 0, english: 0, dabom: 0, humanities: 0, multimedia: 0, periodical: 0, movie: 0, music: 0, gallery: 0, total: 0 },
        'adult': { loan: 0, reading: 0, bookbada: 0, booknare: 0, comic: 0, english: 0, dabom: 0, humanities: 0, multimedia: 0, periodical: 0, movie: 0, music: 0, gallery: 0, total: 0 }
      }

      const cumCatMap: Record<string, string> = {
        '자료이용': 'loan',
        '열람': 'reading',
        '책바다': 'bookbada',
        '책나래': 'booknare',
        '만화책마루': 'comic',
        '영어책마루': 'english',
        '다봄자료실': 'dabom',
        '인문예술자료실': 'humanities',
        '멀티미디어존': 'multimedia',
        '간행물존': 'periodical',
        '영화': 'movie',
        '음악': 'music',
        '디지털갤러리': 'gallery'
      }

      if (cumulativeData.visitor && Array.isArray(cumulativeData.visitor)) {
        cumulativeData.visitor.forEach((item: any) => {
          if (item.age_group && item.age_group !== 'sum' && cumulativeByAge[item.age_group]) {
          const key = cumCatMap[item.category || '']
          if (key) {
            cumulativeByAge[item.age_group][key] += item.user_count || 0
          }
        }
      })
      }

      Object.keys(cumulativeByAge).forEach(ageGroup => {
        const row = cumulativeByAge[ageGroup]
        row.total = row.loan + row.reading + row.bookbada + row.booknare + row.comic +
                    row.english + row.dabom + row.humanities + row.multimedia +
                    row.periodical + row.movie + row.music + row.gallery
      })

      const apiTotals = cumulativeData.visitor_totals || { loan_cumulative: 0, reading_cumulative: 0, total_cumulative: 0 }

      const cumulativeSumVisitor = {
        loan: cumulativeByAge['infant_elementary'].loan + cumulativeByAge['middle_high'].loan + cumulativeByAge['adult'].loan,
        reading: cumulativeByAge['infant_elementary'].reading + cumulativeByAge['middle_high'].reading + cumulativeByAge['adult'].reading,
        bookbada: cumulativeByAge['infant_elementary'].bookbada + cumulativeByAge['middle_high'].bookbada + cumulativeByAge['adult'].bookbada,
        booknare: cumulativeByAge['infant_elementary'].booknare + cumulativeByAge['middle_high'].booknare + cumulativeByAge['adult'].booknare,
        comic: cumulativeByAge['infant_elementary'].comic + cumulativeByAge['middle_high'].comic + cumulativeByAge['adult'].comic,
        english: cumulativeByAge['infant_elementary'].english + cumulativeByAge['middle_high'].english + cumulativeByAge['adult'].english,
        dabom: cumulativeByAge['infant_elementary'].dabom + cumulativeByAge['middle_high'].dabom + cumulativeByAge['adult'].dabom,
        humanities: cumulativeByAge['infant_elementary'].humanities + cumulativeByAge['middle_high'].humanities + cumulativeByAge['adult'].humanities,
        multimedia: cumulativeByAge['infant_elementary'].multimedia + cumulativeByAge['middle_high'].multimedia + cumulativeByAge['adult'].multimedia,
        periodical: cumulativeByAge['infant_elementary'].periodical + cumulativeByAge['middle_high'].periodical + cumulativeByAge['adult'].periodical,
        movie: cumulativeByAge['infant_elementary'].movie + cumulativeByAge['middle_high'].movie + cumulativeByAge['adult'].movie,
        music: cumulativeByAge['infant_elementary'].music + cumulativeByAge['middle_high'].music + cumulativeByAge['adult'].music,
        gallery: cumulativeByAge['infant_elementary'].gallery + cumulativeByAge['middle_high'].gallery + cumulativeByAge['adult'].gallery,
        total: apiTotals.total_cumulative || (cumulativeByAge['infant_elementary'].total + cumulativeByAge['middle_high'].total + cumulativeByAge['adult'].total),
        cumulative: 0
      }

      const builtVisitorData = [
        { type: 'month', age_group: 'infant_elementary', ...monthVisitorByAge['infant_elementary'], cumulative: cumulativeByAge['infant_elementary'].total },
        { type: 'month', age_group: 'middle_high', ...monthVisitorByAge['middle_high'], cumulative: cumulativeByAge['middle_high'].total },
        { type: 'month', age_group: 'adult', ...monthVisitorByAge['adult'], cumulative: cumulativeByAge['adult'].total },
        { type: 'month', age_group: 'sum', ...monthSumVisitor, cumulative: cumulativeSumVisitor.total },
        { type: 'cumulative', age_group: 'infant_elementary', ...cumulativeByAge['infant_elementary'], cumulative: cumulativeByAge['infant_elementary'].total },
        { type: 'cumulative', age_group: 'middle_high', ...cumulativeByAge['middle_high'], cumulative: cumulativeByAge['middle_high'].total },
        { type: 'cumulative', age_group: 'adult', ...cumulativeByAge['adult'], cumulative: cumulativeByAge['adult'].total },
        { type: 'cumulative', age_group: 'sum', ...cumulativeSumVisitor, cumulative: cumulativeSumVisitor.total }
      ]

      setVisitorData(builtVisitorData.map((item, idx) => ({ ...item, key: idx })))

      const monthSubjectLoanData: SubjectData = { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0 }
      if (materialSubjectRes.data && Array.isArray(materialSubjectRes.data)) {
        materialSubjectRes.data.filter((item: any) => item.usage_type === 'loan').forEach((item: any) => {
          const key = item.subject_code === 'etc' ? 'etc' : `type_${item.subject_code}`
          monthSubjectLoanData[key] = item.book_count || 0
        })
      }

      const monthSubjectReadData = {
        type_000: Math.round(monthSubjectLoanData.type_000 * floor23Multiplier),
        type_100: Math.round(monthSubjectLoanData.type_100 * floor23Multiplier),
        type_200: Math.round(monthSubjectLoanData.type_200 * floor23Multiplier),
        type_300: Math.round(monthSubjectLoanData.type_300 * floor23Multiplier),
        type_400: Math.round(monthSubjectLoanData.type_400 * floor23Multiplier),
        type_500: Math.round(monthSubjectLoanData.type_500 * floor23Multiplier),
        type_600: Math.round(monthSubjectLoanData.type_600 * floor23Multiplier),
        type_700: Math.round(monthSubjectLoanData.type_700 * floor23Multiplier),
        type_800: Math.round(monthSubjectLoanData.type_800 * floor23Multiplier),
        type_900: Math.round(monthSubjectLoanData.type_900 * floor23Multiplier),
        etc: Math.round(monthSubjectLoanData.etc * floor23Multiplier)
      }

      const monthSubjectSumData = {
        type_000: monthSubjectLoanData.type_000 + monthSubjectReadData.type_000,
        type_100: monthSubjectLoanData.type_100 + monthSubjectReadData.type_100,
        type_200: monthSubjectLoanData.type_200 + monthSubjectReadData.type_200,
        type_300: monthSubjectLoanData.type_300 + monthSubjectReadData.type_300,
        type_400: monthSubjectLoanData.type_400 + monthSubjectReadData.type_400,
        type_500: monthSubjectLoanData.type_500 + monthSubjectReadData.type_500,
        type_600: monthSubjectLoanData.type_600 + monthSubjectReadData.type_600,
        type_700: monthSubjectLoanData.type_700 + monthSubjectReadData.type_700,
        type_800: monthSubjectLoanData.type_800 + monthSubjectReadData.type_800,
        type_900: monthSubjectLoanData.type_900 + monthSubjectReadData.type_900,
        etc: monthSubjectLoanData.etc + monthSubjectReadData.etc
      }

      const subjectLoanMonthTotal = Object.values(monthSubjectLoanData).reduce((a, b) => a + b, 0)
      const subjectReadMonthTotal = Object.values(monthSubjectReadData).reduce((a, b) => a + b, 0)
      const subjectSumMonthTotal = subjectLoanMonthTotal + subjectReadMonthTotal

      const cumulativeSubjectLoan: SubjectData = { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0 }
      const cumulativeSubjectRead: SubjectData = { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0 }

      if (cumulativeData.material_subject && Array.isArray(cumulativeData.material_subject)) {
        cumulativeData.material_subject.forEach((item: any) => {
          const key = item.subject_code === 'etc' ? 'etc' : `type_${item.subject_code}`
          if (item.usage_type === 'loan') {
            cumulativeSubjectLoan[key] += item.book_count || 0
          } else if (item.usage_type === 'reading') {
            cumulativeSubjectRead[key] += item.book_count || 0
          }
        })
      }

      const cumulativeSubjectSum = {
        type_000: cumulativeSubjectLoan.type_000 + cumulativeSubjectRead.type_000,
        type_100: cumulativeSubjectLoan.type_100 + cumulativeSubjectRead.type_100,
        type_200: cumulativeSubjectLoan.type_200 + cumulativeSubjectRead.type_200,
        type_300: cumulativeSubjectLoan.type_300 + cumulativeSubjectRead.type_300,
        type_400: cumulativeSubjectLoan.type_400 + cumulativeSubjectRead.type_400,
        type_500: cumulativeSubjectLoan.type_500 + cumulativeSubjectRead.type_500,
        type_600: cumulativeSubjectLoan.type_600 + cumulativeSubjectRead.type_600,
        type_700: cumulativeSubjectLoan.type_700 + cumulativeSubjectRead.type_700,
        type_800: cumulativeSubjectLoan.type_800 + cumulativeSubjectRead.type_800,
        type_900: cumulativeSubjectLoan.type_900 + cumulativeSubjectRead.type_900,
        etc: cumulativeSubjectLoan.etc + cumulativeSubjectRead.etc
      }

      const cumulativeSubjectLoanTotal = Object.values(cumulativeSubjectLoan).reduce((a, b) => a + b, 0) as number
      const cumulativeSubjectReadTotal = Object.values(cumulativeSubjectRead).reduce((a, b) => a + b, 0) as number
      const cumulativeSubjectSumTotal = cumulativeSubjectLoanTotal + cumulativeSubjectReadTotal

      const finalMaterialSubjectData = [
        { room_type: 'floor23', type: 'loan', ...monthSubjectLoanData, month_total: subjectLoanMonthTotal, cumulative_total: cumulativeSubjectLoanTotal },
        { room_type: 'floor23', type: 'loan_cumulative', ...cumulativeSubjectLoan, month_total: cumulativeSubjectLoanTotal, cumulative_total: cumulativeSubjectLoanTotal },
        { room_type: 'floor23', type: 'read', ...monthSubjectReadData, month_total: subjectReadMonthTotal, cumulative_total: cumulativeSubjectReadTotal },
        { room_type: 'floor23', type: 'read_cumulative', ...cumulativeSubjectRead, month_total: cumulativeSubjectReadTotal, cumulative_total: cumulativeSubjectReadTotal },
        { room_type: 'floor23', type: 'sum', ...monthSubjectSumData, month_total: subjectSumMonthTotal, cumulative_total: cumulativeSubjectSumTotal },
        { room_type: 'floor23', type: 'sum_cumulative', ...cumulativeSubjectSum, month_total: cumulativeSubjectSumTotal, cumulative_total: cumulativeSubjectSumTotal }
      ]

      const monthGeneralLoanData = { general_books: 0, comic: 0, english: 0, multicultural: 0, large_print: 0, dementia: 0, easy_read: 0, braille: 0 }
      if (materialTypeRes.data && Array.isArray(materialTypeRes.data)) {
        materialTypeRes.data.filter((item: any) => item.room_type === 'general' && item.usage_type === 'loan').forEach((item: any) => {
          monthGeneralLoanData[item.material_type as keyof typeof monthGeneralLoanData] = item.book_count || 0
        })
      }

      const monthGeneralReadData = {
        general_books: Math.round(monthGeneralLoanData.general_books * floor23Multiplier),
        comic: Math.round(monthGeneralLoanData.comic * floor23Multiplier),
        english: Math.round(monthGeneralLoanData.english * floor23Multiplier),
        multicultural: Math.round(monthGeneralLoanData.multicultural * floor23Multiplier),
        large_print: Math.round(monthGeneralLoanData.large_print * floor23Multiplier),
        dementia: Math.round(monthGeneralLoanData.dementia * floor23Multiplier),
        easy_read: Math.round(monthGeneralLoanData.easy_read * floor23Multiplier),
        braille: Math.round(monthGeneralLoanData.braille * floor23Multiplier)
      }

      const monthGeneralSumData = {
        general_books: monthGeneralLoanData.general_books + monthGeneralReadData.general_books,
        comic: monthGeneralLoanData.comic + monthGeneralReadData.comic,
        english: monthGeneralLoanData.english + monthGeneralReadData.english,
        multicultural: monthGeneralLoanData.multicultural + monthGeneralReadData.multicultural,
        large_print: monthGeneralLoanData.large_print + monthGeneralReadData.large_print,
        dementia: monthGeneralLoanData.dementia + monthGeneralReadData.dementia,
        easy_read: monthGeneralLoanData.easy_read + monthGeneralReadData.easy_read,
        braille: monthGeneralLoanData.braille + monthGeneralReadData.braille
      }

      const generalLoanMonthTotal = Object.values(monthGeneralLoanData).reduce((a, b) => a + b, 0)
      const generalReadMonthTotal = Object.values(monthGeneralReadData).reduce((a, b) => a + b, 0)
      const generalSumMonthTotal = generalLoanMonthTotal + generalReadMonthTotal

      const cumulativeGeneralLoan = { general_books: 0, comic: 0, english: 0, multicultural: 0, large_print: 0, dementia: 0, easy_read: 0, braille: 0 }
      const cumulativeGeneralRead = { general_books: 0, comic: 0, english: 0, multicultural: 0, large_print: 0, dementia: 0, easy_read: 0, braille: 0 }

      if (cumulativeData.material_type && Array.isArray(cumulativeData.material_type)) {
        cumulativeData.material_type.filter((item: any) => item.room_type === 'general').forEach((item: any) => {
          if (item.usage_type === 'loan') {
            cumulativeGeneralLoan[item.material_type as keyof typeof cumulativeGeneralLoan] += item.book_count || 0
          } else if (item.usage_type === 'read') {
            cumulativeGeneralRead[item.material_type as keyof typeof cumulativeGeneralRead] += item.book_count || 0
          }
        })
      }

      const cumulativeGeneralSum = {
        general_books: cumulativeGeneralLoan.general_books + cumulativeGeneralRead.general_books,
        comic: cumulativeGeneralLoan.comic + cumulativeGeneralRead.comic,
        english: cumulativeGeneralLoan.english + cumulativeGeneralRead.english,
        multicultural: cumulativeGeneralLoan.multicultural + cumulativeGeneralRead.multicultural,
        large_print: cumulativeGeneralLoan.large_print + cumulativeGeneralRead.large_print,
        dementia: cumulativeGeneralLoan.dementia + cumulativeGeneralRead.dementia,
        easy_read: cumulativeGeneralLoan.easy_read + cumulativeGeneralRead.easy_read,
        braille: cumulativeGeneralLoan.braille + cumulativeGeneralRead.braille
      }

      const cumulativeGeneralLoanTotal = Object.values(cumulativeGeneralLoan).reduce((a, b) => a + b, 0)
      const cumulativeGeneralReadTotal = Object.values(cumulativeGeneralRead).reduce((a, b) => a + b, 0)
      const cumulativeGeneralSumTotal = cumulativeGeneralLoanTotal + cumulativeGeneralReadTotal

      const finalMaterialTypeGeneralData = [
        { room_type: 'general', type: 'loan', unit: '권', ...monthGeneralLoanData, month_total: generalLoanMonthTotal, cumulative_total: cumulativeGeneralLoanTotal },
        { room_type: 'general', type: 'loan_cumulative', unit: '권', ...cumulativeGeneralLoan, month_total: cumulativeGeneralLoanTotal, cumulative_total: cumulativeGeneralLoanTotal },
        { room_type: 'general', type: 'read', unit: '권', ...monthGeneralReadData, month_total: generalReadMonthTotal, cumulative_total: cumulativeGeneralReadTotal },
        { room_type: 'general', type: 'read_cumulative', unit: '권', ...cumulativeGeneralRead, month_total: cumulativeGeneralReadTotal, cumulative_total: cumulativeGeneralReadTotal },
        { room_type: 'general', type: 'sum', unit: '권', ...monthGeneralSumData, month_total: generalSumMonthTotal, cumulative_total: cumulativeGeneralSumTotal },
        { room_type: 'general', type: 'sum_cumulative', unit: '권', ...cumulativeGeneralSum, month_total: cumulativeGeneralSumTotal, cumulative_total: cumulativeGeneralSumTotal }
      ]

      const monthHumanitiesLoanData = { books: 0, newspaper: 0, magazine: 0, ebook: 0, audiobook: 0, ejournal: 0, online_magazine_pc: 0, online_magazine_mobile: 0, waveon: 0, flybook: 0 }
      const monthHumanitiesReadData = { books: 0, newspaper: 0, magazine: 0, ebook: 0, audiobook: 0, ejournal: 0, online_magazine_pc: 0, online_magazine_mobile: 0, waveon: 0, flybook: 0 }
      const monthHumanitiesUseData = { books: 0, newspaper: 0, magazine: 0, ebook: 0, audiobook: 0, ejournal: 0, online_magazine_pc: 0, online_magazine_mobile: 0, waveon: 0, flybook: 0 }

      if (materialTypeRes.data && Array.isArray(materialTypeRes.data)) {
        materialTypeRes.data.filter((item: any) => item.room_type === 'humanities').forEach((item: any) => {
          if (item.usage_type === 'loan') {
            monthHumanitiesLoanData[item.material_type as keyof typeof monthHumanitiesLoanData] = item.book_count || 0
          } else if (item.usage_type === 'read') {
            monthHumanitiesReadData[item.material_type as keyof typeof monthHumanitiesReadData] = item.book_count || 0
          } else if (item.usage_type === 'use') {
            monthHumanitiesUseData[item.material_type as keyof typeof monthHumanitiesUseData] = item.book_count || 0
          }
        })
      }

      monthHumanitiesReadData.books = Math.round(monthHumanitiesLoanData.books * floor23Multiplier)

      const monthHumanitiesSumData = {
        books: monthHumanitiesLoanData.books + monthHumanitiesReadData.books,
        newspaper: monthHumanitiesLoanData.newspaper + monthHumanitiesReadData.newspaper,
        magazine: monthHumanitiesLoanData.magazine + monthHumanitiesReadData.magazine,
        ebook: monthHumanitiesLoanData.ebook + monthHumanitiesReadData.ebook,
        audiobook: monthHumanitiesLoanData.audiobook + monthHumanitiesReadData.audiobook,
        ejournal: monthHumanitiesLoanData.ejournal + monthHumanitiesReadData.ejournal,
        online_magazine_pc: monthHumanitiesLoanData.online_magazine_pc + monthHumanitiesReadData.online_magazine_pc,
        online_magazine_mobile: monthHumanitiesLoanData.online_magazine_mobile + monthHumanitiesReadData.online_magazine_mobile,
        waveon: monthHumanitiesLoanData.waveon + monthHumanitiesReadData.waveon,
        flybook: monthHumanitiesLoanData.flybook + monthHumanitiesReadData.flybook
      }

      const humanitiesLoanMonthTotal = Object.values(monthHumanitiesLoanData).reduce((a, b) => a + b, 0)
      const humanitiesReadMonthTotal = Object.values(monthHumanitiesReadData).reduce((a, b) => a + b, 0)
      const humanitiesSumMonthTotal = humanitiesLoanMonthTotal + humanitiesReadMonthTotal

      const cumulativeHumanitiesLoan = { books: 0, newspaper: 0, magazine: 0, ebook: 0, audiobook: 0, ejournal: 0, online_magazine_pc: 0, online_magazine_mobile: 0, waveon: 0, flybook: 0 }
      const cumulativeHumanitiesRead = { books: 0, newspaper: 0, magazine: 0, ebook: 0, audiobook: 0, ejournal: 0, online_magazine_pc: 0, online_magazine_mobile: 0, waveon: 0, flybook: 0 }
      const cumulativeHumanitiesUse = { books: 0, newspaper: 0, magazine: 0, ebook: 0, audiobook: 0, ejournal: 0, online_magazine_pc: 0, online_magazine_mobile: 0, waveon: 0, flybook: 0 }

      if (cumulativeData.material_type && Array.isArray(cumulativeData.material_type)) {
        cumulativeData.material_type.filter((item: any) => item.room_type === 'humanities').forEach((item: any) => {
          if (item.usage_type === 'loan') {
            cumulativeHumanitiesLoan[item.material_type as keyof typeof cumulativeHumanitiesLoan] += item.book_count || 0
          } else if (item.usage_type === 'read') {
            cumulativeHumanitiesRead[item.material_type as keyof typeof cumulativeHumanitiesRead] += item.book_count || 0
          } else if (item.usage_type === 'use') {
            cumulativeHumanitiesUse[item.material_type as keyof typeof cumulativeHumanitiesUse] += item.book_count || 0
          }
        })
      }

      const cumulativeHumanitiesSum = {
        books: cumulativeHumanitiesLoan.books + cumulativeHumanitiesRead.books,
        newspaper: cumulativeHumanitiesLoan.newspaper + cumulativeHumanitiesRead.newspaper,
        magazine: cumulativeHumanitiesLoan.magazine + cumulativeHumanitiesRead.magazine,
        ebook: cumulativeHumanitiesLoan.ebook + cumulativeHumanitiesRead.ebook,
        audiobook: cumulativeHumanitiesLoan.audiobook + cumulativeHumanitiesRead.audiobook,
        ejournal: cumulativeHumanitiesLoan.ejournal + cumulativeHumanitiesRead.ejournal,
        online_magazine_pc: cumulativeHumanitiesLoan.online_magazine_pc + cumulativeHumanitiesRead.online_magazine_pc,
        online_magazine_mobile: cumulativeHumanitiesLoan.online_magazine_mobile + cumulativeHumanitiesRead.online_magazine_mobile,
        waveon: cumulativeHumanitiesLoan.waveon + cumulativeHumanitiesRead.waveon,
        flybook: cumulativeHumanitiesLoan.flybook + cumulativeHumanitiesRead.flybook
      }

      const cumulativeHumanitiesLoanTotal = Object.values(cumulativeHumanitiesLoan).reduce((a, b) => a + b, 0)
      const cumulativeHumanitiesReadTotal = Object.values(cumulativeHumanitiesRead).reduce((a, b) => a + b, 0)
      const cumulativeHumanitiesSumTotal = cumulativeHumanitiesLoanTotal + cumulativeHumanitiesReadTotal

      const humanitiesUseMonthTotal = Object.values(monthHumanitiesUseData).reduce((a, b) => a + b, 0)
      const cumulativeHumanitiesUseTotal = Object.values(cumulativeHumanitiesUse).reduce((a, b) => a + b, 0)

      const finalMaterialTypeHumanitiesData = [
        { room_type: 'humanities', type: 'loan', unit: '권', ...monthHumanitiesLoanData, month_total: humanitiesLoanMonthTotal, cumulative_total: cumulativeHumanitiesLoanTotal },
        { room_type: 'humanities', type: 'loan_cumulative', unit: '권', ...cumulativeHumanitiesLoan, month_total: cumulativeHumanitiesLoanTotal, cumulative_total: cumulativeHumanitiesLoanTotal },
        { room_type: 'humanities', type: 'read', unit: '권', ...monthHumanitiesReadData, month_total: humanitiesReadMonthTotal, cumulative_total: cumulativeHumanitiesReadTotal },
        { room_type: 'humanities', type: 'read_cumulative', unit: '권', ...cumulativeHumanitiesRead, month_total: cumulativeHumanitiesReadTotal, cumulative_total: cumulativeHumanitiesReadTotal },
        { room_type: 'humanities', type: 'sum', unit: '권', ...monthHumanitiesSumData, month_total: humanitiesSumMonthTotal, cumulative_total: cumulativeHumanitiesSumTotal },
        { room_type: 'humanities', type: 'sum_cumulative', unit: '권', ...cumulativeHumanitiesSum, month_total: cumulativeHumanitiesSumTotal, cumulative_total: cumulativeHumanitiesSumTotal },
        { room_type: 'humanities', type: 'sum', unit: '이용자', ...monthHumanitiesUseData, month_total: humanitiesUseMonthTotal, cumulative_total: cumulativeHumanitiesUseTotal },
        { room_type: 'humanities', type: 'sum_cumulative', unit: '이용자', ...cumulativeHumanitiesUse, month_total: cumulativeHumanitiesUseTotal, cumulative_total: cumulativeHumanitiesUseTotal }
      ]

      const monthProgramMap: any = {}
      if (programRes.data && Array.isArray(programRes.data)) {
        programRes.data.forEach((item: any) => {
          const nameMap: Record<string, string> = {
            '야간개관(일반)': 'night_floor23',
            '북적북적청소년체험': 'teen_experience',
            '자원봉사자교육': 'volunteer_education',
            '다봄프로그램': 'dabom_program',
            '대면낭독': 'face_reading',
            '힐링북콘서트': 'healing_concert',
            '자료실행사': 'room_event'
          }
          const englishKey = nameMap[item.program_name]
          if (englishKey) {
            monthProgramMap[englishKey] = {
              session_count: item.session_count || 0,
              participant_count: item.participant_count || 0
            }
          }
        })
      }

      const monthProgram = {
        type: 'month',
        night_floor23_count: monthProgramMap['night_floor23']?.session_count || 0,
        night_floor23_people: monthProgramMap['night_floor23']?.participant_count || 0,
        teen_experience_count: monthProgramMap['teen_experience']?.session_count || 0,
        teen_experience_people: monthProgramMap['teen_experience']?.participant_count || 0,
        volunteer_education_count: monthProgramMap['volunteer_education']?.session_count || 0,
        volunteer_education_people: monthProgramMap['volunteer_education']?.participant_count || 0,
        dabom_program_count: monthProgramMap['dabom_program']?.session_count || 0,
        dabom_program_people: monthProgramMap['dabom_program']?.participant_count || 0,
        face_reading_count: monthProgramMap['face_reading']?.session_count || 0,
        face_reading_people: monthProgramMap['face_reading']?.participant_count || 0,
        healing_concert_count: monthProgramMap['healing_concert']?.session_count || 0,
        healing_concert_people: monthProgramMap['healing_concert']?.participant_count || 0,
        room_event_count: monthProgramMap['room_event']?.session_count || 0,
        room_event_people: monthProgramMap['room_event']?.participant_count || 0,
        total_count: 0,
        total_people: 0
      }

      monthProgram.total_count = monthProgram.night_floor23_count + monthProgram.teen_experience_count + monthProgram.volunteer_education_count + monthProgram.dabom_program_count + monthProgram.face_reading_count + monthProgram.healing_concert_count + monthProgram.room_event_count
      monthProgram.total_people = monthProgram.night_floor23_people + monthProgram.teen_experience_people + monthProgram.volunteer_education_people + monthProgram.dabom_program_people + monthProgram.face_reading_people + monthProgram.healing_concert_people + monthProgram.room_event_people

      const cumulativeProgramMap: any = {}
      if (cumulativeData.program && Array.isArray(cumulativeData.program)) {
        const [year, month] = yearMonth!.split('-')
        const targetMonths = Array.from({length: parseInt(month)}, (_, i) => `${year}-${String(i+1).padStart(2, '0')}`)

        cumulativeData.program.forEach((item: any) => {
          if (!targetMonths.includes(item.year_month)) return
          const nameMap: Record<string, string> = {
            '야간개관(일반)': 'night_floor23',
            '북적북적청소년체험': 'teen_experience',
            '자원봉사자교육': 'volunteer_education',
            '다봄프로그램': 'dabom_program',
            '대면낭독': 'face_reading',
            '힐링북콘서트': 'healing_concert',
            '자료실행사': 'room_event'
          }
          const englishKey = nameMap[item.program_name]
          if (englishKey) {
            if (!cumulativeProgramMap[englishKey]) {
              cumulativeProgramMap[englishKey] = { session_count: 0, participant_count: 0 }
            }
            cumulativeProgramMap[englishKey].session_count += item.session_count || 0
            cumulativeProgramMap[englishKey].participant_count += item.participant_count || 0
          }
        })
      }

      const cumulativeProgram = {
        type: 'cumulative',
        night_floor23_count: cumulativeProgramMap['night_floor23']?.session_count || 0,
        night_floor23_people: cumulativeProgramMap['night_floor23']?.participant_count || 0,
        teen_experience_count: cumulativeProgramMap['teen_experience']?.session_count || 0,
        teen_experience_people: cumulativeProgramMap['teen_experience']?.participant_count || 0,
        volunteer_education_count: cumulativeProgramMap['volunteer_education']?.session_count || 0,
        volunteer_education_people: cumulativeProgramMap['volunteer_education']?.participant_count || 0,
        dabom_program_count: cumulativeProgramMap['dabom_program']?.session_count || 0,
        dabom_program_people: cumulativeProgramMap['dabom_program']?.participant_count || 0,
        face_reading_count: cumulativeProgramMap['face_reading']?.session_count || 0,
        face_reading_people: cumulativeProgramMap['face_reading']?.participant_count || 0,
        healing_concert_count: cumulativeProgramMap['healing_concert']?.session_count || 0,
        healing_concert_people: cumulativeProgramMap['healing_concert']?.participant_count || 0,
        room_event_count: cumulativeProgramMap['room_event']?.session_count || 0,
        room_event_people: cumulativeProgramMap['room_event']?.participant_count || 0,
        total_count: 0,
        total_people: 0
      }

      cumulativeProgram.total_count = cumulativeProgram.night_floor23_count + cumulativeProgram.teen_experience_count + cumulativeProgram.volunteer_education_count + cumulativeProgram.dabom_program_count + cumulativeProgram.face_reading_count + cumulativeProgram.healing_concert_count + cumulativeProgram.room_event_count
      cumulativeProgram.total_people = cumulativeProgram.night_floor23_people + cumulativeProgram.teen_experience_people + cumulativeProgram.volunteer_education_people + cumulativeProgram.dabom_program_people + cumulativeProgram.face_reading_people + cumulativeProgram.healing_concert_people + cumulativeProgram.room_event_people

      const finalProgramData = [
        monthProgram,
        cumulativeProgram
      ]

      const defaultAISmartData: Floor23AISmartRecord = {
        year_month: yearMonth!,
        literature_vending: 0, unmanned_card_issuer: 0, smart_loan_users: 0, smart_loan_books: 0,
        smart_return_users: 0, smart_return_books: 0, smart_reservation_users: 0, smart_reservation_books: 0,
        smart_total_users: 0, smart_total_books: 0, total_users: 0, total_items: 0
      }
      const monthAISmartData: Floor23AISmartRecord = aiSmartRes.data ? { ...defaultAISmartData, ...aiSmartRes.data } : defaultAISmartData

      monthAISmartData.smart_total_users = monthAISmartData.smart_loan_users + monthAISmartData.smart_return_users + monthAISmartData.smart_reservation_users
      monthAISmartData.smart_total_books = monthAISmartData.smart_loan_books + monthAISmartData.smart_return_books + monthAISmartData.smart_reservation_books

      monthAISmartData.total_users = monthAISmartData.literature_vending + monthAISmartData.unmanned_card_issuer + (monthAISmartData.smart_total_users || 0)
      monthAISmartData.total_items = monthAISmartData.smart_total_books

      monthAISmartData.type = 'month'

      const cumulativeAISmartData: any = {
        literature_vending: 0, unmanned_card_issuer: 0, smart_loan_users: 0, smart_loan_books: 0,
        smart_return_users: 0, smart_return_books: 0, smart_reservation_users: 0, smart_reservation_books: 0,
        smart_total_users: 0, smart_total_books: 0, total_users: 0, total_items: 0
      }

      if (cumulativeData.ai_smart && cumulativeData.ai_smart.length > 0) {
        const aiSmartFields = ['literature_vending', 'unmanned_card_issuer', 'smart_loan_users', 'smart_loan_books',
          'smart_return_users', 'smart_return_books', 'smart_reservation_users', 'smart_reservation_books']

        cumulativeData.ai_smart.forEach((item: any) => {
          aiSmartFields.forEach(field => {
            cumulativeAISmartData[field] += (item[field] || 0)
          })
        })
      }

      cumulativeAISmartData.smart_total_users = cumulativeAISmartData.smart_loan_users + cumulativeAISmartData.smart_return_users + cumulativeAISmartData.smart_reservation_users
      cumulativeAISmartData.smart_total_books = cumulativeAISmartData.smart_loan_books + cumulativeAISmartData.smart_return_books + cumulativeAISmartData.smart_reservation_books

      cumulativeAISmartData.total_users = cumulativeAISmartData.literature_vending + cumulativeAISmartData.unmanned_card_issuer + cumulativeAISmartData.smart_total_users
      cumulativeAISmartData.total_items = cumulativeAISmartData.smart_total_books

      cumulativeAISmartData.type = 'cumulative'

      const finalAISmartData = [monthAISmartData, cumulativeAISmartData]

      const monthAIEquipmentData: any = {
        type: 'month',
        bookbot: 0, book_kiosk: 0, laptop: 0, tablet: 0, book_scanner: 0, enews: 0, users: 0, total: 0
      }

      if (aiEquipmentFloor2Res.data) {
        const floor2Data = aiEquipmentFloor2Res.data
        monthAIEquipmentData.bookbot += floor2Data.bookbot || 0
        monthAIEquipmentData.book_kiosk += floor2Data.book_kiosk || 0
        monthAIEquipmentData.laptop += floor2Data.laptop || 0
        monthAIEquipmentData.tablet += floor2Data.tablet || 0
        monthAIEquipmentData.book_scanner += floor2Data.book_scanner || 0
        monthAIEquipmentData.enews += floor2Data.enews || 0
        monthAIEquipmentData.users += floor2Data.users || 0
      }
      if (aiEquipmentFloor3Res.data) {
        const floor3Data = aiEquipmentFloor3Res.data
        monthAIEquipmentData.bookbot += floor3Data.bookbot || 0
        monthAIEquipmentData.book_kiosk += floor3Data.book_kiosk || 0
        monthAIEquipmentData.laptop += floor3Data.laptop || 0
        monthAIEquipmentData.tablet += floor3Data.tablet || 0
        monthAIEquipmentData.book_scanner += floor3Data.book_scanner || 0
        monthAIEquipmentData.enews += floor3Data.enews || 0
        monthAIEquipmentData.users += floor3Data.users || 0
      }

      monthAIEquipmentData.total = monthAIEquipmentData.bookbot + monthAIEquipmentData.book_kiosk +
        monthAIEquipmentData.laptop + monthAIEquipmentData.tablet +
        monthAIEquipmentData.book_scanner + monthAIEquipmentData.enews + monthAIEquipmentData.users

      const cumulativeAIEquipmentData: any = {
        type: 'cumulative',
        bookbot: 0, book_kiosk: 0, laptop: 0, tablet: 0, book_scanner: 0, enews: 0, users: 0, total: 0
      }

      if (cumulativeData.ai_equipment && cumulativeData.ai_equipment.length > 0) {
        cumulativeData.ai_equipment.forEach((item: any) => {
          cumulativeAIEquipmentData.bookbot += item.bookbot || 0
          cumulativeAIEquipmentData.book_kiosk += item.book_kiosk || 0
          cumulativeAIEquipmentData.laptop += item.laptop || 0
          cumulativeAIEquipmentData.tablet += item.tablet || 0
          cumulativeAIEquipmentData.book_scanner += item.book_scanner || 0
          cumulativeAIEquipmentData.enews += item.enews || 0
          cumulativeAIEquipmentData.users += item.users || 0
        })

        cumulativeAIEquipmentData.total = cumulativeAIEquipmentData.bookbot + cumulativeAIEquipmentData.book_kiosk +
          cumulativeAIEquipmentData.laptop + cumulativeAIEquipmentData.tablet +
          cumulativeAIEquipmentData.book_scanner + cumulativeAIEquipmentData.enews + cumulativeAIEquipmentData.users
      }

      const finalAIEquipmentData = [monthAIEquipmentData, cumulativeAIEquipmentData]

      setMaterialSubjectData(finalMaterialSubjectData.map((item, idx) => ({ ...item, key: idx })))
      setMaterialTypeGeneralData(finalMaterialTypeGeneralData.map((item, idx) => ({ ...item, key: idx })))
      setMaterialTypeHumanitiesData(finalMaterialTypeHumanitiesData.map((item, idx) => ({ ...item, key: idx })))
      setProgramData(finalProgramData.map((item, idx) => ({ ...item, key: idx })))
      setAISmartLibraryData(finalAISmartData.map((item, idx) => ({ ...item, key: idx })))
      setAIEquipmentData(finalAIEquipmentData.map((item, idx) => ({ ...item, key: idx })))

      const allTimestamps = [
        ...(visitorRes.data || []).map((item: any) => item.updated_at || item.created_at),
        ...(materialTypeRes.data || []).map((item: any) => item.updated_at || item.created_at),
        ...(materialSubjectRes.data || []).map((item: any) => item.updated_at || item.created_at),
        ...(programRes.data || []).map((item: any) => item.updated_at || item.created_at),
        aiSmartRes.data?.updated_at || aiSmartRes.data?.created_at,
        aiEquipmentFloor2Res.data?.updated_at || aiEquipmentFloor2Res.data?.created_at,
        aiEquipmentFloor3Res.data?.updated_at || aiEquipmentFloor3Res.data?.created_at
      ].filter(Boolean)

      if (allTimestamps.length > 0) {
        const latestTimestamp = allTimestamps.sort().reverse()[0]
        setLastUpdateDate(dayjs(latestTimestamp).format('YYYY-MM-DD'))
      }

    } catch (error: unknown) {
      console.error('Load error:', error)
      const axiosError = error as { response?: { data?: { detail?: string } } }
      message.error(axiosError.response?.data?.detail || '데이터 로드 실패')
    } finally {
      setLoading(false)
    }
  }


  const handleDownloadExcel = async () => {
    setDownloading(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
      const floor23ReadingMultiplier = getReadingMultiplier('floor23')
      const updateDateFormat = getUpdateDateFormat()
      const libraryYearStartDate = getLibraryYearStartDate(yearMonth || '')
      const holidays = getHolidays()
      const response = await axios.post(
        `${apiUrl}/api/excel/download/${yearMonth}`,
        {
          sheet_type: 'floor23',
          floor23_reading_multiplier: floor23ReadingMultiplier,
          update_date_format: updateDateFormat,
          library_year_start_date: libraryYearStartDate,
          holidays: holidays
        },
        { responseType: 'blob' }
      )

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${DOWNLOAD_FILENAME}_${yearMonth}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      message.success('엑셀 파일 다운로드 완료')
    } catch (error: unknown) {
      console.error('Excel download error:', error)
      const axiosError = error as { response?: { data?: { detail?: string } } }
      message.error(axiosError.response?.data?.detail || '엑셀 다운로드 실패')
    } finally {
      setDownloading(false)
    }
  }

  const handleMonthChange = (date: Dayjs | null) => {
    if (date) {
      const newYearMonth = date.format('YYYY-MM')
      setSelectedMonth(date)
      navigate(`/statistics/floor23/${newYearMonth}`)
    }
  }

  const headerStyle = () => ({ style: { backgroundColor: '#E2EFDA', textAlign: 'center' as const } })

  const baseVisitorColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'type',
      key: 'type',
      width: 39,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA', textAlign: 'center' as const }, colSpan: 2, rowSpan: 3 }),
      render: (_, record, index) => {
        if (index === 0) return '월계'
        if (index === 4) return '누계'
        return null
      },
      onCell: (record, index) => {
        if (index === 0) return { rowSpan: 4 }
        if (index === 4) return { rowSpan: 4 }
        return { rowSpan: 0 }
      }
    },
    {
      title: '',
      dataIndex: 'age_group',
      key: 'age_group',
      width: 39,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA', textAlign: 'center' as const }, colSpan: 0, rowSpan: 0 }),
      render: (text: string) => {
        const labels: Record<string, string> = {
          'infant_elementary': '유아/초등',
          'middle_high': '중고생',
          'adult': '일반',
          'sum': '계'
        }
        return labels[text] || text
      }
    },
    {
      title: '자료\n이용',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '대출', dataIndex: 'loan', key: 'loan', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '열람', dataIndex: 'reading', key: 'reading', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '상호\n대차',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '책바다', dataIndex: 'bookbada', key: 'bookbada', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '책나래', dataIndex: 'booknare', key: 'booknare', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    { title: '만화\n책마루', dataIndex: 'comic', key: 'comic', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '영어\n책마루', dataIndex: 'english', key: 'english', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '다봄\n자료실', dataIndex: 'dabom', key: 'dabom', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '인문예술\n자료실', dataIndex: 'humanities', key: 'humanities', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '멀티\n미디어존', dataIndex: 'multimedia', key: 'multimedia', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '간행물\n존', dataIndex: 'periodical', key: 'periodical', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    {
      title: '영화\n음악존',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '영화', dataIndex: 'movie', key: 'movie', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '음악', dataIndex: 'music', key: 'music', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    { title: '디지털\n갤러리', dataIndex: 'gallery', key: 'gallery', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '합계', dataIndex: 'total', key: 'total', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '누계', dataIndex: 'cumulative', key: 'cumulative', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
  ]

  const baseMaterialSubjectColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'room_type',
      key: 'room_type',
      width: 39,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA', textAlign: 'center' as const }, colSpan: 2, rowSpan: 2 }),
      render: (_, record, index) => {
        if (index === 0) return <span style={{ whiteSpace: 'pre-line' }}>{'종합,\n인문예술\n자료실'}</span>
        return null
      },
      onCell: (record, index) => {
        if (index === 0) return { rowSpan: 6 }
        return { rowSpan: 0 }
      }
    },
    {
      title: '',
      dataIndex: 'type',
      key: 'type',
      width: 39,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA', textAlign: 'center' as const }, colSpan: 0, rowSpan: 0 }),
      render: (text: string) => {
        const labels: Record<string, string> = {
          'loan': '대출',
          'loan_cumulative': '대출누계',
          'read': '열람',
          'read_cumulative': '열람누계',
          'sum': '계',
          'sum_cumulative': '누계'
        }
        return labels[text] || text
      }
    },
    { title: '총류\n(000)', dataIndex: 'type_000', key: 'type_000', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '철학\n(100)', dataIndex: 'type_100', key: 'type_100', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '종교\n(200)', dataIndex: 'type_200', key: 'type_200', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '사회\n(300)', dataIndex: 'type_300', key: 'type_300', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '자연\n(400)', dataIndex: 'type_400', key: 'type_400', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '기술\n(500)', dataIndex: 'type_500', key: 'type_500', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '예술\n(600)', dataIndex: 'type_600', key: 'type_600', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '언어\n(700)', dataIndex: 'type_700', key: 'type_700', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '문학\n(800)', dataIndex: 'type_800', key: 'type_800', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '역사\n(900)', dataIndex: 'type_900', key: 'type_900', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '기타', dataIndex: 'etc', key: 'etc', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '월계', dataIndex: 'month_total', key: 'month_total', width: 32, align: 'center', onHeaderCell: headerStyle, render: (v, record) => record.type?.includes('cumulative') ? '-' : Math.round(v || 0).toLocaleString() },
    { title: '누계', dataIndex: 'cumulative_total', key: 'cumulative_total', width: 32, align: 'center', onHeaderCell: headerStyle, render: (v, record) => !record.type?.includes('cumulative') ? '-' : Math.round(v || 0).toLocaleString() }
  ]

  const baseMaterialTypeGeneralColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'room_type',
      key: 'room_type',
      width: 39,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA', textAlign: 'center' as const }, colSpan: 3, rowSpan: 2 }),
      render: (_, record, index) => {
        if (index === 0) return <span style={{ whiteSpace: 'pre-line' }}>{'종합\n자료실'}</span>
        return null
      },
      onCell: (record, index) => {
        if (index === 0) return { rowSpan: 6 }
        return { rowSpan: 0 }
      }
    },
    {
      title: '',
      dataIndex: 'type',
      key: 'type',
      width: 32,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA', textAlign: 'center' as const }, colSpan: 0, rowSpan: 0 }),
      render: (text: string) => {
        const labels: Record<string, string> = {
          'loan': '대출',
          'loan_cumulative': '대출누계',
          'read': '열람',
          'read_cumulative': '열람누계',
          'sum': '계',
          'sum_cumulative': '누계'
        }
        return labels[text] || text
      }
    },
    {
      title: '',
      dataIndex: 'unit',
      key: 'unit',
      width: 28,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA', textAlign: 'center' as const }, colSpan: 0, rowSpan: 0 }),
      render: (text: string) => text || '권'
    },
    { title: '일반\n도서', dataIndex: 'general_books', key: 'general_books', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '만화\n책마루', dataIndex: 'comic', key: 'comic', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '영어', dataIndex: 'english', key: 'english', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '다문화', dataIndex: 'multicultural', key: 'multicultural', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '큰글자', dataIndex: 'large_print', key: 'large_print', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '치매\n극복', dataIndex: 'dementia', key: 'dementia', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '읽기\n쉬운책', dataIndex: 'easy_read', key: 'easy_read', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '점자', dataIndex: 'braille', key: 'braille', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '월계', dataIndex: 'month_total', key: 'month_total', width: 32, align: 'center', onHeaderCell: headerStyle, render: (v, record) => record.type?.includes('cumulative') ? '-' : Math.round(v || 0).toLocaleString() },
    { title: '누계', dataIndex: 'cumulative_total', key: 'cumulative_total', width: 32, align: 'center', onHeaderCell: headerStyle, render: (v, record) => !record.type?.includes('cumulative') ? '-' : Math.round(v || 0).toLocaleString() }
  ]

  const baseMaterialTypeHumanitiesColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'room_type',
      key: 'room_type',
      width: 39,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA', textAlign: 'center' as const }, colSpan: 3, rowSpan: 2 }),
      render: (_, record, index) => {
        if (index === 0) return <span style={{ whiteSpace: 'pre-line' }}>{'인문예술\n자료실'}</span>
        return null
      },
      onCell: (record, index) => {
        if (index === 0) return { rowSpan: 8 }
        return { rowSpan: 0 }
      }
    },
    {
      title: '',
      dataIndex: 'type',
      key: 'type',
      width: 32,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA', textAlign: 'center' as const }, colSpan: 0, rowSpan: 0 }),
      render: (text, record, index) => {
        const labels: Record<string, string> = {
          'loan': '대출',
          'loan_cumulative': '대출누계',
          'read': '열람',
          'read_cumulative': '열람누계',
          'sum': '계',
          'sum_cumulative': '누계'
        }
        return labels[text] || text
      }
    },
    {
      title: '',
      dataIndex: 'unit',
      key: 'unit',
      width: 32,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA', textAlign: 'center' as const }, colSpan: 0, rowSpan: 0 }),
      render: (text: string) => text || '권'
    },
    {
      title: '도서',
      dataIndex: 'books',
      key: 'books',
      width: 32,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v, record) => {
        if (record.unit === '이용자') return '-'
        if (record.type === 'loan' || record.type === 'read' || record.type === 'sum' || record.type === 'cumulative') {
          return Math.round(v || 0).toLocaleString()
        }
        return '-'
      }
    },
    {
      title: '신문',
      dataIndex: 'newspaper',
      key: 'newspaper',
      width: 32,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v, record) => {
        if (record.type === 'loan') return '-'
        return Math.round(v || 0).toLocaleString()
      }
    },
    {
      title: '잡지',
      dataIndex: 'magazine',
      key: 'magazine',
      width: 32,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v, record) => {
        if (record.type === 'loan') return '-'
        return Math.round(v || 0).toLocaleString()
      }
    },
    {
      title: '전자책',
      dataIndex: 'ebook',
      key: 'ebook',
      width: 32,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v, record) => {
        if (record.type === 'read') return '-'
        return Math.round(v || 0).toLocaleString()
      }
    },
    {
      title: '오디오북',
      dataIndex: 'audiobook',
      key: 'audiobook',
      width: 28,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v, record) => {
        if (record.type === 'loan') return '-'
        return Math.round(v || 0).toLocaleString()
      }
    },
    {
      title: '전자\n저널',
      dataIndex: 'ejournal',
      key: 'ejournal',
      width: 32,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v, record) => {
        return Math.round(v || 0).toLocaleString()
      }
    },
    {
      title: '온라인\n전자잡지',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        {
          title: 'PC',
          dataIndex: 'online_magazine_pc',
          key: 'online_magazine_pc',
          width: 32,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v, record) => {
            if (record.type === 'loan') return '-'
            return Math.round(v || 0).toLocaleString()
          }
        },
        {
          title: '모바일',
          dataIndex: 'online_magazine_mobile',
          key: 'online_magazine_mobile',
          width: 32,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v, record) => {
            if (record.type === 'loan') return '-'
            return Math.round(v || 0).toLocaleString()
          }
        }
      ]
    },
    {
      title: '웨이브온',
      dataIndex: 'waveon',
      key: 'waveon',
      width: 28,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v, record) => {
        if (record.type === 'read') return '-'
        return Math.round(v || 0).toLocaleString()
      }
    },
    {
      title: '플라이북',
      dataIndex: 'flybook',
      key: 'flybook',
      width: 28,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v, record) => {
        if (record.type === 'loan') return '-'
        return Math.round(v || 0).toLocaleString()
      }
    },
    { title: '월계', dataIndex: 'month_total', key: 'month_total', width: 32, align: 'center', onHeaderCell: headerStyle, render: (v, record) => record.type?.includes('cumulative') ? '-' : Math.round(v || 0).toLocaleString() },
    { title: '누계', dataIndex: 'cumulative_total', key: 'cumulative_total', width: 32, align: 'center', onHeaderCell: headerStyle, render: (v, record) => !record.type?.includes('cumulative') ? '-' : Math.round(v || 0).toLocaleString() }
  ]

  const baseProgramColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'type',
      key: 'type',
      width: 39,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (text: string) => text === 'month' ? '월계' : '누계'
    },
    {
      title: headerAliases.floor23_program?.night_floor23 || '야간개관\n(일반)',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'night_floor23_count', key: 'night_floor23_count', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'night_floor23_people', key: 'night_floor23_people', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: headerAliases.floor23_program?.teen_experience || '북적북적\n청소년\n체험',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'teen_experience_count', key: 'teen_experience_count', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'teen_experience_people', key: 'teen_experience_people', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: headerAliases.floor23_program?.volunteer_education || '자원봉사자\n교육',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'volunteer_education_count', key: 'volunteer_education_count', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'volunteer_education_people', key: 'volunteer_education_people', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: headerAliases.floor23_program?.dabom_program || '다봄\n프로그램',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'dabom_program_count', key: 'dabom_program_count', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'dabom_program_people', key: 'dabom_program_people', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: headerAliases.floor23_program?.face_reading || '대면\n낭독',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'face_reading_count', key: 'face_reading_count', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'face_reading_people', key: 'face_reading_people', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: headerAliases.floor23_program?.healing_concert || '힐링북\n콘서트',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'healing_concert_count', key: 'healing_concert_count', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'healing_concert_people', key: 'healing_concert_people', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: headerAliases.floor23_program?.room_event || '자료실\n행사',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'room_event_count', key: 'room_event_count', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'room_event_people', key: 'room_event_people', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '합계',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'total_count', key: 'total_count', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'total_people', key: 'total_people', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    }
  ]

  const baseAISmartLibraryColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'type',
      key: 'type',
      width: 39,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (text: string) => text === 'month' ? '월계' : '누계'
    },
    { title: '문학\n자판기\n이용', dataIndex: 'literature_vending', key: 'literature_vending', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '무인\n회원증\n발급기', dataIndex: 'unmanned_card_issuer', key: 'unmanned_card_issuer', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    {
      title: '스마트도서관',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        {
          title: '대출',
          align: 'center',
          onHeaderCell: headerStyle,
          children: [
            { title: '이용자수', dataIndex: 'smart_loan_users', key: 'smart_loan_users', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
            { title: '이용권수', dataIndex: 'smart_loan_books', key: 'smart_loan_books', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
          ]
        },
        {
          title: '반납',
          align: 'center',
          onHeaderCell: headerStyle,
          children: [
            { title: '이용자수', dataIndex: 'smart_return_users', key: 'smart_return_users', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
            { title: '이용권수', dataIndex: 'smart_return_books', key: 'smart_return_books', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
          ]
        },
        {
          title: '예약대출',
          align: 'center',
          onHeaderCell: headerStyle,
          children: [
            { title: '이용자수', dataIndex: 'smart_reservation_users', key: 'smart_reservation_users', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
            { title: '이용권수', dataIndex: 'smart_reservation_books', key: 'smart_reservation_books', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
          ]
        },
        {
          title: '계',
          align: 'center',
          onHeaderCell: headerStyle,
          children: [
            { title: '이용자수', dataIndex: 'smart_total_users', key: 'smart_total_users', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
            { title: '이용권수', dataIndex: 'smart_total_books', key: 'smart_total_books', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
          ]
        }
      ]
    },
    {
      title: '합계',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '이용자\n수', dataIndex: 'total_users', key: 'total_users', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '이용\n권수', dataIndex: 'total_items', key: 'total_items', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    }
  ]

  const baseAIEquipmentColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'type',
      key: 'type',
      width: 39,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (text: string) => text === 'month' ? '월계' : '누계'
    },
    { title: '책봇\n(로버)', dataIndex: 'bookbot', key: 'bookbot', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '도서추천\n키오스크', dataIndex: 'book_kiosk', key: 'book_kiosk', width: 39, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '노트북', dataIndex: 'laptop', key: 'laptop', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '태블릿', dataIndex: 'tablet', key: 'tablet', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '북스캐너', dataIndex: 'book_scanner', key: 'book_scanner', width: 39, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '전자신문', dataIndex: 'enews', key: 'enews', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '이용자\n수', dataIndex: 'users', key: 'users', width: 28, align: 'center', onHeaderCell: headerStyle, render: () => '-' },
    { title: '합계', dataIndex: 'total', key: 'total', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
  ]

  const visitorColumns = baseVisitorColumns
  const materialSubjectColumns = baseMaterialSubjectColumns
  const materialTypeGeneralColumns = baseMaterialTypeGeneralColumns
  const materialTypeHumanitiesColumns = baseMaterialTypeHumanitiesColumns
  const programColumns = baseProgramColumns
  const aiSmartLibraryColumns = baseAISmartLibraryColumns
  const aiEquipmentColumns = baseAIEquipmentColumns

  const openDays = yearMonth ? calculateOpenDays(yearMonth) : 0
  const dateRangeStr = yearMonth ? getDateRangeString(yearMonth) : ''
  const operationPeriod = yearMonth ? getOperationPeriod(yearMonth) : ''

  return (
    <>
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, alignItems: 'center' }}>
          <DatePicker
            picker="month"
            value={selectedMonth}
            onChange={handleMonthChange}
            format="YYYY-MM"
          />
        </div>

      {isAccessCodeSession() && <SessionTimer />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <FloorNavigation yearMonth={yearMonth || ''} />
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleDownloadExcel}
            loading={downloading}
          >
            엑셀 다운로드
          </Button>
          {isAccessCodeSession() && (
            <>
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => navigate(`/floor23/input/${yearMonth}`)}
              >
                입력하기
              </Button>
              <Button
                icon={<DashboardOutlined />}
                onClick={() => navigate('/floor23/dashboard')}
              >
                대시보드
              </Button>
              <Button
                icon={<SettingOutlined />}
                onClick={() => navigate('/settings')}
              >
                설정으로 돌아가기
              </Button>
            </>
          )}
        </div>
      </div>

      <Card id="printable-content" style={{ marginBottom: 24, border: '2px solid #000' }}>
        <h1 style={{ textAlign: 'center', margin: '0 0 16px 0' }}>종합,인문예술자료실 이용 현황</h1>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ textAlign: 'left', fontSize: '14px' }}>
            {dateRangeStr} 개관 {openDays} 일째
          </div>
          <div style={{ textAlign: 'left', fontSize: '14px' }}>
            <div>운영기간: {operationPeriod}</div>
            {lastUpdateDate && <div>업데이트: {lastUpdateDate}</div>}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 이용자 현황</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
          </div>
          <Table
            className="black-bordered-table"
            dataSource={visitorData}
            columns={visitorColumns}
            pagination={false}
            loading={loading}
            bordered
            size="small"
            tableLayout="fixed"
            components={{
              body: {
                cell: EditableCell,
              },
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 자료 이용 현황(주제별)</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 권)</span>
          </div>
          <Table
            className="black-bordered-table"
            dataSource={materialSubjectData}
            columns={materialSubjectColumns}
            pagination={false}
            loading={loading}
            bordered
            size="small"
            tableLayout="fixed"
            components={{
              body: {
                cell: EditableCell,
              },
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 자료 이용 현황(자료별) - 종합자료실</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 권)</span>
          </div>
          <Table
            className="black-bordered-table"
            dataSource={materialTypeGeneralData}
            columns={materialTypeGeneralColumns}
            pagination={false}
            loading={loading}
            bordered
            size="small"
            tableLayout="fixed"
            components={{
              body: {
                cell: EditableCell,
              },
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 자료 이용 현황(자료별) - 인문예술자료실</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 권)</span>
          </div>
          <Table
            className="black-bordered-table"
            dataSource={materialTypeHumanitiesData}
            columns={materialTypeHumanitiesColumns}
            pagination={false}
            loading={loading}
            bordered
            size="small"
            tableLayout="fixed"
            components={{
              body: {
                cell: EditableCell,
              },
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 행사 및 프로그램</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
          </div>
          <Table
            key={`program-${JSON.stringify(headerAliases.floor23_program || {})}`}
            className="black-bordered-table"
            dataSource={programData}
            columns={programColumns}
            pagination={false}
            loading={loading}
            bordered
            size="small"
            tableLayout="fixed"
            components={{
              body: {
                cell: EditableCell,
              },
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 인공지능 미래형 도서관</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
          </div>
          <Table
            className="black-bordered-table"
            dataSource={aiSmartLibraryData}
            columns={aiSmartLibraryColumns}
            pagination={false}
            loading={loading}
            bordered
            size="small"
            tableLayout="fixed"
            style={{ marginBottom: 16 }}
            components={{
              body: {
                cell: EditableCell,
              },
            }}
          />
          <Table
            className="black-bordered-table"
            dataSource={aiEquipmentData}
            columns={aiEquipmentColumns}
            pagination={false}
            loading={loading}
            bordered
            size="small"
            tableLayout="fixed"
            components={{
              body: {
                cell: EditableCell,
              },
            }}
          />
        </div>
      </Card>

      </div>
    </>
  )
}
