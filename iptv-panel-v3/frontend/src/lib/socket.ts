import { io, Socket } from 'socket.io-client'

export let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('token')
    socket = io('/', {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket?.id)
    })

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
    })

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message)
    })
  }
  return socket
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function updateSocketAuth(): void {
  if (socket) {
    const token = localStorage.getItem('token')
    socket.auth = { token }
    socket.disconnect().connect()
  }
}
