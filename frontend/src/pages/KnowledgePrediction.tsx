import { useState } from 'react'
import { Card, Table, DatePicker, Alert, Button, Space, Statistic, Row, Col, Divider } from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowRightOutlined, BarChartOutlined, LineChartOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import PredictionNavigation from '../components/prediction/PredictionNavigation'
import SessionTimer from '../components/SessionTimer'
import { isAccessCodeSession } from '../utils/libraryDays'
import '../styles/table.css'

export default function KnowledgePrediction() {
  const { yearMonth } = useParams()
  const navigate = useNavigate()
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs(yearMonth))

  const currentMonth = dayjs().format('YYYY-MM')
  const nextMonth = dayjs().add(1, 'month').format('YYYY-MM')

  const handleMonthChange = (date: Dayjs | null) => {
    if (date) {
      const newYearMonth = date.format('YYYY-MM')
      setSelectedMonth(date)
      navigate(`/prediction/knowledge/${newYearMonth}`)
    }
  }

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

      <div style={{ marginBottom: 16 }}>
        <PredictionNavigation yearMonth={yearMonth || ''} />
      </div>

      <Card style={{ marginBottom: 24, border: '2px solid #1890ff' }}>
        <h1 style={{ textAlign: 'center', margin: '0 0 16px 0', color: '#1890ff' }}>
          지식정보기반과 예측 현황
        </h1>

        <Alert
          message="통합 예측 페이지"
          description="지식정보기반과의 통계는 어린이자료실(1층)과 종합·인문예술자료실(2-3층)의 데이터를 통합합니다. 각 층별 상세 예측은 아래 버튼을 통해 확인하세요."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Row gutter={[24, 24]}>
          <Col xs={24} md={12}>
            <Card
              hoverable
              onClick={() => navigate(`/prediction/floor1/${yearMonth}`)}
              style={{ textAlign: 'center', cursor: 'pointer' }}
            >
              <Statistic
                title="어린이자료실 (1층)"
                value="예측 보기"
                prefix={<BarChartOutlined />}
                valueStyle={{ color: '#1890ff', fontSize: 20 }}
              />
              <Divider />
              <div style={{ color: '#666', fontSize: 13 }}>
                <p>• 이용자 현황 예측</p>
                <p>• 자료 이용 현황 예측</p>
                <p>• 행사 및 프로그램 예측</p>
              </div>
              <Button type="primary" icon={<ArrowRightOutlined />}>
                1층 예측 페이지로 이동
              </Button>
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card
              hoverable
              onClick={() => navigate(`/prediction/floor23/${yearMonth}`)}
              style={{ textAlign: 'center', cursor: 'pointer' }}
            >
              <Statistic
                title="종합·인문예술자료실 (2-3층)"
                value="예측 보기"
                prefix={<LineChartOutlined />}
                valueStyle={{ color: '#52c41a', fontSize: 20 }}
              />
              <Divider />
              <div style={{ color: '#666', fontSize: 13 }}>
                <p>• 이용자 현황 예측</p>
                <p>• 자료 이용 현황 예측 (주제별)</p>
                <p>• 스마트도서관 예측</p>
              </div>
              <Button type="primary" icon={<ArrowRightOutlined />} style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}>
                2-3층 예측 페이지로 이동
              </Button>
            </Card>
          </Col>
        </Row>

        <Divider />

        <Card type="inner" title="예측 대상 기간" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Statistic
                title="이번 달"
                value={currentMonth}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="다음 달"
                value={nextMonth}
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
          </Row>
        </Card>

        <Card type="inner" title="예측 모델 안내" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: '#666' }}>
            <p><strong>모델 1: 시계열 패턴 분해 예측</strong> - 추세, 계절성, 특별 이벤트를 분리하여 분석</p>
            <p><strong>모델 2: 계절성 자기회귀 통합 이동평균</strong> - 통계적 시계열 분석 (최소 12개월 데이터 필요)</p>
            <p><strong>모델 3: 가중 평균 추세 예측</strong> - 최근 데이터에 높은 가중치를 부여</p>
          </div>
        </Card>
      </Card>
    </div>
  )
}
