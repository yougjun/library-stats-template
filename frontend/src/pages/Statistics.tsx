import { useState, useEffect } from 'react'
import { Card, Table, Button, message, DatePicker } from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import { statsApi } from '../services/api'
import dayjs, { Dayjs } from 'dayjs'
import axios from 'axios'
import { getErrorMessage } from '../utils/errorHandler'
import { DOWNLOAD_FILENAME } from '../config/library'

interface StatsData {
  floor1_visitor: any[]
  floor1_material: any[]
  floor1_program: any[]
  floor23_visitor: any[]
  floor23_material_type: any[]
  floor23_material_subject: any[]
}

export default function Statistics() {
  const { yearMonth } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs(yearMonth))

  useEffect(() => {
    loadData()
  }, [yearMonth])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await statsApi.getMonthly(yearMonth!)
      setData(res.data)
    } catch (error: unknown) {
      console.error('Failed to load data:', error)
      message.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadExcel = async () => {
    setDownloading(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
      const response = await axios.get(
        `${apiUrl}/api/excel/download/${yearMonth}`,
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
      navigate(`/statistics/${newYearMonth}`)
    }
  }

  const getRoomTypeLabel = (type: string) => {
    return type === 'children' ? '어린이자료실' : '유아자료실'
  }

  const getAgeGroupLabel = (age: string) => {
    const labels: Record<string, string> = {
      'infant_elementary': '유아/초등',
      'middle_high': '중고생',
      'adult': '성인'
    }
    return labels[age] || age
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'loan': '대출',
      'reference': '참고봉사',
      'facility': '시설이용'
    }
    return labels[category] || category
  }

  const floor1Columns = [
    {
      title: '자료실',
      dataIndex: 'room_type',
      key: 'room_type',
      render: (text: string) => getRoomTypeLabel(text)
    },
    {
      title: '연령대',
      dataIndex: 'age_group',
      key: 'age_group',
      render: (text: string) => getAgeGroupLabel(text)
    },
    { title: '이용자 수', dataIndex: 'user_count', key: 'user_count' }
  ]

  const floor1MaterialColumns = [
    { title: '이용 유형', dataIndex: 'usage_type', key: 'usage_type' },
    { title: '주제 코드', dataIndex: 'subject_code', key: 'subject_code' },
    { title: '도서 수', dataIndex: 'book_count', key: 'book_count' }
  ]

  const floor1ProgramColumns = [
    { title: '프로그램명', dataIndex: 'program_name', key: 'program_name' },
    { title: '횟수', dataIndex: 'session_count', key: 'session_count' },
    { title: '인원', dataIndex: 'participant_count', key: 'participant_count' },
    { title: '도서 수', dataIndex: 'book_count', key: 'book_count' }
  ]

  const floor23Columns = [
    {
      title: '연령대',
      dataIndex: 'age_group',
      key: 'age_group',
      render: (text: string) => getAgeGroupLabel(text)
    },
    {
      title: '카테고리',
      dataIndex: 'category',
      key: 'category',
      render: (text: string) => getCategoryLabel(text)
    },
    { title: '이용자 수', dataIndex: 'user_count', key: 'user_count' }
  ]

  const floor23MaterialSubjectColumns = [
    { title: '이용 유형', dataIndex: 'usage_type', key: 'usage_type' },
    { title: '주제 코드', dataIndex: 'subject_code', key: 'subject_code' },
    { title: '도서 수', dataIndex: 'book_count', key: 'book_count' }
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, alignItems: 'center' }}>
        <h1>통계 조회 - {yearMonth}</h1>
        <DatePicker
          picker="month"
          value={selectedMonth}
          onChange={handleMonthChange}
          format="YYYY-MM"
        />
      </div>

      <Card title="통계 페이지 바로가기" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, flexDirection: 'column' }}>
          <Button
            type="primary"
            size="large"
            onClick={() => navigate(`/statistics/knowledge/${yearMonth}`)}
            block
          >
            지식정보기반과 이용 현황
          </Button>
          <Button
            type="primary"
            size="large"
            onClick={() => navigate(`/statistics/floor23/${yearMonth}`)}
            block
          >
            종합,인문예술자료실 이용 현황
          </Button>
          <Button
            type="primary"
            size="large"
            onClick={() => navigate(`/statistics/floor1/${yearMonth}`)}
            block
          >
            어린이자료실 이용 현황
          </Button>
        </div>
      </Card>

      <Button
        type="default"
        size="large"
        style={{ marginTop: 24 }}
        onClick={handleDownloadExcel}
        loading={downloading}
      >
        전체 엑셀 다운로드
      </Button>
    </div>
  )
}
