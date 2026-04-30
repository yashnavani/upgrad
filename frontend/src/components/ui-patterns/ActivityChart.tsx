"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { ChartDay } from "@/lib/dashboard-types";

type Point = ChartDay;

/** Demo series when no API data is passed (non-production previews). */
function generateDemoData(): Point[] {
  const data: Point[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const daySeed = d.getDate() + d.getMonth() * 31 + i * 7;
    data.push({
      name: d.toLocaleDateString("en-US", { weekday: "short" }),
      requests: 1000 + (daySeed * 137) % 5000,
      ai_calls: 500 + (daySeed * 89) % 2000,
    });
  }
  return data;
}

type TooltipPayloadEntry = {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string | number;
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 text-sm shadow-lg">
      <p className="mb-2 font-semibold text-foreground">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="mt-1 flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="capitalize text-muted-foreground">
            {String(entry.name ?? entry.dataKey ?? "").replaceAll("_", " ")}:
          </span>
          <span className="font-mono font-medium text-foreground">
            {(entry.value ?? 0).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

const MUTED_TICK = { fontSize: 12, fill: "var(--muted-foreground)" };

export type ActivityChartProps = {
  /** When set, chart uses API telemetry (typically last 7 days). */
  data?: Point[] | null;
  /** When true and `data` is empty, show empty state instead of demo data. */
  liveOnly?: boolean;
  /** Copy for descriptions when using live audit data. */
  scope?: "personal" | "organization";
};

export function ActivityChart({
  data,
  liveOnly = false,
  scope = "organization",
}: ActivityChartProps) {
  const chartData = React.useMemo(() => {
    if (liveOnly) {
      return data && data.length > 0 ? data : [];
    }
    if (data && data.length > 0) return data;
    return generateDemoData();
  }, [data, liveOnly]);

  const maxVal = React.useMemo(
    () =>
      Math.max(
        1,
        ...chartData.flatMap((d) => [d.requests, d.ai_calls])
      ),
    [chartData]
  );

  const yFormatter = (v: number) =>
    maxVal < 800 ? String(Math.round(v)) : `${(v / 1000).toFixed(1)}k`;

  const uid = React.useId().replace(/:/g, "");
  const gradRequests = `colorRequests-${uid}`;
  const gradAi = `colorAI-${uid}`;

  if (liveOnly && chartData.length === 0) {
    return (
      <Card className="w-full border border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            Usage Overview
          </CardTitle>
          <CardDescription>
            {scope === "personal"
              ? "No audit rows for your account in this window yet. Use the app (API calls while signed in) to populate telemetry."
              : "No org-wide audit data in this window yet. Generate API traffic to see request and /ai/chat volume for the last 7 days."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
            {scope === "personal"
              ? "Your activity chart will appear here once audit logs include your requests."
              : "No telemetry in run logs for this period yet."}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full border border-border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" />
              Usage Overview
            </CardTitle>
            <CardDescription>
              {liveOnly
                ? scope === "personal"
                  ? "Your API requests and /ai/chat calls from audit logs (last 7 days)"
                  : "Org-wide API requests and /ai/chat calls from audit logs (last 7 days)"
                : "API requests and AI invocations (last 7 days)"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mt-4 h-[300px] w-full min-h-[300px] min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id={gradRequests} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6c5ce7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6c5ce7" stopOpacity={0} />
                </linearGradient>
                <linearGradient id={gradAi} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(150, 150, 150, 0.1)"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={MUTED_TICK}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={MUTED_TICK}
                tickFormatter={yFormatter}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{
                  stroke: "rgba(150, 150, 150, 0.2)",
                  strokeWidth: 2,
                }}
              />
              <Area
                type="monotone"
                dataKey="requests"
                name="requests"
                stroke="#6c5ce7"
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#${gradRequests})`}
                activeDot={{ r: 5, strokeWidth: 0, fill: "#6c5ce7" }}
              />
              <Area
                type="monotone"
                dataKey="ai_calls"
                name="ai_calls"
                stroke="#38bdf8"
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#${gradAi})`}
                activeDot={{ r: 5, strokeWidth: 0, fill: "#38bdf8" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
