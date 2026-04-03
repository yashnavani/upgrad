"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
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
  "Command Center overview — AI Assistant card (status and description shown on the dashboard).";
const DASHBOARD_AI_CARD_RESPONSE =
  "Active — Assistant and automation rules.";

export default function Home() {
  const [teachOpen, setTeachOpen] = useState(false);

  return (
    <motion.div
      className="mx-auto max-w-6xl space-y-10 py-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants} className="space-y-3">
        <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary backdrop-blur-sm">
          <span className="mr-2 flex h-2 w-2 animate-pulse rounded-full bg-primary" />
          System Online
        </div>
        <h1 className="text-fluid-h2 font-extrabold tracking-tight text-foreground">
          Command Center Overview
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Welcome to your Master Foundation. The architecture is sovereign, the
          AI assistant is available, and audit logging is active.
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
                AI Assistant
              </CardTitle>
              <div className="rounded-lg bg-primary/10 p-2">
                <BrainCircuit className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between">
              <div>
                <div className="text-3xl font-bold text-foreground">Active</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Assistant and automation rules
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
                Configure Agent
                <ArrowRight className="h-4 w-4 opacity-50 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-panel flex h-full flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Audit Logs
              </CardTitle>
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <Activity className="h-4 w-4 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between">
              <div>
                <div className="text-3xl font-bold text-foreground">
                  Recording
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Request and access history
                </p>
              </div>
              <Link
                href="/logs"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "default" }),
                  "group mt-4 w-full justify-between hover:bg-emerald-500/5 hover:text-emerald-600"
                )}
              >
                View Logs
                <ArrowRight className="h-4 w-4 opacity-50 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-panel flex h-full flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {"Identity & access"}
              </CardTitle>
              <div className="rounded-lg bg-violet-500/10 p-2">
                <ShieldCheck className="h-4 w-4 text-violet-500" />
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between">
              <div>
                <div className="text-3xl font-bold text-foreground">
                  Secured
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Native JWT + Argon2 hashing
                </p>
              </div>
              <Link
                href="/admin/users"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "default" }),
                  "group mt-4 w-full justify-between hover:bg-violet-500/5 hover:text-violet-600"
                )}
              >
                Manage Users
                <ArrowRight className="h-4 w-4 opacity-50 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <ActivityChart />
      </motion.div>

      <motion.div variants={itemVariants}>
        <Link
          href="/ai/insights"
          className={cn(
            buttonVariants({ variant: "default", size: "lg" }),
            "rounded-full shadow-md"
          )}
        >
          Initiate Diagnostic Run
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
