import { useState, useEffect, useRef } from 'react'
import { Form, InputNumber } from 'antd'
import { isAccessCodeSession } from '../utils/libraryDays'

interface EditableCellProps {
  title: React.ReactNode
  editable: boolean
  children: React.ReactNode
  dataIndex: string
  record: any
  handleSave: (record: any) => void
}

export const EditableCell: React.FC<EditableCellProps> = ({
  title,
  editable,
  children,
  dataIndex,
  record,
  handleSave,
  ...restProps
}) => {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<any>(null)
  const [form] = Form.useForm()
  const canEdit = isAccessCodeSession() && editable

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
    }
  }, [editing])

  const toggleEdit = () => {
    if (!canEdit) return
    setEditing(!editing)
    form.setFieldsValue({ [dataIndex]: record[dataIndex] })
  }

  const save = async () => {
    try {
      const values = await form.validateFields()
      toggleEdit()
      handleSave({ ...record, ...values })
    } catch (errInfo) {
    }
  }

  let childNode = children

  if (canEdit) {
    childNode = editing ? (
      <Form form={form} component={false}>
        <Form.Item
          style={{ margin: 0 }}
          name={dataIndex}
          rules={[
            {
              required: false,
              pattern: /^-?\d+(\.\d+)?$/,
              message: '숫자만 입력 가능합니다'
            }
          ]}
        >
          <InputNumber
            ref={inputRef}
            onPressEnter={save}
            onBlur={save}
            style={{ width: '100%' }}
            precision={0}
            step={1}
            controls={false}
          />
        </Form.Item>
      </Form>
    ) : (
      <div
        className="editable-cell-value-wrap"
        onClick={toggleEdit}
      >
        {children}
      </div>
    )
  } else if (editable) {
    childNode = (
      <div className="editable-cell-readonly">
        <div className="editable-cell-value-wrap">
          {children}
        </div>
      </div>
    )
  }

  return <td {...restProps}>{childNode}</td>
}
