import { useState } from 'react'
import { Form, Input, Button, message, Card, Checkbox } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../services/api'
import { startAccessSession } from '../utils/libraryDays'
import { getErrorMessage } from '../utils/errorHandler'

export default function AccessCodeLogin() {
  const [loading, setLoading] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (values: { access_code: string }) => {
    setLoading(true)
    try {
      const { data } = await authApi.verifyCode(values.access_code)

      if (!data.valid) {
        message.error('Invalid access code')
        return
      }

      login(data.token, data.role)
      startAccessSession()

      if (rememberDevice) {
        await authApi.rememberMe({
          access_type: 'edit',
          access_role: data.role,
          access_code: values.access_code
        }, data.token)
      }

      message.success('Access code verified')
      navigate('/template-driven')
    } catch (error: unknown) {
      console.error('Access code verification error:', error)
      message.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 400 }}>
        <h1 style={{ textAlign: 'center', marginBottom: 16 }}>Access Code</h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: 32 }}>
          Enter your access code to manage data
        </p>

        <Form onFinish={handleSubmit}>
          <Form.Item
            name="access_code"
            rules={[{ required: true, message: 'Please enter access code' }]}
          >
            <Input.Password
              placeholder="Access code"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Checkbox
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
            >
              Remember this device (30 days)
            </Checkbox>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              size="large"
              block
            >
              Verify
            </Button>
          </Form.Item>
        </Form>

        <Button
          type="link"
          block
          onClick={() => navigate('/access-mode')}
          style={{ marginTop: 16 }}
        >
          ← Back
        </Button>
      </Card>
    </div>
  )
}
