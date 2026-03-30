import axios, { AxiosError, AxiosInstance } from 'axios'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Request interceptor — attach token from localStorage if present
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('jwt_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// Response interceptor — redirect to login on 401
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('jwt_token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  refresh: () => api.post('/auth/refresh'),
}

// Dashboard
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
  revenue: (period?: number) => api.get('/dashboard/revenue', { params: { period } }),
  activity: () => api.get('/dashboard/activity'),
}

// Subscription Lines
export const subscriptionLinesApi = {
  list: (params?: Record<string, unknown>) => api.get('/subscriptions/lines', { params }),
  get: (id: number) => api.get(`/subscriptions/lines/${id}`),
  create: (data: Record<string, unknown>) => api.post('/subscriptions/lines', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/subscriptions/lines/${id}`, data),
  delete: (id: number) => api.delete(`/subscriptions/lines/${id}`),
  renew: (id: number, days: number) => api.post(`/subscriptions/lines/${id}/renew`, { days }),
  suspend: (id: number) => api.post(`/subscriptions/lines/${id}/suspend`),
  activate: (id: number) => api.post(`/subscriptions/lines/${id}/activate`),
  connections: (id: number) => api.get(`/subscriptions/lines/${id}/connections`),
}

// MAG Devices
export const magDevicesApi = {
  list: (params?: Record<string, unknown>) => api.get('/subscriptions/mag-devices', { params }),
  get: (id: number) => api.get(`/subscriptions/mag-devices/${id}`),
  create: (data: Record<string, unknown>) => api.post('/subscriptions/mag-devices', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/subscriptions/mag-devices/${id}`, data),
  delete: (id: number) => api.delete(`/subscriptions/mag-devices/${id}`),
  reboot: (id: number) => api.post(`/subscriptions/mag-devices/${id}/reboot`),
}

// Enigma2
export const enigma2Api = {
  list: (params?: Record<string, unknown>) => api.get('/subscriptions/enigma2', { params }),
  get: (id: number) => api.get(`/subscriptions/enigma2/${id}`),
  create: (data: Record<string, unknown>) => api.post('/subscriptions/enigma2', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/subscriptions/enigma2/${id}`, data),
  delete: (id: number) => api.delete(`/subscriptions/enigma2/${id}`),
}

// Streams
export const streamsApi = {
  list: (params?: Record<string, unknown>) => api.get('/streams', { params }),
  get: (id: number) => api.get(`/streams/${id}`),
  create: (data: Record<string, unknown>) => api.post('/streams', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/streams/${id}`, data),
  delete: (id: number) => api.delete(`/streams/${id}`),
  restart: (id: number) => api.post(`/streams/${id}/restart`),
  stats: (id: number) => api.get(`/streams/${id}/stats`),
  bulkAction: (ids: number[], action: string) => api.post('/streams/bulk-action', { ids, action }),
}

// VOD Movies
export const vodMoviesApi = {
  list: (params?: Record<string, unknown>) => api.get('/vods/movies', { params }),
  get: (id: number) => api.get(`/vods/movies/${id}`),
  create: (data: Record<string, unknown>) => api.post('/vods/movies', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/vods/movies/${id}`, data),
  delete: (id: number) => api.delete(`/vods/movies/${id}`),
  bulkAction: (ids: number[], action: string) => api.post('/vods/movies/bulk-action', { ids, action }),
}

// VOD Series
export const vodSeriesApi = {
  list: (params?: Record<string, unknown>) => api.get('/vods/series', { params }),
  get: (id: number) => api.get(`/vods/series/${id}`),
  create: (data: Record<string, unknown>) => api.post('/vods/series', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/vods/series/${id}`, data),
  delete: (id: number) => api.delete(`/vods/series/${id}`),
  episodes: (id: number) => api.get(`/vods/series/${id}/episodes`),
}

// Bouquets
export const bouquetsApi = {
  list: (params?: Record<string, unknown>) => api.get('/bouquets', { params }),
  get: (id: number) => api.get(`/bouquets/${id}`),
  create: (data: Record<string, unknown>) => api.post('/bouquets', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/bouquets/${id}`, data),
  delete: (id: number) => api.delete(`/bouquets/${id}`),
}

// Packages
export const packagesApi = {
  list: (params?: Record<string, unknown>) => api.get('/packages', { params }),
  get: (id: number) => api.get(`/packages/${id}`),
  create: (data: Record<string, unknown>) => api.post('/packages', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/packages/${id}`, data),
  delete: (id: number) => api.delete(`/packages/${id}`),
}

// Users
export const usersApi = {
  list: (params?: Record<string, unknown>) => api.get('/users', { params }),
  get: (id: number) => api.get(`/users/${id}`),
  create: (data: Record<string, unknown>) => api.post('/users', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
  toggleStatus: (id: number) => api.post(`/users/${id}/toggle-status`),
}

// Resellers
export const resellersApi = {
  list: (params?: Record<string, unknown>) => api.get('/resellers', { params }),
  get: (id: number) => api.get(`/resellers/${id}`),
  create: (data: Record<string, unknown>) => api.post('/resellers', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/resellers/${id}`, data),
  delete: (id: number) => api.delete(`/resellers/${id}`),
  addCredits: (id: number, amount: number) => api.post(`/resellers/${id}/add-credits`, { amount }),
  lines: (id: number, params?: Record<string, unknown>) => api.get(`/resellers/${id}/lines`, { params }),
}

// Servers
export const serversApi = {
  list: (params?: Record<string, unknown>) => api.get('/servers', { params }),
  get: (id: number) => api.get(`/servers/${id}`),
  create: (data: Record<string, unknown>) => api.post('/servers', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/servers/${id}`, data),
  delete: (id: number) => api.delete(`/servers/${id}`),
  stats: (id: number) => api.get(`/servers/${id}/stats`),
  test: (id: number) => api.post(`/servers/${id}/test`),
}

// Live Connections
export const liveConnectionsApi = {
  list: (params?: Record<string, unknown>) => api.get('/live-connections', { params }),
  kick: (id: number) => api.delete(`/live-connections/${id}`),
  kickAll: () => api.post('/live-connections/kick-all'),
}

// EPG
export const epgApi = {
  list: (params?: Record<string, unknown>) => api.get('/epg', { params }),
  create: (data: Record<string, unknown>) => api.post('/epg', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/epg/${id}`, data),
  delete: (id: number) => api.delete(`/epg/${id}`),
  sync: (id: number) => api.post(`/epg/${id}/sync`),
}

// Security
export const securityApi = {
  blockedIps: (params?: Record<string, unknown>) => api.get('/security/blocked-ips', { params }),
  blockIp: (data: Record<string, unknown>) => api.post('/security/block-ip', data),
  unblockIp: (id: number) => api.delete(`/security/blocked-ips/${id}`),
  auditLog: (params?: Record<string, unknown>) => api.get('/security/audit-log', { params }),
  failedLogins: (params?: Record<string, unknown>) => api.get('/security/failed-logins', { params }),
}

// Statistics
export const statisticsApi = {
  overview: (params?: Record<string, unknown>) => api.get('/statistics/overview', { params }),
  streams: () => api.get('/statistics/streams'),
  users: (params?: Record<string, unknown>) => api.get('/statistics/users', { params }),
  bandwidth: (params?: Record<string, unknown>) => api.get('/statistics/bandwidth', { params }),
}

// Notifications
export const notificationsApi = {
  list: (params?: Record<string, unknown>) => api.get('/notifications', { params }),
  create: (data: Record<string, unknown>) => api.post('/notifications', data),
  markRead: (id: number) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/mark-all-read'),
  delete: (id: number) => api.delete(`/notifications/${id}`),
}

// Tickets
export const ticketsApi = {
  list: (params?: Record<string, unknown>) => api.get('/tickets', { params }),
  get: (id: number) => api.get(`/tickets/${id}`),
  create: (data: Record<string, unknown>) => api.post('/tickets', data),
  update: (id: number, data: Record<string, unknown>) => api.put(`/tickets/${id}`, data),
  delete: (id: number) => api.delete(`/tickets/${id}`),
  reply: (id: number, message: string) => api.post(`/tickets/${id}/reply`, { message }),
  close: (id: number) => api.post(`/tickets/${id}/close`),
  reopen: (id: number) => api.post(`/tickets/${id}/open`),
}
