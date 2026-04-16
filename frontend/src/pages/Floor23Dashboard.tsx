import { useState, useEffect } from 'react'
import { Card, Table, Button, Tag, Space, Row, Col, message, Collapse, DatePicker } from 'antd'
import { useNavigate } from 'react-router-dom'
import { EditOutlined, BarChartOutlined, CalendarOutlined, SettingOutlined, LineChartOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, SwapOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import axios from 'axios'
import dayjs, { Dayjs } from 'dayjs'
import SessionTimer from '../components/SessionTimer'
import { isAccessCodeSession, getDefaultStatsMonth } from '../utils/libraryDays'
import { useAuthStore } from '../store/authStore'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { io } from 'socket.io-client'
import ChartContainer from '../components/charts/ChartContainer'
import ComparisonChart from '../components/charts/ComparisonChart'
import ModelSelector from '../components/dashboard/ModelSelector'
import { getErrorMessage } from '../utils/errorHandler'
import ChartMaximizedModal from '../components/dashboard/ChartMaximizedModal'
import MaximizedChart from '../components/charts/MaximizedChart'
import { useDashboardStore } from '../store/dashboardStore'

interface MonthlyData {
  year_month: string
  last_updated: string | null
  updated_by: string | null
  visitor_count: number
  material_count: number
  program_count: number
  program_session_count: number
  program_participant_count: number
  ai_smart_users: number
  ai_smart_items: number
  ai_equipment_users: number
  ai_equipment_total: number
  has_data: boolean
  is_completed: boolean
  manual_status: boolean | null
}

export default function Floor23Dashboard() {
  const navigate = useNavigate()
  const { token, role } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [data, setData] = useState<MonthlyData[]>([])
  const [selectedYear, setSelectedYear] = useState<Dayjs>(dayjs())
  const currentYear = selectedYear.year()

  const { selectedModel, predictionData, loading: predictionLoading, fetchPredictions, maximizedChart, maximizeChart } = useDashboardStore()
  const [localMaximizedChart, setLocalMaximizedChart] = useState<string | null>(null)
  const [hasFetchedPredictions, setHasFetchedPredictions] = useState(false)

  const [visitorChartMode, setVisitorChartMode] = useState<'actual' | 'prediction' | 'both'>('actual')

  const ensurePredictions = () => {
    if (!hasFetchedPredictions && token && Object.keys(predictionData.visitor).length === 0) {
      setHasFetchedPredictions(true)
      fetchPredictions('floor23', token)
    }
  }

  useEffect(() => {
    loadMonthlyData()
  }, [selectedYear])

  useEffect(() => {
    const handleFocus = () => {
      loadMonthlyData()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  useEffect(() => {
    if (window.location.hostname.includes('github.io')) return

    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      auth: {
        token: token
      },
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 10000
    })

    socket.on('connect_error', (error) => {
      console.error('Socket connect error:', error.message)
    })

    socket.on('error', (error) => {
      console.error('Socket error:', error)
    })

    socket.on('floor23_completion_status_updated', (data) => {
      const { year_month, is_completed, updated_by } = data

      if (year_month.startsWith(currentYear.toString())) {
        setRemoteLoading(true)
        setData(prev => prev.map(item =>
          item.year_month === year_month
            ? { ...item, is_completed, manual_status: true, updated_by }
            : item
        ))
        setTimeout(() => setRemoteLoading(false), 300)
      }
    })

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        socket.connect()
      }
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [currentYear, token])

  const handleYearChange = (date: Dayjs | null) => {
    if (date) {
      setSelectedYear(date)
    }
  }

  const loadMonthlyData = async () => {
    if (window.location.hostname.includes('github.io')) {
      const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
      setData(months.map(month => ({
        year_month: `${currentYear}-${month}`,
        last_updated: null,
        updated_by: null,
        visitor_count: 0,
        material_count: 0,
        program_count: 0,
        program_session_count: 0,
        program_participant_count: 0,
        ai_smart_users: 0,
        ai_smart_items: 0,
        ai_equipment_users: 0,
        ai_equipment_total: 0,
        has_data: false,
        is_completed: false,
        manual_status: null
      })))
      return
    }
    setLoading(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
      const response = await axios.get(`${apiUrl}/api/floor23/metadata/year/${currentYear}`)
      const metadataByMonth = response.data

      const monthlyData = Object.keys(metadataByMonth).sort().map(yearMonth => {
        const statusKey = `floor23_completion_${yearMonth}`
        const sessionStatus = sessionStorage.getItem(statusKey)
        const item = metadataByMonth[yearMonth]

        if (sessionStatus === 'true') {
          return {
            year_month: yearMonth,
            ...item,
            is_completed: true,
            manual_status: true
          }
        }
        return {
          year_month: yearMonth,
          ...item
        }
      })

      setData(monthlyData)
    } catch (error: unknown) {
      console.error('Load error:', error)
      message.error(getErrorMessage(error))
      const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
      const emptyData = months.map(month => ({
        year_month: `${currentYear}-${month}`,
        last_updated: null,
        updated_by: null,
        visitor_count: 0,
        material_count: 0,
        program_count: 0,
        program_session_count: 0,
        program_participant_count: 0,
        ai_smart_users: 0,
        ai_smart_items: 0,
        ai_equipment_users: 0,
        ai_equipment_total: 0,
        has_data: false,
        is_completed: false,
        manual_status: null
      }))
      setData(emptyData)
    } finally {
      setLoading(false)
    }
  }

  const toggleCompletionStatus = async (yearMonth: string, currentStatus: boolean) => {
    const newStatus = !currentStatus
    const statusKey = `floor23_completion_${yearMonth}`

    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
      await axios.post(
        `${apiUrl}/api/floor23/completion-status/${yearMonth}`,
        { is_completed: newStatus },
        {
          headers: {
            Authorization: `Bearer ${useAuthStore.getState().token}`
          }
        }
      )

      if (newStatus) {
        sessionStorage.setItem(statusKey, 'true')
      } else {
        sessionStorage.removeItem(statusKey)
      }

      setData(prev => prev.map(item =>
        item.year_month === yearMonth
          ? { ...item, is_completed: newStatus, manual_status: true }
          : item
      ))

      message.success(`${yearMonth} 상태가 ${newStatus ? '입력완료' : '미입력'}로 변경되었습니다`)
    } catch (error: unknown) {
      console.error('Failed to update completion status:', error)
      message.error(getErrorMessage(error))
    }
  }

  const columns: ColumnsType<MonthlyData> = [
    {
      title: '월',
      dataIndex: 'year_month',
      key: 'year_month',
      width: 100,
      align: 'center',
      render: (text: string) => {
        const month = text.split('-')[1]
        return <strong>{parseInt(month)}월</strong>
      }
    },
    {
      title: '상태',
      key: 'status',
      width: 140,
      align: 'center',
      render: (_: any, record: MonthlyData) => {
        const isCompleted = record.is_completed
        const hasManualStatus = record.manual_status !== null

        return (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Tag
              color={isCompleted ? "green" : "default"}
              style={{ width: '80px', textAlign: 'center', margin: 0 }}
            >
              {isCompleted ? '입력완료' : '미입력'}
            </Tag>
            <Button
              size="small"
              type={hasManualStatus ? "default" : "dashed"}
              icon={isCompleted ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
              onClick={() => toggleCompletionStatus(record.year_month, isCompleted)}
              title={hasManualStatus ? "수동 설정됨 (클릭하여 토글)" : "자동 감지 중 (클릭하여 수동 설정)"}
              style={{ width: '80px' }}
            >
              변경
            </Button>
          </Space>
        )
      }
    },
    {
      title: '데이터 현황',
      key: 'data_summary',
      render: (_: any, record: MonthlyData) => (
        <Space size="small" direction="vertical" style={{ fontSize: '12px' }}>
          <Space size="small">
            <span>이용자: {record.visitor_count.toLocaleString()}</span>
            <span>자료: {record.material_count.toLocaleString()}</span>
          </Space>
          <Space size="small">
            <span>프로그램횟수: {(record.program_session_count || 0).toLocaleString()}</span>
            <span>프로그램인원: {(record.program_participant_count || 0).toLocaleString()}</span>
          </Space>
          <Space size="small">
            <span>스마트 2층: {(record.ai_smart_users || 0).toLocaleString()}명</span>
            <span>스마트 3층: {(record.ai_equipment_total || 0).toLocaleString()}회</span>
          </Space>
        </Space>
      )
    },
    {
      title: '최종 수정일',
      dataIndex: 'last_updated',
      key: 'last_updated',
      width: 180,
      render: (text: string | null) => {
        if (!text) return <span style={{ color: '#999' }}>-</span>
        return dayjs(text).format('YYYY-MM-DD HH:mm:ss')
      }
    },
    {
      title: '수정자',
      dataIndex: 'updated_by',
      key: 'updated_by',
      width: 120,
      render: (text: string | null) => {
        if (!text) return <span style={{ color: '#999' }}>-</span>
        return <Tag color="blue">{text}</Tag>
      }
    },
    {
      title: '작업',
      key: 'action',
      width: 200,
      align: 'center',
      render: (_: any, record: MonthlyData) => (
        <Space>
          <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/floor23/input/${record.year_month}`)}
            >
              입력
            </Button>
          <Button
            size="small"
            icon={<LineChartOutlined />}
            onClick={() => navigate(`/prediction?month=${record.year_month}&floor=floor23`)}
            disabled={record.is_completed}
            type={record.is_completed ? "default" : "default"}
          >
            예측
          </Button>
          <Button
            size="small"
            icon={<BarChartOutlined />}
            onClick={() => navigate(`/statistics/floor23/${record.year_month}`)}
          >
            통계
          </Button>
        </Space>
      )
    }
  ]

  const chartData = data.map(item => ({
    month: item.year_month.split('-')[1] + '월',
    이용자: item.visitor_count,
    자료: item.material_count,
    프로그램횟수: item.program_session_count || 0,
    프로그램인원: item.program_participant_count || 0,
    스마트2층: item.ai_smart_users || 0,
    스마트3층: item.ai_equipment_total || 0
  }))

  return (
    <div style={{ padding: 24 }}>
      {isAccessCodeSession() && <SessionTimer />}

      <Card
        title={
          <Space>
            <CalendarOutlined />
            <span>2/3층 종합·인문예술자료실 - {currentYear}년 데이터 관리</span>
            <DatePicker
              picker="year"
              value={selectedYear}
              onChange={handleYearChange}
              format="YYYY"
              style={{ width: 100 }}
            />
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<SwapOutlined />}
              onClick={() => navigate('/floor1/dashboard')}
              type="dashed"
            >
              1층 이동
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadMonthlyData()}
              loading={loading}
            >
              새로고침
            </Button>
            <Button
              icon={<LineChartOutlined />}
              onClick={() => navigate(`/statistics/floor23/${getDefaultStatsMonth('floor23')}`)}
            >
              월별 통계
            </Button>
            <Button
              icon={<BarChartOutlined />}
              onClick={() => navigate(`/statistics/yearly-floor23/${currentYear}`)}
            >
              연간 통계
            </Button>
            <Button
              icon={<SettingOutlined />}
              onClick={() => navigate('/settings')}
            >
              설정
            </Button>
          </Space>
        }
      >
        <Collapse
          defaultActiveKey={[]}
          style={{ marginBottom: 16 }}
          items={[
            ...(Object.keys(predictionData.visitor).length > 0 ? [{
              key: 'model-selector',
              label: '🔮 예측 모델 선택',
              children: <ModelSelector loading={predictionLoading} />
            }] : []),
            {
              key: 'charts',
              label: '📊 월별 통계 차트',
              children: (
                <>
                  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col span={12}>
                      <ChartContainer
                        title="월별 이용자 및 자료 현황"
                        chartId="visitor-material-chart"
                        showPredictionToggle={true}
                        dataMode={visitorChartMode}
                        onDataModeChange={(mode) => {
                          setVisitorChartMode(mode)
                          if (mode !== 'actual') ensurePredictions()
                        }}
                        onMaximize={() => setLocalMaximizedChart('visitor-material-chart')}
                      >
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart data={(() => {
                            const merged: Array<{
                              month: string
                              실제_이용자: number | null
                              실제_자료: number | null
                              예측_이용자: number | null
                              예측_자료: number | null
                            }> = chartData.map(d => ({
                              month: d.month,
                              실제_이용자: d.이용자,
                              실제_자료: d.자료,
                              예측_이용자: null,
                              예측_자료: null
                            }))

                            if (visitorChartMode !== 'actual') {
                              const visitorPred = predictionData.visitor[selectedModel]
                              const materialPred = predictionData.material[selectedModel]

                              visitorPred?.predictions?.filter(pred => pred.year_month.startsWith(currentYear.toString())).forEach(pred => {
                                const predMonth = pred.year_month.split('-')[1] + '월'
                                const existing = merged.find(m => m.month === predMonth)
                                if (existing) {
                                  existing.예측_이용자 = pred.predicted_value
                                }
                              })

                              materialPred?.predictions?.filter(pred => pred.year_month.startsWith(currentYear.toString())).forEach(pred => {
                                const predMonth = pred.year_month.split('-')[1] + '월'
                                const existing = merged.find(m => m.month === predMonth)
                                if (existing) {
                                  existing.예측_자료 = pred.predicted_value
                                }
                              })

                              merged.sort((a, b) => a.month.localeCompare(b.month))
                            }

                            return merged
                          })()}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            {visitorChartMode !== 'prediction' && (
                              <>
                                <Line type="monotone" dataKey="실제_이용자" stroke="#8884d8" strokeWidth={2} name="실제 이용자" dot={{ r: 4 }} />
                                <Line type="monotone" dataKey="실제_자료" stroke="#82ca9d" strokeWidth={2} name="실제 자료" dot={{ r: 4 }} />
                              </>
                            )}
                            {visitorChartMode !== 'actual' && (
                              <>
                                <Line type="monotone" dataKey="예측_이용자" stroke="#8884d8" strokeWidth={2} strokeDasharray="5 5" name="예측 이용자" dot={{ r: 4, fill: '#8884d8' }} />
                                <Line type="monotone" dataKey="예측_자료" stroke="#82ca9d" strokeWidth={2} strokeDasharray="5 5" name="예측 자료" dot={{ r: 4, fill: '#82ca9d' }} />
                              </>
                            )}
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </Col>
                    <Col span={12}>
                      <ChartContainer
                        title="월별 프로그램 현황 (횟수/인원)"
                        chartId="program-chart"
                        onMaximize={() => setLocalMaximizedChart('program-chart')}
                      >
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="프로그램횟수" fill="#8884d8" name="횟수" />
                            <Bar dataKey="프로그램인원" fill="#ffc658" name="인원" />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col span={24}>
                      <ChartContainer
                        title="월별 미래형 도서관 현황 (스마트 2층/스마트 3층)"
                        chartId="smart-library-chart"
                        onMaximize={() => setLocalMaximizedChart('smart-library-chart')}
                      >
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="스마트2층" fill="#82ca9d" name="스마트 2층(문학자판기+무인회원증+스마트도서관)" />
                            <Bar dataKey="스마트3층" fill="#ff7c7c" name="스마트 3층(책봇+키오스크+노트북+태블릿+북스캐너+전자신문)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </Col>
                  </Row>
                </>
              )
            }
          ]}
        />

        <Collapse
          defaultActiveKey={['table']}
          style={{ marginBottom: 16 }}
          items={[
            {
              key: 'table',
              label: '📋 월별 데이터 현황',
              children: (
                <Table
                  loading={loading || remoteLoading}
                  columns={columns}
                  dataSource={data}
                  pagination={false}
                  rowKey="year_month"
                  size="middle"
                />
              )
            }
          ]}
        />
      </Card>

      {/* Chart Maximized Modal */}
      <ChartMaximizedModal
        visible={localMaximizedChart !== null}
        title={
          localMaximizedChart === 'visitor-material-chart' ? '월별 이용자 및 자료 현황' :
          localMaximizedChart === 'program-chart' ? '월별 프로그램 현황 (횟수/인원)' :
          localMaximizedChart === 'smart-library-chart' ? '월별 미래형 도서관 현황 (스마트 2층/스마트 3층)' :
          '차트'
        }
        onClose={() => setLocalMaximizedChart(null)}
        showPredictionToggle={localMaximizedChart === 'visitor-material-chart'}
        dataMode={visitorChartMode}
        onDataModeChange={(mode) => {
          setVisitorChartMode(mode)
          if (mode !== 'actual') ensurePredictions()
        }}
        chartData={(() => {
          if (localMaximizedChart === 'visitor-material-chart') {
            const merged = chartData.map(d => ({
              month: d.month,
              실제_이용자: d.이용자,
              실제_자료: d.자료,
              예측_이용자: null as number | null,
              예측_자료: null as number | null
            }))

            if (visitorChartMode !== 'actual') {
              const visitorPred = predictionData.visitor[selectedModel]
              const materialPred = predictionData.material[selectedModel]

              visitorPred?.predictions?.filter(pred => pred.year_month.startsWith(currentYear.toString())).forEach(pred => {
                const predMonth = pred.year_month.split('-')[1] + '월'
                const existing = merged.find(m => m.month === predMonth)
                if (existing) {
                  existing.예측_이용자 = pred.predicted_value
                }
              })

              materialPred?.predictions?.filter(pred => pred.year_month.startsWith(currentYear.toString())).forEach(pred => {
                const predMonth = pred.year_month.split('-')[1] + '월'
                const existing = merged.find(m => m.month === predMonth)
                if (existing) {
                  existing.예측_자료 = pred.predicted_value
                }
              })
            }
            return merged
          }
          return chartData
        })()}
      >
        {localMaximizedChart === 'visitor-material-chart' && (() => {
          const merged = chartData.map(d => ({
            month: d.month,
            실제_이용자: d.이용자,
            실제_자료: d.자료,
            예측_이용자: null as number | null,
            예측_자료: null as number | null
          }))

          if (visitorChartMode !== 'actual') {
            const visitorPred = predictionData.visitor[selectedModel]
            const materialPred = predictionData.material[selectedModel]

            visitorPred?.predictions?.filter(pred => pred.year_month.startsWith(currentYear.toString())).forEach(pred => {
              const predMonth = pred.year_month.split('-')[1] + '월'
              const existing = merged.find(m => m.month === predMonth)
              if (existing) {
                existing.예측_이용자 = pred.predicted_value
              }
            })

            materialPred?.predictions?.filter(pred => pred.year_month.startsWith(currentYear.toString())).forEach(pred => {
              const predMonth = pred.year_month.split('-')[1] + '월'
              const existing = merged.find(m => m.month === predMonth)
              if (existing) {
                existing.예측_자료 = pred.predicted_value
              }
            })
          }

          const lines = []
          if (visitorChartMode !== 'prediction') {
            lines.push(
              { dataKey: '실제_이용자', stroke: '#8884d8', strokeWidth: 3, name: '실제 이용자', dot: { r: 5 } },
              { dataKey: '실제_자료', stroke: '#82ca9d', strokeWidth: 3, name: '실제 자료', dot: { r: 5 } }
            )
          }
          if (visitorChartMode !== 'actual') {
            lines.push(
              { dataKey: '예측_이용자', stroke: '#8884d8', strokeWidth: 3, strokeDasharray: '5 5', name: '예측 이용자', dot: { r: 5, fill: '#8884d8' } },
              { dataKey: '예측_자료', stroke: '#82ca9d', strokeWidth: 3, strokeDasharray: '5 5', name: '예측 자료', dot: { r: 5, fill: '#82ca9d' } }
            )
          }

          return <MaximizedChart type="line" data={merged} lines={lines} />
        })()}
        {localMaximizedChart === 'program-chart' && (
          <MaximizedChart
            type="bar"
            data={chartData}
            bars={[
              { dataKey: '프로그램횟수', fill: '#8884d8', name: '횟수' },
              { dataKey: '프로그램인원', fill: '#ffc658', name: '인원' }
            ]}
          />
        )}
        {localMaximizedChart === 'smart-library-chart' && (
          <MaximizedChart
            type="bar"
            data={chartData}
            bars={[
              { dataKey: '스마트2층', fill: '#82ca9d', name: '스마트 2층(문학자판기+무인회원증+스마트도서관)' },
              { dataKey: '스마트3층', fill: '#ff7c7c', name: '스마트 3층(책봇+키오스크+노트북+태블릿+북스캐너+전자신문)' }
            ]}
          />
        )}
      </ChartMaximizedModal>
    </div>
  )
}
