"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BrainCircuit,
  Lightbulb,
  Loader2,
  Sparkles,
  Activity,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardMetrics, InsightItem } from "@/lib/dashboard-types";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export default function AIInsightsPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, ins] = await Promise.all([
        apiClient<DashboardMetrics>("/dashboard/metrics"),
        apiClient<InsightItem[]>("/dashboard/insights"),
      ]);
      setMetrics(m);
      setInsights(ins);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load insights.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const critical = insights.filter((i) => i.severity === "CRITICAL").length;
    const warning = insights.filter((i) => i.severity === "WARNING").length;
    const rec = Math.max(0, insights.length - critical - warning);
    return { critical, warning, rec };
  }, [insights]);

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setHint(null);
    try {
      const res = await apiClient<{ message: string }>(
        "/reports/generate?report_type=operational",
        { method: "POST" }
      );
      setHint(res.message ?? "Analysis job queued.");
      await load();
    } catch (e) {
      setHint(e instanceof Error ? e.message : "Could not queue analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex max-w-6xl items-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading insights…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 duration-500 animate-in fade-in">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-fluid-h2 font-bold tracking-tight text-foreground">
            Agent insights
          </h1>
          <p className="mt-1 text-muted-foreground">
            Rule-based signals from policies, approvals, audit traffic, and AI
            latency (
            <code className="font-mono text-xs">GET /dashboard/insights</code>
            ).
          </p>
        </div>
        <Button
          onClick={() => void handleRunAnalysis()}
          disabled={isAnalyzing}
          className="rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
        >
          {isAnalyzing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {isAnalyzing ? "Queuing…" : "Run analysis job"}
        </Button>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          {hint}
        </p>
      ) : null}

      {insights.length === 0 && !error ? (
        <p className="text-sm text-muted-foreground">
          No open issues detected for your access level. Superusers see pending
          approvals, error rates, and policy gaps.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="border-red-500/20 bg-red-50/50 shadow-sm dark:bg-red-950/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-xl bg-red-100 p-3 text-red-600 dark:bg-red-900/30">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">{counts.critical}</p>
              <p className="text-sm font-medium text-muted-foreground">
                Critical issues
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-amber-50/50 shadow-sm dark:bg-amber-950/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-xl bg-amber-100 p-3 text-amber-600 dark:bg-amber-900/30">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">{counts.warning}</p>
              <p className="text-sm font-medium text-muted-foreground">Warnings</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-50/50 shadow-sm dark:bg-blue-950/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-xl bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/30">
              <Lightbulb className="h-6 w-6" />
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">{counts.rec}</p>
              <p className="text-sm font-medium text-muted-foreground">
                Recommendations
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {metrics ? (
        <p className="text-xs text-muted-foreground">
          Policies: {metrics.policies_active} active / {metrics.policies_total} total
          {metrics.pending_decisions != null
            ? ` · Pending approvals: ${metrics.pending_decisions}`
            : ""}
          {metrics.audit_events_24h != null
            ? ` · Audit events (24h): ${metrics.audit_events_24h}`
            : ""}
        </p>
      ) : null}

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="mb-6 rounded-xl border border-border/50 bg-muted/50 p-1">
          <TabsTrigger
            value="summary"
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Activity className="mr-2 h-4 w-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger
            value="patterns"
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <BrainCircuit className="mr-2 h-4 w-4" />
            Patterns
          </TabsTrigger>
          <TabsTrigger
            value="actions"
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Zap className="mr-2 h-4 w-4" />
            Actions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">All insights</h3>
            <p className="text-sm text-muted-foreground">
              Generated from live database checks (not an external LLM).
            </p>
          </div>

          {insights.length === 0 ? (
            <Card className="glass-panel p-8 text-center text-muted-foreground">
              <p>No insight cards for the current window.</p>
            </Card>
          ) : (
            insights.map((insight) => (
              <Card
                key={insight.id}
                className={`overflow-hidden border-l-4 shadow-sm ${
                  insight.severity === "CRITICAL"
                    ? "border-l-red-500 bg-red-50/30 dark:bg-red-950/20"
                    : "border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/20"
                }`}
              >
                <CardContent className="p-6">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                      {insight.severity === "CRITICAL" ? (
                        <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                      )}
                      <h4 className="text-lg font-bold text-foreground">
                        {insight.title}
                      </h4>
                      <Badge
                        variant={
                          insight.severity === "CRITICAL"
                            ? "destructive"
                            : "secondary"
                        }
                        className={
                          insight.severity === "WARNING"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                            : ""
                        }
                      >
                        {insight.severity}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {insight.confidence} confident
                      </span>
                    </div>
                  </div>

                  <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{insight.insight_type}</span>
                    <span>•</span>
                    <span>{new Date(insight.timestamp).toLocaleString()}</span>
                    <span>•</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                      RULE ENGINE
                    </span>
                  </div>

                  <p className="mb-6 text-sm leading-relaxed text-foreground/80">
                    {insight.description}
                  </p>

                  <Link
                    href="/logs"
                    className={cn(
                      buttonVariants({ variant: "default" }),
                      "inline-flex rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    )}
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Open run logs
                  </Link>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="patterns">
          <Card className="glass-panel p-12 text-center text-muted-foreground">
            <BrainCircuit className="mx-auto mb-4 h-12 w-12 opacity-20" />
            <p>
              Pattern mining is not enabled in this template. Use audit exports
              or your warehouse for cohort analysis.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="actions">
          <Card className="glass-panel p-12 text-center text-muted-foreground">
            <Zap className="mx-auto mb-4 h-12 w-12 opacity-20" />
            <p>
              Automated remediation hooks are not wired. Approve or reject items
              under Human approvals.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
