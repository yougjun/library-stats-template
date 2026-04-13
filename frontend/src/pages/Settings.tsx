import { useState, useEffect } from 'react'
import { Button, message, DatePicker, List, Space, Input, InputNumber, Select, Modal, Form, Table, Tag, Popconfirm, Collapse, Divider, Row, Col, Upload, Tabs, Typography, Alert, Card } from 'antd'
import { DeleteOutlined, HomeOutlined, LockOutlined, PlusOutlined, EditOutlined, CopyOutlined, SettingOutlined, UserOutlined, CalendarOutlined, KeyOutlined, DownloadOutlined, UploadOutlined, CloudOutlined } from '@ant-design/icons'

import { useNavigate } from 'react-router-dom'
import dayjs, { Dayjs } from 'dayjs'
import 'dayjs/locale/ko'
import axios from 'axios'
import { isAccessCodeSession, endAccessSession, setHolidays as setHolidaysLS, setLibraryYearStartDate } from '../utils/libraryDays'
import { getErrorMessage, isAxiosError } from '../utils/errorHandler'
import { useAuthStore } from '../store/authStore'
import { settingsApi, adminApi, automationApi, siteAuthApi, templateApi, type AdminRecord } from '../services/api'
import { useFetchWeather } from '../hooks/useWeatherQueries'
import { DOWNLOAD_FILENAME } from '../config/library'

dayjs.locale('ko')

const { Text } = Typography

interface HolidayEntry {
  start_date: string
  end_date: string
  condition?: string
}

export default function Settings() {
  const navigate = useNavigate()
  const { token, role } = useAuthStore()

  const [holidays, setHolidaysState] = useState<HolidayEntry[]>([])
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null)
  const [selectedEndDate, setSelectedEndDate] = useState<Dayjs | null>(null)
  const [holidayCondition, setHolidayCondition] = useState<string>('')
  const [libraryYearStart, setLibraryYearStart] = useState<Dayjs | null>(null)
  const [fetchingHolidays, setFetchingHolidays] = useState(false)
  const [holidayYear, setHolidayYear] = useState<number>(new Date().getFullYear())
  const [holidayApiServiceKey, setHolidayApiServiceKey] = useState<string>('')

  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm] = Form.useForm()

  const [admins, setAdmins] = useState<AdminRecord[]>([])
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<AdminRecord | null>(null)
  const [adminForm] = Form.useForm()
  const [loadingAdmins, setLoadingAdmins] = useState(false)

  const [weatherDateRange, setWeatherDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null])
  const [weatherStationId, setWeatherStationId] = useState<number>(131)
  const { mutate: fetchWeatherData, isPending: isFetchingWeather } = useFetchWeather()

  const [automationInfo, setAutomationInfo] = useState<{ exists: boolean; size: number; modified: string | null }>({ exists: false, size: 0, modified: null })
  const [uploadingAutomation, setUploadingAutomation] = useState(false)

  useEffect(() => {
    if (token) {
      loadSettings()
      loadAdmins()
      loadAutomationInfo()
    }
  }, [token])

  const loadAutomationInfo = async () => {
    if (!token) return
    try {
      const response = await automationApi.getInfo()
      setAutomationInfo(response.data)
    } catch (error: unknown) {
      console.error('Failed to load automation info:', error)
    }
  }

  const loadSettings = async () => {
    if (!token) return
    try {
      const response = await settingsApi.get()
      const data = response.data
      setHolidaysState(data.holidays)
      setLibraryYearStart(dayjs(data.library_year_start_date))
      setHolidaysLS(data.holidays)
      setLibraryYearStartDate(data.library_year_start_date)
      setHolidayApiServiceKey(data.holiday_api_service_key || '')
    } catch (error: unknown) {
      if (!isAxiosError(error) || error.response?.status !== 401) {
        console.error('Failed to load settings:', error)
        message.error(getErrorMessage(error) || 'Failed to load settings')
      }
    }
  }

  const loadAdmins = async () => {
    if (!token) return
    try {
      setLoadingAdmins(true)
      const response = await adminApi.list()
      setAdmins(response.data)
    } catch (error: unknown) {
      if (!isAxiosError(error) || error.response?.status !== 401) {
        console.error('Failed to load admins:', error)
        message.error('Failed to load admin list')
      }
    } finally {
      setLoadingAdmins(false)
    }
  }

  const handleCreateAdmin = () => {
    setEditingAdmin(null)
    adminForm.resetFields()
    setShowAdminModal(true)
  }

  const handleEditAdmin = (admin: AdminRecord) => {
    setEditingAdmin(admin)
    adminForm.setFieldsValue({
      name: admin.name,
      role: admin.role || 'admin',
      description: admin.description,
      is_active: admin.is_active
    })
    setShowAdminModal(true)
  }

  const handleAdminSubmit = async (values: any) => {
    if (!token) {
      message.error('Login required')
      return
    }
    try {
      if (editingAdmin) {
        const updateData = { ...values }
        if (!updateData.code || updateData.code === '') {
          delete updateData.code
        }
        await adminApi.update(editingAdmin.id, updateData)
        message.success('Admin updated')
      } else {
        const response = await adminApi.create(values)
        message.success(`Admin created. Access code: ${response.data.code}`)
      }

      setShowAdminModal(false)
      adminForm.resetFields()
      loadAdmins()
    } catch (error: unknown) {
      console.error('Admin save error:', error)
      let errorMessage = 'Failed to save admin'

      if (isAxiosError(error)) {
        const data = error.response?.data as { detail?: unknown } | undefined
        const detail = data?.detail
        if (typeof detail === 'string') {
          errorMessage = detail
        } else if (Array.isArray(detail)) {
          errorMessage = detail.map((err: { msg?: string }) => err.msg || JSON.stringify(err)).join(', ')
        } else if (detail && typeof detail === 'object') {
          errorMessage = JSON.stringify(detail)
        }
      }

      message.error(errorMessage)
    }
  }

  const handleDeleteAdmin = async (adminId: number) => {
    if (!token) {
      message.error('Login required')
      return
    }
    try {
      await adminApi.delete(adminId)
      message.success('Admin deleted')
      loadAdmins()
    } catch (error: unknown) {
      console.error('Admin delete error:', error)
      let errorMessage = 'Failed to delete admin'

      if (isAxiosError(error)) {
        const data = error.response?.data as { detail?: unknown } | undefined
        const detail = data?.detail
        if (typeof detail === 'string') {
          errorMessage = detail
        } else if (Array.isArray(detail)) {
          errorMessage = detail.map((err: { msg?: string }) => err.msg || JSON.stringify(err)).join(', ')
        } else if (detail && typeof detail === 'object') {
          errorMessage = JSON.stringify(detail)
        }
      }

      message.error(errorMessage)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    message.success('Access code copied')
  }

  const handleLogout = () => {
    endAccessSession()
    navigate('/')
  }

  const handleAddHoliday = async () => {
    if (!selectedDate) {
      message.warning('Select a start date')
      return
    }

    const startStr = selectedDate.format('YYYY-MM-DD')
    const endStr = selectedEndDate ? selectedEndDate.format('YYYY-MM-DD') : startStr

    const newEntry: HolidayEntry = {
      start_date: startStr,
      end_date: endStr,
      condition: holidayCondition
    }

    const newHolidays = [...holidays, newEntry].sort((a, b) => a.start_date.localeCompare(b.start_date))
    try {
      await settingsApi.update({ holidays: newHolidays })
      setHolidaysState(newHolidays)
      setHolidaysLS(newHolidays)
      setSelectedDate(null)
      setSelectedEndDate(null)
      setHolidayCondition('')
      message.success('Holiday added')
    } catch (error: unknown) {
      console.error('Failed to save holiday:', error)
      message.error(getErrorMessage(error) || 'Failed to add holiday')
    }
  }

  const handleDeleteHoliday = async (index: number) => {
    const newHolidays = holidays.filter((_, i) => i !== index)
    try {
      await settingsApi.update({ holidays: newHolidays })
      setHolidaysState(newHolidays)
      setHolidaysLS(newHolidays)
      message.success('Holiday deleted')
    } catch (error: unknown) {
      console.error('Failed to delete holiday:', error)
      message.error(getErrorMessage(error) || 'Failed to delete holiday')
    }
  }

  const handleFetchHolidays = async () => {
    setFetchingHolidays(true)
    try {
      const response = await axios.post(
        `/api/settings/fetch-holidays/${holidayYear}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const fetchedHolidays = response.data.holidays
      setHolidaysState(fetchedHolidays)
      setHolidaysLS(fetchedHolidays)
      message.success(`${holidayYear}: ${response.data.count} added (total: ${response.data.total})`)
    } catch (error: unknown) {
      console.error('Failed to fetch holidays:', error)
      message.error(getErrorMessage(error) || 'Failed to fetch holidays')
    } finally {
      setFetchingHolidays(false)
    }
  }

  const handleSaveLibraryYearStart = async () => {
    if (!libraryYearStart) {
      message.warning('Select a library year start date')
      return
    }
    try {
      const dateStr = libraryYearStart.format('YYYY-MM-DD')
      await settingsApi.update({ library_year_start_date: dateStr })
      setLibraryYearStartDate(dateStr)
      message.success('Library year start date saved')
    } catch (error: unknown) {
      console.error('Failed to save library year start:', error)
      message.error(getErrorMessage(error) || 'Failed to save setting')
    }
  }

  const handleSaveServiceKey = async () => {
    if (!holidayApiServiceKey.trim()) {
      message.warning('Enter a service key')
      return
    }
    try {
      await settingsApi.update({ holiday_api_service_key: holidayApiServiceKey })
      message.success('Holiday API service key saved')
    } catch (error: unknown) {
      console.error('Failed to save service key:', error)
      message.error(getErrorMessage(error) || 'Failed to save setting')
    }
  }

  const handleFetchWeather = () => {
    if (!weatherDateRange[0] || !weatherDateRange[1]) {
      message.warning('Select a date range')
      return
    }

    const startDate = weatherDateRange[0].format('YYYY-MM-DD')
    const endDate = weatherDateRange[1].format('YYYY-MM-DD')

    fetchWeatherData(
      { startDate, endDate, stationId: weatherStationId },
      {
        onSuccess: (data) => {
          message.success(`Weather data fetched successfully (${data.total || 0} records)`)
        },
        onError: (error: any) => {
          message.error(getErrorMessage(error) || 'Failed to fetch weather data')
        }
      }
    )
  }

  const handlePasswordChange = async (values: any) => {
    try {
      if (token) {
        await siteAuthApi.setPassword(values.newPassword, token)
      } else {
        await siteAuthApi.changePassword(values.currentPassword, values.newPassword)
      }

      message.success('Site password changed')
      setShowPasswordModal(false)
      passwordForm.resetFields()
    } catch (error: unknown) {
      console.error('Password change error:', error)
      message.error(getErrorMessage(error) || 'Password change failed')
    }
  }

  const handleDownloadTemplate = async (type: 'old' | 'new') => {
    try {
      const filename = type === 'old' ? `${DOWNLOAD_FILENAME}.xlsx` : `${DOWNLOAD_FILENAME}_new.xlsx`
      const response = type === 'old' ? await templateApi.downloadOld() : await templateApi.downloadNew()

      const url = window.URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      message.success(`${type === 'old' ? 'Old' : 'New'} template downloaded`)
    } catch (error: unknown) {
      console.error('Template download error:', error)
      message.error(getErrorMessage(error) || 'Template download failed')
    }
  }

  const handleUploadTemplate = async (file: File, type: 'old' | 'new') => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      if (type === 'old') {
        await templateApi.uploadOld(formData)
      } else {
        await templateApi.uploadNew(formData)
      }
      message.success(`${type === 'old' ? 'Old' : 'New'} template uploaded`)
    } catch (error: unknown) {
      console.error('Template upload error:', error)
      message.error(getErrorMessage(error) || 'Template upload failed')
    }

    return false
  }

  const handleDownloadAutomation = async () => {
    try {
      const response = await automationApi.download()

      const url = window.URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'Automation_Tool.zip')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      message.success('Automation tool downloaded')
    } catch (error: unknown) {
      console.error('Automation download error:', error)
      message.error(getErrorMessage(error) || 'Automation download failed')
    }
  }

  const handleUploadAutomation = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    setUploadingAutomation(true)
    try {
      const response = await automationApi.upload(formData)
      message.success(response.data.message || 'Automation tool uploaded')
      loadAutomationInfo()
    } catch (error: unknown) {
      console.error('Automation upload error:', error)
      message.error(getErrorMessage(error) || 'Automation upload failed')
    } finally {
      setUploadingAutomation(false)
    }

    return false
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f0f2f5',
      padding: '24px 24px 48px'
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto'
      }}>
        <div style={{
          background: '#fff',
          padding: '24px 32px',
          borderRadius: '8px',
          marginBottom: 24,
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>
              <SettingOutlined style={{ marginRight: 12 }} />
              System Settings
            </h1>
            <p style={{ margin: '8px 0 0', color: '#666', fontSize: 14 }}>
              Manage overall settings for the library statistics system
            </p>
          </div>
          <Space>
            {isAccessCodeSession() && (
              <Button icon={<HomeOutlined />} onClick={handleLogout} size="large">
                Logout
              </Button>
            )}
          </Space>
        </div>

        <Collapse
          defaultActiveKey={['1']}
          style={{ background: '#fff', borderRadius: 8 }}
          expandIconPosition="end"
          items={[
            {
              key: '1',
              label: (
                <Space>
                  <CalendarOutlined style={{ fontSize: 18, color: '#13c2c2' }} />
                  <span style={{ fontSize: 16, fontWeight: 500 }}>Holiday Management</span>
                  <Tag color="default">{holidays.length}</Tag>
                </Space>
              ),
              children: (
                <>
                  <Row gutter={[16, 8]} style={{ padding: '8px 0' }}>
                    <Col span={24}>
                      <Space size="small" wrap>
                        <DatePicker
                          value={selectedDate}
                          onChange={setSelectedDate}
                          placeholder="Start date"
                          style={{ width: 140 }}
                        />
                        <DatePicker
                          value={selectedEndDate}
                          onChange={setSelectedEndDate}
                          placeholder="End date"
                          style={{ width: 140 }}
                        />
                        <Input
                          value={holidayCondition}
                          onChange={(e) => setHolidayCondition(e.target.value)}
                          placeholder="Reason"
                          style={{ width: 180 }}
                        />
                        <Button type="primary" onClick={handleAddHoliday} size="small">
                          Add
                        </Button>
                        <Divider type="vertical" />
                        <InputNumber
                          value={holidayYear}
                          onChange={(val) => setHolidayYear(val || new Date().getFullYear())}
                          min={2000}
                          max={2100}
                          style={{ width: 100 }}
                          placeholder="Year"
                        />
                        <Button
                          type="default"
                          onClick={handleFetchHolidays}
                          size="small"
                          loading={fetchingHolidays}
                          icon={<DownloadOutlined />}
                        >
                          Fetch from API
                        </Button>
                      </Space>
                    </Col>
                    <Col span={24}>
                      {holidays.length === 0 ? (
                        <div style={{
                          padding: 20,
                          textAlign: 'center',
                          background: '#fafafa',
                          borderRadius: 4,
                          color: '#999',
                          fontSize: '14px'
                        }}>
                          No holidays registered
                        </div>
                      ) : (
                        <Tabs
                          defaultActiveKey={new Date().getFullYear().toString()}
                          items={Object.entries(
                            holidays.reduce((acc: Record<string, HolidayEntry[]>, h: HolidayEntry) => {
                              const year = h.start_date.substring(0, 4)
                              if (!acc[year]) acc[year] = []
                              acc[year].push(h)
                              return acc
                            }, {})
                          )
                            .sort((a, b) => a[0].localeCompare(b[0]))
                            .map(([year, entries]) => ({
                              key: year,
                              label: `${year} (${entries.length})`,
                              children: (
                                <div style={{
                                  maxHeight: 250,
                                  overflowY: 'auto',
                                  border: '1px solid #f0f0f0',
                                  borderRadius: 4
                                }}>
                                  <List
                                    dataSource={entries.map((e) => ({ ...e, idx: holidays.indexOf(e) }))}
                                    size="small"
                                    renderItem={(entry) => (
                                      <List.Item
                                        style={{ padding: '6px 12px', fontSize: '13px' }}
                                        actions={[
                                          <Button
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={() => handleDeleteHoliday(entry.idx)}
                                            size="small"
                                          />
                                        ]}
                                      >
                                        <CalendarOutlined style={{ marginRight: 8, color: '#1890ff', fontSize: '12px' }} />
                                        {entry.start_date === entry.end_date
                                          ? dayjs(entry.start_date).format('MM-DD (ddd)')
                                          : `${dayjs(entry.start_date).format('MM-DD')} ~ ${dayjs(entry.end_date).format('MM-DD')}`
                                        }
                                        {entry.condition && <Tag color="blue" style={{ marginLeft: 8 }}>{entry.condition}</Tag>}
                                      </List.Item>
                                    )}
                                  />
                                </div>
                              )
                            }))}
                        />
                      )}
                    </Col>
                  </Row>
                </>
              )
            },
            {
              key: '2',
              label: (
                <Space>
                  <UserOutlined style={{ fontSize: 18, color: '#fa8c16' }} />
                  <span style={{ fontSize: 16, fontWeight: 500 }}>Admin Management</span>
                  <Tag color="default">{admins.length}</Tag>
                </Space>
              ),
              children: (
                <>
                  <div style={{ padding: '8px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <p style={{ margin: 0, color: '#999', fontSize: '13px' }}>
                        Access codes are auto-generated per admin user
                      </p>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleCreateAdmin}
                        size="small"
                      >
                        Add
                      </Button>
                    </div>

                    <div style={{
                      maxHeight: 250,
                      overflowY: 'auto',
                      border: '1px solid #f0f0f0',
                      borderRadius: 4
                    }}>
                      <Table
                        dataSource={admins}
                        loading={loadingAdmins}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        columns={[
                          {
                            title: 'Name',
                            dataIndex: 'name',
                            key: 'name'
                          },
                          {
                            title: 'Role',
                            dataIndex: 'role',
                            key: 'role',
                            render: (r: string) => {
                              const color = r === 'admin' ? 'red' : 'green'
                              return <Tag color={color}>{r}</Tag>
                            }
                          },
                          {
                            title: 'Access Code',
                            dataIndex: 'code',
                            key: 'code',
                            render: (code: string) => (
                              <Space>
                                <code style={{ fontSize: '11px' }}>{code.substring(0, 20)}...</code>
                                <Button
                                  type="link"
                                  size="small"
                                  icon={<CopyOutlined />}
                                  onClick={() => copyToClipboard(code)}
                                />
                              </Space>
                            )
                          },
                          {
                            title: 'Description',
                            dataIndex: 'description',
                            key: 'description',
                            render: (desc: string | null) => desc || '-'
                          },
                          {
                            title: 'Status',
                            dataIndex: 'is_active',
                            key: 'is_active',
                            render: (active: boolean) => (
                              <Tag color={active ? 'success' : 'default'}>
                                {active ? 'Active' : 'Inactive'}
                              </Tag>
                            )
                          },
                          {
                            title: 'Actions',
                            key: 'action',
                            render: (_: unknown, record: AdminRecord) => (
                              <Space>
                                <Button
                                  type="link"
                                  size="small"
                                  icon={<EditOutlined />}
                                  onClick={() => handleEditAdmin(record)}
                                >
                                  Edit
                                </Button>
                                <Popconfirm
                                  title="Delete admin"
                                  description="Are you sure you want to delete this admin?"
                                  onConfirm={() => handleDeleteAdmin(record.id)}
                                  okText="Delete"
                                  cancelText="Cancel"
                                >
                                  <Button
                                    type="link"
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                  >
                                    Delete
                                  </Button>
                                </Popconfirm>
                              </Space>
                            )
                          }
                        ]}
                      />
                    </div>
                  </div>
                </>
              )
            },
            {
              key: '3',
              label: (
                <Space>
                  <CloudOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                  <span style={{ fontSize: 16, fontWeight: 500 }}>Weather Data</span>
                </Space>
              ),
              children: (
                <>
                  <div style={{ padding: '8px 0' }}>
                    <p style={{ marginBottom: 16, color: '#666', fontSize: '13px' }}>
                      Fetch weather data from the meteorological API to analyze correlations with library usage statistics.
                    </p>

                    <Row gutter={[16, 16]}>
                      <Col span={12}>
                        <div style={{ marginBottom: 8 }}>
                          <Text strong style={{ fontSize: '13px' }}>Date Range</Text>
                        </div>
                        <DatePicker.RangePicker
                          value={weatherDateRange}
                          onChange={(dates) => setWeatherDateRange(dates || [null, null])}
                          placeholder={['Start date', 'End date']}
                          style={{ width: '100%' }}
                          format="YYYY-MM-DD"
                        />
                      </Col>

                      <Col span={6}>
                        <div style={{ marginBottom: 8 }}>
                          <Text strong style={{ fontSize: '13px' }}>Weather Station ID</Text>
                        </div>
                        <InputNumber
                          value={weatherStationId}
                          onChange={(val) => setWeatherStationId(val || 131)}
                          placeholder="Station ID"
                          style={{ width: '100%' }}
                          min={1}
                        />
                        <div style={{ fontSize: '11px', color: '#999', marginTop: 4 }}>
                          Default: 131
                        </div>
                      </Col>

                      <Col span={6} style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <Button
                          type="primary"
                          icon={<DownloadOutlined />}
                          onClick={handleFetchWeather}
                          loading={isFetchingWeather}
                          block
                        >
                          Fetch Weather Data
                        </Button>
                      </Col>
                    </Row>

                    <Divider style={{ margin: '16px 0' }} />

                    <Alert
                      message="Usage Guide"
                      description={
                        <div style={{ fontSize: '12px' }}>
                          <p>Weather data is fetched via the meteorological Open API.</p>
                          <p>Fetched data is used for weather correlation analysis in predictive analytics.</p>
                          <p>Data includes daily average/max/min temperature, precipitation, humidity, etc.</p>
                        </div>
                      }
                      type="info"
                      showIcon
                    />
                  </div>
                </>
              )
            },
            ...(role === 'admin' ? [{
              key: '4',
              label: (
                <Space>
                  <SettingOutlined style={{ fontSize: 18, color: '#722ed1' }} />
                  <span style={{ fontSize: 16, fontWeight: 500 }}>Admin-Only Settings</span>
                </Space>
              ),
              children: (
                <>
                  <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: 16, color: '#333', display: 'flex', alignItems: 'center' }}>
                      <UploadOutlined style={{ marginRight: 8, color: '#722ed1' }} />
                      Automation Tool
                    </h3>
                    <Card size="small">
                      <Row gutter={[16, 16]} align="middle">
                        <Col span={12}>
                          <div style={{ marginBottom: 8 }}>
                            <Text strong>Automation Tool (ZIP)</Text>
                          </div>
                          {automationInfo.exists ? (
                            <div style={{ fontSize: '12px', color: '#666' }}>
                              <div>File size: {formatFileSize(automationInfo.size)}</div>
                              <div>Last modified: {automationInfo.modified ? dayjs(automationInfo.modified).format('YYYY-MM-DD HH:mm:ss') : '-'}</div>
                            </div>
                          ) : (
                            <div style={{ fontSize: '12px', color: '#999' }}>No file uploaded</div>
                          )}
                        </Col>
                        <Col span={12}>
                          <Row gutter={8}>
                            <Col span={12}>
                              <Button
                                type="default"
                                icon={<DownloadOutlined />}
                                onClick={handleDownloadAutomation}
                                block
                                disabled={!automationInfo.exists}
                              >
                                Download
                              </Button>
                            </Col>
                            <Col span={12}>
                              <Upload
                                accept=".zip"
                                beforeUpload={handleUploadAutomation}
                                showUploadList={false}
                                style={{ display: 'block' }}
                              >
                                <Button
                                  type="primary"
                                  icon={<UploadOutlined />}
                                  block
                                  loading={uploadingAutomation}
                                  style={{ width: '100%' }}
                                >
                                  Upload
                                </Button>
                              </Upload>
                            </Col>
                          </Row>
                        </Col>
                      </Row>
                      <div style={{ marginTop: 12, fontSize: '12px', color: '#999' }}>
                        Uploading a new version automatically backs up the existing file.
                      </div>
                    </Card>
                  </div>

                  <Divider style={{ margin: '16px 0' }} />

                  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col span={12}>
                      <Card size="small" style={{ background: '#fafafa' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                          <LockOutlined style={{ marginRight: 8, color: '#722ed1' }} />
                          <Text strong style={{ fontSize: '13px' }}>Site Password</Text>
                        </div>
                        <Button
                          type="default"
                          icon={<LockOutlined />}
                          onClick={() => setShowPasswordModal(true)}
                          block
                          size="small"
                        >
                          Change Password
                        </Button>
                      </Card>
                    </Col>

                    <Col span={12}>
                      <Card size="small" style={{ background: '#fafafa' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                          <KeyOutlined style={{ marginRight: 8, color: '#722ed1' }} />
                          <Text strong style={{ fontSize: '13px' }}>Holiday API Key</Text>
                        </div>
                        <Space.Compact style={{ width: '100%' }}>
                          <Input.Password
                            value={holidayApiServiceKey}
                            onChange={(e) => setHolidayApiServiceKey(e.target.value)}
                            placeholder="Service key"
                            size="small"
                            style={{ flex: 1 }}
                          />
                          <Button type="primary" onClick={handleSaveServiceKey} size="small">
                            Save
                          </Button>
                        </Space.Compact>
                      </Card>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col span={24}>
                      <Card size="small" style={{ background: '#fafafa' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <DownloadOutlined style={{ marginRight: 8, color: '#722ed1' }} />
                            <Text strong style={{ fontSize: '13px' }}>Excel Templates</Text>
                          </div>
                          <Button
                            type="link"
                            icon={<EditOutlined />}
                            onClick={() => navigate('/template-editor')}
                            size="small"
                          >
                            Editor
                          </Button>
                        </div>
                        <Row gutter={16}>
                          <Col span={12}>
                            <div style={{ marginBottom: 8 }}>
                              <Text style={{ fontSize: '12px', color: '#666' }}>Old Template</Text>
                            </div>
                            <Row gutter={4}>
                              <Col span={12}>
                                <Button
                                  type="default"
                                  icon={<DownloadOutlined />}
                                  onClick={() => handleDownloadTemplate('old')}
                                  block
                                  size="small"
                                >
                                  Download
                                </Button>
                              </Col>
                              <Col span={12}>
                                <Upload
                                  accept=".xlsx,.xls"
                                  beforeUpload={(file) => handleUploadTemplate(file, 'old')}
                                  showUploadList={false}
                                  style={{ display: 'block' }}
                                >
                                  <Button
                                    type="primary"
                                    icon={<UploadOutlined />}
                                    block
                                    size="small"
                                    style={{ width: '100%' }}
                                  >
                                    Upload
                                  </Button>
                                </Upload>
                              </Col>
                            </Row>
                          </Col>
                          <Col span={12}>
                            <div style={{ marginBottom: 8 }}>
                              <Text style={{ fontSize: '12px', color: '#666' }}>New Template</Text>
                            </div>
                            <Row gutter={4}>
                              <Col span={12}>
                                <Button
                                  type="default"
                                  icon={<DownloadOutlined />}
                                  onClick={() => handleDownloadTemplate('new')}
                                  block
                                  size="small"
                                >
                                  Download
                                </Button>
                              </Col>
                              <Col span={12}>
                                <Upload
                                  accept=".xlsx,.xls"
                                  beforeUpload={(file) => handleUploadTemplate(file, 'new')}
                                  showUploadList={false}
                                  style={{ display: 'block' }}
                                >
                                  <Button
                                    type="primary"
                                    icon={<UploadOutlined />}
                                    block
                                    size="small"
                                    style={{ width: '100%' }}
                                  >
                                    Upload
                                  </Button>
                                </Upload>
                              </Col>
                            </Row>
                          </Col>
                        </Row>
                      </Card>
                    </Col>
                  </Row>

                  <Divider style={{ margin: '16px 0' }} />

                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: 16, color: '#333', display: 'flex', alignItems: 'center' }}>
                      <CalendarOutlined style={{ marginRight: 8, color: '#722ed1' }} />
                      Library Year Start Date
                    </h3>
                    <Row gutter={[16, 16]}>
                      <Col span={8}>
                        <Card size="small" style={{ height: '100%' }}>
                          <h4 style={{ marginBottom: 8, fontSize: '13px' }}>Year Start Date</h4>
                          <Space direction="vertical" style={{ width: '100%' }} size={8}>
                            <DatePicker
                              value={libraryYearStart}
                              onChange={setLibraryYearStart}
                              placeholder="Select date"
                              style={{ width: '100%' }}
                              size="small"
                            />
                            <Button type="primary" onClick={handleSaveLibraryYearStart} size="small" block>
                              Save
                            </Button>
                          </Space>
                        </Card>
                      </Col>
                    </Row>
                  </div>
                </>
              )
            }] : [])
          ]}
        />
      </div>

      <Modal
        title="Change Site Password"
        open={showPasswordModal}
        onCancel={() => {
          setShowPasswordModal(false)
          passwordForm.resetFields()
        }}
        footer={null}
      >
        <Form
          form={passwordForm}
          onFinish={handlePasswordChange}
          layout="vertical"
        >
          {!token && (
            <Form.Item
              label="Current Password"
              name="currentPassword"
              rules={[{ required: true, message: 'Enter current password' }]}
            >
              <Input.Password placeholder="Current password" />
            </Form.Item>
          )}

          <Form.Item
            label="New Password"
            name="newPassword"
            rules={[
              { required: true, message: 'Enter new password' },
              { min: 8, message: 'Minimum 8 characters' },
              { max: 100, message: 'Maximum 100 characters' }
            ]}
          >
            <Input.Password placeholder="New password (8-100 characters)" />
          </Form.Item>

          <Form.Item
            label="Confirm New Password"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Confirm your password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Passwords do not match'))
                },
              }),
            ]}
          >
            <Input.Password placeholder="Confirm new password" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                Change
              </Button>
              <Button onClick={() => {
                setShowPasswordModal(false)
                passwordForm.resetFields()
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingAdmin ? 'Edit Admin' : 'Add Admin'}
        open={showAdminModal}
        onCancel={() => {
          setShowAdminModal(false)
          adminForm.resetFields()
          setEditingAdmin(null)
        }}
        footer={null}
        width={500}
      >
        <Form
          form={adminForm}
          onFinish={handleAdminSubmit}
          layout="vertical"
        >
          <Form.Item
            label="Name"
            name="name"
            rules={[
              { required: true, message: 'Enter a name' },
              { min: 1, max: 100, message: '1-100 characters' }
            ]}
          >
            <Input placeholder="Admin name" />
          </Form.Item>

          <Form.Item
            label="Role"
            name="role"
            rules={[{ required: true, message: 'Select a role' }]}
          >
            <Select placeholder="Select role">
              <Select.Option value="admin">Admin</Select.Option>
              <Select.Option value="editor">Editor</Select.Option>
              <Select.Option value="viewer">Viewer</Select.Option>
            </Select>
          </Form.Item>

          {editingAdmin && (
            <Form.Item
              label="Access Code"
              name="code"
            >
              <Input placeholder="Access code (optional - leave blank to keep existing)" />
            </Form.Item>
          )}

          <Form.Item
            label="Description"
            name="description"
          >
            <Input.TextArea rows={3} placeholder="Description (optional)" />
          </Form.Item>

          {editingAdmin && (
            <Form.Item
              label="Status"
              name="is_active"
              valuePropName="checked"
            >
              <Select>
                <Select.Option value={true}>Active</Select.Option>
                <Select.Option value={false}>Inactive</Select.Option>
              </Select>
            </Form.Item>
          )}

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingAdmin ? 'Update' : 'Add'}
              </Button>
              <Button onClick={() => {
                setShowAdminModal(false)
                adminForm.resetFields()
                setEditingAdmin(null)
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
