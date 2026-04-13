import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { Button, Select, Space, message, Spin, Typography, DatePicker, Tag, Upload, Modal } from 'antd'
import {
  SaveOutlined,
  DownloadOutlined,
  ArrowLeftOutlined,
  UploadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import UniverEditor, { type UniverEditorRef, type CellLocation } from '../components/template-editor/UniverEditor'
import {
  templateDrivenApi,
  type TemplateDrivenConfig,
  type CellSaveItem,
} from '../services/api'

const { Text } = Typography

function colToLetter(col: number): string {
  let result = ''
  let c = col
  while (c >= 0) {
    result = String.fromCharCode((c % 26) + 65) + result
    c = Math.floor(c / 26) - 1
  }
  return result
}

function TemplateDrivenInput() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const editorRef = useRef<UniverEditorRef>(null)

  const [configs, setConfigs] = useState<TemplateDrivenConfig[]>([])
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null)
  const [cellRoles, setCellRoles] = useState<Record<string, string>>({})
  const [yearMonth, setYearMonth] = useState(() =>
    searchParams.get('month') || dayjs().format('YYYY-MM')
  )
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [selectedCell, setSelectedCell] = useState<CellLocation | null>(null)
  const [uploading, setUploading] = useState(false)

  const selectedConfig = useMemo(
    () => configs.find(c => c.id === selectedConfigId) || null,
    [configs, selectedConfigId]
  )

  const loadConfigs = useCallback(async () => {
    try {
      const { data } = await templateDrivenApi.getConfigs()
      setConfigs(data)
      if (data.length > 0 && !selectedConfigId) {
        const paramId = searchParams.get('config')
        const targetId = paramId ? Number(paramId) : data[0].id
        setSelectedConfigId(targetId)
      }
    } catch {
      message.error('템플릿 목록을 불러오지 못했습니다')
    }
  }, [selectedConfigId, searchParams])

  const loadData = useCallback(async (configId: number, month: string) => {
    setLoading(true)
    try {
      const { data } = await templateDrivenApi.getData(configId, month)
      editorRef.current?.loadWorkbook(data.univer_data as Record<string, unknown>)
      setCellRoles(data.cell_roles || {})
      setDirty(false)
    } catch {
      message.error('데이터를 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSave = useCallback(async () => {
    if (!selectedConfigId) return

    const snapshot = editorRef.current?.getSnapshot()
    if (!snapshot) {
      message.warning('저장할 데이터가 없습니다')
      return
    }

    const cells: CellSaveItem[] = []
    const sheets = (snapshot as Record<string, unknown>).sheets as Record<string, Record<string, unknown>> | undefined
    if (!sheets) return

    for (const [, sheetData] of Object.entries(sheets)) {
      const sheetName = sheetData.name as string
      const cellData = sheetData.cellData as Record<string, Record<string, Record<string, unknown>>> | undefined
      if (!cellData) continue

      for (const [rowKey, rowCells] of Object.entries(cellData)) {
        for (const [colKey, cellInfo] of Object.entries(rowCells)) {
          const row = Number(rowKey)
          const col = Number(colKey)
          const ref = `${colToLetter(col)}${row + 1}`
          const roleKey = `${sheetName}!${ref}`

          if (cellRoles[roleKey] !== 'input') continue

          const value = cellInfo.v
          if (value === undefined || value === null) continue

          cells.push({
            sheet: sheetName,
            cell: ref,
            value: value as string | number,
            value_type: typeof value === 'number' ? 'number' : 'text',
          })
        }
      }
    }

    setSaving(true)
    try {
      const { data } = await templateDrivenApi.saveData(selectedConfigId, yearMonth, cells)
      setDirty(false)
      message.success(`${data.saved}개 셀 저장 완료`)
    } catch {
      message.error('저장 실패')
    } finally {
      setSaving(false)
    }
  }, [selectedConfigId, yearMonth, cellRoles])

  const handleExport = useCallback(async () => {
    if (!selectedConfigId) return
    try {
      const resp = await templateDrivenApi.exportXlsx(selectedConfigId, yearMonth)
      const blob = new Blob([resp.data])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedConfig?.name || 'export'}_${yearMonth}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('다운로드 실패')
    }
  }, [selectedConfigId, yearMonth, selectedConfig])

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', file.name.replace(/\.xlsx$/, ''))
      formData.append('template_type', 'current')

      const { data } = await templateDrivenApi.upload(formData)
      message.success(`템플릿 업로드 완료: ${data.sheets}개 시트, ${data.auto_detected_roles}개 셀 역할 자동 감지`)
      await loadConfigs()
      setSelectedConfigId(data.id)
    } catch {
      message.error('업로드 실패')
    } finally {
      setUploading(false)
    }
    return false
  }, [loadConfigs])

  const handleConfigChange = useCallback((value: number) => {
    if (dirty) {
      Modal.confirm({
        title: '저장하지 않은 변경사항',
        content: '저장하지 않은 변경사항이 있습니다. 계속하시겠습니까?',
        onOk: () => {
          setSelectedConfigId(value)
          setSearchParams(prev => { prev.set('config', String(value)); return prev })
        },
      })
    } else {
      setSelectedConfigId(value)
      setSearchParams(prev => { prev.set('config', String(value)); return prev })
    }
  }, [dirty, setSearchParams])

  const handleMonthChange = useCallback((_: unknown, dateStr: string | string[]) => {
    const month = Array.isArray(dateStr) ? dateStr[0] : dateStr
    if (!month) return
    setYearMonth(month)
    setSearchParams(prev => { prev.set('month', month); return prev })
  }, [setSearchParams])

  useEffect(() => {
    loadConfigs()
  }, [loadConfigs])

  useEffect(() => {
    if (selectedConfigId) {
      loadData(selectedConfigId, yearMonth)
    }
  }, [selectedConfigId, yearMonth, loadData])

  useEffect(() => {
    const unsub = editorRef.current?.onSelectionChange((cell) => {
      setSelectedCell(cell)
    })
    return () => unsub?.()
  }, [])

  const selectedCellRole = selectedCell
    ? cellRoles[`${selectedCell.sheetName}!${selectedCell.cellRef}`] || 'unknown'
    : null

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid #e8e8e8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#fff',
        zIndex: 10,
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <Space wrap>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/settings')}
            type="text"
          />
          <Select
            value={selectedConfigId}
            options={configs.map(c => ({ value: c.id, label: c.name }))}
            onChange={handleConfigChange}
            style={{ width: 200 }}
            placeholder="템플릿 선택"
          />
          <DatePicker
            picker="month"
            value={dayjs(yearMonth)}
            onChange={handleMonthChange}
            format="YYYY-MM"
            allowClear={false}
            style={{ width: 140 }}
          />
          {dirty && <Tag color="orange">수정됨</Tag>}
          {selectedCell && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {selectedCell.sheetName} / {selectedCell.cellRef}
              {selectedCellRole && (
                <Tag
                  color={
                    selectedCellRole === 'input' ? 'blue'
                      : selectedCellRole === 'computed' ? 'green'
                        : selectedCellRole === 'header' ? 'default'
                          : 'default'
                  }
                  style={{ marginLeft: 4 }}
                >
                  {selectedCellRole}
                </Tag>
              )}
            </Text>
          )}
        </Space>
        <Space>
          <Upload
            accept=".xlsx"
            showUploadList={false}
            beforeUpload={handleUpload}
          >
            <Button icon={<UploadOutlined />} loading={uploading}>
              템플릿 업로드
            </Button>
          </Upload>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExport}
            disabled={!selectedConfigId}
          >
            다운로드
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={!selectedConfigId}
          >
            저장
          </Button>
        </Space>
      </div>

      {configs.length === 0 && !loading && (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 16,
        }}>
          <InfoCircleOutlined style={{ fontSize: 48, color: '#bbb' }} />
          <Text type="secondary">
            등록된 템플릿이 없습니다. Excel 파일을 업로드하세요.
          </Text>
          <Upload
            accept=".xlsx"
            showUploadList={false}
            beforeUpload={handleUpload}
          >
            <Button type="primary" icon={<UploadOutlined />} loading={uploading}>
              첫 번째 템플릿 업로드
            </Button>
          </Upload>
        </div>
      )}

      {(configs.length > 0 || loading) && (
        <div style={{ flex: 1, position: 'relative' }}>
          {loading && (
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.8)',
              zIndex: 5,
            }}>
              <Spin size="large" />
            </div>
          )}
          <UniverEditor
            ref={editorRef}
            onChange={() => setDirty(true)}
            enableFormula
          />
        </div>
      )}
    </div>
  )
}

export default TemplateDrivenInput
