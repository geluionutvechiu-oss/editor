export type Role = 'ADMIN' | 'RESELLER' | 'CLIENT';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
export type ServerType = 'XTREAM' | 'STALKER' | 'M3U';
export type ServerStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED';
export type InvoiceStatus = 'PAID' | 'PENDING' | 'OVERDUE';
export type FirewallRuleType = 'WHITELIST' | 'BLACKLIST';
export type NotificationType = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';

export interface User {
  id: string;
  email: string;
  username: string;
  role: Role;
  status: UserStatus;
  twoFactorEnabled: boolean;
  credits: number;
  resellerId?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { iptvClients: number };
}

export interface Client {
  id: string;
  username: string;
  password: string;
  m3uUrl?: string;
  xtreamHost?: string;
  status: UserStatus;
  maxConnections: number;
  expiresAt: string;
  lastSeen?: string;
  deviceCount: number;
  notes?: string;
  bouquets: string[];
  ownerId: string;
  serverId?: string;
  server?: { id: string; name: string };
  planId?: string;
  plan?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface Plan {
  id: string;
  name: string;
  description?: string;
  durationDays: number;
  maxConnections: number;
  price: number;
  bouquets: string[];
  isActive: boolean;
  createdAt: string;
  _count?: { clients: number };
}

export interface Server {
  id: string;
  name: string;
  url: string;
  type: ServerType;
  username?: string;
  password?: string;
  status: ServerStatus;
  uptime: number;
  activeStreams: number;
  maxStreams: number;
  bandwidthMbps: number;
  location?: string;
  lastChecked?: string;
  createdAt: string;
  _count?: { clients: number };
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: InvoiceStatus;
  dueDate: string;
  paidAt?: string;
  notes?: string;
  clientId: string;
  client?: { username: string };
  userId: string;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  ip: string;
  userAgent?: string;
  device?: string;
  lastActive: string;
  expiresAt: string;
  createdAt: string;
  user?: { username: string; email: string };
}

export interface AuditLog {
  id: string;
  userId?: string;
  user?: { username: string; email: string };
  action: string;
  resource?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  link?: string;
  createdAt: string;
}

export interface FirewallRule {
  id: string;
  type: FirewallRuleType;
  value: string;
  reason?: string;
  createdBy?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  key: string;
  permissions: string[];
  isActive: boolean;
  lastUsed?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface SharingAlert {
  id: string;
  clientId: string;
  client?: { username: string; ownerId: string };
  ips: string[];
  resolved: boolean;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface DashboardStats {
  clients: {
    total: number;
    active: number;
    suspended: number;
    expired: number;
    expiringSoon: number;
  };
  revenue: {
    total: number;
    mrr: number;
    arr: number;
  };
  resellers: number;
  servers: Pick<Server, 'id' | 'name' | 'status' | 'activeStreams' | 'maxStreams' | 'uptime' | 'bandwidthMbps'>[];
}

export interface ChartData {
  clientsByDay: { date: string; count: number }[];
  revenueByMonth: { month: string; revenue: number }[];
}

export interface CredentialFormats {
  m3u: { label: string; url: string; instructions: string; qr: string };
  xtream: { label: string; host: string; username: string; password: string; qr: string; instructions: string };
  tivimate: { label: string; m3uUrl: string; epgUrl: string; instructions: string; qr: string };
  smartersPro: { label: string; host: string; username: string; password: string; instructions: string; qr: string };
  gse: { label: string; m3uUrl: string; instructions: string; qr: string };
  duplexPlay: { label: string; host: string; username: string; password: string; instructions: string; qr: string };
  kodi: { label: string; m3uUrl: string; epgUrl: string; instructions: string; qr: string };
  vlc: { label: string; m3uUrl: string; instructions: string; qr: string };
  ottNavigator: { label: string; host: string; username: string; password: string; instructions: string; qr: string };
  perfectPlayer: { label: string; m3uUrl: string; instructions: string; qr: string };
  lazyIptv: { label: string; m3uUrl: string; instructions: string; qr: string };
}
