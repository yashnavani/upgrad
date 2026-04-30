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
      <div className="h-[300px] w-full animate-pulse rounded-xl border border-border bg-card" />
    ),
  }
);

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 400, damping: 28 },
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
  const itemsOwned = metrics?.items_owned;
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
    audit24 != null ? String(audit24) : metrics ? "0" : "…";
  const logsSub = isSuper
    ? "Audited API requests (last 24h, org-wide)"
    : "Your audited API requests (last 24h)";

  const accessHeadline = isSuper
    ? usersTotal != null
      ? String(usersTotal)
      : "—"
    : itemsOwned != null
      ? String(itemsOwned)
      : "—";
  const accessSub = isSuper
    ? pending != null && pending > 0
      ? `${pending} pending — review in Agent Insights → Decisions tab`
      : "Org-wide user count"
    : pending != null && pending > 0
      ? `${pending} of your proposals awaiting approval`
      : "Records you own in the workspace";

  const greeting = me?.full_name
    ? `Hi ${me.full_name.split(" ")[0]}!`
    : me?.email
      ? `Hi ${me.email.split("@")[0]}!`
      : "Welcome back!";

  return (
    <motion.div
      className="mx-auto max-w-6xl space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {loadError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </p>
      )}
      {reportHint && (
        <p className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
          {reportHint}
        </p>
      )}

      <motion.div variants={itemVariants} className="space-y-1">
        <p className="text-sm text-muted-foreground">Start Operating</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {greeting}
        </h1>
      </motion.div>

      <motion.div
        variants={containerVariants}
        className="grid grid-cols-1 gap-5 md:grid-cols-3"
      >
        <motion.div variants={itemVariants}>
          <Card className="h-full border border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Deployed Agents
              </CardTitle>
              <div className="rounded-lg bg-primary/10 p-2">
                <BrainCircuit className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {metrics ? agentsHeadline : "…"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {metrics ? agentsSub : "Loading…"}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-0 py-0 text-[11px] text-muted-foreground hover:text-primary"
                  onClick={() => setTeachOpen(true)}
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  Not accurate? Teach AI
                </Button>
                <Link
                  href="/ai/policies"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  View
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="h-full border border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Run & Audit Logs
              </CardTitle>
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <Activity className="h-4 w-4 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {metrics ? logsHeadline : "…"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {metrics ? logsSub : "Loading…"}
              </p>
              <div className="mt-4 flex justify-end">
                <Link
                  href="/logs"
                  className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  View Logs
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="h-full border border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {me && !me.is_superuser ? "Your workspace" : "Org directory"}
              </CardTitle>
              <div className="rounded-lg bg-violet-500/10 p-2">
                <ShieldCheck className="h-4 w-4 text-violet-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {metrics ? accessHeadline : "…"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {metrics ? accessSub : "Loading…"}
              </p>
              <div className="mt-4 flex justify-end">
                <Link
                  href={isSuper && pending != null && pending > 0 ? "/ai/insights?tab=decisions" : "/settings"}
                  className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
                >
                  {isSuper && pending != null && pending > 0 ? "Review queue" : "Settings"}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <ActivityChart
          liveOnly
          scope={isSuper ? "organization" : "personal"}
          data={metrics?.chart_days ?? []}
        />
      </motion.div>

      <motion.div variants={itemVariants} className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="default"
          size="lg"
          className="rounded-full px-6 shadow-sm"
          disabled={reportBusy}
          onClick={() => void runHealthReport()}
        >
          {reportBusy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Run Health Check
        </Button>
        <Link
          href="/ai/insights"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "rounded-full px-6"
          )}
        >
          Open Insights
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
