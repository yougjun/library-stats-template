import { useState, useEffect } from 'react'
import { Card, Table, Button, message, DatePicker } from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import { SettingOutlined, EditOutlined, DownloadOutlined, DashboardOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import axios from 'axios'
import { useFloor1Visitor, useFloor1Material, useFloor1Program, useFloor1AILibrary } from '../hooks/useFloor1Queries'
import { useFloor1Cumulative } from '../hooks/useStatsQueries'
import type { ColumnsType } from 'antd/es/table'
import FloorNavigation from '../components/FloorNavigation'
import SessionTimer from '../components/SessionTimer'
import { useAuthStore } from '../store/authStore'
import type { Floor1AILibraryRecord, Floor1VisitorRecord, Floor1MaterialRecord, Floor1ProgramRecord } from '../services/api'
import { settingsApi } from '../services/api'
import {
  calculateOpenDays,
  getDateRangeString,
  getOperationPeriod,
  isAccessCodeSession,
  getUpdateDateFormat,
  getLibraryYearStartDate,
  getHolidays,
  getReadingMultiplier
} from '../utils/libraryDays'
import { Resizable } from 'react-resizable'
import type { ResizeCallbackData } from 'react-resizable'
import 'react-resizable/css/styles.css'
import '../styles/table.css'
import { DOWNLOAD_FILENAME } from '../config/library'

type TextAlign = 'left' | 'right' | 'center' | 'justify' | 'start' | 'end'

interface ResizableTitleProps {
  onResize?: (e: React.SyntheticEvent, data: ResizeCallbackData) => void
  width?: number
  textAlign?: TextAlign
  [key: string]: unknown
}

interface VisitorAgeData {
  children_loan: number
  children_read: number
  infant_loan: number
  infant_read: number
  total: number
}

interface VisitorRowData extends VisitorAgeData {
  key: number
  type: string
  age_group: string
}

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

interface MaterialRowData {
  key: number
  room: string
  type: string
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
  month_total: number
  cumulative_total: number
}

interface ProgramDisplayData {
  key: number
  period: string
  storytelling_count: number
  storytelling_people: number
  library_tour_count: number
  library_tour_people: number
  children_bookclub_count: number
  children_bookclub_people: number
  night_floor1_count: number
  night_floor1_people: number
  book_package_count: number
  book_package_books: number
  book_package_people: number
  room_event_count: number
  room_event_people: number
  total_count: number
  total_people: number
}

interface AILibraryDisplayData {
  key: number
  period: string
  bookbot?: number
  air_projection?: number
  finger_story?: number
  ar_book?: number
  pass_infant_m?: number
  pass_infant_f?: number
  pass_elementary_m?: number
  pass_elementary_f?: number
  pass_middle_m?: number
  pass_middle_f?: number
  pass_adult_m?: number
  pass_adult_f?: number
  unmanned_users?: number
  unmanned_books?: number
  total_users?: number
  total_books?: number
}

interface ProgramMapData {
  session_count: number
  participant_count: number
  book_count: number
}

interface AIAccumulatorData {
  bookbot: number
  air_projection: number
  finger_story: number
  ar_book: number
  pass_infant_m: number
  pass_infant_f: number
  pass_elementary_m: number
  pass_elementary_f: number
  pass_middle_m: number
  pass_middle_f: number
  pass_adult_m: number
  pass_adult_f: number
  unmanned_users: number
  unmanned_books: number
  total_users: number
  total_books: number
  [key: string]: number
}

const renderNumber = (v: number | undefined) => Math.round(v || 0).toLocaleString()

const ResizableTitle = (props: ResizableTitleProps) => {
  const { onResize, width, textAlign, ...restProps } = props

  if (!width) {
    return <th {...restProps} style={{ textAlign }} />
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => e.stopPropagation()}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} style={{ textAlign }} />
    </Resizable>
  )
}

export default function Floor1Stats() {
  const { yearMonth } = useParams()
  const navigate = useNavigate()
  const { role, token } = useAuthStore()
  const [downloading, setDownloading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs(yearMonth))
  const [visitorData, setVisitorData] = useState<VisitorRowData[]>([])
  const [materialData, setMaterialData] = useState<MaterialRowData[]>([])
  const [programData, setProgramData] = useState<ProgramDisplayData[]>([])
  const [aiLibraryData, setAILibraryData] = useState<AILibraryDisplayData[]>([])
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [lastUpdateDate, setLastUpdateDate] = useState<string>('')
  const [headerAliases, setHeaderAliases] = useState<{program?: Record<string, string>, ai?: Record<string, string>}>({})

  const { data: visitorRes, isLoading: visitorLoading } = useFloor1Visitor(yearMonth!)
  const { data: materialRes, isLoading: materialLoading } = useFloor1Material(yearMonth!)
  const { data: programRes, isLoading: programLoading } = useFloor1Program(yearMonth!)
  const { data: aiLibraryRes, isLoading: aiLibraryLoading } = useFloor1AILibrary(yearMonth!)
  const { data: cumulativeData, isLoading: cumulativeLoading } = useFloor1Cumulative(yearMonth!)

  const loading = visitorLoading || materialLoading || programLoading || aiLibraryLoading || cumulativeLoading

  useEffect(() => {
    if (yearMonth) {
      sessionStorage.setItem('last_viewed_floor1_month', yearMonth)
      setVisitorData([])
      setMaterialData([])
      setProgramData([])
      setAILibraryData([])
      setLastUpdateDate('')
    }
  }, [yearMonth])

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
    if (visitorLoading || materialLoading || programLoading || aiLibraryLoading || cumulativeLoading) return

    try {
      const visitor = visitorRes || []
      const material = materialRes || []
      const program = programRes || []
      const aiLibrary: Floor1AILibraryRecord | null = aiLibraryRes || null
      const cumulative = cumulativeData || { visitor: [], material: [], program: [], ai_library: [] }


      const monthVisitorMap: Record<string, VisitorAgeData> = {
        'infant_elementary': { children_loan: 0, children_read: 0, infant_loan: 0, infant_read: 0, total: 0 },
        'middle_high': { children_loan: 0, children_read: 0, infant_loan: 0, infant_read: 0, total: 0 },
        'adult': { children_loan: 0, children_read: 0, infant_loan: 0, infant_read: 0, total: 0 }
      }

      visitor.forEach((item: Floor1VisitorRecord) => {
        const ag = item.age_group
        const room = item.room_type
        const usage = item.usage_type

        if (monthVisitorMap[ag]) {
          if (room === 'children' && usage === 'loan') {
            monthVisitorMap[ag].children_loan = item.user_count || 0
          } else if (room === 'children' && usage === 'read') {
            monthVisitorMap[ag].children_read = item.user_count || 0
          } else if (room === 'infant' && usage === 'loan') {
            monthVisitorMap[ag].infant_loan = item.user_count || 0
          } else if (room === 'infant' && usage === 'read') {
            monthVisitorMap[ag].infant_read = item.user_count || 0
          }
        }
      })

      Object.keys(monthVisitorMap).forEach(ag => {
        monthVisitorMap[ag].total =
          monthVisitorMap[ag].children_loan +
          monthVisitorMap[ag].children_read +
          monthVisitorMap[ag].infant_loan +
          monthVisitorMap[ag].infant_read
      })

      const cumulativeVisitorMap: Record<string, VisitorAgeData> = {
        'infant_elementary': { children_loan: 0, children_read: 0, infant_loan: 0, infant_read: 0, total: 0 },
        'middle_high': { children_loan: 0, children_read: 0, infant_loan: 0, infant_read: 0, total: 0 },
        'adult': { children_loan: 0, children_read: 0, infant_loan: 0, infant_read: 0, total: 0 }
      }

      const floor1Multiplier = getReadingMultiplier('floor1')

      cumulative.visitor.forEach((item: Floor1VisitorRecord) => {
        const ag = item.age_group
        const room = item.room_type
        const usage = item.usage_type

        if (cumulativeVisitorMap[ag]) {
          if (room === 'children' && usage === 'loan') {
            cumulativeVisitorMap[ag].children_loan += item.user_count || 0
          } else if (room === 'children' && usage === 'read') {
            cumulativeVisitorMap[ag].children_read += item.user_count || 0
          } else if (room === 'infant' && usage === 'loan') {
            cumulativeVisitorMap[ag].infant_loan += item.user_count || 0
          } else if (room === 'infant' && usage === 'read') {
            cumulativeVisitorMap[ag].infant_read += item.user_count || 0
          }
        }
      })

      Object.keys(cumulativeVisitorMap).forEach(ag => {
        cumulativeVisitorMap[ag].total =
          cumulativeVisitorMap[ag].children_loan +
          cumulativeVisitorMap[ag].children_read +
          cumulativeVisitorMap[ag].infant_loan +
          cumulativeVisitorMap[ag].infant_read
      })

      const monthSumVisitor = {
        children_loan: monthVisitorMap['infant_elementary'].children_loan + monthVisitorMap['middle_high'].children_loan + monthVisitorMap['adult'].children_loan,
        children_read: monthVisitorMap['infant_elementary'].children_read + monthVisitorMap['middle_high'].children_read + monthVisitorMap['adult'].children_read,
        infant_loan: monthVisitorMap['infant_elementary'].infant_loan + monthVisitorMap['middle_high'].infant_loan + monthVisitorMap['adult'].infant_loan,
        infant_read: monthVisitorMap['infant_elementary'].infant_read + monthVisitorMap['middle_high'].infant_read + monthVisitorMap['adult'].infant_read,
        total: monthVisitorMap['infant_elementary'].total + monthVisitorMap['middle_high'].total + monthVisitorMap['adult'].total
      }

      const cumulativeSumVisitor = {
        children_loan: cumulativeVisitorMap['infant_elementary'].children_loan + cumulativeVisitorMap['middle_high'].children_loan + cumulativeVisitorMap['adult'].children_loan,
        children_read: cumulativeVisitorMap['infant_elementary'].children_read + cumulativeVisitorMap['middle_high'].children_read + cumulativeVisitorMap['adult'].children_read,
        infant_loan: cumulativeVisitorMap['infant_elementary'].infant_loan + cumulativeVisitorMap['middle_high'].infant_loan + cumulativeVisitorMap['adult'].infant_loan,
        infant_read: cumulativeVisitorMap['infant_elementary'].infant_read + cumulativeVisitorMap['middle_high'].infant_read + cumulativeVisitorMap['adult'].infant_read,
        total: cumulativeVisitorMap['infant_elementary'].total + cumulativeVisitorMap['middle_high'].total + cumulativeVisitorMap['adult'].total
      }

      const builtVisitorData = [
        { type: 'month', age_group: 'infant_elementary', ...monthVisitorMap['infant_elementary'] },
        { type: 'month', age_group: 'middle_high', ...monthVisitorMap['middle_high'] },
        { type: 'month', age_group: 'adult', ...monthVisitorMap['adult'] },
        { type: 'month', age_group: 'sum', ...monthSumVisitor },
        { type: 'cumulative', age_group: 'infant_elementary', ...cumulativeVisitorMap['infant_elementary'] },
        { type: 'cumulative', age_group: 'middle_high', ...cumulativeVisitorMap['middle_high'] },
        { type: 'cumulative', age_group: 'adult', ...cumulativeVisitorMap['adult'] },
        { type: 'cumulative', age_group: 'sum', ...cumulativeSumVisitor }
      ]

      setVisitorData(builtVisitorData.map((item, idx) => ({ ...item, key: idx })))

      const monthLoanData: SubjectData = { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0 }
      const monthReadData: SubjectData = { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0 }

      material.forEach((item: Floor1MaterialRecord) => {
        const key = item.subject_code === 'etc' ? 'etc' : `type_${item.subject_code}`
        if (item.usage_type === 'loan') {
          monthLoanData[key] = item.book_count || 0
        } else if (item.usage_type === 'reading') {
          monthReadData[key] = item.book_count || 0
        }
      })

      const monthSumData: SubjectData = { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0 }
      Object.keys(monthLoanData).forEach(key => {
        monthSumData[key] = monthLoanData[key] + monthReadData[key]
      })

      const cumulativeLoanData: SubjectData = { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0 }
      const cumulativeReadData: SubjectData = { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0 }

      cumulative.material.forEach((item: Floor1MaterialRecord) => {
        const key = item.subject_code === 'etc' ? 'etc' : `type_${item.subject_code}`
        if (item.usage_type === 'loan') {
          cumulativeLoanData[key] += item.book_count || 0
        } else if (item.usage_type === 'reading') {
          cumulativeReadData[key] += item.book_count || 0
        }
      })

      const cumulativeSumData: SubjectData = { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0 }
      Object.keys(cumulativeLoanData).forEach(key => {
        cumulativeSumData[key] = cumulativeLoanData[key] + cumulativeReadData[key]
      })

      const loanMonthTotal = Object.values(monthLoanData).reduce((a, b) => a + b, 0)
      const readMonthTotal = Object.values(monthReadData).reduce((a, b) => a + b, 0)
      const sumMonthTotal = loanMonthTotal + readMonthTotal
      const cumulativeLoanTotal = Object.values(cumulativeLoanData).reduce((a, b) => a + b, 0)
      const cumulativeReadTotal = Object.values(cumulativeReadData).reduce((a, b) => a + b, 0)
      const cumulativeSumTotal = Object.values(cumulativeSumData).reduce((a, b) => a + b, 0)

      const builtMaterialData = [
        { room: 'children', type: 'loan', ...monthLoanData, month_total: loanMonthTotal, cumulative_total: cumulativeLoanTotal },
        { room: 'children', type: 'loan_cumulative', ...cumulativeLoanData, month_total: cumulativeLoanTotal, cumulative_total: cumulativeLoanTotal },
        { room: 'children', type: 'read', ...monthReadData, month_total: readMonthTotal, cumulative_total: cumulativeReadTotal },
        { room: 'children', type: 'read_cumulative', ...cumulativeReadData, month_total: cumulativeReadTotal, cumulative_total: cumulativeReadTotal },
        { room: 'children', type: 'sum', ...monthSumData, month_total: sumMonthTotal, cumulative_total: cumulativeSumTotal },
        { room: 'children', type: 'sum_cumulative', ...cumulativeSumData, month_total: cumulativeSumTotal, cumulative_total: cumulativeSumTotal }
      ]

      setMaterialData(builtMaterialData.map((item, idx) => ({ ...item, key: idx })))

      const monthProgramMap: Record<string, ProgramMapData> = {}
      program.forEach((item: Floor1ProgramRecord) => {
        monthProgramMap[item.program_name] = {
          session_count: item.session_count || 0,
          participant_count: item.participant_count || 0,
          book_count: item.book_count || 0
        }
      })

      const cumulativeProgramMap: Record<string, ProgramMapData> = {}
      cumulative.program.forEach((item: Floor1ProgramRecord) => {
        if (!cumulativeProgramMap[item.program_name]) {
          cumulativeProgramMap[item.program_name] = { session_count: 0, participant_count: 0, book_count: 0 }
        }
        cumulativeProgramMap[item.program_name].session_count += item.session_count || 0
        cumulativeProgramMap[item.program_name].participant_count += item.participant_count || 0
        cumulativeProgramMap[item.program_name].book_count += item.book_count || 0
      })

      const monthProgram = {
        period: 'month',
        storytelling_count: monthProgramMap['storytelling']?.session_count || 0,
        storytelling_people: monthProgramMap['storytelling']?.participant_count || 0,
        library_tour_count: monthProgramMap['library_tour']?.session_count || 0,
        library_tour_people: monthProgramMap['library_tour']?.participant_count || 0,
        children_bookclub_count: monthProgramMap['children_bookclub']?.session_count || 0,
        children_bookclub_people: monthProgramMap['children_bookclub']?.participant_count || 0,
        night_floor1_count: monthProgramMap['night_floor1']?.session_count || 0,
        night_floor1_people: monthProgramMap['night_floor1']?.participant_count || 0,
        book_package_count: monthProgramMap['book_package']?.session_count || 0,
        book_package_books: monthProgramMap['book_package']?.book_count || 0,
        book_package_people: monthProgramMap['book_package']?.participant_count || 0,
        room_event_count: monthProgramMap['room_event']?.session_count || 0,
        room_event_people: monthProgramMap['room_event']?.participant_count || 0,
        total_count: 0,
        total_people: 0
      }

      monthProgram.total_count = monthProgram.storytelling_count + monthProgram.library_tour_count +
        monthProgram.children_bookclub_count + monthProgram.night_floor1_count + monthProgram.book_package_count +
        monthProgram.room_event_count
      monthProgram.total_people = monthProgram.storytelling_people + monthProgram.library_tour_people +
        monthProgram.children_bookclub_people + monthProgram.night_floor1_people + monthProgram.book_package_people +
        monthProgram.room_event_people

      const cumulativeProgram = {
        period: 'cumulative',
        storytelling_count: cumulativeProgramMap['storytelling']?.session_count || 0,
        storytelling_people: cumulativeProgramMap['storytelling']?.participant_count || 0,
        library_tour_count: cumulativeProgramMap['library_tour']?.session_count || 0,
        library_tour_people: cumulativeProgramMap['library_tour']?.participant_count || 0,
        children_bookclub_count: cumulativeProgramMap['children_bookclub']?.session_count || 0,
        children_bookclub_people: cumulativeProgramMap['children_bookclub']?.participant_count || 0,
        night_floor1_count: cumulativeProgramMap['night_floor1']?.session_count || 0,
        night_floor1_people: cumulativeProgramMap['night_floor1']?.participant_count || 0,
        book_package_count: cumulativeProgramMap['book_package']?.session_count || 0,
        book_package_books: cumulativeProgramMap['book_package']?.book_count || 0,
        book_package_people: cumulativeProgramMap['book_package']?.participant_count || 0,
        room_event_count: cumulativeProgramMap['room_event']?.session_count || 0,
        room_event_people: cumulativeProgramMap['room_event']?.participant_count || 0,
        total_count: 0,
        total_people: 0
      }

      cumulativeProgram.total_count = cumulativeProgram.storytelling_count + cumulativeProgram.library_tour_count +
        cumulativeProgram.children_bookclub_count + cumulativeProgram.night_floor1_count + cumulativeProgram.book_package_count +
        cumulativeProgram.room_event_count
      cumulativeProgram.total_people = cumulativeProgram.storytelling_people + cumulativeProgram.library_tour_people +
        cumulativeProgram.children_bookclub_people + cumulativeProgram.night_floor1_people + cumulativeProgram.book_package_people +
        cumulativeProgram.room_event_people

      const builtProgramData = [monthProgram, cumulativeProgram]

      setProgramData(builtProgramData.map((item, idx) => ({ ...item, key: idx })))

      const defaultAIData: Floor1AILibraryRecord = {
        year_month: yearMonth!,
        bookbot: 0, air_projection: 0, finger_story: 0, ar_book: 0,
        pass_infant_m: 0, pass_infant_f: 0, pass_elementary_m: 0, pass_elementary_f: 0,
        pass_middle_m: 0, pass_middle_f: 0, pass_adult_m: 0, pass_adult_f: 0,
        unmanned_users: 0, unmanned_books: 0, total_users: 0, total_books: 0
      }
      const monthAIData: Floor1AILibraryRecord = aiLibrary ? { ...defaultAIData, ...aiLibrary } : defaultAIData

      monthAIData.total_users = (monthAIData.bookbot || 0) + (monthAIData.air_projection || 0) +
        (monthAIData.finger_story || 0) + (monthAIData.ar_book || 0) +
        (monthAIData.pass_infant_m || 0) + (monthAIData.pass_infant_f || 0) +
        (monthAIData.pass_elementary_m || 0) + (monthAIData.pass_elementary_f || 0) +
        (monthAIData.pass_middle_m || 0) + (monthAIData.pass_middle_f || 0) +
        (monthAIData.pass_adult_m || 0) + (monthAIData.pass_adult_f || 0) +
        (monthAIData.unmanned_users || 0)
      monthAIData.total_books = monthAIData.unmanned_books || 0

      const cumulativeAIData: AIAccumulatorData = {
        bookbot: 0, air_projection: 0, finger_story: 0, ar_book: 0,
        pass_infant_m: 0, pass_infant_f: 0, pass_elementary_m: 0, pass_elementary_f: 0,
        pass_middle_m: 0, pass_middle_f: 0, pass_adult_m: 0, pass_adult_f: 0,
        unmanned_users: 0, unmanned_books: 0, total_users: 0, total_books: 0
      }

      if (cumulative.ai_library && cumulative.ai_library.length > 0) {
        const aiFields = ['bookbot', 'air_projection', 'finger_story', 'ar_book',
          'pass_infant_m', 'pass_infant_f', 'pass_elementary_m', 'pass_elementary_f',
          'pass_middle_m', 'pass_middle_f', 'pass_adult_m', 'pass_adult_f',
          'unmanned_users', 'unmanned_books']

        cumulative.ai_library.forEach((item: Floor1AILibraryRecord) => {
          aiFields.forEach(field => {
            const value = item[field]
            cumulativeAIData[field] += (typeof value === 'number' ? value : 0)
          })
        })

        cumulativeAIData.total_users = cumulativeAIData.bookbot + cumulativeAIData.air_projection +
          cumulativeAIData.finger_story + cumulativeAIData.ar_book +
          cumulativeAIData.pass_infant_m + cumulativeAIData.pass_infant_f +
          cumulativeAIData.pass_elementary_m + cumulativeAIData.pass_elementary_f +
          cumulativeAIData.pass_middle_m + cumulativeAIData.pass_middle_f +
          cumulativeAIData.pass_adult_m + cumulativeAIData.pass_adult_f +
          cumulativeAIData.unmanned_users
        cumulativeAIData.total_books = cumulativeAIData.unmanned_books
      }

      const builtAIData = [
        { period: 'month', ...monthAIData },
        { period: 'cumulative', ...cumulativeAIData }
      ]

      setAILibraryData(builtAIData.map((item, idx) => ({ ...item, key: idx })))

      const allTimestamps = [
        ...visitor.map((item) => (item as Floor1VisitorRecord & { updated_at?: string; created_at?: string }).updated_at || (item as Floor1VisitorRecord & { created_at?: string }).created_at),
        ...material.map((item) => (item as Floor1MaterialRecord & { updated_at?: string; created_at?: string }).updated_at || (item as Floor1MaterialRecord & { created_at?: string }).created_at),
        ...program.map((item) => (item as Floor1ProgramRecord & { updated_at?: string; created_at?: string }).updated_at || (item as Floor1ProgramRecord & { created_at?: string }).created_at),
        aiLibrary?.updated_at || aiLibrary?.created_at
      ].filter(Boolean)

      if (allTimestamps.length > 0) {
        const latestTimestamp = allTimestamps.sort().reverse()[0]
        setLastUpdateDate(dayjs(latestTimestamp).format('YYYY-MM-DD'))
      }

    } catch (error: unknown) {
      console.error('Load error:', error)
      const axiosError = error as { response?: { data?: { detail?: string } } }
      message.error(axiosError.response?.data?.detail || '데이터 로드 실패')
    }
  }, [visitorRes, materialRes, programRes, aiLibraryRes, cumulativeData, visitorLoading, materialLoading, programLoading, aiLibraryLoading, cumulativeLoading])

  useEffect(() => {
    let lastFetchTime = Date.now()
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now()
        if (now - lastFetchTime > 30000) {
          lastFetchTime = now
          window.location.reload()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const handleResize = (key: string) => (_: React.SyntheticEvent, { size }: ResizeCallbackData) => {
    setColumnWidths(prev => ({ ...prev, [key]: size.width }))
  }

  const handleDownloadExcel = async () => {
    setDownloading(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
      const updateDateFormat = getUpdateDateFormat()
      const libraryYearStartDate = getLibraryYearStartDate(yearMonth || '')
      const holidays = getHolidays()
      const response = await axios.post(
        `${apiUrl}/api/excel/download/${yearMonth}`,
        {
          sheet_type: 'floor1',
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
      navigate(`/statistics/floor1/${newYearMonth}`)
    }
  }

  const headerStyle = () => ({ style: { backgroundColor: '#E2EFDA', textAlign: 'center' as const } })

  const baseVisitorColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'type',
      key: 'type',
      width: 32,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, rowSpan: 2, colSpan: 2 }),
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
      width: 36,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, rowSpan: 0, colSpan: 0 }),
      render: (text: string) => {
        const labels: Record<string, string> = {
          'infant_elementary': '유아/\n초등',
          'middle_high': '중고생',
          'adult': '일반',
          'sum': '계'
        }
        return labels[text] || text
      }
    },
    {
      title: '어린이자료실',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '관외대출', dataIndex: 'children_loan', key: 'children_loan', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '관내열람', dataIndex: 'children_read', key: 'children_read', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '유아자료실',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '관외대출', dataIndex: 'infant_loan', key: 'infant_loan', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '관내열람', dataIndex: 'infant_read', key: 'infant_read', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    { title: '합계', dataIndex: 'total', key: 'total', width: 36, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
  ]

  const baseMaterialColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'room',
      key: 'room',
      width: 39,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, rowSpan: 2, colSpan: 2 }),
      render: (_, record, index) => {
        if (index === 0) return <span style={{ whiteSpace: 'pre-line' }}>{'어린이\n자료실'}</span>
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
      width: 28,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, rowSpan: 0, colSpan: 0 }),
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
    { title: '총류\n(000)', dataIndex: 'type_000', key: 'type_000', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '철학\n(100)', dataIndex: 'type_100', key: 'type_100', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '종교\n(200)', dataIndex: 'type_200', key: 'type_200', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '사회\n(300)', dataIndex: 'type_300', key: 'type_300', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '자연\n(400)', dataIndex: 'type_400', key: 'type_400', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '기술\n(500)', dataIndex: 'type_500', key: 'type_500', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '예술\n(600)', dataIndex: 'type_600', key: 'type_600', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '언어\n(700)', dataIndex: 'type_700', key: 'type_700', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '문학\n(800)', dataIndex: 'type_800', key: 'type_800', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '역사\n(900)', dataIndex: 'type_900', key: 'type_900', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '기타', dataIndex: 'etc', key: 'etc', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '월계', dataIndex: 'month_total', key: 'month_total', width: 32, align: 'center', onHeaderCell: headerStyle, render: (v: number | undefined, record: MaterialRowData) => record.type?.includes('cumulative') ? '-' : Math.round(v || 0).toLocaleString() },
    { title: '누계', dataIndex: 'cumulative_total', key: 'cumulative_total', width: 32, align: 'center', onHeaderCell: headerStyle, render: (v: number | undefined, record: MaterialRowData) => !record.type?.includes('cumulative') ? '-' : Math.round(v || 0).toLocaleString() }
  ]

  const baseProgramColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'period',
      key: 'period',
      width: 32,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, rowSpan: 2, colSpan: 1 }),
      render: (text: string) => text === 'month' ? '월계' : '누계'
    },
    {
      title: headerAliases.program?.storytelling || '동화체험',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'storytelling_count', key: 'storytelling_count', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'storytelling_people', key: 'storytelling_people', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: headerAliases.program?.library_tour || '도서관\n나들이',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'library_tour_count', key: 'library_tour_count', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'library_tour_people', key: 'library_tour_people', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: headerAliases.program?.children_bookclub || '어린이\n북클럽',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'children_bookclub_count', key: 'children_bookclub_count', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'children_bookclub_people', key: 'children_bookclub_people', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: headerAliases.program?.night_floor1 || '야간개관\n(어린이)',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'night_floor1_count', key: 'night_floor1_count', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'night_floor1_people', key: 'night_floor1_people', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: headerAliases.program?.book_package || '책꾸러미',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        {
          title: '횟수\n(권수)',
          dataIndex: 'book_package_count',
          key: 'book_package_count',
          width: 30,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (_: number | undefined, record: { book_package_count?: number; book_package_books?: number }) => (
            <div style={{ whiteSpace: 'pre-line' }}>
              {Math.round(record.book_package_count || 0).toLocaleString().toLocaleString()}
              {'\n'}
              {Math.round(record.book_package_books || 0).toLocaleString().toLocaleString()}
            </div>
          )
        },
        { title: '인원', dataIndex: 'book_package_people', key: 'book_package_people', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: headerAliases.program?.room_event || '자료실행사',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'room_event_count', key: 'room_event_count', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'room_event_people', key: 'room_event_people', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
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

  const baseAILibraryColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'period',
      key: 'period',
      width: 32,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, rowSpan: 2, colSpan: 1 }),
      render: (text: string) => text === 'month' ? '월계' : '누계'
    },
    { title: headerAliases.ai?.bookbot || '책봇\n(로미)', dataIndex: 'bookbot', key: 'bookbot', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: headerAliases.ai?.air_projection || '에어\n프로젝션', dataIndex: 'air_projection', key: 'air_projection', width: 34, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: headerAliases.ai?.finger_story || '핑거\n스토리', dataIndex: 'finger_story', key: 'finger_story', width: 34, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: headerAliases.ai?.ar_book || 'AR북', dataIndex: 'ar_book', key: 'ar_book', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    {
      title: '1일출입증',
      onHeaderCell: headerStyle,
      children: [
        { title: '유아\n(남)', dataIndex: 'pass_infant_m', key: 'pass_infant_m', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '유아\n(여)', dataIndex: 'pass_infant_f', key: 'pass_infant_f', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '초등\n(남)', dataIndex: 'pass_elementary_m', key: 'pass_elementary_m', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '초등\n(여)', dataIndex: 'pass_elementary_f', key: 'pass_elementary_f', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '중고등\n(남)', dataIndex: 'pass_middle_m', key: 'pass_middle_m', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '중고등\n(여)', dataIndex: 'pass_middle_f', key: 'pass_middle_f', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '일반\n(남)', dataIndex: 'pass_adult_m', key: 'pass_adult_m', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '일반\n(여)', dataIndex: 'pass_adult_f', key: 'pass_adult_f', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '무인\n반납실',
      onHeaderCell: headerStyle,
      children: [
        { title: '이용자\n수', dataIndex: 'unmanned_users', key: 'unmanned_users', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '이용\n권수', dataIndex: 'unmanned_books', key: 'unmanned_books', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '합계',
      onHeaderCell: headerStyle,
      children: [
        { title: '이용자\n수', dataIndex: 'total_users', key: 'total_users', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '이용\n권수', dataIndex: 'total_books', key: 'total_books', width: 30, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    }
  ]

  const visitorColumns = baseVisitorColumns
  const materialColumns = baseMaterialColumns
  const programColumns = baseProgramColumns
  const aiLibraryColumns = baseAILibraryColumns

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
                onClick={() => navigate(`/floor1/input/${yearMonth}`)}
              >
                입력하기
              </Button>
              <Button
                icon={<DashboardOutlined />}
                onClick={() => navigate('/floor1/dashboard')}
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
        <h1 style={{ textAlign: 'center', margin: '0 0 16px 0' }}>어린이자료실 이용 현황</h1>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
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
              header: {
                cell: ResizableTitle,
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
            dataSource={materialData}
            columns={materialColumns}
            pagination={false}
            loading={loading}
            bordered
            size="small"
            tableLayout="fixed"
            components={{
              header: {
                cell: ResizableTitle,
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
            key={`program-${JSON.stringify(headerAliases.program || {})}`}
            className="black-bordered-table"
            dataSource={programData}
            columns={programColumns}
            pagination={false}
            loading={loading}
            bordered
            size="small"
            tableLayout="fixed"
            components={{
              header: {
                cell: ResizableTitle,
              },
            }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 인공지능 미래형 도서관</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
          </div>
          <Table
            key={`ai-${JSON.stringify(headerAliases.ai || {})}`}
            className="black-bordered-table"
            dataSource={aiLibraryData}
            columns={aiLibraryColumns}
            pagination={false}
            loading={loading}
            bordered
            size="small"
            tableLayout="fixed"
            components={{
              header: {
                cell: ResizableTitle,
              },
            }}
          />
        </div>
      </Card>

      </div>
    </>
  )
}
