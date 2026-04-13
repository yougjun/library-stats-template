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
import { useFloor1Visitor, useFloor1Material } from '../hooks/useFloor1Queries'
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
  material: Record<string, Record<string, PredictionData>>
  program: Record<string, Record<string, PredictionData>>
  ai_library: Record<string, Record<string, PredictionData>>
}

export default function Floor1Prediction() {
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

  const { data: visitorRes } = useFloor1Visitor(yearMonth!)
  const { data: materialRes } = useFloor1Material(yearMonth!)

  const currentMonth = dayjs().format('YYYY-MM')
  const nextMonth = dayjs().add(1, 'month').format('YYYY-MM')
  const isPastMonth = yearMonth && yearMonth < currentMonth

  const generatePredictions = async () => {
    setLoading(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
      const response = await axios.post(
        `${apiUrl}/api/predictions/floor1/table`,
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
        `${apiUrl}/api/predictions/compare/floor1/${yearMonth}?model_id=${selectedModel}`
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
      navigate(`/prediction/floor1/${newYearMonth}`)
    }
  }

  const headerStyle = () => ({ style: { backgroundColor: '#E8F4FD', textAlign: 'center' as const } })

  const renderPredictionValue = (
    key: string,
    dataType: 'visitor' | 'material' | 'program' | 'ai_library',
    actualValue?: number
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
      return actualValue?.toLocaleString() || 0
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
    dataType: 'visitor' | 'material' | 'program' | 'ai_library'
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
    dataType: 'visitor' | 'material' | 'program' | 'ai_library'
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
      age_group: ag,
      children_loan: ag,
      children_read: ag,
      infant_loan: ag,
      infant_read: ag
    }))
  }, [])

  const ageGroupKeys = ['infant_elementary', 'middle_high', 'adult']

  const visitorColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'age_group',
      key: 'age_group',
      width: 80,
      align: 'center',
      onHeaderCell: headerStyle,
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
      title: '어린이자료실',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        {
          title: '관외대출',
          dataIndex: 'children_loan',
          key: 'children_loan',
          width: 100,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (ag: string) => {
            if (ag === 'sum') {
              return renderSumValue(ageGroupKeys.map(k => `children_${k}_loan`), 'visitor')
            }
            return renderPredictionValue(`children_${ag}_loan`, 'visitor')
          }
        },
        {
          title: '관내열람',
          dataIndex: 'children_read',
          key: 'children_read',
          width: 100,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (ag: string) => {
            if (ag === 'sum') {
              return renderSumValue(ageGroupKeys.map(k => `children_${k}_read`), 'visitor')
            }
            return renderPredictionValue(`children_${ag}_read`, 'visitor')
          }
        }
      ]
    },
    {
      title: '유아자료실',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        {
          title: '관외대출',
          dataIndex: 'infant_loan',
          key: 'infant_loan',
          width: 100,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (ag: string) => {
            if (ag === 'sum') {
              return renderSumValue(ageGroupKeys.map(k => `infant_${k}_loan`), 'visitor')
            }
            return renderPredictionValue(`infant_${ag}_loan`, 'visitor')
          }
        },
        {
          title: '관내열람',
          dataIndex: 'infant_read',
          key: 'infant_read',
          width: 100,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (ag: string) => {
            if (ag === 'sum') {
              return renderSumValue(ageGroupKeys.map(k => `infant_${k}_read`), 'visitor')
            }
            return renderPredictionValue(`infant_${ag}_read`, 'visitor')
          }
        }
      ]
    }
  ]

  const materialData = useMemo(() => {
    return [
      { key: 0, type: 'loan', label: '대출' },
      { key: 1, type: 'reading', label: '열람' },
      { key: 2, type: 'sum', label: '계' }
    ]
  }, [])

  const subjectCodes = ['000', '100', '200', '300', '400', '500', '600', '700', '800', '900', 'etc']

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
      title: code === 'etc' ? '기타' : `${code.replace(/^0+/, '') || '총류'}\n(${code})`,
      dataIndex: code,
      key: code,
      width: 80,
      align: 'center' as const,
      onHeaderCell: headerStyle,
      render: (_: any, record: any) => {
        if (record.type === 'sum') {
          return renderSumValue([`${code}_loan`, `${code}_reading`], 'material')
        }
        const key = `${code}_${record.type}`
        return renderPredictionValue(key, 'material')
      }
    })),
    {
      title: '합계',
      key: 'total',
      width: 80,
      align: 'center' as const,
      onHeaderCell: headerStyle,
      render: (_: any, record: any) => {
        const allKeys = subjectCodes.map(code => `${code}_${record.type}`)
        if (record.type === 'sum') {
          const loanKeys = subjectCodes.map(code => `${code}_loan`)
          const readingKeys = subjectCodes.map(code => `${code}_reading`)
          return renderSumValue([...loanKeys, ...readingKeys], 'material')
        }
        return renderSumValue(allKeys, 'material')
      }
    }
  ]

  const programData = useMemo(() => {
    return [{ key: 0, type: 'prediction' }]
  }, [])

  const programColumns: ColumnsType<any> = [
    {
      title: '동화체험',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', key: 'storytelling_count', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('storytelling_count', 'program') },
        { title: '인원', key: 'storytelling_people', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('storytelling_people', 'program') }
      ]
    },
    {
      title: '도서관\n나들이',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', key: 'library_tour_count', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('library_tour_count', 'program') },
        { title: '인원', key: 'library_tour_people', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('library_tour_people', 'program') }
      ]
    },
    {
      title: '영어북클럽',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', key: 'english_count', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('english_count', 'program') },
        { title: '인원', key: 'english_people', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('english_people', 'program') }
      ]
    },
    {
      title: '책꾸러미',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', key: 'book_package_count', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('book_package_count', 'program') },
        { title: '인원', key: 'book_package_people', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('book_package_people', 'program') }
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
      title: '기타',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', key: 'etc_count', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('etc_count', 'program') },
        { title: '인원', key: 'etc_people', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('etc_people', 'program') }
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

  const aiLibraryData = useMemo(() => {
    return [{ key: 0, type: 'prediction' }]
  }, [])

  const aiLibraryColumns: ColumnsType<any> = [
    { title: '책봇\n(로미)', key: 'bookbot', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('bookbot', 'ai_library') },
    { title: '에어\n프로젝션', key: 'air_projection', width: 70, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('air_projection', 'ai_library') },
    { title: '핑거\n스토리', key: 'finger_story', width: 70, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('finger_story', 'ai_library') },
    { title: 'AR북', key: 'ar_book', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('ar_book', 'ai_library') },
    {
      title: '1일출입증',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '유아(남)', key: 'pass_infant_m', width: 55, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('pass_infant_m', 'ai_library') },
        { title: '유아(여)', key: 'pass_infant_f', width: 55, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('pass_infant_f', 'ai_library') },
        { title: '초등(남)', key: 'pass_elementary_m', width: 55, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('pass_elementary_m', 'ai_library') },
        { title: '초등(여)', key: 'pass_elementary_f', width: 55, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('pass_elementary_f', 'ai_library') },
        { title: '중고등(남)', key: 'pass_middle_m', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('pass_middle_m', 'ai_library') },
        { title: '중고등(여)', key: 'pass_middle_f', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('pass_middle_f', 'ai_library') },
        { title: '일반(남)', key: 'pass_adult_m', width: 55, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('pass_adult_m', 'ai_library') },
        { title: '일반(여)', key: 'pass_adult_f', width: 55, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('pass_adult_f', 'ai_library') }
      ]
    },
    {
      title: '무인반납실',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '이용자수', key: 'unmanned_users', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('unmanned_users', 'ai_library') },
        { title: '이용권수', key: 'unmanned_books', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('unmanned_books', 'ai_library') }
      ]
    },
    {
      title: '합계',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '이용자수', key: 'total_users', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('total_users', 'ai_library') },
        { title: '이용권수', key: 'total_books', width: 60, align: 'center' as const, onHeaderCell: headerStyle, render: () => renderPredictionValue('total_books', 'ai_library') }
      ]
    }
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
          description="이 월은 이미 지났습니다. 예측값과 실제값의 비교를 표시합니다. 녹색은 정확, 노란색은 근접, 빨간색은 오차를 나타냅니다."
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
          어린이자료실 예측 현황
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
                <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 인공지능 미래형 도서관 예측</span>
                <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
              </div>
              <Table
                className="prediction-table"
                dataSource={aiLibraryData}
                columns={aiLibraryColumns}
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
