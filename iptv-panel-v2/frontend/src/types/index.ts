export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'reseller' | 'user'
  is_active: boolean
  credits?: number
  phone?: string
  country?: string
  reseller_id?: number
  last_login_at?: string
  last_login_ip?: string
  created_at: string
  updated_at: string
}

export interface SubscriptionLine {
  id: number
  username: string
  password: string
  owner_id?: number
  reseller_id?: number
  package_id?: number
  bouquet_ids?: number[]
  max_connections: number
  is_active: boolean
  is_trial: boolean
  expires_at?: string
  notes?: string
  last_activity_at?: string
  current_ip?: string
  isp?: string
  country_code?: string
  allowed_ips?: string[]
  owner?: User
  reseller?: User
  package?: Package
  created_at: string
  updated_at: string
}

export interface MagDevice {
  id: number
  mac_address: string
  owner_id?: number
  reseller_id?: number
  package_id?: number
  bouquet_ids?: number[]
  is_active: boolean
  expires_at?: string
  notes?: string
  last_seen_at?: string
  ip_address?: string
  device_model?: string
  owner?: User
  package?: Package
  created_at: string
}

export interface Enigma2Device extends MagDevice {}

export interface Stream {
  id: number
  name: string
  stream_icon?: string
  category_id?: number
  stream_source: string[]
  stream_type: 'live' | 'movie' | 'series'
  epg_channel_id?: string
  is_active: boolean
  server_id?: number
  stream_order: number
  tv_archive: boolean
  current_viewers: number
  status: 'online' | 'offline' | 'error' | 'restarting'
  category?: { id: number; name: string }
  server?: Server
  created_at: string
}

export interface VodMovie {
  id: number
  name: string
  cover?: string
  description?: string
  trailer_url?: string
  category_id?: number
  stream_source: string[]
  is_active: boolean
  release_year?: number
  director?: string
  cast?: string[]
  genre?: string[]
  rating?: number
  duration?: number
  language?: string
  category?: { id: number; name: string }
  created_at: string
}

export interface VodSeries {
  id: number
  name: string
  cover?: string
  description?: string
  category_id?: number
  is_active: boolean
  release_year?: number
  genre?: string[]
  rating?: number
  language?: string
  episodes_count?: number
  category?: { id: number; name: string }
  created_at: string
}

export interface Bouquet {
  id: number
  name: string
  description?: string
  is_active: boolean
  type: 'live' | 'movie' | 'series' | 'mixed'
  sort_order: number
  streams_count?: number
  created_at: string
}

export interface Package {
  id: number
  name: string
  description?: string
  price: number
  duration_days: number
  max_connections: number
  is_active: boolean
  is_trial: boolean
  trial_duration_days?: number
  features?: string[]
  subscription_lines_count?: number
  created_at: string
}

export interface Server {
  id: number
  name: string
  ip_address: string
  domain?: string
  http_port: number
  https_port?: number
  rtmp_port?: number
  server_type: 'main' | 'load_balancer' | 'edge'
  is_active: boolean
  cpu_usage?: number
  ram_usage?: number
  bandwidth_usage?: number
  total_connections: number
  last_checked_at?: string
  streams_count?: number
  created_at: string
}

export interface LiveConnection {
  id: number
  subscription_line_id?: number
  stream_id?: number
  ip_address: string
  user_agent?: string
  isp?: string
  country_code?: string
  connected_at: string
  last_activity_at?: string
  bytes_transferred: number
  subscription_line?: SubscriptionLine
  stream?: Stream
}

export interface EpgSource {
  id: number
  name: string
  url: string
  is_active: boolean
  last_synced_at?: string
  sync_interval_hours: number
  channel_count: number
  notes?: string
  created_at: string
}

export interface BlockedIp {
  id: number
  ip_address: string
  reason?: string
  blocked_by?: number
  expires_at?: string
  is_permanent: boolean
  created_at: string
  blocked_by_user?: User
}

export interface Notification {
  id: number
  user_id: number
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  is_read: boolean
  read_at?: string
  link?: string
  created_at: string
}

export interface Ticket {
  id: number
  user_id: number
  assigned_to?: number
  subject: string
  status: 'open' | 'in_progress' | 'awaiting_user' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  category?: string
  replies_count?: number
  user?: User
  assigned_to_user?: User
  created_at: string
  updated_at: string
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
    unread_count?: number
  }
}

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface DashboardStats {
  lines: {
    total: number
    active: number
    expired: number
    expiring_today: number
    new_today: number
    new_this_week: number
  }
  connections: { live: number }
  users: { total: number; resellers: number }
  streams: { total: number; active: number }
  servers: { online: number }
}
