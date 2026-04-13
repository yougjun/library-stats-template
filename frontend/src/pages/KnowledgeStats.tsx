import { useState, useEffect } from 'react'
import { Card, Table, Button, message, DatePicker } from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import { SettingOutlined, DownloadOutlined } from '@ant-design/icons'
import { statsApi } from '../services/api'
import dayjs, { Dayjs } from 'dayjs'
import axios from 'axios'
import type { ColumnsType } from 'antd/es/table'
import { getErrorMessage } from '../utils/errorHandler'
import FloorNavigation from '../components/FloorNavigation'
import { EditableCell } from '../components/EditableCell'
import SessionTimer from '../components/SessionTimer'
import {
  calculateOpenDays,
  calculateOpenDaysFromDate,
  getDateRangeString,
  getOperationPeriod,
  isAccessCodeSession,
  getGateStartDate,
  getShowReopenDate,
  getShowReopenDateUntil,
  getReadingMultiplier,
  getUpdateDateFormat,
  getLibraryYearStartDate,
  getHolidays,
  getCalculationCutoffDate
} from '../utils/libraryDays'
import { Resizable } from 'react-resizable'
import type { ResizeCallbackData } from 'react-resizable'
import 'react-resizable/css/styles.css'
import '../styles/table.css'
import { DOWNLOAD_FILENAME } from '../config/library'

type TextAlign = 'left' | 'right' | 'center' | 'justify' | 'start' | 'end'

interface Floor1AIRecord {
  pass_infant_m?: number
  pass_infant_f?: number
  pass_elementary_m?: number
  pass_elementary_f?: number
  pass_middle_m?: number
  pass_middle_f?: number
  pass_adult_m?: number
  pass_adult_f?: number
  bookbot?: number
  air_projection?: number
  finger_story?: number
  ar_book?: number
  unmanned_users?: number
}

interface Floor1RegularRecord {
  infant_m?: number
  infant_f?: number
  elementary_m?: number
  elementary_f?: number
  middle_m?: number
  middle_f?: number
  adult_m?: number
  adult_f?: number
}

interface Floor1VisitorRecord {
  usage_type?: string
  user_count?: number
}

interface Floor1ProgramRecord {
  participant_count?: number
}

interface Floor23VisitorRecord {
  category?: string
  user_count?: number
}

interface Floor23ProgramRecord {
  participant_count?: number
}

interface Floor23AISmartRecord {
  literature_vending?: number
  unmanned_card_issuer?: number
  smart_loan_users?: number
  smart_return_users?: number
  smart_reservation_users?: number
}

interface Floor23AIEquipmentRecord {
  bookbot?: number
  book_kiosk?: number
  laptop?: number
  tablet?: number
  book_scanner?: number
  enews?: number
}

interface MaterialRecord {
  subject_code?: string
  usage_type?: string
  book_count?: number
}

interface SubjectMap {
  [key: string]: number
}

interface MaterialRow {
  section: string
  type: string
  etc: number
  month_total?: number
  cumulative_total?: number
  [key: string]: string | number | undefined
}

interface VisitorDisplayRow {
  key: number
  col1: string
  col2: string
  col3: string
  month_total: number
  cumulative_total: number
}

interface KnowledgeData {
  floor1_ai?: Floor1AIRecord
  floor1_regular?: Floor1RegularRecord
  floor1_visitor?: Floor1VisitorRecord[]
  floor1_program?: Floor1ProgramRecord[]
  floor1_material?: MaterialRecord[]
  floor23_visitor?: Floor23VisitorRecord[]
  floor23_program?: Floor23ProgramRecord[]
  floor23_ai_smart?: Floor23AISmartRecord
  floor23_ai_equipment?: Floor23AIEquipmentRecord[]
  floor23_material?: MaterialRecord[]
  cumulative?: {
    floor1_ai?: Floor1AIRecord[]
    floor1_regular?: Floor1RegularRecord[]
    floor1_visitor?: Floor1VisitorRecord[]
    floor1_program?: Floor1ProgramRecord[]
    floor1_material?: MaterialRecord[]
    floor23_visitor?: Floor23VisitorRecord[]
    floor23_program?: Floor23ProgramRecord[]
    floor23_ai_smart?: Floor23AISmartRecord[]
    floor23_ai_equipment?: Floor23AIEquipmentRecord[]
    floor23_material?: MaterialRecord[]
    floor23_visitor_totals?: { loan_cumulative?: number; reading_cumulative?: number }
  }
}

interface ResizableTitleProps {
  onResize?: (e: React.SyntheticEvent, data: ResizeCallbackData) => void
  width?: number
  textAlign?: TextAlign
  [key: string]: unknown
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

export default function KnowledgeStats() {
  const { yearMonth } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs(yearMonth))
  const [gateData, setGateData] = useState<any[]>([])
  const [visitorData, setVisitorData] = useState<any[]>([])
  const [materialData, setMaterialData] = useState<any[]>([])
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [lastUpdateDate, setLastUpdateDate] = useState<string>('')

  useEffect(() => {
    if (yearMonth) {
      sessionStorage.setItem('last_viewed_knowledge_month', yearMonth)
      setGateData([])
      setVisitorData([])
      setMaterialData([])
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
      const res = await statsApi.getKnowledge(yearMonth!)
      const data = res.data

      const { gateRows, visitorRows } = processVisitorData(data)
      const materialRows = processMaterialData(data)

      setGateData(gateRows)
      setVisitorData(visitorRows)
      setMaterialData(materialRows)
    } catch (error: unknown) {
      console.error('Failed to load data:', error)
      message.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const processVisitorData = (data: KnowledgeData) => {
    const ai = data.floor1_ai
    const reg = data.floor1_regular

    const monthly_infant_m = (ai?.pass_infant_m || 0) + (reg?.infant_m || 0)
    const monthly_infant_f = (ai?.pass_infant_f || 0) + (reg?.infant_f || 0)
    const monthly_elementary_m = (ai?.pass_elementary_m || 0) + (reg?.elementary_m || 0)
    const monthly_elementary_f = (ai?.pass_elementary_f || 0) + (reg?.elementary_f || 0)
    const monthly_middle_m = (ai?.pass_middle_m || 0) + (reg?.middle_m || 0)
    const monthly_middle_f = (ai?.pass_middle_f || 0) + (reg?.middle_f || 0)
    const monthly_adult_m = (ai?.pass_adult_m || 0) + (reg?.adult_m || 0)
    const monthly_adult_f = (ai?.pass_adult_f || 0) + (reg?.adult_f || 0)

    const passCount = (ai?.pass_infant_m || 0) + (ai?.pass_infant_f || 0) +
      (ai?.pass_elementary_m || 0) + (ai?.pass_elementary_f || 0) +
      (ai?.pass_middle_m || 0) + (ai?.pass_middle_f || 0) +
      (ai?.pass_adult_m || 0) + (ai?.pass_adult_f || 0)

    const regularCount = (reg?.infant_m || 0) + (reg?.infant_f || 0) +
      (reg?.elementary_m || 0) + (reg?.elementary_f || 0) +
      (reg?.middle_m || 0) + (reg?.middle_f || 0) +
      (reg?.adult_m || 0) + (reg?.adult_f || 0)

    const gateCount = passCount + regularCount

    let cum_infant_m = 0, cum_infant_f = 0, cum_elementary_m = 0, cum_elementary_f = 0
    let cum_middle_m = 0, cum_middle_f = 0, cum_adult_m = 0, cum_adult_f = 0

    data.cumulative?.floor1_ai?.forEach((ai) => {
      cum_infant_m += (ai.pass_infant_m || 0)
      cum_infant_f += (ai.pass_infant_f || 0)
      cum_elementary_m += (ai.pass_elementary_m || 0)
      cum_elementary_f += (ai.pass_elementary_f || 0)
      cum_middle_m += (ai.pass_middle_m || 0)
      cum_middle_f += (ai.pass_middle_f || 0)
      cum_adult_m += (ai.pass_adult_m || 0)
      cum_adult_f += (ai.pass_adult_f || 0)
    })

    data.cumulative?.floor1_regular?.forEach((reg) => {
      cum_infant_m += (reg.infant_m || 0)
      cum_infant_f += (reg.infant_f || 0)
      cum_elementary_m += (reg.elementary_m || 0)
      cum_elementary_f += (reg.elementary_f || 0)
      cum_middle_m += (reg.middle_m || 0)
      cum_middle_f += (reg.middle_f || 0)
      cum_adult_m += (reg.adult_m || 0)
      cum_adult_f += (reg.adult_f || 0)
    })

    const cumPassCount = data.cumulative?.floor1_ai?.reduce((total: number, ai) => {
      return total + (ai.pass_infant_m || 0) + (ai.pass_infant_f || 0) +
        (ai.pass_elementary_m || 0) + (ai.pass_elementary_f || 0) +
        (ai.pass_middle_m || 0) + (ai.pass_middle_f || 0) +
        (ai.pass_adult_m || 0) + (ai.pass_adult_f || 0)
    }, 0) || 0

    const cumRegularCount = data.cumulative?.floor1_regular?.reduce((total: number, reg) => {
      return total + (reg.infant_m || 0) + (reg.infant_f || 0) +
        (reg.elementary_m || 0) + (reg.elementary_f || 0) +
        (reg.middle_m || 0) + (reg.middle_f || 0) +
        (reg.adult_m || 0) + (reg.adult_f || 0)
    }, 0) || 0

    const cumGateCount = cumPassCount + cumRegularCount

    const gateBreakdown = {
      monthly_infant_m, monthly_infant_f,
      monthly_elementary_m, monthly_elementary_f,
      monthly_middle_m, monthly_middle_f,
      monthly_adult_m, monthly_adult_f,
      cum_infant_m, cum_infant_f,
      cum_elementary_m, cum_elementary_f,
      cum_middle_m, cum_middle_f,
      cum_adult_m, cum_adult_f
    }

    const floor1Multiplier = getReadingMultiplier('floor1')
    const floor23Multiplier = getReadingMultiplier('floor23')

    const f1LoanUsers = (data.floor1_visitor || []).filter((v) => v.usage_type === 'loan').reduce((sum: number, v) => sum + (v.user_count || 0), 0)
    const f1ReadUsers = (data.floor1_visitor || []).filter((v) => v.usage_type === 'read').reduce((sum: number, v) => sum + (v.user_count || 0), 0)

    const cumF1LoanUsers = (data.cumulative?.floor1_visitor || []).filter((v) => v.usage_type === 'loan').reduce((sum: number, v) => sum + (v.user_count || 0), 0)
    const cumF1ReadUsers = (data.cumulative?.floor1_visitor || []).filter((v) => v.usage_type === 'read').reduce((sum: number, v) => sum + (v.user_count || 0), 0)

    const f1Program = (data.floor1_program || []).reduce((sum: number, p) => sum + (p.participant_count || 0), 0)
    const cumF1Program = (data.cumulative?.floor1_program || []).reduce((sum: number, p) => sum + (p.participant_count || 0), 0)

    const f1AIUsers = (() => {
      const ai = data.floor1_ai
      if (!ai) return 0

      const deviceUsers = (ai.bookbot || 0) + (ai.air_projection || 0) +
        (ai.finger_story || 0) + (ai.ar_book || 0) + (ai.unmanned_users || 0)

      return passCount + deviceUsers
    })()

    const cumF1AIUsers = (() => {
      let total = 0
      data.cumulative?.floor1_ai?.forEach((ai) => {
        const deviceUsers = (ai.bookbot || 0) + (ai.air_projection || 0) +
          (ai.finger_story || 0) + (ai.ar_book || 0) + (ai.unmanned_users || 0)

        total += deviceUsers
      })

      return cumPassCount + total
    })()

    const loanWithMultiplierCategories = ['만화책마루', '영어책마루', '다봄자료실', '인문예술자료실']
    const pureReadingCategories = ['멀티미디어존', '간행물존', '영화', '음악', '디지털갤러리']
    const excludeFromReading = ['책바다', '책나래']

    const isNewCalculation = yearMonth! >= getCalculationCutoffDate()
    const newLoanCategories = ['만화책마루', '영어책마루', '다봄자료실', '인문예술자료실', '자료이용', '책바다', '책나래']

    const f23LoanUsers = (() => {
      if (!isNewCalculation) {
        return (data.floor23_visitor || []).filter((v) => v.category !== '열람').reduce((sum: number, v) => sum + (v.user_count || 0), 0)
      }
      return (data.floor23_visitor || []).filter((v) => newLoanCategories.includes(v.category || '')).reduce((sum: number, v) => sum + (v.user_count || 0), 0)
    })()

    const f23ReadUsers = (() => {
      if (!isNewCalculation) {
        return (data.floor23_visitor || []).filter((v) => v.category === '열람').reduce((sum: number, v) => sum + (v.user_count || 0), 0)
      }

      let total = 0
      total += (data.floor23_visitor || []).filter((v) => v.category === '열람').reduce((sum: number, v) => sum + (v.user_count || 0), 0)
      loanWithMultiplierCategories.forEach(cat => {
        total += (data.floor23_visitor || []).filter((v) => v.category === `${cat}_열람`).reduce((sum: number, v) => sum + (v.user_count || 0), 0)
      })
      pureReadingCategories.forEach(cat => {
        total += (data.floor23_visitor || []).filter((v) => v.category === cat).reduce((sum: number, v) => sum + (v.user_count || 0), 0)
      })
      return total
    })()

    const f23VisitorTotals = data.cumulative?.floor23_visitor_totals || { loan_cumulative: 0, reading_cumulative: 0 }
    const cumF23LoanUsers = f23VisitorTotals.loan_cumulative || 0
    const cumF23ReadUsers = f23VisitorTotals.reading_cumulative || 0

    const f23Program = (data.floor23_program || []).reduce((sum: number, p) => sum + (p.participant_count || 0), 0)
    const cumF23Program = (data.cumulative?.floor23_program || []).reduce((sum: number, p) => sum + (p.participant_count || 0), 0)

    const f23AIUsers = (() => {
      let total = 0
      const smart = data.floor23_ai_smart
      if (smart) {
        total += (smart.literature_vending || 0) + (smart.unmanned_card_issuer || 0) +
          (smart.smart_loan_users || 0) + (smart.smart_return_users || 0) + (smart.smart_reservation_users || 0)
      }
      data.floor23_ai_equipment?.forEach((eq) => {
        total += (eq.bookbot || 0) + (eq.book_kiosk || 0) + (eq.laptop || 0) +
          (eq.tablet || 0) + (eq.book_scanner || 0) + (eq.enews || 0)
      })
      return total
    })()

    const cumF23AIUsers = (() => {
      let total = 0
      data.cumulative?.floor23_ai_smart?.forEach((smart) => {
        total += (smart.literature_vending || 0) + (smart.unmanned_card_issuer || 0) +
          (smart.smart_loan_users || 0) + (smart.smart_return_users || 0) + (smart.smart_reservation_users || 0)
      })
      data.cumulative?.floor23_ai_equipment?.forEach((eq) => {
        total += (eq.bookbot || 0) + (eq.book_kiosk || 0) + (eq.laptop || 0) +
          (eq.tablet || 0) + (eq.book_scanner || 0) + (eq.enews || 0)
      })
      return total
    })()

    const f1Sum = f1LoanUsers + f1ReadUsers + f1Program + f1AIUsers
    const cumF1Sum = cumF1LoanUsers + cumF1ReadUsers + cumF1Program + cumF1AIUsers

    const f23Sum = f23LoanUsers + f23ReadUsers + f23Program + f23AIUsers
    const cumF23Sum = cumF23LoanUsers + cumF23ReadUsers + cumF23Program + cumF23AIUsers

    const totalLoan = f1LoanUsers + f23LoanUsers
    const cumTotalLoan = cumF1LoanUsers + cumF23LoanUsers

    const totalRead = f1ReadUsers + f23ReadUsers
    const cumTotalRead = cumF1ReadUsers + cumF23ReadUsers

    const totalProgram = f1Program + f23Program
    const cumTotalProgram = cumF1Program + cumF23Program

    const totalAI = f1AIUsers + f23AIUsers
    const cumTotalAI = cumF1AIUsers + cumF23AIUsers

    const grandTotal = f1Sum + f23Sum
    const cumGrandTotal = cumF1Sum + cumF23Sum

    const gateStartDate = getGateStartDate()
    const showReopenDate = getShowReopenDate()
    const showReopenDateUntil = getShowReopenDateUntil()
    const isNewKnowledgeFormat = yearMonth! >= '2025-12'

    const shouldShowReopenDate = showReopenDate && yearMonth && yearMonth <= showReopenDateUntil

    let gateLabel = '출입게이트 출입자수'
    if (shouldShowReopenDate && gateStartDate) {
      gateLabel = `출입게이트 출입자수 (${gateStartDate} ~)`
      if (yearMonth && yearMonth >= '2025-12') {
        const match = gateStartDate.match(/(\d+)\.\s*(\d+)\.?/)
        if (match) {
          const gateMonth = parseInt(match[1])
          const gateDay = parseInt(match[2])
          const gateYear = gateMonth >= 12 ? '2025' : yearMonth.substring(0, 4)
          const gateStartStr = `${gateYear}-${gateMonth.toString().padStart(2, '0')}-${gateDay.toString().padStart(2, '0')}`
          const gateOpenDays = calculateOpenDaysFromDate(gateStartStr, yearMonth)
          gateLabel = `출입게이트 출입자수 (${gateStartDate} ~)\n(재개관 ${gateOpenDays}일째)`
        }
      }
    }

    const gateRows = isNewKnowledgeFormat ? [
      {
        key: 0,
        col1: gateLabel,
        rowType: 'monthly',
        infant_m: gateBreakdown.monthly_infant_m,
        infant_f: gateBreakdown.monthly_infant_f,
        elementary_m: gateBreakdown.monthly_elementary_m,
        elementary_f: gateBreakdown.monthly_elementary_f,
        middle_m: gateBreakdown.monthly_middle_m,
        middle_f: gateBreakdown.monthly_middle_f,
        adult_m: gateBreakdown.monthly_adult_m,
        adult_f: gateBreakdown.monthly_adult_f,
        month_total: gateCount,
        cumulative_total: null
      },
      {
        key: 1,
        col1: '',
        rowType: 'cumulative',
        infant_m: gateBreakdown.cum_infant_m,
        infant_f: gateBreakdown.cum_infant_f,
        elementary_m: gateBreakdown.cum_elementary_m,
        elementary_f: gateBreakdown.cum_elementary_f,
        middle_m: gateBreakdown.cum_middle_m,
        middle_f: gateBreakdown.cum_middle_f,
        adult_m: gateBreakdown.cum_adult_m,
        adult_f: gateBreakdown.cum_adult_f,
        month_total: null,
        cumulative_total: cumGateCount
      }
    ] : [
      { key: 0, col1: `출입게이트 출입자수${gateStartDate ? ` (${gateStartDate} ~)` : ''}`, col2: '', month_total: gateCount, cumulative_total: cumGateCount }
    ]

    const visitorRows = [
      { key: 0, col1: '어린이자료실', col2: '이용자수', col3: '대출자수', month_total: f1LoanUsers, cumulative_total: cumF1LoanUsers },
      { key: 1, col1: '', col2: '', col3: '열람자수', month_total: f1ReadUsers, cumulative_total: cumF1ReadUsers },
      { key: 2, col1: '', col2: '프로그램', col3: '이용자수', month_total: f1Program, cumulative_total: cumF1Program },
      { key: 3, col1: '', col2: '미래형도서관', col3: '이용자수', month_total: f1AIUsers, cumulative_total: cumF1AIUsers },
      { key: 4, col1: '', col2: '계', col3: '', month_total: f1Sum, cumulative_total: cumF1Sum },
      { key: 5, col1: '종합, 인문예술자료실', col2: '이용자수', col3: '대출자수', month_total: f23LoanUsers, cumulative_total: cumF23LoanUsers },
      { key: 6, col1: '', col2: '', col3: '열람자수', month_total: f23ReadUsers, cumulative_total: cumF23ReadUsers },
      { key: 7, col1: '', col2: '프로그램', col3: '이용자수', month_total: f23Program, cumulative_total: cumF23Program },
      { key: 8, col1: '', col2: '미래형도서관', col3: '이용자수', month_total: f23AIUsers, cumulative_total: cumF23AIUsers },
      { key: 9, col1: '', col2: '계', col3: '', month_total: f23Sum, cumulative_total: cumF23Sum },
      { key: 10, col1: '전체', col2: '이용자수', col3: '대출자수', month_total: totalLoan, cumulative_total: cumTotalLoan },
      { key: 11, col1: '', col2: '', col3: '열람자수', month_total: totalRead, cumulative_total: cumTotalRead },
      { key: 12, col1: '', col2: '프로그램', col3: '이용자수', month_total: totalProgram, cumulative_total: cumTotalProgram },
      { key: 13, col1: '', col2: '미래형도서관', col3: '이용자수', month_total: totalAI, cumulative_total: cumTotalAI },
      { key: 14, col1: '', col2: '계', col3: '', month_total: grandTotal, cumulative_total: cumGrandTotal }
    ]

    return { gateRows, visitorRows }
  }

  const processMaterialData = (data: KnowledgeData) => {
    const subjects = ['000', '100', '200', '300', '400', '500', '600', '700', '800', '900']

    const floor1Multiplier = getReadingMultiplier('floor1')
    const floor23Multiplier = getReadingMultiplier('floor23')

    const f1Loan: SubjectMap = {}
    const f1Read: SubjectMap = {}
    data.floor1_material?.forEach((item) => {
      const subj = item.subject_code || ''
      if (item.usage_type === 'loan') {
        f1Loan[subj] = (f1Loan[subj] || 0) + (item.book_count || 0)
      } else if (item.usage_type === 'read' || item.usage_type === 'reading') {
        f1Read[subj] = (f1Read[subj] || 0) + (item.book_count || 0)
      }
    })

    const cumF1Loan: SubjectMap = {}
    const cumF1Read: SubjectMap = {}
    data.cumulative?.floor1_material?.forEach((item) => {
      const subj = item.subject_code || ''
      if (item.usage_type === 'loan') {
        cumF1Loan[subj] = (cumF1Loan[subj] || 0) + (item.book_count || 0)
      } else if (item.usage_type === 'read' || item.usage_type === 'reading') {
        cumF1Read[subj] = (cumF1Read[subj] || 0) + (item.book_count || 0)
      }
    })

    const f23Loan: SubjectMap = {}
    const f23Read: SubjectMap = {}
    data.floor23_material?.forEach((item) => {
      const subj = item.subject_code || ''
      if (item.usage_type === 'loan') {
        f23Loan[subj] = (f23Loan[subj] || 0) + (item.book_count || 0)
      } else if (item.usage_type === 'read' || item.usage_type === 'reading') {
        f23Read[subj] = (f23Read[subj] || 0) + (item.book_count || 0)
      }
    })

    const cumF23Loan: SubjectMap = {}
    const cumF23Read: SubjectMap = {}
    data.cumulative?.floor23_material?.forEach((item) => {
      const subj = item.subject_code || ''
      if (item.usage_type === 'loan') {
        cumF23Loan[subj] = (cumF23Loan[subj] || 0) + (item.book_count || 0)
      } else if (item.usage_type === 'read' || item.usage_type === 'reading') {
        cumF23Read[subj] = (cumF23Read[subj] || 0) + (item.book_count || 0)
      }
    })

    const buildRow = (type: string, rowData: SubjectMap, cumData: SubjectMap): MaterialRow => {
      const row: MaterialRow = { section: '', type, etc: 0 }
      let total = 0
      let cumTotal = 0
      subjects.forEach(subj => {
        const val = rowData[subj] || 0
        const cumVal = cumData[subj] || 0
        row[`type_${subj}`] = val
        total += val
        cumTotal += cumVal
      })
      row.month_total = total
      row.cumulative_total = cumTotal
      return row
    }

    const f1LoanRow = buildRow('loan', f1Loan, cumF1Loan)
    const f1LoanCumRow: MaterialRow = { section: '', type: 'loan_cumulative', etc: 0 }
    subjects.forEach(subj => {
      f1LoanCumRow[`type_${subj}`] = cumF1Loan[subj] || 0
    })
    f1LoanCumRow.month_total = f1LoanRow.cumulative_total
    f1LoanCumRow.cumulative_total = f1LoanRow.cumulative_total

    const f1ReadRow = buildRow('read', f1Read, cumF1Read)
    const f1ReadCumRow: MaterialRow = { section: '', type: 'read_cumulative', etc: 0 }
    subjects.forEach(subj => {
      f1ReadCumRow[`type_${subj}`] = cumF1Read[subj] || 0
    })
    f1ReadCumRow.month_total = f1ReadRow.cumulative_total
    f1ReadCumRow.cumulative_total = f1ReadRow.cumulative_total

    const f1SumRow: MaterialRow = { section: '', type: 'sum', etc: 0 }
    subjects.forEach(subj => {
      f1SumRow[`type_${subj}`] = Number(f1LoanRow[`type_${subj}`] || 0) + Number(f1ReadRow[`type_${subj}`] || 0)
    })
    f1SumRow.month_total = (f1LoanRow.month_total || 0) + (f1ReadRow.month_total || 0)
    f1SumRow.cumulative_total = (f1LoanRow.cumulative_total || 0) + (f1ReadRow.cumulative_total || 0)

    const f1SumCumRow: MaterialRow = { section: '', type: 'sum_cumulative', etc: 0 }
    subjects.forEach(subj => {
      f1SumCumRow[`type_${subj}`] = (cumF1Loan[subj] || 0) + (cumF1Read[subj] || 0)
    })
    f1SumCumRow.month_total = f1SumRow.cumulative_total
    f1SumCumRow.cumulative_total = f1SumRow.cumulative_total

    const f23LoanRow = buildRow('loan', f23Loan, cumF23Loan)
    const f23LoanCumRow: MaterialRow = { section: '', type: 'loan_cumulative', etc: 0 }
    subjects.forEach(subj => {
      f23LoanCumRow[`type_${subj}`] = cumF23Loan[subj] || 0
    })
    f23LoanCumRow.month_total = f23LoanRow.cumulative_total
    f23LoanCumRow.cumulative_total = f23LoanRow.cumulative_total

    const f23ReadRow = buildRow('read', f23Read, cumF23Read)
    const f23ReadCumRow: MaterialRow = { section: '', type: 'read_cumulative', etc: 0 }
    subjects.forEach(subj => {
      f23ReadCumRow[`type_${subj}`] = cumF23Read[subj] || 0
    })
    f23ReadCumRow.month_total = f23ReadRow.cumulative_total
    f23ReadCumRow.cumulative_total = f23ReadRow.cumulative_total

    const f23SumRow: MaterialRow = { section: '', type: 'sum', etc: 0 }
    subjects.forEach(subj => {
      f23SumRow[`type_${subj}`] = Number(f23LoanRow[`type_${subj}`] || 0) + Number(f23ReadRow[`type_${subj}`] || 0)
    })
    f23SumRow.month_total = (f23LoanRow.month_total || 0) + (f23ReadRow.month_total || 0)
    f23SumRow.cumulative_total = (f23LoanRow.cumulative_total || 0) + (f23ReadRow.cumulative_total || 0)

    const f23SumCumRow: MaterialRow = { section: '', type: 'sum_cumulative', etc: 0 }
    subjects.forEach(subj => {
      f23SumCumRow[`type_${subj}`] = (cumF23Loan[subj] || 0) + (cumF23Read[subj] || 0)
    })
    f23SumCumRow.month_total = f23SumRow.cumulative_total
    f23SumCumRow.cumulative_total = f23SumRow.cumulative_total

    const totalLoanRow: MaterialRow = { section: '', type: 'loan', etc: 0 }
    const totalLoanCumRow: MaterialRow = { section: '', type: 'loan_cumulative', etc: 0 }
    const totalReadRow: MaterialRow = { section: '', type: 'read', etc: 0 }
    const totalReadCumRow: MaterialRow = { section: '', type: 'read_cumulative', etc: 0 }
    const totalSumRow: MaterialRow = { section: '', type: 'sum', etc: 0 }
    const totalSumCumRow: MaterialRow = { section: '', type: 'sum_cumulative', etc: 0 }
    subjects.forEach(subj => {
      totalLoanRow[`type_${subj}`] = Number(f1LoanRow[`type_${subj}`] || 0) + Number(f23LoanRow[`type_${subj}`] || 0)
      totalLoanCumRow[`type_${subj}`] = Number(f1LoanCumRow[`type_${subj}`] || 0) + Number(f23LoanCumRow[`type_${subj}`] || 0)
      totalReadRow[`type_${subj}`] = Number(f1ReadRow[`type_${subj}`] || 0) + Number(f23ReadRow[`type_${subj}`] || 0)
      totalReadCumRow[`type_${subj}`] = Number(f1ReadCumRow[`type_${subj}`] || 0) + Number(f23ReadCumRow[`type_${subj}`] || 0)
      totalSumRow[`type_${subj}`] = Number(f1SumRow[`type_${subj}`] || 0) + Number(f23SumRow[`type_${subj}`] || 0)
      totalSumCumRow[`type_${subj}`] = Number(f1SumCumRow[`type_${subj}`] || 0) + Number(f23SumCumRow[`type_${subj}`] || 0)
    })
    totalLoanRow.month_total = (f1LoanRow.month_total || 0) + (f23LoanRow.month_total || 0)
    totalLoanRow.cumulative_total = (f1LoanRow.cumulative_total || 0) + (f23LoanRow.cumulative_total || 0)
    totalLoanCumRow.month_total = totalLoanRow.cumulative_total
    totalLoanCumRow.cumulative_total = totalLoanRow.cumulative_total
    totalReadRow.month_total = (f1ReadRow.month_total || 0) + (f23ReadRow.month_total || 0)
    totalReadRow.cumulative_total = (f1ReadRow.cumulative_total || 0) + (f23ReadRow.cumulative_total || 0)
    totalReadCumRow.month_total = totalReadRow.cumulative_total
    totalReadCumRow.cumulative_total = totalReadRow.cumulative_total
    totalSumRow.month_total = (f1SumRow.month_total || 0) + (f23SumRow.month_total || 0)
    totalSumRow.cumulative_total = (f1SumRow.cumulative_total || 0) + (f23SumRow.cumulative_total || 0)
    totalSumCumRow.month_total = totalSumRow.cumulative_total
    totalSumCumRow.cumulative_total = totalSumRow.cumulative_total

    return [
      { ...f1LoanRow, key: 0, section: '어린이자료실' },
      { ...f1LoanCumRow, key: 1 },
      { ...f1ReadRow, key: 2 },
      { ...f1ReadCumRow, key: 3 },
      { ...f1SumRow, key: 4 },
      { ...f1SumCumRow, key: 5 },
      { ...f23LoanRow, key: 6, section: '종합, 인문예술자료실' },
      { ...f23LoanCumRow, key: 7 },
      { ...f23ReadRow, key: 8 },
      { ...f23ReadCumRow, key: 9 },
      { ...f23SumRow, key: 10 },
      { ...f23SumCumRow, key: 11 },
      { ...totalLoanRow, key: 12, section: '전체' },
      { ...totalLoanCumRow, key: 13 },
      { ...totalReadRow, key: 14 },
      { ...totalReadCumRow, key: 15 },
      { ...totalSumRow, key: 16 },
      { ...totalSumCumRow, key: 17 }
    ]
  }

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
      message.error(getErrorMessage(error))
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadWebStats = async () => {
    setDownloading(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
      const response = await axios.get(
        `${apiUrl}/api/excel/web-stats/knowledge/${yearMonth}`,
        { responseType: 'blob' }
      )

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `지식정보기반과통계_${yearMonth}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      message.success('엑셀 파일 다운로드 완료')
    } catch (error: unknown) {
      console.error('Excel download error:', error)
      message.error(getErrorMessage(error))
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadAllStats = async () => {
    setDownloading(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
      const response = await axios.get(
        `${apiUrl}/api/excel/web-stats/all/${yearMonth}`,
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
      message.error(getErrorMessage(error))
    } finally {
      setDownloading(false)
    }
  }

  const handleMonthChange = (date: Dayjs | null) => {
    if (date) {
      const newYearMonth = date.format('YYYY-MM')
      setSelectedMonth(date)
      navigate(`/statistics/knowledge/${newYearMonth}`)
    }
  }

  const headerStyle = () => ({ style: { backgroundColor: '#E2EFDA', textAlign: 'center' as const, whiteSpace: 'pre-line' as const } })

  const isNewKnowledgeFormat = yearMonth ? yearMonth >= '2025-12' : false

  const gateColumnsOld: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'col1',
      key: 'col1',
      width: 159,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, colSpan: 2 }),
      render: (text: string) => text,
      onCell: () => ({ colSpan: 2 })
    },
    {
      title: '',
      dataIndex: 'col2',
      key: 'col2',
      width: 80,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, colSpan: 0 }),
      render: () => null,
      onCell: () => ({ colSpan: 0 })
    },
    {
      title: '월계',
      dataIndex: 'month_total',
      key: 'month_total',
      width: 55,
      align: 'center',
      onHeaderCell: headerStyle,
      render: renderNumber
    },
    {
      title: '누계',
      dataIndex: 'cumulative_total',
      key: 'cumulative_total',
      width: 55,
      align: 'center',
      onHeaderCell: headerStyle,
      render: renderNumber
    }
  ]

  const gateColumnsNew: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'col1',
      key: 'col1',
      width: 100,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (text, record, index) => {
        if (index === 0) return <span style={{ whiteSpace: 'pre-line' }}>{text}</span>
        return null
      },
      onCell: (record, index) => {
        if (index === 0) return { rowSpan: 2 }
        return { rowSpan: 0 }
      }
    },
    { title: '유아\n(남)', dataIndex: 'infant_m', key: 'infant_m', width: 50, align: 'center', onHeaderCell: headerStyle, render: (v) => v !== null ? Math.round(v || 0).toLocaleString() : '' },
    { title: '유아\n(여)', dataIndex: 'infant_f', key: 'infant_f', width: 50, align: 'center', onHeaderCell: headerStyle, render: (v) => v !== null ? Math.round(v || 0).toLocaleString() : '' },
    { title: '초등\n(남)', dataIndex: 'elementary_m', key: 'elementary_m', width: 50, align: 'center', onHeaderCell: headerStyle, render: (v) => v !== null ? Math.round(v || 0).toLocaleString() : '' },
    { title: '초등\n(여)', dataIndex: 'elementary_f', key: 'elementary_f', width: 50, align: 'center', onHeaderCell: headerStyle, render: (v) => v !== null ? Math.round(v || 0).toLocaleString() : '' },
    { title: '중고등\n(남)', dataIndex: 'middle_m', key: 'middle_m', width: 50, align: 'center', onHeaderCell: headerStyle, render: (v) => v !== null ? Math.round(v || 0).toLocaleString() : '' },
    { title: '중고등\n(여)', dataIndex: 'middle_f', key: 'middle_f', width: 50, align: 'center', onHeaderCell: headerStyle, render: (v) => v !== null ? Math.round(v || 0).toLocaleString() : '' },
    { title: '일반\n(남)', dataIndex: 'adult_m', key: 'adult_m', width: 50, align: 'center', onHeaderCell: headerStyle, render: (v) => v !== null ? Math.round(v || 0).toLocaleString() : '' },
    { title: '일반\n(여)', dataIndex: 'adult_f', key: 'adult_f', width: 50, align: 'center', onHeaderCell: headerStyle, render: (v) => v !== null ? Math.round(v || 0).toLocaleString() : '' },
    {
      title: '월계',
      dataIndex: 'month_total',
      key: 'month_total',
      width: 55,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v) => v !== null ? Math.round(v || 0).toLocaleString() : ''
    },
    {
      title: '누계',
      dataIndex: 'cumulative_total',
      key: 'cumulative_total',
      width: 55,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v) => v !== null ? Math.round(v || 0).toLocaleString() : ''
    }
  ]

  const gateColumns = isNewKnowledgeFormat ? gateColumnsNew : gateColumnsOld

  const baseVisitorColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'col1',
      key: 'col1',
      width: 58,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, colSpan: 3 }),
      render: (text, record, index) => {
        if (index === 0) return '어린이자료실'
        if (index === 5) return '종합, 인문예술자료실'
        if (index === 10) return '전체'
        return null
      },
      onCell: (record, index) => {
        if (index === 0) return { rowSpan: 5 }
        if (index && index > 0 && index < 5) return { rowSpan: 0 }
        if (index === 5) return { rowSpan: 5 }
        if (index && index > 5 && index < 10) return { rowSpan: 0 }
        if (index === 10) return { rowSpan: 5 }
        if (index && index > 10) return { rowSpan: 0 }
        return {}
      }
    },
    {
      title: '',
      dataIndex: 'col2',
      key: 'col2',
      width: 58,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, colSpan: 0 }),
      render: (text, record, index) => {
        if (index === 0 || index === 5 || index === 10) return '이용자수'
        if (index === 2 || index === 7 || index === 12) return '프로그램'
        if (index === 3 || index === 8 || index === 13) return '미래형도서관'
        if (index === 4 || index === 9 || index === 14) return '계'
        return null
      },
      onCell: (record, index) => {
        if (index === 0 || index === 5 || index === 10) return { rowSpan: 2 }
        if (index === 1 || index === 6 || index === 11) return { rowSpan: 0 }
        if (index === 4 || index === 9 || index === 14) return { colSpan: 2 }
        return {}
      }
    },
    {
      title: '',
      dataIndex: 'col3',
      key: 'col3',
      width: 58,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, colSpan: 0 }),
      render: (text, record, index) => {
        if (index === 4 || index === 9 || index === 14) return null
        return text
      },
      onCell: (record, index) => {
        if (index === 4 || index === 9 || index === 14) return { colSpan: 0 }
        return {}
      }
    },
    {
      title: '월계',
      dataIndex: 'month_total',
      key: 'month_total',
      width: 40,
      align: 'center',
      onHeaderCell: headerStyle,
      render: renderNumber
    },
    {
      title: '누계',
      dataIndex: 'cumulative_total',
      key: 'cumulative_total',
      width: 40,
      align: 'center',
      onHeaderCell: headerStyle,
      render: renderNumber
    }
  ]

  const baseMaterialColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'section',
      key: 'section',
      width: 40,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, colSpan: 2 }),
      render: (_, record, index) => {
        if (index === 0) return <span style={{ whiteSpace: 'pre-line' }}>{'어린이\n자료실'}</span>
        if (index === 6) return <span style={{ whiteSpace: 'pre-line' }}>{'종합,\n인문예술\n자료실'}</span>
        if (index === 12) return '전체'
        return null
      },
      onCell: (record, index) => {
        if (index === 0) return { rowSpan: 6 }
        if (index && index > 0 && index < 6) return { rowSpan: 0 }
        if (index === 6) return { rowSpan: 6 }
        if (index && index > 6 && index < 12) return { rowSpan: 0 }
        if (index === 12) return { rowSpan: 6 }
        if (index && index > 12 && index < 18) return { rowSpan: 0 }
        return {}
      }
    },
    {
      title: '',
      dataIndex: 'type',
      key: 'type',
      width: 29,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, colSpan: 0 }),
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
    { title: '기타', dataIndex: 'etc', key: 'etc', width: 24, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '월계', dataIndex: 'month_total', key: 'month_total', width: 32, align: 'center', onHeaderCell: headerStyle, render: (v, record) => record.type?.includes('cumulative') ? '-' : Math.round(v || 0).toLocaleString() },
    { title: '누계', dataIndex: 'cumulative_total', key: 'cumulative_total', width: 32, align: 'center', onHeaderCell: headerStyle, render: (v, record) => !record.type?.includes('cumulative') ? '-' : Math.round(v || 0).toLocaleString() }
  ]

  const visitorColumns = baseVisitorColumns
  const materialColumns = baseMaterialColumns

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
            onClick={handleDownloadAllStats}
            loading={downloading}
          >
            전체 다운로드
          </Button>
          {isAccessCodeSession() && (
            <Button
              icon={<SettingOutlined />}
              onClick={() => navigate('/settings')}
            >
              설정으로 돌아가기
            </Button>
          )}
        </div>
      </div>

      <Card id="printable-content" style={{ marginBottom: 24, border: '2px solid #000' }}>
        <h1 style={{ textAlign: 'center', margin: '0 0 16px 0' }}>지식정보기반과 이용 현황</h1>

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
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 출입자 현황</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
          </div>
          <Table
            className="black-bordered-table"
            dataSource={gateData}
            columns={gateColumns}
            pagination={false}
            loading={loading}
            bordered
            size="small"
            tableLayout="fixed"
            components={{
              header: {
                cell: ResizableTitle,
              },
              body: {
                cell: EditableCell,
              },
            }}
          />
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
              body: {
                cell: EditableCell,
              },
            }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 자료 이용 현황</span>
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
            scroll={{ x: 1200 }}
            components={{
              header: {
                cell: ResizableTitle,
              },
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
