import { useState } from 'react'
import { Form, Input, Button, message, Card, Checkbox } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../services/api'
import { getErrorMessage } from '../utils/errorHandler'

export default function SitePasswordLogin() {
  const [loading, setLoading] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(false)
  const { setSiteToken } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (values: { password: string }) => {
    setLoading(true)
    try {
      const { data } = await authApi.verifySitePassword(values.password)

      if (!data.valid) {
        message.error('잘못된 비밀번호입니다')
        return
      }

      setSiteToken(data.token)

      if (rememberDevice) {
        await authApi.rememberMe({ access_type: 'site' }, data.token)
      }

      message.success('사이트 접근이 허가되었습니다')
      navigate('/access-mode')
    } catch (error: unknown) {
      console.error('Site password verification error:', error)
      message.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 400 }}>
        <h1 style={{ textAlign: 'center', marginBottom: 32 }}>이용 현황 통계</h1>

        <p style={{ textAlign: 'center', marginBottom: 32, color: '#666' }}>
          사이트 접근을 위해 비밀번호를 입력하세요
        </p>

        <Form onFinish={handleSubmit}>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '비밀번호를 입력하세요' }]}
          >
            <Input.Password
              placeholder="사이트 비밀번호"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Checkbox
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
            >
              이 기기 기억하기 (30일)
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
              접속하기
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
