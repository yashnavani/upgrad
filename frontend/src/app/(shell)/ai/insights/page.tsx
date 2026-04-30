"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Brain,
  CheckCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  HardDrive,
  Lightbulb,
  Loader2,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  XCircle,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InterviewInsightsReport } from "@/components/ai/InterviewInsightsReport";
import type {
  AuditLogRow,
  DashboardMetrics,
  InsightItem,
  MeDto,
} from "@/lib/dashboard-types";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type HealthCheck = { healthy: boolean; message: string; version?: string };

type HealthData = {
  status: string;
  checks?: {
    database?: HealthCheck;
    gemini_api?: HealthCheck;
    storage?: HealthCheck;
  };
};

type SystemMetrics = {
  system?: {
    cpu_percent: number;
    memory_percent: number;
    memory_available_mb: number;
    disk_usage_percent: number;
    uptime_seconds: number;
    python_version: string;
  };
  database?: {
    pool_size: number;
    checked_in: number;
    checked_out: number;
    overflow: number;
    total_connections: number;
  };
};

type PolicyDto = {
  id: string;
  name: string;
  is_active: boolean;
  policy_type: string;
  priority: number;
};

type DecisionDto = {
  id: string;
  action_type: string;
  confidence_score: number;
  status: string;
  reasoning: string;
  created_at: string;
  proposed_payload?: Record<string, unknown>;
  input_context?: Record<string, unknown>;
};

type InterviewSummaryRow = {
  id: string;
  target_role: string;
  focus_area: string;
  resume_snippet: string | null;
  status: string;
  turn_count: number;
  max_turns: number;
  transcript: { role: string; content: string }[];
  feedback_data: {
    evaluation: Record<string, unknown>;
    coaching_report?: string;
  } | null;
  created_at: string;
  updated_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 30;

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function methodColor(method: string): string {
  switch (method) {
    case "GET":    return "text-blue-600 border-blue-200 dark:border-blue-800 dark:text-blue-400";
    case "POST":   return "text-emerald-600 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400";
    case "PATCH":
    case "PUT":    return "text-amber-600 border-amber-200 dark:border-amber-800 dark:text-amber-400";
    case "DELETE": return "text-red-600 border-red-200 dark:border-red-800 dark:text-red-400";
    default:       return "text-muted-foreground border-border";
  }
}

function statusBadge(code: number): string {
  if (code < 300) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  if (code < 400) return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200";
  if (code < 500) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return `${Math.round(diff / 3_600_000)}h ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HealthDot({ healthy, label }: { healthy: boolean | undefined; label: string }) {
  if (healthy === undefined) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-muted animate-pulse" />
        {label}
      </span>
    );
  }
  return (
    <span className={cn("flex items-center gap-1.5 text-xs font-medium", healthy ? "text-emerald-600 dark:text-emerald-400" : "text-red-500")}>
      <span className={cn("h-2 w-2 rounded-full", healthy ? "bg-emerald-500" : "bg-red-500")} />
      {label}
    </span>
  );
}

function GaugeBar({ value, label, color = "bg-primary" }: { value: number; label: string; color?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium text-foreground">{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

function PendingDecisionCard({
  decision,
  onResolved,
}: {
  decision: DecisionDto;
  onResolved: () => void | Promise<void>;
}) {
  const [approveNote, setApproveNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  const approve = async () => {
    setBusy(true);
    setLocalErr(null);
    try {
      const q = approveNote.trim()
        ? `?notes=${encodeURIComponent(approveNote.trim())}`
        : "";
      await apiClient(`/decisions/${decision.id}/approve${q}`, { method: "POST" });
      setApproveNote("");
      await onResolved();
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    const r = rejectReason.trim();
    if (!r) {
      setLocalErr("Enter a rejection reason.");
      return;
    }
    setBusy(true);
    setLocalErr(null);
    try {
      await apiClient(`/decisions/${decision.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: r }),
      });
      setRejectReason("");
      await onResolved();
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusy(false);
    }
  };

  const payload = decision.proposed_payload;

  return (
    <Card className="border border-border border-l-4 border-l-violet-500 shadow-sm">
      <CardContent className="space-y-4 pt-6">
        {localErr ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {localErr}
          </p>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-violet-500/10 p-2">
              <Brain className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{decision.action_type}</p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">ID: {decision.id}</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">{decision.reasoning}</p>
              <p className="mt-1 text-xs text-muted-foreground">{relativeTime(decision.created_at)}</p>
            </div>
          </div>
          <Badge className="shrink-0 bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            {Math.round(decision.confidence_score * 100)}% confidence
          </Badge>
        </div>
        {payload && Object.keys(payload).length > 0 ? (
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Proposed payload</p>
            <pre className="max-h-40 overflow-auto font-mono text-xs text-muted-foreground">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        ) : null}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Approval notes (optional)</label>
          <Input
            value={approveNote}
            onChange={(e) => setApproveNote(e.target.value)}
            placeholder="e.g. Verified with finance — OK to execute"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Rejection reason (required to reject)
          </label>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Why this should not run (fed back for learning)"
            rows={3}
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            disabled={busy}
            onClick={() => void reject()}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Reject
          </Button>
          <Button type="button" disabled={busy} onClick={() => void approve()}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            Approve
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AIInsightsPageInner() {
  // Data state
  const [metrics, setMetrics]     = useState<DashboardMetrics | null>(null);
  const [insights, setInsights]   = useState<InsightItem[]>([]);
  const [health, setHealth]       = useState<HealthData | null>(null);
  const [sysMet, setSysMet]       = useState<SystemMetrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [policies, setPolicies]   = useState<PolicyDto[]>([]);
  const [decisions, setDecisions] = useState<DecisionDto[]>([]);
  const [interviews, setInterviews] = useState<InterviewSummaryRow[] | null>(null);

  // UI state
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [countdown, setCountdown]     = useState(REFRESH_INTERVAL);
  const countdownRef                  = useRef<ReturnType<typeof setInterval> | null>(null);

  const searchParams = useSearchParams();
  const [mainTab, setMainTab] = useState("feed");

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "decisions" || t === "issues" || t === "policies" || t === "feed") {
      setMainTab(t);
    }
  }, [searchParams]);

  // Fetch all data in parallel — partial failures are tolerated
  const load = useCallback(async (isBackground = false) => {
    if (isBackground) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const me = await apiClient<MeDto>("/users/me");
      const isSuper = me.is_superuser === true;

      const baseResults = await Promise.allSettled([
        apiClient<DashboardMetrics>("/dashboard/metrics"),
        apiClient<InsightItem[]>("/dashboard/insights"),
        apiClient<HealthData>("/health/detailed"),
        apiClient<PolicyDto[]>("/policies"),
        apiClient<InterviewSummaryRow[]>("/interviews?limit=20"),
      ]);

      if (baseResults[0].status === "fulfilled") setMetrics(baseResults[0].value);
      if (baseResults[1].status === "fulfilled") setInsights(baseResults[1].value);
      if (baseResults[2].status === "fulfilled") setHealth(baseResults[2].value);
      if (baseResults[3].status === "fulfilled") setPolicies(baseResults[3].value);
      if (baseResults[4].status === "fulfilled") setInterviews(baseResults[4].value);
      else if (!isBackground) setInterviews([]);

      if (isSuper) {
        const adminResults = await Promise.allSettled([
          apiClient<SystemMetrics>("/metrics"),
          apiClient<AuditLogRow[]>("/audit-logs?limit=25"),
          apiClient<DecisionDto[]>("/decisions/pending"),
        ]);
        if (adminResults[0].status === "fulfilled") setSysMet(adminResults[0].value);
        if (adminResults[1].status === "fulfilled") setAuditLogs(adminResults[1].value);
        if (adminResults[2].status === "fulfilled") setDecisions(adminResults[2].value);
      } else {
        setSysMet(null);
        setAuditLogs([]);
        setDecisions([]);
      }

      const firstFail = baseResults.find(
        (r, i) => r.status === "rejected" && i < 2
      ) as PromiseRejectedResult | undefined;
      if (firstFail) {
        setError(
          firstFail.reason instanceof Error
            ? firstFail.reason.message
            : "Some data failed to load."
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Some data failed to load.");
    }

    setLastRefreshed(new Date());
    setCountdown(REFRESH_INTERVAL);
    if (isBackground) setRefreshing(false);
    else setLoading(false);
  }, []);

  // Initial load
  useEffect(() => { void load(); }, [load]);

  // Auto-refresh timer
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          void load(true);
          return REFRESH_INTERVAL;
        }
        return c - 1;
      });
    }, 1000);
    countdownRef.current = tick;
    return () => clearInterval(tick);
  }, [load]);

  // Derived counts
  const counts = useMemo(() => ({
    critical: insights.filter((i) => i.severity === "CRITICAL").length,
    warning:  insights.filter((i) => i.severity === "WARNING").length,
    info:     insights.filter((i) => i.severity !== "CRITICAL" && i.severity !== "WARNING").length,
  }), [insights]);

  const activePolicies   = useMemo(() => policies.filter((p) => p.is_active), [policies]);
  const inactivePolicies = useMemo(() => policies.filter((p) => !p.is_active), [policies]);

  // Overall system health derived value
  const systemOk = health?.checks
    ? Object.values(health.checks).every((c) => c?.healthy !== false)
    : null;

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      await apiClient<{ message: string }>("/reports/generate?report_type=operational", { method: "POST" });
      await load(true);
    } catch {
      // silently continue — load() already surfaces errors
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ─── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-muted animate-pulse" />
          <div className="h-4 w-96 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
        <div className="h-80 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl space-y-6 duration-500 animate-in fade-in">

      {/* ── Header ── */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Agent Insights
            </h1>
            {systemOk === true && (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <CheckCircle2 className="mr-1 h-3 w-3" /> All systems operational
              </Badge>
            )}
            {systemOk === false && (
              <Badge variant="destructive">
                <AlertCircle className="mr-1 h-3 w-3" /> System issue detected
              </Badge>
            )}
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Interview scores, coach report, and transcript first. Platform health and ops tabs below.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastRefreshed
                ? `Refreshed ${relativeTime(lastRefreshed.toISOString())}`
                : "Loading…"}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
              {refreshing ? "Refreshing…" : `Next refresh in ${countdown}s`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh now
          </Button>
          <Button
            size="sm"
            onClick={() => void handleRunAnalysis()}
            disabled={isAnalyzing}
            className="rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            {isAnalyzing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isAnalyzing ? "Queuing…" : "Run analysis"}
          </Button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <InterviewInsightsReport sessions={interviews} />

      {/* ── System health strip ── */}
      <Card className="border border-border shadow-sm">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            {/* Health checks */}
            <div className="flex items-center gap-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Services
              </span>
              <HealthDot healthy={health?.checks?.database?.healthy} label="Database" />
              <HealthDot healthy={health?.checks?.gemini_api?.healthy} label="AI Engine" />
              <HealthDot healthy={health?.checks?.storage?.healthy} label="Storage" />
            </div>

            <div className="h-6 w-px bg-border" />

            {/* System metrics */}
            {sysMet?.system ? (
              <div className="flex flex-wrap items-center gap-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  System
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono font-medium text-foreground">{sysMet.system.cpu_percent.toFixed(1)}%</span>
                  <span className="text-muted-foreground">CPU</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <Server className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono font-medium text-foreground">{sysMet.system.memory_percent.toFixed(1)}%</span>
                  <span className="text-muted-foreground">Memory</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono font-medium text-foreground">{sysMet.system.disk_usage_percent.toFixed(1)}%</span>
                  <span className="text-muted-foreground">Disk</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono font-medium text-foreground">{formatUptime(sysMet.system.uptime_seconds)}</span>
                  <span className="text-muted-foreground">Uptime</span>
                </span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">System metrics require superuser access</span>
            )}

            {/* DB pool */}
            {sysMet?.database && (
              <>
                <div className="h-6 w-px bg-border" />
                <span className="flex items-center gap-1.5 text-xs">
                  <Database className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono font-medium text-foreground">
                    {sysMet.database.checked_out}/{sysMet.database.pool_size}
                  </span>
                  <span className="text-muted-foreground">DB pool</span>
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── 6 stat cards ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {/* Critical */}
        <Card className={cn("border shadow-sm", counts.critical > 0 ? "border-red-400/40 bg-red-50/60 dark:bg-red-950/20" : "border-border")}>
          <CardContent className="flex flex-col gap-1 py-4">
            <AlertCircle className={cn("h-4 w-4", counts.critical > 0 ? "text-red-500" : "text-muted-foreground")} />
            <p className="text-2xl font-bold tracking-tight text-foreground">{counts.critical}</p>
            <p className="text-xs text-muted-foreground">Critical</p>
          </CardContent>
        </Card>

        {/* Warnings */}
        <Card className={cn("border shadow-sm", counts.warning > 0 ? "border-amber-400/40 bg-amber-50/60 dark:bg-amber-950/20" : "border-border")}>
          <CardContent className="flex flex-col gap-1 py-4">
            <AlertTriangle className={cn("h-4 w-4", counts.warning > 0 ? "text-amber-500" : "text-muted-foreground")} />
            <p className="text-2xl font-bold tracking-tight text-foreground">{counts.warning}</p>
            <p className="text-xs text-muted-foreground">Warnings</p>
          </CardContent>
        </Card>

        {/* Pending approvals */}
        <Card className={cn("border shadow-sm", decisions.length > 0 ? "border-violet-400/40 bg-violet-50/60 dark:bg-violet-950/20" : "border-border")}>
          <CardContent className="flex flex-col gap-1 py-4">
            <Brain className={cn("h-4 w-4", decisions.length > 0 ? "text-violet-500" : "text-muted-foreground")} />
            <p className="text-2xl font-bold tracking-tight text-foreground">{decisions.length}</p>
            <p className="text-xs text-muted-foreground">Pending decisions</p>
          </CardContent>
        </Card>

        {/* Active policies */}
        <Card className="border border-border shadow-sm">
          <CardContent className="flex flex-col gap-1 py-4">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {metrics ? `${metrics.policies_active}/${metrics.policies_total}` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Active policies</p>
          </CardContent>
        </Card>

        {/* Audit events */}
        <Card className="border border-border shadow-sm">
          <CardContent className="flex flex-col gap-1 py-4">
            <Activity className="h-4 w-4 text-emerald-500" />
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {metrics != null ? String(metrics.audit_events_24h ?? 0) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {metrics != null && metrics.users_total != null
                ? "Audit events 24h (org)"
                : "Your audit events 24h"}
            </p>
          </CardContent>
        </Card>

        {/* Team / your records */}
        <Card className="border border-border shadow-sm">
          <CardContent className="flex flex-col gap-1 py-4">
            <Users className="h-4 w-4 text-blue-500" />
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {metrics == null
                ? "—"
                : metrics.users_total != null
                  ? String(metrics.users_total)
                  : metrics.items_owned != null
                    ? String(metrics.items_owned)
                    : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {metrics != null && metrics.users_total != null
                ? "Team members"
                : "Your records"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabbed deep-dive ── */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
        <TabsList className="mb-5 rounded-xl border border-border bg-muted/50 p-1">
          <TabsTrigger value="feed" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Activity className="mr-2 h-4 w-4" />
            Live Feed
            {auditLogs.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-4 rounded-full px-1.5 text-[10px]">
                {auditLogs.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="issues" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <AlertCircle className="mr-2 h-4 w-4" />
            Open Issues
            {(counts.critical + counts.warning) > 0 && (
              <Badge variant="destructive" className="ml-2 h-4 rounded-full px-1.5 text-[10px]">
                {counts.critical + counts.warning}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="policies" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Workflow className="mr-2 h-4 w-4" />
            Policies
          </TabsTrigger>
          <TabsTrigger value="decisions" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Brain className="mr-2 h-4 w-4" />
            Decisions
            {decisions.length > 0 && (
              <Badge className="ml-2 h-4 rounded-full bg-violet-500 px-1.5 text-[10px] text-white">
                {decisions.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Live Feed tab ── */}
        <TabsContent value="feed" className="mt-0">
          <Card className="overflow-hidden border border-border shadow-sm">
            <CardHeader className="border-b border-border bg-muted/40">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" />
                Recent API activity
              </CardTitle>
              <CardDescription>
                Last {auditLogs.length} requests processed by the backend — updates every {REFRESH_INTERVAL}s.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {auditLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <Activity className="h-8 w-8 opacity-20" />
                  <p>No API traffic recorded yet, or superuser access required.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-center gap-4 px-5 py-3 text-sm transition-colors hover:bg-muted/30">
                      {/* Method badge */}
                      <Badge
                        variant="outline"
                        className={cn("w-16 shrink-0 justify-center font-mono text-[10px]", methodColor(log.http_method))}
                      >
                        {log.http_method}
                      </Badge>

                      {/* Endpoint */}
                      <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                        {log.endpoint}
                      </span>

                      {/* Status */}
                      <span className={cn("shrink-0 rounded px-2 py-0.5 font-mono text-xs font-medium", statusBadge(log.status_code))}>
                        {log.status_code}
                      </span>

                      {/* Latency */}
                      <span className={cn(
                        "w-16 shrink-0 text-right font-mono text-xs",
                        log.processing_time_ms > 1000 ? "text-amber-500" : "text-muted-foreground"
                      )}>
                        {log.processing_time_ms < 1000
                          ? `${Math.round(log.processing_time_ms)}ms`
                          : `${(log.processing_time_ms / 1000).toFixed(1)}s`}
                      </span>

                      {/* Time */}
                      <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                        {relativeTime(log.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error rate inline summary */}
          {auditLogs.length > 0 && (() => {
            const errors5xx = auditLogs.filter((l) => l.status_code >= 500).length;
            const errors4xx = auditLogs.filter((l) => l.status_code >= 400 && l.status_code < 500).length;
            const avgLatency = auditLogs.reduce((a, l) => a + l.processing_time_ms, 0) / auditLogs.length;
            return (
              <div className="mt-3 grid grid-cols-3 gap-4">
                <Card className="border border-border shadow-sm">
                  <CardContent className="py-4 text-center">
                    <p className={cn("text-2xl font-bold", errors5xx > 0 ? "text-red-500" : "text-foreground")}>{errors5xx}</p>
                    <p className="text-xs text-muted-foreground">5xx errors</p>
                  </CardContent>
                </Card>
                <Card className="border border-border shadow-sm">
                  <CardContent className="py-4 text-center">
                    <p className={cn("text-2xl font-bold", errors4xx > 3 ? "text-amber-500" : "text-foreground")}>{errors4xx}</p>
                    <p className="text-xs text-muted-foreground">4xx errors</p>
                  </CardContent>
                </Card>
                <Card className="border border-border shadow-sm">
                  <CardContent className="py-4 text-center">
                    <p className={cn("text-2xl font-bold", avgLatency > 500 ? "text-amber-500" : "text-foreground")}>
                      {avgLatency < 1000 ? `${Math.round(avgLatency)}ms` : `${(avgLatency / 1000).toFixed(1)}s`}
                    </p>
                    <p className="text-xs text-muted-foreground">Avg latency</p>
                  </CardContent>
                </Card>
              </div>
            );
          })()}
        </TabsContent>

        {/* ── Open Issues tab ── */}
        <TabsContent value="issues" className="mt-0 space-y-4">
          {insights.length === 0 ? (
            <Card className="border border-border shadow-sm">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 opacity-60" />
                <div>
                  <p className="font-medium text-foreground">No open issues</p>
                  <p className="mt-1 text-sm">All rule-based checks passed. Run an analysis job to generate fresh signals.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void handleRunAnalysis()} disabled={isAnalyzing}>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Run analysis
                </Button>
              </CardContent>
            </Card>
          ) : (
            insights.map((insight) => (
              <Card
                key={insight.id}
                className={cn(
                  "overflow-hidden border-l-4 border border-border shadow-sm",
                  insight.severity === "CRITICAL"
                    ? "border-l-red-500 bg-red-50/20 dark:bg-red-950/10"
                    : insight.severity === "WARNING"
                    ? "border-l-amber-500 bg-amber-50/20 dark:bg-amber-950/10"
                    : "border-l-blue-400"
                )}
              >
                <CardContent>
                  {/* Title row */}
                  <div className="flex flex-wrap items-start gap-3">
                    {insight.severity === "CRITICAL" ? (
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                    ) : insight.severity === "WARNING" ? (
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                    ) : (
                      <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
                    )}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-foreground">{insight.title}</h4>
                        <Badge
                          variant={insight.severity === "CRITICAL" ? "destructive" : "secondary"}
                          className={
                            insight.severity === "WARNING"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                              : insight.severity !== "CRITICAL"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                              : ""
                          }
                        >
                          {insight.severity}
                        </Badge>
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {insight.insight_type}
                        </span>
                        <span className="text-xs text-muted-foreground">{insight.confidence} confidence</span>
                      </div>

                      <p className="mt-2 text-sm leading-relaxed text-foreground/80">{insight.description}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {new Date(insight.timestamp).toLocaleString()}
                        </span>
                        <Link
                          href="/logs"
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 rounded-lg text-xs")}
                        >
                          <Zap className="mr-1 h-3 w-3" />
                          View logs
                        </Link>
                        {insight.severity === "CRITICAL" && (
                          <Link
                            href="/ai/insights?tab=decisions"
                            className={cn(buttonVariants({ size: "sm" }), "h-7 rounded-lg text-xs")}
                          >
                            <ChevronRight className="mr-1 h-3 w-3" />
                            Review in Decisions
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Policies tab ── */}
        <TabsContent value="policies" className="mt-0">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Active policies */}
            <Card className="border border-border shadow-sm">
              <CardHeader className="border-b border-border bg-muted/40">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Active guardrails
                  <Badge className="ml-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    {activePolicies.length}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  These rules are enforced on every agent decision.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {activePolicies.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                    No active policies — agents are unconstrained.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {activePolicies.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{p.name}</span>
                        <Badge variant="outline" className="shrink-0 font-mono text-[10px] capitalize">
                          {p.policy_type.replace("_", " ")}
                        </Badge>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">P{p.priority}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Inactive policies */}
            <Card className="border border-border shadow-sm">
              <CardHeader className="border-b border-border bg-muted/40">
                <CardTitle className="flex items-center gap-2 text-base">
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                  Inactive / disabled
                  <Badge variant="secondary" className="ml-auto">
                    {inactivePolicies.length}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  These policies exist but are not being applied.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {inactivePolicies.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                    All policies are active.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {inactivePolicies.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 px-5 py-3 opacity-60 hover:opacity-100 hover:bg-muted/30">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" />
                        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{p.name}</span>
                        <Badge variant="outline" className="shrink-0 font-mono text-[10px] capitalize">
                          {p.policy_type.replace("_", " ")}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* System metrics gauges if available */}
          {sysMet?.system && (
            <Card className="mt-4 border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cpu className="h-4 w-4 text-primary" />
                  Server resource usage
                </CardTitle>
                <CardDescription>
                  Live system metrics from the backend host — Python {sysMet.system.python_version}.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-3">
                <GaugeBar
                  value={sysMet.system.cpu_percent}
                  label="CPU usage"
                  color={sysMet.system.cpu_percent > 80 ? "bg-red-500" : sysMet.system.cpu_percent > 60 ? "bg-amber-500" : "bg-emerald-500"}
                />
                <GaugeBar
                  value={sysMet.system.memory_percent}
                  label="Memory usage"
                  color={sysMet.system.memory_percent > 85 ? "bg-red-500" : sysMet.system.memory_percent > 70 ? "bg-amber-500" : "bg-primary"}
                />
                <GaugeBar
                  value={sysMet.system.disk_usage_percent}
                  label="Disk usage"
                  color={sysMet.system.disk_usage_percent > 90 ? "bg-red-500" : sysMet.system.disk_usage_percent > 75 ? "bg-amber-500" : "bg-primary"}
                />
              </CardContent>
            </Card>
          )}

          <div className="mt-4 flex justify-end">
            <Link
              href="/ai/policies"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}
            >
              Manage all policies
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </div>
        </TabsContent>

        {/* ── Decisions tab ── */}
        <TabsContent value="decisions" className="mt-0 space-y-4">
          {decisions.length === 0 ? (
            <Card className="border border-border shadow-sm">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 opacity-60" />
                <div>
                  <p className="font-medium text-foreground">Queue is clear</p>
                  <p className="mt-1 text-sm">
                    No pending decisions. Agents are operating within approved parameters.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            decisions.map((d) => (
              <PendingDecisionCard key={d.id} decision={d} onResolved={() => void load(true)} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AIInsightsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <AIInsightsPageInner />
    </Suspense>
  );
}
