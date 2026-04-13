import { Button, Card } from 'antd'
import { useNavigate } from 'react-router-dom'
import { EditOutlined } from '@ant-design/icons'

export default function AccessModeSelection() {
  const navigate = useNavigate()

  const handleEnter = () => {
    navigate('/access-code-login')
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 500 }}>
        <h1 style={{ textAlign: 'center', marginBottom: 16 }}>Library Statistics</h1>
        <p style={{ textAlign: 'center', marginBottom: 40, color: '#666' }}>
          Enter your access code to manage data
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Button
            type="primary"
            size="large"
            icon={<EditOutlined />}
            onClick={handleEnter}
            style={{ height: 80, fontSize: 16 }}
          >
            <div>
              <div style={{ fontWeight: 'bold' }}>Enter Data</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Access code required</div>
            </div>
          </Button>
        </div>
      </Card>
    </div>
  )
}
