import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { message } from 'antd'

type ConnectionState = 'disconnected' | 'connecting' | 'connected'
type FloorType = 'floor1' | 'floor23'

interface UseSocketOptions {
  floor: FloorType
  yearMonth: string
  token: string | null
  onDataUpdated: () => Promise<void>
  enabled?: boolean
}

interface UseSocketReturn {
  isConnected: boolean
  connectionState: ConnectionState
}

export function useSocket({
  floor,
  yearMonth,
  token,
  onDataUpdated,
  enabled = true
}: UseSocketOptions): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null)
  const isMountedRef = useRef(true)
  const connectionStateRef = useRef<ConnectionState>('disconnected')

  const getCurrentUserCode = useCallback(() => {
    if (!token) return null
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload?.code
    } catch {
      return null
    }
  }, [token])

  useEffect(() => {
    if (!enabled || !token || !yearMonth) return

    isMountedRef.current = true
    connectionStateRef.current = 'connecting'

    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 10000
    })

    socketRef.current = socket
    const room = `${floor}-${yearMonth}`
    const eventName = `${floor}_data_updated`

    socket.on('connect', () => {
      if (!isMountedRef.current) return
      connectionStateRef.current = 'connected'
      socket.emit('join_room', { room })
    })

    socket.on('connect_error', () => {
      if (!isMountedRef.current) return
      connectionStateRef.current = 'disconnected'
    })

    socket.on('error', () => {
      if (!isMountedRef.current) return
    })

    socket.on(eventName, (data: { year_month: string; updated_by: string }) => {
      if (!isMountedRef.current) return
      if (data.year_month !== yearMonth) return

      const currentUserCode = getCurrentUserCode()
      if (data.updated_by === currentUserCode) return

      message.info(`데이터가 업데이트되었습니다 (${data.updated_by})`)
      onDataUpdated()
    })

    socket.on('disconnect', (reason) => {
      if (!isMountedRef.current) return
      connectionStateRef.current = 'disconnected'
      if (reason === 'io server disconnect') {
        socket.connect()
      }
    })

    socket.on('reconnect', () => {
      if (!isMountedRef.current) return
      connectionStateRef.current = 'connected'
      socket.emit('join_room', { room })
    })

    return () => {
      if (connectionStateRef.current === 'connected' && socketRef.current) {
        socketRef.current.emit('leave_room', { room })
      }
      if (socketRef.current) {
        socketRef.current.removeAllListeners()
        socketRef.current.disconnect()
        socketRef.current = null
      }
      isMountedRef.current = false
      connectionStateRef.current = 'disconnected'
    }
  }, [floor, yearMonth, token, enabled, onDataUpdated, getCurrentUserCode])

  return {
    isConnected: connectionStateRef.current === 'connected',
    connectionState: connectionStateRef.current
  }
}
