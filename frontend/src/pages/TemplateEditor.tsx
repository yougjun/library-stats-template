import { useEffect, useRef, useCallback, useState } from 'react'
import { Button, Select, Space, message, Spin, Typography, Tag, Popover, Radio } from 'antd'
import {
  SaveOutlined,
  DownloadOutlined,
  ArrowLeftOutlined,
  TagsOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import UniverEditor, { type UniverEditorRef, type CellLocation } from '../components/template-editor/UniverEditor'
import { useTemplateEditorStore } from '../store/templateEditorStore'
import { templateApi, templateDrivenApi } from '../services/api'

const { Text } = Typography

const TEMPLATE_OPTIONS = [
  { value: 'current', label: '현재 템플릿' },
  { value: 'old', label: '기존 템플릿 (~2025-11)' },
  { value: 'new', label: '신규 템플릿 (2025-12~)' },
]

const ROLE_OPTIONS = [
  { value: 'input', label: '입력 (input)', color: '#1677ff' },
  { value: 'computed', label: '수식 (computed)', color: '#52c41a' },
  { value: 'header', label: '헤더 (header)', color: '#8c8c8c' },
  { value: 'skip', label: '제외 (skip)', color: '#d9d9d9' },
]

const ROLE_COLOR_MAP: Record<string, string> = {
  input: '#E6F4FF',
  computed: '#F6FFED',
  header: '#F0F0F0',
  skip: '#FAFAFA',
}

function TemplateEditor() {
  const navigate = useNavigate()
  const editorRef = useRef<UniverEditorRef>(null)
  const {
    templateType, loading, saving, dirty, lastSaved,
    setTemplateType, setLoading, setSaving, setDirty, setLastSaved,
  } = useTemplateEditorStore()

  const [roleMode, setRoleMode] = useState(false)
  const [cellRoles, setCellRoles] = useState<Record<string, string>>({})
  const [selectedCell, setSelectedCell] = useState<CellLocation | null>(null)
  const [roleConfigId, setRoleConfigId] = useState<number | null>(null)
  const [roleSaving, setRoleSaving] = useState(false)
  const [configs, setConfigs] = useState<{ id: number; name: string }[]>([])

  const loadTemplate = useCallback(async (type: string) => {
    setLoading(true)
    try {
      const { data } = await templateApi.getEditorData(type)
      editorRef.current?.loadWorkbook(data)
      setDirty(false)
      message.success('템플릿을 불러왔습니다')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '불러오기 실패'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }, [setLoading, setDirty])

  const handleSave = useCallback(async () => {
    const snapshot = editorRef.current?.getSnapshot()
    if (!snapshot) {
      message.warning('저장할 데이터가 없습니다')
      return
    }
    setSaving(true)
    try {
      await templateApi.saveEditorData(templateType, snapshot)
      setDirty(false)
      setLastSaved(new Date().toLocaleTimeString('ko-KR'))
      message.success('저장 완료')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '저장 실패'
      message.error(msg)
    } finally {
      setSaving(false)
    }
  }, [templateType, setSaving, setDirty, setLastSaved])

  const handleDownload = useCallback(async () => {
    try {
      const resp = templateType === 'old'
        ? await templateApi.downloadOld()
        : await templateApi.downloadNew()
      const blob = new Blob([resp.data])
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `template_${templateType}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      message.error('다운로드 실패')
    }
  }, [templateType])

  const handleTypeChange = useCallback((value: 'old' | 'new' | 'current') => {
    if (dirty) {
      const confirmed = window.confirm('저장하지 않은 변경사항이 있습니다. 계속하시겠습니까?')
      if (!confirmed) return
    }
    setTemplateType(value)
    loadTemplate(value)
  }, [dirty, setTemplateType, loadTemplate])

  const toggleRoleMode = useCallback(async () => {
    if (!roleMode) {
      try {
        const { data } = await templateDrivenApi.getConfigs()
        setConfigs(data.map((c: { id: number; name: string }) => ({ id: c.id, name: c.name })))
        if (data.length > 0) {
          const configId = data[0].id
          setRoleConfigId(configId)
          const structResp = await templateDrivenApi.getStructure(configId)
          setCellRoles(structResp.data.cell_roles || {})
          message.info('셀 역할 설정 모드 활성화')
        } else {
          message.warning('등록된 템플릿 설정이 없습니다. 먼저 템플릿을 업로드하세요.')
          return
        }
      } catch {
        message.error('템플릿 설정을 불러오지 못했습니다')
        return
      }
    }
    setRoleMode(!roleMode)
  }, [roleMode])

  const handleRoleChange = useCallback((role: string) => {
    if (!selectedCell) return
    const key = `${selectedCell.sheetName}!${selectedCell.cellRef}`
    setCellRoles(prev => ({ ...prev, [key]: role }))

    const color = ROLE_COLOR_MAP[role] || '#FFFFFF'
    editorRef.current?.setCellStyle(selectedCell.sheetName, selectedCell.row, selectedCell.col, {
      background: color,
    })
  }, [selectedCell])

  const handleSaveRoles = useCallback(async () => {
    if (!roleConfigId) return
    setRoleSaving(true)
    try {
      const { data } = await templateDrivenApi.saveCellRoles(roleConfigId, cellRoles)
      message.success(`${data.saved}개 셀 역할 저장 완료`)
    } catch {
      message.error('역할 저장 실패')
    } finally {
      setRoleSaving(false)
    }
  }, [roleConfigId, cellRoles])

  const handleRoleConfigChange = useCallback(async (configId: number) => {
    setRoleConfigId(configId)
    try {
      const { data } = await templateDrivenApi.getStructure(configId)
      setCellRoles(data.cell_roles || {})
    } catch {
      message.error('셀 역할을 불러오지 못했습니다')
    }
  }, [])

  useEffect(() => {
    loadTemplate(templateType)
  }, [])

  useEffect(() => {
    const unsub = editorRef.current?.onSelectionChange((cell) => {
      setSelectedCell(cell)
    })
    return () => unsub?.()
  }, [])

  const selectedCellRole = selectedCell
    ? cellRoles[`${selectedCell.sheetName}!${selectedCell.cellRef}`] || ''
    : ''

  const roleCounts = Object.values(cellRoles).reduce<Record<string, number>>((acc, role) => {
    acc[role] = (acc[role] || 0) + 1
    return acc
  }, {})

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
            value={templateType}
            options={TEMPLATE_OPTIONS}
            onChange={handleTypeChange}
            style={{ width: 200 }}
          />
          {lastSaved && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              마지막 저장: {lastSaved}
            </Text>
          )}
          {dirty && (
            <Text type="warning" style={{ fontSize: 12 }}>
              (수정됨)
            </Text>
          )}
        </Space>
        <Space wrap>
          <Button
            icon={<TagsOutlined />}
            type={roleMode ? 'primary' : 'default'}
            ghost={roleMode}
            onClick={toggleRoleMode}
          >
            셀 역할 설정
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleDownload}>
            다운로드
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
          >
            저장
          </Button>
        </Space>
      </div>

      {roleMode && (
        <div style={{
          padding: '8px 16px',
          borderBottom: '1px solid #e8e8e8',
          background: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          <Space wrap>
            <Select
              value={roleConfigId}
              options={configs.map(c => ({ value: c.id, label: c.name }))}
              onChange={handleRoleConfigChange}
              style={{ width: 180 }}
              size="small"
              placeholder="템플릿 선택"
            />
            {selectedCell && (
              <>
                <Text strong style={{ fontSize: 13 }}>
                  {selectedCell.sheetName}/{selectedCell.cellRef}
                </Text>
                <Popover
                  open={!!selectedCell}
                  content={
                    <Radio.Group
                      value={selectedCellRole}
                      onChange={e => handleRoleChange(e.target.value)}
                    >
                      <Space direction="vertical">
                        {ROLE_OPTIONS.map(opt => (
                          <Radio key={opt.value} value={opt.value}>
                            <Tag color={opt.color}>{opt.label}</Tag>
                          </Radio>
                        ))}
                      </Space>
                    </Radio.Group>
                  }
                  trigger="click"
                  placement="bottomLeft"
                >
                  <Tag
                    color={ROLE_OPTIONS.find(r => r.value === selectedCellRole)?.color || 'default'}
                    style={{ cursor: 'pointer' }}
                  >
                    {selectedCellRole || '미지정'}
                  </Tag>
                </Popover>
              </>
            )}
            <Space size={4}>
              {Object.entries(roleCounts).map(([role, count]) => (
                <Tag
                  key={role}
                  color={ROLE_OPTIONS.find(r => r.value === role)?.color || 'default'}
                >
                  {role}: {count}
                </Tag>
              ))}
            </Space>
          </Space>
          <Button
            type="primary"
            size="small"
            onClick={handleSaveRoles}
            loading={roleSaving}
          >
            역할 저장
          </Button>
        </div>
      )}

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
        />
      </div>
    </div>
  )
}

export default TemplateEditor
