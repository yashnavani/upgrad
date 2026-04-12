"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { FeedbackModal } from "@/components/ai/FeedbackModal";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardMetrics, MeDto as MeProfile } from "@/lib/dashboard-types";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const ActivityChart = dynamic(
  () =>
    import("@/components/ui-patterns/ActivityChart").then((m) => m.ActivityChart),
  {
    ssr: false,
    loading: () => (
      <div className="glass-panel h-[300px] w-full animate-pulse rounded-xl bg-muted/20" />
    ),
  }
);

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

const DASHBOARD_AI_CARD_PROMPT =
  "Operations overview — deployed agent status card on the home dashboard.";
const DASHBOARD_AI_CARD_RESPONSE =
  "Active — client-facing agents and policy automations are running.";

export default function Home() {
  const [teachOpen, setTeachOpen] = useState(false);
  const [me, setMe] = useState<MeProfile | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportHint, setReportHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [profile, dash] = await Promise.all([
        apiClient<MeProfile>("/users/me"),
        apiClient<DashboardMetrics>("/dashboard/metrics"),
      ]);
      setMe(profile);
      setMetrics(dash);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load dashboard.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runHealthReport = async () => {
    setReportBusy(true);
    setReportHint(null);
    try {
      const res = await apiClient<{ message: string; status: string }>(
        "/reports/generate?report_type=operational",
        { method: "POST" }
      );
      setReportHint(res.message ?? "Report queued. Watch notifications.");
    } catch (e) {
      setReportHint(
        e instanceof Error ? e.message : "Could not queue report."
      );
    } finally {
      setReportBusy(false);
    }
  };

  const policiesActive = metrics?.policies_active ?? 0;
  const policiesTotal = metrics?.policies_total ?? 0;
  const audit24 = metrics?.audit_events_24h;
  const usersTotal = metrics?.users_total;
  const pending = metrics?.pending_decisions;
  const isSuper = me?.is_superuser === true;

  const agentsHeadline =
    policiesActive > 0 ? String(policiesActive) : policiesTotal > 0 ? "0" : "—";
  const agentsSub =
    policiesActive > 0
      ? `${policiesActive} active / ${policiesTotal} total policies`
      : policiesTotal > 0
        ? "No active policies — enable under Policies & tools"
        : "Create policies under Policies & tools";

  const logsHeadline =
    isSuper && audit24 != null ? String(audit24) : isSuper ? "0" : "—";
  const logsSub =
    isSuper && audit24 != null
      ? "Audited API requests (last 24h)"
      : "Superuser view shows live audit volume";

  const accessHeadline = isSuper && usersTotal != null ? String(usersTotal) : "—";
  const accessSub = isSuper
    ? pending != null && pending > 0
      ? `${pending} approval(s) pending`
      : "Directory synced from database"
    : "Superuser directory for operators";

  return (
    <motion.div
      className="mx-auto max-w-6xl space-y-10 py-6 pb-24"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {loadError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </p>
      ) : null}
      {reportHint ? (
        <p className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          {reportHint}
        </p>
      ) : null}

      <motion.div variants={itemVariants} className="space-y-3">
        <div className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-sm font-medium text-primary backdrop-blur-sm">
          <span className="mr-2 flex h-2 w-2 animate-pulse rounded-full bg-primary shadow-[0_0_12px_oklch(0.55_0.2_278/0.6)]" />
          {me ? "Connected to API" : "Loading…"}
        </div>
            <h1 className="text-fluid-h2 font-extrabold tracking-tight text-foreground">
              Global Dashboard
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Luminous glass interface — manage agents, policies, approvals, and
              operational telemetry in one unified workspace.
            </p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        className="grid grid-cols-1 gap-6 md:grid-cols-3"
      >
        <motion.div variants={itemVariants}>
          <Card className="glass-panel flex h-full flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Deployed agents
              </CardTitle>
              <div className="rounded-lg bg-primary/10 p-2">
                <BrainCircuit className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between">
              <div>
                <div className="text-3xl font-bold text-foreground">
                  {metrics ? agentsHeadline : "…"}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {metrics ? agentsSub : "Loading policy counts…"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-auto justify-start px-0 py-1 text-[10px] text-muted-foreground hover:text-primary"
                onClick={() => setTeachOpen(true)}
              >
                <Sparkles className="mr-1 h-3 w-3" />
                Not accurate? Teach AI
              </Button>
              <Link
                href="/ai/policies"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "default" }),
                  "group mt-2 w-full justify-between hover:bg-primary/5 hover:text-primary"
                )}
              >
                Agent configuration
                <ArrowRight className="h-4 w-4 opacity-50 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-panel flex h-full flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Run &amp; audit logs
              </CardTitle>
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <Activity className="h-4 w-4 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between">
              <div>
                <div className="text-3xl font-bold text-foreground">
                  {metrics ? logsHeadline : "…"}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {metrics ? logsSub : "Loading audit summary…"}
                </p>
              </div>
              <Link
                href="/logs"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "default" }),
                  "group mt-4 w-full justify-between hover:bg-emerald-500/5 hover:text-emerald-600"
                )}
              >
                Open run logs
                <ArrowRight className="h-4 w-4 opacity-50 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-panel flex h-full flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Team &amp; client access
              </CardTitle>
              <div className="rounded-lg bg-violet-500/10 p-2">
                <ShieldCheck className="h-4 w-4 text-violet-500" />
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between">
              <div>
                <div className="text-3xl font-bold text-foreground">
                  {metrics ? accessHeadline : "…"}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {metrics ? accessSub : "Loading directory summary…"}
                </p>
              </div>
              <Link
                href="/admin/users"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "default" }),
                  "group mt-4 w-full justify-between hover:bg-violet-500/5 hover:text-violet-600"
                )}
              >
                Manage access
                <ArrowRight className="h-4 w-4 opacity-50 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <ActivityChart
          liveOnly
          data={isSuper ? (metrics?.chart_days ?? []) : []}
        />
      </motion.div>

      <motion.div variants={itemVariants} className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="default"
          size="lg"
          className="rounded-full shadow-md"
          disabled={reportBusy}
          onClick={() => void runHealthReport()}
        >
          {reportBusy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Run agent health check
        </Button>
        <Link
          href="/ai/insights"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "rounded-full"
          )}
        >
          Open insights
        </Link>
      </motion.div>

      <FeedbackModal
        isOpen={teachOpen}
        onClose={() => setTeachOpen(false)}
        originalPrompt={DASHBOARD_AI_CARD_PROMPT}
        aiResponse={DASHBOARD_AI_CARD_RESPONSE}
      />
    </motion.div>
  );
}
