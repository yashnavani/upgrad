"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Brain,
  ChevronRight,
  Clock,
  Filter,
  Loader2,
  Pencil,
  Plus,
  PowerOff,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Trash2,
  Workflow,
  XCircle,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { AuditLogRow, DashboardMetrics, MeDto } from "@/lib/dashboard-types";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type PolicyDto = {
  id: string;
  name: string;
  description: string | null;
  natural_language: string;
  policy_type: "logical" | "natural_language";
  is_active: boolean;
  priority: number;
  refined_instruction?: string | null;
  tags?: string[];
  updated_at?: string;
  created_at?: string;
};

type PolicyForm = {
  name: string;
  description: string;
  natural_language: string;
  policy_type: "logical" | "natural_language";
  priority: number;
  tags: string;
};

const EMPTY_FORM: PolicyForm = {
  name: "",
  description: "",
  natural_language: "",
  policy_type: "logical",
  priority: 10,
  tags: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

function typeLabel(t: string) {
  return t === "natural_language" ? "NL Rule" : "Logical";
}

function typeBadgeClass(t: string) {
  return t === "natural_language"
    ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300"
    : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300";
}

function methodBadge(method: string) {
  const map: Record<string, string> = {
    GET:    "text-blue-600 border-blue-200 dark:border-blue-800",
    POST:   "text-emerald-600 border-emerald-200 dark:border-emerald-800",
    PATCH:  "text-amber-600 border-amber-200 dark:border-amber-800",
    PUT:    "text-amber-600 border-amber-200 dark:border-amber-800",
    DELETE: "text-red-600 border-red-200 dark:border-red-800",
  };
  return map[method] ?? "text-muted-foreground border-border";
}

function statusBadge(code: number) {
  if (code < 300) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  if (code < 500) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
}

// ─── Policy Form (shared between Create & Edit) ───────────────────────────────

function PolicyFormFields({
  form,
  onChange,
}: {
  form: PolicyForm;
  onChange: (f: PolicyForm) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <label className="text-xs font-semibold text-foreground">Policy name *</label>
        <Input
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="e.g. No PII in responses"
        />
      </div>

      <div className="grid gap-1.5">
        <label className="text-xs font-semibold text-foreground">Short description</label>
        <Input
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          placeholder="Displayed on the policy card"
        />
      </div>

      <div className="grid gap-1.5">
        <label className="text-xs font-semibold text-foreground">Rule / instruction *</label>
        <Textarea
          value={form.natural_language}
          onChange={(e) => onChange({ ...form, natural_language: e.target.value })}
          placeholder="Describe in plain language what the agent must or must not do…"
          rows={5}
        />
        <p className="text-xs text-muted-foreground">
          Write as if instructing the agent directly. Be specific and unambiguous.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-1.5">
          <label className="text-xs font-semibold text-foreground">Type</label>
          <select
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
            value={form.policy_type}
            onChange={(e) => onChange({ ...form, policy_type: e.target.value as "logical" | "natural_language" })}
          >
            <option value="logical">Logical (structured)</option>
            <option value="natural_language">Natural language</option>
          </select>
        </div>

        <div className="grid gap-1.5">
          <label className="text-xs font-semibold text-foreground">
            Priority <span className="text-muted-foreground">(lower = first)</span>
          </label>
          <Input
            type="number"
            min={1}
            max={999}
            value={form.priority}
            onChange={(e) => onChange({ ...form, priority: parseInt(e.target.value) || 1 })}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <label className="text-xs font-semibold text-foreground">Tags <span className="text-muted-foreground">(comma-separated)</span></label>
        <Input
          value={form.tags}
          onChange={(e) => onChange({ ...form, tags: e.target.value })}
          placeholder="e.g. safety, pii, financial"
        />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AIPoliciesPage() {
  // Data
  const [policies, setPolicies]   = useState<PolicyDto[]>([]);
  const [metrics, setMetrics]     = useState<DashboardMetrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Toggle / action busy state
  const [togglingId, setTogglingId]             = useState<string | null>(null);
  const [suggestionActionId, setSuggestionActionId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy]                 = useState(false);

  // Dialogs
  const [createOpen, setCreateOpen]       = useState(false);
  const [editTarget, setEditTarget]       = useState<PolicyDto | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<PolicyDto | null>(null);
  const [killOpen, setKillOpen]           = useState(false);
  const [killConfirm, setKillConfirm]     = useState("");
  const [saving, setSaving]               = useState(false);
  const [deleting, setDeleting]           = useState(false);

  // Forms
  const [createForm, setCreateForm] = useState<PolicyForm>(EMPTY_FORM);
  const [editForm, setEditForm]     = useState<PolicyForm>(EMPTY_FORM);

  // Filters (Control Panel)
  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [filterType, setFilterType]     = useState<"all" | "logical" | "natural_language">("all");

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async (bg = false) => {
    if (bg) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const me = await apiClient<MeDto>("/users/me");
      const [polRes, metRes] = await Promise.allSettled([
        apiClient<PolicyDto[]>("/policies"),
        apiClient<DashboardMetrics>("/dashboard/metrics"),
      ]);
      if (polRes.status === "fulfilled") setPolicies(polRes.value);
      else
        setError(
          polRes.reason instanceof Error
            ? polRes.reason.message
            : "Failed to load policies."
        );
      if (metRes.status === "fulfilled") setMetrics(metRes.value);

      if (me.is_superuser) {
        const logRes = await Promise.allSettled([
          apiClient<AuditLogRow[]>("/audit-logs?limit=50"),
        ]);
        if (logRes[0].status === "fulfilled") {
          setAuditLogs(
            logRes[0].value.filter((l) => l.endpoint.includes("/policies"))
          );
        } else {
          setAuditLogs([]);
        }
      } else {
        setAuditLogs([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    }
    if (bg) setRefreshing(false);
    else setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const suggestions = useMemo(
    () => policies.filter((p) => {
      if (p.is_active) return false;
      const tags = p.tags ?? [];
      return tags.includes("ai-optimized") || p.name.startsWith("AI Suggestion:");
    }),
    [policies]
  );

  const corePolicies = useMemo(
    () => policies.filter((p) => !suggestions.some((s) => s.id === p.id)),
    [policies, suggestions]
  );

  const activeCore   = useMemo(() => corePolicies.filter((p) => p.is_active), [corePolicies]);
  const inactiveCore = useMemo(() => corePolicies.filter((p) => !p.is_active), [corePolicies]);

  const governanceScore = corePolicies.length === 0 ? 0
    : Math.round((activeCore.length / corePolicies.length) * 100);

  const filteredPolicies = useMemo(() => {
    return corePolicies
      .filter((p) => {
        if (filterStatus === "active" && !p.is_active) return false;
        if (filterStatus === "inactive" && p.is_active) return false;
        if (filterType !== "all" && p.policy_type !== filterType) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            p.name.toLowerCase().includes(q) ||
            p.natural_language.toLowerCase().includes(q) ||
            (p.description?.toLowerCase().includes(q) ?? false) ||
            (p.tags?.some((t) => t.toLowerCase().includes(q)) ?? false)
          );
        }
        return true;
      })
      .sort((a, b) => a.priority - b.priority);
  }, [corePolicies, search, filterStatus, filterType]);

  // ── Toggle single policy ──────────────────────────────────────────────────

  const togglePolicy = async (id: string, active: boolean) => {
    setTogglingId(id);
    const prev = policies;
    setPolicies((p) => p.map((x) => (x.id === id ? { ...x, is_active: active } : x)));
    try {
      await apiClient<PolicyDto>(`/policies/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: active }),
      });
    } catch (e) {
      setPolicies(prev);
      setError(e instanceof Error ? e.message : "Failed to update policy.");
    } finally {
      setTogglingId(null);
    }
  };

  // ── Bulk: enable / disable all core policies ──────────────────────────────

  const bulkToggle = async (active: boolean) => {
    setBulkBusy(true);
    setError(null);
    const targets = corePolicies.filter((p) => p.is_active !== active);
    try {
      await Promise.all(
        targets.map((p) =>
          apiClient<PolicyDto>(`/policies/${p.id}`, {
            method: "PATCH",
            body: JSON.stringify({ is_active: active }),
          })
        )
      );
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk operation failed.");
    } finally {
      setBulkBusy(false);
    }
  };

  // ── Emergency kill switch ────────────────────────────────────────────────

  const handleKillSwitch = async () => {
    if (killConfirm !== "STOP") return;
    setKillOpen(false);
    setKillConfirm("");
    await bulkToggle(false);
  };

  // ── Create policy ────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.natural_language.trim()) {
      setError("Name and rule text are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient<PolicyDto>("/policies", {
        method: "POST",
        body: JSON.stringify({
          name: createForm.name.trim(),
          description: createForm.description.trim() || null,
          natural_language: createForm.natural_language.trim(),
          policy_type: createForm.policy_type,
          priority: createForm.priority,
          tags: createForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      setCreateOpen(false);
      setCreateForm(EMPTY_FORM);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create policy.");
    } finally {
      setSaving(false);
    }
  };

  // ── Edit policy ──────────────────────────────────────────────────────────

  const openEdit = (p: PolicyDto) => {
    setEditTarget(p);
    setEditForm({
      name: p.name,
      description: p.description ?? "",
      natural_language: p.natural_language,
      policy_type: p.policy_type,
      priority: p.priority,
      tags: (p.tags ?? []).join(", "),
    });
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (!editForm.name.trim() || !editForm.natural_language.trim()) {
      setError("Name and rule text are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient<PolicyDto>(`/policies/${editTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description.trim() || null,
          natural_language: editForm.natural_language.trim(),
          policy_type: editForm.policy_type,
          priority: editForm.priority,
          tags: editForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      setEditTarget(null);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update policy.");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete policy ────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await apiClient(`/policies/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete policy.");
    } finally {
      setDeleting(false);
    }
  };

  // ── Suggestions ──────────────────────────────────────────────────────────

  const applySuggestion = async (id: string) => {
    setSuggestionActionId(id);
    const prev = policies;
    setPolicies((p) => p.map((x) => (x.id === id ? { ...x, is_active: true } : x)));
    try {
      await apiClient<PolicyDto>(`/policies/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: true }),
      });
      await load(true);
    } catch (e) {
      setPolicies(prev);
      setError(e instanceof Error ? e.message : "Failed to apply suggestion.");
    } finally {
      setSuggestionActionId(null);
    }
  };

  const dismissSuggestion = async (id: string) => {
    setSuggestionActionId(id);
    const prev = policies;
    setPolicies((p) => p.filter((x) => x.id !== id));
    try {
      await apiClient(`/policies/${id}`, { method: "DELETE" });
    } catch (e) {
      setPolicies(prev);
      setError(e instanceof Error ? e.message : "Failed to dismiss suggestion.");
    } finally {
      setSuggestionActionId(null);
    }
  };

  // ── Score color ───────────────────────────────────────────────────────────

  const scoreColor =
    governanceScore === 0 ? "text-red-500"
    : governanceScore < 50 ? "text-amber-500"
    : "text-emerald-500";

  const scoreBarColor =
    governanceScore === 0 ? "bg-red-500"
    : governanceScore < 50 ? "bg-amber-500"
    : "bg-emerald-500";

  const scoreLabel =
    governanceScore === 0 ? "Agents unconstrained — CRITICAL"
    : governanceScore < 50 ? "Partial governance — review inactive rules"
    : governanceScore < 100 ? "Good coverage — some rules disabled"
    : "Full governance — all rules enforced";

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="h-7 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="h-24 w-full animate-pulse rounded-xl bg-muted" />
        <div className="grid gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 w-full animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl space-y-6 duration-500 animate-in fade-in">

      {/* ── Page header ── */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Governance & Control
          </h1>
          <p className="text-sm text-muted-foreground">
            Human oversight of every rule the AI agents operate under. Toggle, edit, prioritise, or halt agent behaviour instantly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setKillOpen(true)}
            disabled={activeCore.length === 0 || bulkBusy}
            className="gap-1.5"
          >
            <PowerOff className="h-3.5 w-3.5" />
            Emergency stop
          </Button>
          <Button
            size="sm"
            className="rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New policy
          </Button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* ── Governance status command bar ── */}
      <Card className="border border-border shadow-sm">
        <CardContent className="py-5">
          <div className="flex flex-wrap items-center gap-8">

            {/* Score */}
            <div className="min-w-[160px] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Governance coverage
                </span>
                <span className={cn("text-lg font-bold", scoreColor)}>
                  {governanceScore}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", scoreBarColor)}
                  style={{ width: `${governanceScore}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{scoreLabel}</p>
            </div>

            <div className="h-12 w-px bg-border" />

            {/* Quick stats */}
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span className="text-sm">
                  <span className="font-bold text-foreground">{activeCore.length}</span>
                  <span className="ml-1 text-muted-foreground">active</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldOff className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-bold text-foreground">{inactiveCore.length}</span>
                  <span className="ml-1 text-muted-foreground">disabled</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" />
                <span className="text-sm">
                  <span className="font-bold text-foreground">{suggestions.length}</span>
                  <span className="ml-1 text-muted-foreground">AI proposals</span>
                </span>
              </div>
              {metrics?.pending_decisions != null && (
                <div className="flex items-center gap-2">
                  <Brain className={cn("h-4 w-4", metrics.pending_decisions > 0 ? "text-violet-500" : "text-muted-foreground")} />
                  <span className="text-sm">
                    <span className={cn("font-bold", metrics.pending_decisions > 0 ? "text-violet-600" : "text-foreground")}>
                      {metrics.pending_decisions}
                    </span>
                    <span className="ml-1 text-muted-foreground">decisions pending</span>
                  </span>
                  {metrics.pending_decisions > 0 && (
                    <Link
                      href="/ai/insights?tab=decisions"
                      className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
                    >
                      Review <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={bulkBusy || inactiveCore.length === 0}
                onClick={() => void bulkToggle(true)}
                className="gap-1.5 text-emerald-600 hover:border-emerald-300 hover:text-emerald-700"
              >
                {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                Enable all
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={bulkBusy || activeCore.length === 0}
                onClick={() => void bulkToggle(false)}
                className="gap-1.5 text-muted-foreground"
              >
                {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />}
                Disable all
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Main tabs ── */}
      <Tabs defaultValue="control" className="w-full">
        <TabsList className="mb-5 rounded-xl border border-border bg-muted/50 p-1">
          <TabsTrigger value="control" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Workflow className="mr-2 h-4 w-4" />
            Control panel
            <Badge variant="secondary" className="ml-2 h-4 rounded-full px-1.5 text-[10px]">
              {corePolicies.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Sparkles className="mr-2 h-4 w-4 text-violet-500" />
            AI proposals
            {suggestions.length > 0 && (
              <Badge className="ml-2 h-4 rounded-full bg-violet-500 px-1.5 text-[10px] text-white">
                {suggestions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Clock className="mr-2 h-4 w-4" />
            Policy log
          </TabsTrigger>
        </TabsList>

        {/* ── Control Panel tab ── */}
        <TabsContent value="control" className="mt-0 space-y-4">

          {/* Search + filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search policies by name, rule text, or tag…"
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as "all" | "active" | "inactive")}
              >
                <option value="all">All status</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
              <select
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as "all" | "logical" | "natural_language")}
              >
                <option value="all">All types</option>
                <option value="logical">Logical</option>
                <option value="natural_language">Natural language</option>
              </select>
            </div>
            <span className="text-xs text-muted-foreground">
              {filteredPolicies.length} of {corePolicies.length} rules
            </span>
          </div>

          {/* Policy list */}
          {filteredPolicies.length === 0 ? (
            <Card className="border border-border shadow-sm">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                <ShieldAlert className="h-10 w-10 opacity-20" />
                <div>
                  <p className="font-medium text-foreground">
                    {corePolicies.length === 0 ? "No policies yet" : "No policies match your filters"}
                  </p>
                  <p className="mt-1 text-sm">
                    {corePolicies.length === 0
                      ? "Create your first governance rule to constrain agent behaviour."
                      : "Adjust the search or filters above."}
                  </p>
                </div>
                {corePolicies.length === 0 && (
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Create first policy
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden border border-border shadow-sm">
              {/* Table header */}
              <div className="grid grid-cols-[auto_48px_1fr_100px_80px_120px] items-center gap-4 border-b border-border bg-muted/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="w-10 text-center">On/Off</span>
                <span className="text-center">Pri</span>
                <span>Rule</span>
                <span>Type</span>
                <span>Updated</span>
                <span className="text-right">Actions</span>
              </div>

              {/* Policy rows */}
              <div className="divide-y divide-border">
                {filteredPolicies.map((policy) => (
                  <div
                    key={policy.id}
                    className={cn(
                      "group grid grid-cols-[auto_48px_1fr_100px_80px_120px] items-start gap-4 px-5 py-4 transition-colors hover:bg-muted/20",
                      !policy.is_active && "opacity-60 hover:opacity-100"
                    )}
                  >
                    {/* Toggle */}
                    <div className="flex w-10 justify-center pt-0.5">
                      <Switch
                        checked={policy.is_active}
                        disabled={togglingId === policy.id}
                        onCheckedChange={(v) => void togglePolicy(policy.id, v)}
                        aria-label={`Toggle ${policy.name}`}
                      />
                    </div>

                    {/* Priority */}
                    <div className="flex justify-center pt-1">
                      <span className={cn(
                        "inline-flex h-6 w-10 items-center justify-center rounded-md font-mono text-xs font-bold",
                        policy.priority <= 3
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : policy.priority <= 10
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-muted text-muted-foreground"
                      )}>
                        P{policy.priority}
                      </span>
                    </div>

                    {/* Name + description + tags */}
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        {policy.is_active ? (
                          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        ) : (
                          <ShieldOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <p className="font-semibold text-sm text-foreground leading-tight">{policy.name}</p>
                      </div>
                      {(policy.description || policy.natural_language) && (
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {policy.description || policy.natural_language}
                        </p>
                      )}
                      {(policy.tags ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {(policy.tags ?? []).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Type */}
                    <div className="pt-0.5">
                      <Badge variant="outline" className={cn("font-mono text-[10px]", typeBadgeClass(policy.policy_type))}>
                        {typeLabel(policy.policy_type)}
                      </Badge>
                    </div>

                    {/* Updated */}
                    <div className="pt-1 text-xs text-muted-foreground">
                      {relativeTime(policy.updated_at ?? policy.created_at)}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        onClick={() => openEdit(policy)}
                        title="Edit policy"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(policy)}
                        title="Delete policy"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Bottom CTA */}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)} className="rounded-full">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add another rule
            </Button>
          </div>
        </TabsContent>

        {/* ── AI Proposals tab ── */}
        <TabsContent value="suggestions" className="mt-0 space-y-4">
          <div>
            <h2 className="font-semibold text-foreground">AI-synthesised proposals</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Draft policies generated from recurring human feedback and corrections. Review each carefully before activating system-wide.
            </p>
          </div>

          {suggestions.length === 0 ? (
            <Card className="border border-border shadow-sm">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                <Sparkles className="h-10 w-10 opacity-20" />
                <div>
                  <p className="font-medium text-foreground">No proposals right now</p>
                  <p className="mt-1 text-sm">
                    The nightly worker surfaces patterns when enough human corrections accumulate.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {suggestions.map((s) => (
                <Card key={s.id} className="border border-border border-l-4 border-l-violet-500 shadow-sm">
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                        <div>
                          <CardTitle className="text-base">{s.name}</CardTitle>
                          <CardDescription className="mt-1 text-sm leading-relaxed">
                            {s.description?.trim() || "Pattern detected from recent human corrections."}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge className="shrink-0 bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                        AI proposal
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Proposed rule</p>
                      <p className="text-sm italic leading-relaxed text-foreground/80">
                        {`"${s.refined_instruction?.trim() || s.natural_language.trim()}"`}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={suggestionActionId === s.id}
                        onClick={() => void dismissSuggestion(s.id)}
                        className="text-muted-foreground"
                      >
                        <XCircle className="mr-1.5 h-3.5 w-3.5" />
                        Dismiss
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(s)}
                        disabled={suggestionActionId === s.id}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit then apply
                      </Button>
                      <Button
                        size="sm"
                        className="bg-violet-600 text-white hover:bg-violet-700"
                        disabled={suggestionActionId === s.id}
                        onClick={() => void applySuggestion(s.id)}
                      >
                        {suggestionActionId === s.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Zap className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Apply now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Policy Audit Log tab ── */}
        <TabsContent value="audit" className="mt-0">
          <Card className="overflow-hidden border border-border shadow-sm">
            <CardHeader className="border-b border-border bg-muted/40">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-primary" />
                Policy change log
              </CardTitle>
              <CardDescription>
                All API calls to <code className="font-mono text-xs">/policies</code> — who touched what and when.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {auditLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <Clock className="h-8 w-8 opacity-20" />
                  <p>No policy-related API calls yet, or superuser access required.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-4 px-5 py-3 text-sm transition-colors hover:bg-muted/20"
                    >
                      <Badge
                        variant="outline"
                        className={cn("w-16 shrink-0 justify-center font-mono text-[10px]", methodBadge(log.http_method))}
                      >
                        {log.http_method}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                        {log.endpoint}
                      </span>
                      <span className={cn("shrink-0 rounded px-2 py-0.5 font-mono text-xs font-medium", statusBadge(log.status_code))}>
                        {log.status_code}
                      </span>
                      <span className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground">
                        {Math.round(log.processing_time_ms)}ms
                      </span>
                      <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                        {relativeTime(log.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ────────────────── Dialogs ────────────────── */}

      {/* Create policy dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setCreateForm(EMPTY_FORM); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              New governance rule
            </DialogTitle>
            <DialogDescription>
              Define a constraint that every agent must obey. Rules are enforced immediately on save.
            </DialogDescription>
          </DialogHeader>
          <PolicyFormFields form={createForm} onChange={setCreateForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1.5 h-4 w-4" />}
              {saving ? "Saving…" : "Create rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit policy dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edit rule
            </DialogTitle>
            <DialogDescription>
              Changes take effect immediately for all agents that load this policy.
            </DialogDescription>
          </DialogHeader>
          <PolicyFormFields form={editForm} onChange={setEditForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={() => void handleEdit()} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete policy
            </DialogTitle>
            <DialogDescription>
              This will permanently remove{" "}
              <strong>{`"${deleteTarget?.name}"`}</strong> from the system.
              Agents will no longer be bound by this rule. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Keep it</Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
              {deleting ? "Deleting…" : "Yes, delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Emergency kill-switch dialog */}
      <Dialog open={killOpen} onOpenChange={(o) => { setKillOpen(o); if (!o) setKillConfirm(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <PowerOff className="h-5 w-5" />
              Emergency stop — disable all agents
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block">
                This will <strong>immediately disable all {activeCore.length} active policies</strong>. Agents will operate without any guardrails until policies are manually re-enabled.
              </span>
              <span className="block rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
                <AlertTriangle className="mb-0.5 mr-1.5 inline h-3.5 w-3.5" />
                Only use this in a genuine emergency. Re-enabling requires individual or bulk activation.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">
              Type <code className="rounded bg-muted px-1 font-mono">STOP</code> to confirm
            </label>
            <Input
              value={killConfirm}
              onChange={(e) => setKillConfirm(e.target.value)}
              placeholder="STOP"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setKillOpen(false); setKillConfirm(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={killConfirm !== "STOP" || bulkBusy}
              onClick={() => void handleKillSwitch()}
            >
              <PowerOff className="mr-1.5 h-4 w-4" />
              Halt all agents
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
