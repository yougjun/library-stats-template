import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card } from 'antd'
import { HomeOutlined, ReloadOutlined } from '@ant-design/icons'

export type ErrorType = 'connection' | 'maintenance' | '404' | '500' | 'unauthorized'

const ERROR_TYPES: ErrorType[] = ['connection', 'maintenance', '404', '500', 'unauthorized']

interface ErrorPageProps {
  errorType?: ErrorType
}

const errorConfig: Record<ErrorType, { code: string; title: string; description: string }> = {
  '404': {
    code: '404',
    title: '페이지를 찾을 수 없습니다',
    description: '요청하신 페이지가 존재하지 않거나 이동되었습니다.'
  },
  '500': {
    code: '500',
    title: '서버 오류',
    description: '서버에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  },
  maintenance: {
    code: '503',
    title: '시스템 점검 중',
    description: '더 나은 서비스를 위해 점검 중입니다. 잠시 후 다시 시도해 주세요.'
  },
  connection: {
    code: '503',
    title: '서버 연결 실패',
    description: '서버와의 연결에 문제가 발생했습니다. 네트워크 상태를 확인해 주세요.'
  },
  unauthorized: {
    code: '401',
    title: '접근 권한 없음',
    description: '이 페이지에 접근할 권한이 없습니다. 로그인 후 다시 시도해 주세요.'
  }
}

export const isValidErrorType = (type: string | undefined): type is ErrorType => {
  return ERROR_TYPES.includes(type as ErrorType)
}

export function ErrorPageWithParams() {
  const { type } = useParams<{ type: string }>()
  const validType = isValidErrorType(type) ? type : '404'
  return <ErrorPage errorType={validType} />
}

const ErrorPage = ({ errorType = '404' }: ErrorPageProps) => {
  const navigate = useNavigate()
  const config = errorConfig[errorType]

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f0f2f5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: 480,
          textAlign: 'center',
          borderRadius: 8,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03), 0 2px 4px rgba(0, 0, 0, 0.03)'
        }}
        bodyStyle={{ padding: '48px 32px' }}
      >
        <div style={{
          fontSize: 72,
          fontWeight: 700,
          color: '#1890ff',
          lineHeight: 1,
          marginBottom: 16,
          letterSpacing: '-2px'
        }}>
          {config.code}
        </div>

        <h1 style={{
          fontSize: 24,
          fontWeight: 600,
          color: 'rgba(0, 0, 0, 0.85)',
          margin: '0 0 12px 0'
        }}>
          {config.title}
        </h1>

        <p style={{
          fontSize: 15,
          color: 'rgba(0, 0, 0, 0.45)',
          margin: '0 0 32px 0',
          lineHeight: 1.6
        }}>
          {config.description}
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Button
            type="primary"
            size="large"
            icon={<HomeOutlined />}
            onClick={() => navigate('/')}
          >
            홈으로 돌아가기
          </Button>

          {(errorType === 'connection' || errorType === 'maintenance' || errorType === '500') && (
            <Button
              size="large"
              icon={<ReloadOutlined />}
              onClick={() => window.location.reload()}
            >
              다시 시도
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}

export default ErrorPage
