"use client";

import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BrainCircuit,
  Lightbulb,
  Sparkles,
  Activity,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MOCK_INSIGHTS = [
  {
    id: "1",
    title: "Critical System Inactivity Detected",
    type: "Anomaly",
    severity: "CRITICAL",
    confidence: "100%",
    timestamp: new Date().toISOString(),
    description:
      "The system data indicates a complete lack of operational activity. There are 0 active projects and a 0.0% resource utilization rate. This suggests a critical data reporting failure.",
  },
  {
    id: "2",
    title: "Unusual API Latency Spike",
    type: "Performance",
    severity: "WARNING",
    confidence: "85%",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    description:
      "Endpoint /api/v1/auth experienced a 400% increase in response time over the last 15 minutes. Check database connection pooling.",
  },
];

export default function AIInsightsPage() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleRunAnalysis = () => {
    setIsAnalyzing(true);
    setTimeout(() => setIsAnalyzing(false), 2000);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 duration-500 animate-in fade-in">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-fluid-h2 font-bold tracking-tight text-foreground">
            AI Insights
          </h1>
          <p className="mt-1 text-muted-foreground">
            AI-powered analysis of your data. Discover patterns, anomalies, and
            optimization opportunities.
          </p>
        </div>
        <Button
          onClick={handleRunAnalysis}
          disabled={isAnalyzing}
          className="rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {isAnalyzing ? "Analyzing..." : "Run Analysis"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="border-red-500/20 bg-red-50/50 shadow-sm dark:bg-red-950/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-xl bg-red-100 p-3 text-red-600 dark:bg-red-900/30">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">1</p>
              <p className="text-sm font-medium text-muted-foreground">
                Critical Issues
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
              <p className="text-3xl font-bold text-foreground">1</p>
              <p className="text-sm font-medium text-muted-foreground">
                Warnings
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-50/50 shadow-sm dark:bg-blue-950/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-xl bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/30">
              <Lightbulb className="h-6 w-6" />
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">0</p>
              <p className="text-sm font-medium text-muted-foreground">
                Recommendations
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

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
            <h3 className="text-lg font-semibold">All Insights</h3>
            <p className="text-sm text-muted-foreground">
              Generated from your latest operational data.
            </p>
          </div>

          {MOCK_INSIGHTS.map((insight) => (
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
                  <span>{insight.type}</span>
                  <span>•</span>
                  <span>{new Date(insight.timestamp).toLocaleString()}</span>
                  <span>•</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                    AI GENERATED
                  </span>
                </div>

                <p className="mb-6 text-sm leading-relaxed text-foreground/80">
                  {insight.description}
                </p>

                <Button
                  variant="default"
                  className="rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Investigate Root Cause
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="patterns">
          <Card className="glass-panel p-12 text-center text-muted-foreground">
            <BrainCircuit className="mx-auto mb-4 h-12 w-12 opacity-20" />
            <p>No recurring patterns detected in the current data window.</p>
          </Card>
        </TabsContent>

        <TabsContent value="actions">
          <Card className="glass-panel p-12 text-center text-muted-foreground">
            <Zap className="mx-auto mb-4 h-12 w-12 opacity-20" />
            <p>No automated actions recommended at this time.</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
