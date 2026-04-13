import { Spin } from 'antd'

export function LoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        flexDirection: 'column',
        gap: '16px'
      }}
    >
      <Spin size="large" />
      <span style={{ color: '#666', fontSize: '14px' }}>로딩 중...</span>
    </div>
  )
}
