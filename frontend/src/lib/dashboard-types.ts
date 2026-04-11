export type MeDto = {
  id: string;
  email: string;
  full_name: string | null;
  is_superuser: boolean;
};

export type ChartDay = {
  name: string;
  requests: number;
  ai_calls: number;
};

export type DashboardMetrics = {
  policies_active: number;
  policies_total: number;
  users_total: number | null;
  pending_decisions: number | null;
  audit_events_24h: number | null;
  chart_days: ChartDay[];
};

export type InsightItem = {
  id: string;
  title: string;
  insight_type: string;
  severity: string;
  confidence: string;
  timestamp: string;
  description: string;
};

export type AuditLogRow = {
  id: string;
  created_at: string;
  actor_id: string | null;
  endpoint: string;
  http_method: string;
  status_code: number;
  processing_time_ms: number;
  client_ip: string | null;
};

export type UserDirectoryRow = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
};
