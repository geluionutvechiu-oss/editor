import axios, { AxiosInstance, AxiosError } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('iptv_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401
api.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('iptv_token');
      localStorage.removeItem('iptv_user');
      window.location.href = '/admin/login';
    }
    const message = (error.response?.data as any)?.message || error.message || 'Request failed';
    return Promise.reject(new Error(message));
  }
);

// Auth
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (current_password: string, new_password: string) =>
    api.put('/auth/change-password', { current_password, new_password }),
};

// Users
export const usersApi = {
  list: (params?: Record<string, any>) => api.get('/users', { params }),
  get: (id: number) => api.get(`/users/${id}`),
  create: (data: Record<string, any>) => api.post('/users', data),
  update: (id: number, data: Record<string, any>) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
  kick: (id: number) => api.post(`/users/${id}/kick`),
};

// Streams
export const streamsApi = {
  list: (params?: Record<string, any>) => api.get('/streams', { params }),
  get: (id: number) => api.get(`/streams/${id}`),
  create: (data: Record<string, any>) => api.post('/streams', data),
  update: (id: number, data: Record<string, any>) => api.put(`/streams/${id}`, data),
  delete: (id: number) => api.delete(`/streams/${id}`),
  checkHealth: (id: number) => api.get(`/streams/${id}/health`),
  bulkImport: (formData: FormData) =>
    api.post('/streams/bulk-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  categories: () => api.get('/streams/categories/list'),
};

// VOD
export const vodApi = {
  list: (params?: Record<string, any>) => api.get('/vod', { params }),
  get: (id: number) => api.get(`/vod/${id}`),
  create: (data: Record<string, any>) => api.post('/vod', data),
  update: (id: number, data: Record<string, any>) => api.put(`/vod/${id}`, data),
  delete: (id: number) => api.delete(`/vod/${id}`),
  refreshTmdb: (id: number, tmdb_id?: number) =>
    api.post(`/vod/${id}/refresh-tmdb`, tmdb_id ? { tmdb_id } : {}),
  continueWatching: () => api.get('/vod/user/continue-watching'),
};

// Series
export const seriesApi = {
  list: (params?: Record<string, any>) => api.get('/series', { params }),
  get: (id: number) => api.get(`/series/${id}`),
  create: (data: Record<string, any>) => api.post('/series', data),
  addEpisode: (seriesId: number, data: Record<string, any>) =>
    api.post(`/series/${seriesId}/episodes`, data),
};

// EPG
export const epgApi = {
  sources: () => api.get('/epg/sources'),
  createSource: (data: Record<string, any>) => api.post('/epg/sources', data),
  deleteSource: (id: number) => api.delete(`/epg/sources/${id}`),
  refreshSource: (id: number) => api.post(`/epg/sources/${id}/refresh`),
  channels: (params?: Record<string, any>) => api.get('/epg/channels', { params }),
  guide: (channelId: string) => api.get(`/epg/guide/${channelId}`),
};

// Admin
export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),
  servers: () => api.get('/admin/servers'),
  createServer: (data: Record<string, any>) => api.post('/admin/servers', data),
  updateServer: (id: number, data: Record<string, any>) => api.put(`/admin/servers/${id}`, data),
  deleteServer: (id: number) => api.delete(`/admin/servers/${id}`),
  settings: () => api.get('/admin/settings'),
  updateSettings: (data: Record<string, any>) => api.put('/admin/settings', data),
  connectionLogs: (params?: Record<string, any>) => api.get('/admin/connection-logs', { params }),
  activeConnections: () => api.get('/admin/active-connections'),
  revenue: (period?: string) => api.get('/admin/revenue', { params: { period } }),
  bulkHealthCheck: (categoryId?: number) =>
    api.post('/admin/stream-health-check', categoryId ? { category_id: categoryId } : {}),
  ipFilter: () => api.get('/admin/ip-filter'),
  addIpFilter: (data: Record<string, any>) => api.post('/admin/ip-filter', data),
  deleteIpFilter: (id: number) => api.delete(`/admin/ip-filter/${id}`),
  bouquets: () => api.get('/admin/bouquets'),
  createBouquet: (data: Record<string, any>) => api.post('/admin/bouquets', data),
  updateBouquetStreams: (id: number, streamType: string, streamIds: number[]) =>
    api.put(`/admin/bouquets/${id}/streams`, { stream_type: streamType, stream_ids: streamIds }),
  // Resellers
  getResellers: () => api.get('/admin/resellers'),
  createReseller: (data: Record<string, any>) => api.post('/admin/resellers', data),
  updateReseller: (id: number, data: Record<string, any>) => api.put(`/admin/resellers/${id}`, data),
  addCredits: (id: number, amount: number) => api.post(`/admin/resellers/${id}/credits`, { amount }),
  // Plans
  getPlans: () => api.get('/admin/plans'),
  createPlan: (data: Record<string, any>) => api.post('/admin/plans', data),
  updatePlan: (id: number, data: Record<string, any>) => api.put(`/admin/plans/${id}`, data),
  deletePlan: (id: number) => api.delete(`/admin/plans/${id}`),
  // Reports
  topStreams: (params?: Record<string, any>) => api.get('/admin/reports/top-streams', { params }),
  connectionStats: (params?: Record<string, any>) => api.get('/admin/reports/connections', { params }),
};

export default api;
