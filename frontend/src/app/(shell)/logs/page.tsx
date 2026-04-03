"use client";

import { Activity } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MOCK_LOGS = [
  {
    id: "log_928",
    time: "Just now",
    actor: "user_uuid_123",
    method: "POST",
    endpoint: "/api/v1/ai/chat",
    status: 200,
    latency: "145ms",
  },
  {
    id: "log_927",
    time: "2 mins ago",
    actor: "system",
    method: "GET",
    endpoint: "/api/v1/health",
    status: 200,
    latency: "12ms",
  },
  {
    id: "log_926",
    time: "15 mins ago",
    actor: "anon",
    method: "POST",
    endpoint: "/api/v1/auth/login",
    status: 401,
    latency: "89ms",
  },
  {
    id: "log_925",
    time: "1 hour ago",
    actor: "user_uuid_123",
    method: "DELETE",
    endpoint: "/api/v1/users/456",
    status: 403,
    latency: "45ms",
  },
];

function statusClass(status: number) {
  if (status >= 200 && status < 300) {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  }
  if (status >= 400 && status < 500) {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  }
  return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
}

export default function AuditLogsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 duration-500 animate-in fade-in">
      <div>
        <h1 className="text-fluid-h2 font-bold tracking-tight text-foreground">
          Audit Logs
        </h1>
        <p className="mt-1 text-muted-foreground">
          Immutable record of system events, API requests, and access attempts.
        </p>
      </div>

      <Card className="glass-panel overflow-hidden border-border/50 shadow-sm">
        <CardHeader className="border-b border-border/50 bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            Request Log
          </CardTitle>
          <CardDescription>
            Sample request log (connect to your audit API when ready).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow>
                <TableHead className="w-[150px]">Timestamp</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_LOGS.map((log) => (
                <TableRow
                  key={log.id}
                  className="transition-colors hover:bg-muted/30"
                >
                  <TableCell className="text-xs font-medium text-muted-foreground">
                    {log.time}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`font-mono text-[10px] ${
                        log.method === "GET"
                          ? "border-blue-200 text-blue-500 dark:border-blue-800"
                          : log.method === "POST"
                            ? "border-emerald-200 text-emerald-500 dark:border-emerald-800"
                            : "border-red-200 text-red-500 dark:border-red-800"
                      }`}
                    >
                      {log.method}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.endpoint}
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate font-mono text-xs text-muted-foreground">
                    {log.actor}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${statusClass(log.status)}`}
                    >
                      {log.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {log.latency}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
