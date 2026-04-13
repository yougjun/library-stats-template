import { useState, useEffect, useMemo } from 'react'
import { Card, Table, message, DatePicker, Modal, Typography, Divider, Alert, Spin } from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs, { Dayjs } from 'dayjs'
import axios from 'axios'
import type { ColumnsType } from 'antd/es/table'
import PredictionNavigation from '../components/prediction/PredictionNavigation'
import ModelSelectionPanel from '../components/prediction/ModelSelectionPanel'
import PredictionCell from '../components/prediction/PredictionCell'
import PredictionCompareCell from '../components/prediction/PredictionCompareCell'
import SessionTimer from '../components/SessionTimer'
import { useAuthStore } from '../store/authStore'
import { getErrorMessage } from '../utils/errorHandler'
import {
  calculateOpenDays,
  getDateRangeString,
  getOperationPeriod,
  isAccessCodeSession
} from '../utils/libraryDays'
import '../styles/table.css'

const { Title, Paragraph } = Typography

interface PredictionData {
  predicted_value: number
  lower_bound: number
  upper_bound: number
  confidence: number
}

interface TablePredictions {
  visitor: Record<string, Record<string, PredictionData>>
  material_subject: Record<string, Record<string, PredictionData>>
  material_type: Record<string, Record<string, PredictionData>>
  program: Record<string, Record<string, PredictionData>>
  smart_library: Record<string, Record<string, PredictionData>>
  ai_equipment: Record<string, Record<string, PredictionData>>
}

export default function Floor23Prediction() {
  const { yearMonth } = useParams()
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs(yearMonth))
  const [selectedModel, setSelectedModel] = useState(1)
  const [weatherEnabled, setWeatherEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [predictions, setPredictions] = useState<TablePredictions | null>(null)
  const [modelInfo, setModelInfo] = useState<any>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [comparison, setComparison] = useState<any>(null)

  const currentMonth = dayjs().format('YYYY-MM')
  const nextMonth = dayjs().add(1, 'month').format('YYYY-MM')
  const isPastMonth = yearMonth && yearMonth < currentMonth

  const generatePredictions = async () => {
    setLoading(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
      const response = await axios.post(
        `${apiUrl}/api/predictions/floor23/table`,
        {
          model_id: selectedModel,
          target_months: [currentMonth, nextMonth],
          include_weather: weatherEnabled
        },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (response.data.success) {
        setPredictions(response.data.predictions)
        setModelInfo(response.data.model_info)
        message.success('예측 생성 완료')
      }
    } catch (error: unknown) {
      message.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const loadComparison = async () => {
    if (!isPastMonth || !yearMonth) return

    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
      const response = await axios.get(
        `${apiUrl}/api/predictions/compare/floor23/${yearMonth}?model_id=${selectedModel}`
      )
      if (response.data.success) {
        setComparison(response.data.comparison)
      }
    } catch (error: unknown) {
      console.error('Failed to load comparison:', error)
    }
  }

  useEffect(() => {
    if (isPastMonth) {
      loadComparison()
    }
  }, [yearMonth, selectedModel])

  const handleMonthChange = (date: Dayjs | null) => {
    if (date) {
      const newYearMonth = date.format('YYYY-MM')
      setSelectedMonth(date)
      navigate(`/prediction/floor23/${newYearMonth}`)
    }
  }

  const headerStyle = () => ({ style: { backgroundColor: '#E8F4FD', textAlign: 'center' as const } })

  const renderPredictionValue = (
    key: string,
    dataType: 'visitor' | 'material_subject' | 'material_type' | 'program' | 'smart_library' | 'ai_equipment'
  ) => {
    const targetMonth = currentMonth

    if (isPastMonth && comparison) {
      const compData = comparison[dataType]?.[key]
      if (compData) {
        return (
          <PredictionCompareCell
            predicted={compData.predicted}
            actual={compData.actual}
            lowerBound={compData.lower_bound}
            upperBound={compData.upper_bound}
          />
        )
      }
      return '-'
    }

    if (!predictions) {
      return <span style={{ color: '#999' }}>-</span>
    }

    const predData = predictions[dataType]?.[key]?.[targetMonth]
    if (!predData) {
      return <span style={{ color: '#999' }}>-</span>
    }

    return (
      <PredictionCell
        value={predData.predicted_value}
        lowerBound={predData.lower_bound}
        upperBound={predData.upper_bound}
        confidence={predData.confidence}
      />
    )
  }

  const calculateSumPrediction = (
    keys: string[],
    dataType: 'visitor' | 'material_subject' | 'material_type' | 'program' | 'smart_library' | 'ai_equipment'
  ): { value: number; lower: number; upper: number; avgConfidence: number } | null => {
    const targetMonth = currentMonth

    if (isPastMonth && comparison) {
      let predictedSum = 0
      let actualSum = 0
      let hasData = false
      keys.forEach(key => {
        const compData = comparison[dataType]?.[key]
        if (compData) {
          predictedSum += compData.predicted || 0
          actualSum += compData.actual || 0
          hasData = true
        }
      })
      if (hasData) {
        return { value: predictedSum, lower: 0, upper: 0, avgConfidence: 0, actual: actualSum } as any
      }
      return null
    }

    if (!predictions) return null

    let sum = 0
    let lowerSum = 0
    let upperSum = 0
    let confidenceSum = 0
    let count = 0

    keys.forEach(key => {
      const predData = predictions[dataType]?.[key]?.[targetMonth]
      if (predData) {
        sum += predData.predicted_value
        lowerSum += predData.lower_bound
        upperSum += predData.upper_bound
        confidenceSum += predData.confidence
        count++
      }
    })

    if (count === 0) return null

    return {
      value: sum,
      lower: lowerSum,
      upper: upperSum,
      avgConfidence: confidenceSum / count
    }
  }

  const renderSumValue = (
    keys: string[],
    dataType: 'visitor' | 'material_subject' | 'material_type' | 'program' | 'smart_library' | 'ai_equipment'
  ) => {
    const sumData = calculateSumPrediction(keys, dataType) as any

    if (isPastMonth && sumData && 'actual' in sumData) {
      return (
        <PredictionCompareCell
          predicted={sumData.value}
          actual={sumData.actual}
          lowerBound={0}
          upperBound={0}
        />
      )
    }

    if (!sumData) {
      return <span style={{ color: '#999' }}>-</span>
    }

    return (
      <PredictionCell
        value={sumData.value}
        lowerBound={sumData.lower}
        upperBound={sumData.upper}
        confidence={sumData.avgConfidence}
      />
    )
  }

  const visitorData = useMemo(() => {
    const ageGroups = ['infant_elementary', 'middle_high', 'adult', 'sum']
    return ageGroups.map((ag, idx) => ({
      key: idx,
      age_group: ag
    }))
  }, [])

  const ageGroupKeys = ['infant_elementary', 'middle_high', 'adult']

  const visitorCategories = [
    { key: '자료이용', title: '대출' },
    { key: '책바다', title: '책바다' },
    { key: '책나래', title: '책나래' },
    { key: '만화책마루', title: '만화\n책마루' },
    { key: '영어책마루', title: '영어\n책마루' },
    { key: '다봄자료실', title: '다봄\n자료실' },
    { key: '인문예술자료실', title: '인문예술\n자료실' },
    { key: '멀티미디어존', title: '멀티\n미디어존' },
    { key: '간행물존', title: '간행물존' },
    { key: '영화', title: '영화' },
    { key: '음악', title: '음악' },
    { key: '디지털갤러리', title: '디지털\n갤러리' }
  ]

  const visitorColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'age_group',
      key: 'age_group',
      width: 70,
      align: 'center',
      onHeaderCell: headerStyle,
      fixed: 'left',
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
    ...visitorCategories.map(cat => ({
      title: cat.title,
      key: cat.key,
      width: 65,
      align: 'center' as const,
      onHeaderCell: headerStyle,
      render: (_: any, record: any) => {
        if (record.age_group === 'sum') {
          return renderSumValue(ageGroupKeys.map(k => `${k}_${cat.key}`), 'visitor')
        }
        return renderPredictionValue(`${record.age_group}_${cat.key}`, 'visitor')
      }
    })),
    {
      title: '합계',
      key: 'total',
      width: 70,
      align: 'center' as const,
      onHeaderCell: headerStyle,
      render: (_: any, record: any) => {
        const catKeys = visitorCategories.map(cat => cat.key)
        if (record.age_group === 'sum') {
          const allKeys: string[] = []
          ageGroupKeys.forEach(ag => catKeys.forEach(cat => allKeys.push(`${ag}_${cat}`)))
          return renderSumValue(allKeys, 'visitor')
        }
        return renderSumValue(catKeys.map(cat => `${record.age_group}_${cat}`), 'visitor')
      }
    }
  ]

  const materialData = useMemo(() => {
    return [
      { key: 0, type: 'loan', label: '대출' },
      { key: 1, type: 'reading', label: '열람' },
      { key: 2, type: 'sum', label: '계' }
    ]
  }, [])

  const subjectCodes = ['000', '100', '200', '300', '400', '500', '600', '700', '800', '900']
  const subjectLabels: Record<string, string> = {
    '000': '총류',
    '100': '철학',
    '200': '종교',
    '300': '사회',
    '400': '자연',
    '500': '기술',
    '600': '예술',
    '700': '언어',
    '800': '문학',
    '900': '역사'
  }

  const materialColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'label',
      key: 'label',
      width: 60,
      align: 'center',
      onHeaderCell: headerStyle
    },
    ...subjectCodes.map(code => ({
      title: `${subjectLabels[code]}\n(${code})`,
      dataIndex: code,
      key: code,
      width: 80,
      align: 'center' as const,
      onHeaderCell: headerStyle,
      render: (_: any, record: any) => {
        if (record.type === 'sum') {
          return renderSumValue([`${code}_loan`, `${code}_reading`], 'material_subject')
        }
        const key = `${code}_${record.type}`
        return renderPredictionValue(key, 'material_subject')
      }
    })),
    {
      title: '합계',
      key: 'total',
      width: 80,
      align: 'center' as const,
      onHeaderCell: headerStyle,
      render: (_: any, record: any) => {
        if (record.type === 'sum') {
          const loanKeys = subjectCodes.map(code => `${code}_loan`)
          const readingKeys = subjectCodes.map(code => `${code}_reading`)
          return renderSumValue([...loanKeys, ...readingKeys], 'material_subject')
        }
        const allKeys = subjectCodes.map(code => `${code}_${record.type}`)
        return renderSumValue(allKeys, 'material_subject')
      }
    }
  ]

  const materialTypeData = useMemo(() => {
    return [{ key: 0, type: 'prediction' }]
  }, [])

  const materialTypeKeys = ['general_books', 'comic', 'english', 'multicultural', 'large_print', 'dementia', 'easy_read', 'braille']

  const materialTypeColumns: ColumnsType<any> = [
    { title: '일반도서', key: 'general_books', width: 80, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('general_books', 'material_type') },
    { title: '만화도서', key: 'comic', width: 80, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('comic', 'material_type') },
    { title: '영어도서', key: 'english', width: 80, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('english', 'material_type') },
    { title: '다문화도서', key: 'multicultural', width: 80, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('multicultural', 'material_type') },
    { title: '큰글자도서', key: 'large_print', width: 80, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('large_print', 'material_type') },
    { title: '치매예방', key: 'dementia', width: 80, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('dementia', 'material_type') },
    { title: '읽기쉬운책', key: 'easy_read', width: 80, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('easy_read', 'material_type') },
    { title: '점자도서', key: 'braille', width: 80, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('braille', 'material_type') },
    { title: '합계', key: 'total', width: 80, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderSumValue(materialTypeKeys, 'material_type') }
  ]

  const programData = useMemo(() => {
    return [{ key: 0, type: 'prediction' }]
  }, [])

  const programColumns: ColumnsType<any> = [
    {
      title: '야간개관\n(일반)',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', key: 'night_floor23_count', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('night_floor23_count', 'program') },
        { title: '인원', key: 'night_floor23_people', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('night_floor23_people', 'program') }
      ]
    },
    {
      title: '북적북적\n청소년체험',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', key: 'teen_experience_count', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('teen_experience_count', 'program') },
        { title: '인원', key: 'teen_experience_people', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('teen_experience_people', 'program') }
      ]
    },
    {
      title: '자원봉사자\n교육',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', key: 'volunteer_education_count', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('volunteer_education_count', 'program') },
        { title: '인원', key: 'volunteer_education_people', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('volunteer_education_people', 'program') }
      ]
    },
    {
      title: '다봄프로그램',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', key: 'dabom_program_count', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('dabom_program_count', 'program') },
        { title: '인원', key: 'dabom_program_people', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('dabom_program_people', 'program') }
      ]
    },
    {
      title: '대면낭독',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', key: 'face_reading_count', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('face_reading_count', 'program') },
        { title: '인원', key: 'face_reading_people', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('face_reading_people', 'program') }
      ]
    },
    {
      title: '힐링북콘서트',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', key: 'healing_concert_count', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('healing_concert_count', 'program') },
        { title: '인원', key: 'healing_concert_people', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('healing_concert_people', 'program') }
      ]
    },
    {
      title: '자료실행사',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', key: 'room_event_count', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('room_event_count', 'program') },
        { title: '인원', key: 'room_event_people', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('room_event_people', 'program') }
      ]
    },
    {
      title: '합계',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', key: 'total_count', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('total_count', 'program') },
        { title: '인원', key: 'total_people', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('total_people', 'program') }
      ]
    }
  ]

  const smartLibraryData = useMemo(() => {
    return [{ key: 0, type: 'prediction' }]
  }, [])

  const smartLibraryColumns: ColumnsType<any> = [
    { title: '문학\n자판기', key: 'literature_vending', width: 70, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('literature_vending', 'smart_library') },
    { title: '무인\n회원증발급기', key: 'unmanned_card_issuer', width: 80, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('unmanned_card_issuer', 'smart_library') },
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
            { title: '이용자', key: 'smart_loan_users', width: 55, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('smart_loan_users', 'smart_library') },
            { title: '권수', key: 'smart_loan_books', width: 55, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('smart_loan_books', 'smart_library') }
          ]
        },
        {
          title: '반납',
          align: 'center',
          onHeaderCell: headerStyle,
          children: [
            { title: '이용자', key: 'smart_return_users', width: 55, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('smart_return_users', 'smart_library') },
            { title: '권수', key: 'smart_return_books', width: 55, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('smart_return_books', 'smart_library') }
          ]
        },
        {
          title: '예약',
          align: 'center',
          onHeaderCell: headerStyle,
          children: [
            { title: '이용자', key: 'smart_reservation_users', width: 55, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('smart_reservation_users', 'smart_library') },
            { title: '권수', key: 'smart_reservation_books', width: 55, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('smart_reservation_books', 'smart_library') }
          ]
        },
        {
          title: '소계',
          align: 'center',
          onHeaderCell: headerStyle,
          children: [
            { title: '이용자', key: 'smart_total_users', width: 55, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderSumValue(['smart_loan_users', 'smart_return_users', 'smart_reservation_users'], 'smart_library') },
            { title: '권수', key: 'smart_total_books', width: 55, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderSumValue(['smart_loan_books', 'smart_return_books', 'smart_reservation_books'], 'smart_library') }
          ]
        }
      ]
    },
    {
      title: '합계',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '이용자', key: 'total_users', width: 55, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderSumValue(['literature_vending', 'unmanned_card_issuer', 'smart_loan_users', 'smart_return_users', 'smart_reservation_users'], 'smart_library') },
        { title: '권수', key: 'total_books', width: 55, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderSumValue(['smart_loan_books', 'smart_return_books', 'smart_reservation_books'], 'smart_library') }
      ]
    }
  ]

  const aiEquipmentData = useMemo(() => {
    return [{ key: 0, type: 'prediction' }]
  }, [])

  const aiEquipmentKeys = ['bookbot', 'book_kiosk', 'laptop', 'tablet', 'book_scanner', 'enews', 'users']

  const aiEquipmentColumns: ColumnsType<any> = [
    { title: '책봇', key: 'bookbot', width: 70, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('bookbot', 'ai_equipment') },
    { title: '북키오스크', key: 'book_kiosk', width: 80, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('book_kiosk', 'ai_equipment') },
    { title: '노트북', key: 'laptop', width: 70, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('laptop', 'ai_equipment') },
    { title: '태블릿', key: 'tablet', width: 70, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('tablet', 'ai_equipment') },
    { title: '북스캐너', key: 'book_scanner', width: 80, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('book_scanner', 'ai_equipment') },
    { title: '전자신문', key: 'enews', width: 70, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('enews', 'ai_equipment') },
    { title: '이용자수', key: 'users', width: 70, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('users', 'ai_equipment') },
    { title: '합계', key: 'total', width: 70, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderSumValue(aiEquipmentKeys, 'ai_equipment') }
  ]

  const openDays = yearMonth ? calculateOpenDays(yearMonth) : 0
  const dateRangeStr = yearMonth ? getDateRangeString(yearMonth) : ''
  const operationPeriod = yearMonth ? getOperationPeriod(yearMonth) : ''

  return (
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
        <PredictionNavigation yearMonth={yearMonth || ''} />
        <ModelSelectionPanel
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          onGenerate={generatePredictions}
          onShowSummary={() => setShowSummary(true)}
          loading={loading}
          hasData={predictions !== null}
          weatherEnabled={weatherEnabled}
          onWeatherToggle={() => setWeatherEnabled(!weatherEnabled)}
        />
      </div>

      {isPastMonth && (
        <Alert
          message="과거 월 예측 비교"
          description="이 월은 이미 지났습니다. 예측값과 실제값의 비교를 표시합니다."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {!isPastMonth && !predictions && (
        <Alert
          message="예측 생성 필요"
          description={`'예측 생성' 버튼을 클릭하여 ${currentMonth}과 ${nextMonth}의 예측값을 생성하세요.`}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card style={{ marginBottom: 24, border: '2px solid #1890ff' }}>
        <h1 style={{ textAlign: 'center', margin: '0 0 16px 0', color: '#1890ff' }}>
          종합·인문예술자료실 예측 현황
        </h1>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ textAlign: 'left', fontSize: '14px' }}>
            {dateRangeStr} 개관 {openDays} 일째
          </div>
          <div style={{ textAlign: 'left', fontSize: '14px' }}>
            {isPastMonth ? (
              <div>예측 비교: {yearMonth} (예측값 vs 실제값)</div>
            ) : (
              <div>예측 대상: {currentMonth}, {nextMonth}</div>
            )}
            {modelInfo && <div>모델: {modelInfo.name}</div>}
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>예측 모델 학습 중...</div>
          </div>
        )}

        {!loading && (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 이용자 현황 예측</span>
                <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
              </div>
              <Table
                className="prediction-table"
                dataSource={visitorData}
                columns={visitorColumns}
                pagination={false}
                bordered
                size="small"
                tableLayout="fixed"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 자료 이용 현황 예측 (주제별)</span>
                <span style={{ fontSize: '13px', color: '#666' }}>(단위: 권)</span>
              </div>
              <Table
                className="prediction-table"
                dataSource={materialData}
                columns={materialColumns}
                pagination={false}
                bordered
                size="small"
                tableLayout="fixed"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 자료 이용 현황 예측 (유형별)</span>
                <span style={{ fontSize: '13px', color: '#666' }}>(단위: 권)</span>
              </div>
              <Table
                className="prediction-table"
                dataSource={materialTypeData}
                columns={materialTypeColumns}
                pagination={false}
                bordered
                size="small"
                tableLayout="fixed"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 행사 및 프로그램 예측</span>
                <span style={{ fontSize: '13px', color: '#666' }}>(단위: 횟수/명)</span>
              </div>
              <Table
                className="prediction-table"
                dataSource={programData}
                columns={programColumns}
                pagination={false}
                bordered
                size="small"
                tableLayout="fixed"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 스마트 도서관 예측</span>
                <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명/권)</span>
              </div>
              <Table
                className="prediction-table"
                dataSource={smartLibraryData}
                columns={smartLibraryColumns}
                pagination={false}
                bordered
                size="small"
                tableLayout="fixed"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ AI 기기 이용 예측</span>
                <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
              </div>
              <Table
                className="prediction-table"
                dataSource={aiEquipmentData}
                columns={aiEquipmentColumns}
                pagination={false}
                bordered
                size="small"
                tableLayout="fixed"
              />
            </div>
          </>
        )}
      </Card>

      <Modal
        title="예측 모델 상세 정보"
        open={showSummary}
        onCancel={() => setShowSummary(false)}
        footer={null}
        width={800}
      >
        {modelInfo && (
          <div>
            <Title level={4}>{modelInfo.name}</Title>
            <Paragraph>{modelInfo.description}</Paragraph>
            <Divider />
            <Title level={5}>작동 원리</Title>
            <div style={{ whiteSpace: 'pre-wrap', backgroundColor: '#f5f5f5', padding: 16, borderRadius: 4 }}>
              {modelInfo.mechanism}
            </div>
            <Divider />
            <Title level={5}>수학적 공식</Title>
            <div style={{ fontFamily: 'monospace', backgroundColor: '#f0f0f0', padding: 16, borderRadius: 4 }}>
              {modelInfo.formula}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
