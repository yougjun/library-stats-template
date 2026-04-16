import { useState, useEffect } from 'react'
import { Card, Table, Button, message, DatePicker, Tag, Space, Modal, Typography } from 'antd'
import { HistoryOutlined, RollbackOutlined, HomeOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import dayjs, { Dayjs } from 'dayjs'
import { useAuthStore } from '../store/authStore'
import { getErrorMessage } from '../utils/errorHandler'

const { Text } = Typography

interface HistoryRecord {
  id: number
  page_type: string
  year_month: string
  changed_by: string
  changed_by_display: string
  changed_at: string
}

export default function History() {
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs())
  const [detailModal, setDetailModal] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null)
  const [pageSize, setPageSize] = useState(20)

  useEffect(() => {
    loadHistory()
  }, [selectedMonth])

  const loadHistory = async () => {
    if (window.location.hostname.includes('github.io')) {
      setHistory([])
      return
    }
    setLoading(true)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
      const yearMonth = selectedMonth.format('YYYY-MM')
      const response = await axios.get(`${apiUrl}/api/history/month/${yearMonth}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setHistory(response.data)
    } catch (error: unknown) {
      console.error('Failed to load history:', error)
      message.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async (record: HistoryRecord) => {
    Modal.confirm({
      title: '데이터 복원',
      content: `${record.year_month} 월의 ${getPageDisplayName(record.page_type)} 데이터를 이 시점으로 복원하시겠습니까? 현재 데이터가 모두 덮어씌워집니다.`,
      okText: '복원',
      cancelText: '취소',
      onOk: async () => {
        try {
          const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
          await axios.post(`${apiUrl}/api/restore/${record.id}`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          })
          message.success('데이터가 복원되었습니다')
          loadHistory()
        } catch (error: unknown) {
          console.error('Failed to restore:', error)
          message.error(getErrorMessage(error))
        }
      }
    })
  }

  const getPageDisplayName = (pageType: string) => {
    const names: any = {
      'template_driven': 'Template-Driven Input',
      'template_editor': 'Template Editor'
    }
    return names[pageType] || pageType
  }

  const columns = [
    {
      title: '변경 시각',
      dataIndex: 'changed_at',
      key: 'changed_at',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '페이지',
      dataIndex: 'page_type',
      key: 'page_type',
      width: 200,
      render: (text: string) => <Tag color="blue">{getPageDisplayName(text)}</Tag>
    },
    {
      title: '변경자',
      dataIndex: 'changed_by_display',
      key: 'changed_by_display',
      width: 180,
      render: (text: string) => <Tag color="purple">{text}</Tag>
    },
    {
      title: '작업',
      key: 'action',
      width: 120,
      align: 'center' as const,
      render: (_: any, record: HistoryRecord) => (
        <Button
          size="small"
          type="primary"
          danger
          icon={<RollbackOutlined />}
          onClick={() => handleRestore(record)}
        >
          복원
        </Button>
      )
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <HistoryOutlined style={{ fontSize: 20 }} />
            <span>데이터 변경 이력</span>
          </Space>
        }
        extra={
          <Space>
            <DatePicker
              picker="month"
              value={selectedMonth}
              onChange={(date) => date && setSelectedMonth(date)}
              format="YYYY-MM"
            />
            <Button icon={<HomeOutlined />} onClick={() => navigate('/access-mode')}>
              홈으로
            </Button>
          </Space>
        }
      >
        <Table
          loading={loading}
          columns={columns}
          dataSource={history}
          rowKey="id"
          pagination={{
            pageSize: pageSize,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            onShowSizeChange: (_, size) => setPageSize(size)
          }}
          size="small"
        />
      </Card>

    </div>
  )
}
