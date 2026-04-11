"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Loader2, ShieldAlert } from "lucide-react";

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
import type { AuditLogRow } from "@/lib/dashboard-types";
import { apiClient } from "@/lib/api-client";

function statusClass(status: number) {
  if (status >= 200 && status < 300) {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  }
  if (status >= 400 && status < 500) {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  }
  return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AuditLogsPage() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<AuditLogRow[]>("/audit-logs?limit=200");
      setRows(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load logs.";
      if (
        msg.toLowerCase().includes("privileges") ||
        msg.toLowerCase().includes("403") ||
        msg.includes("Forbidden")
      ) {
        setError(
          "Run logs are restricted to superusers. Ask an administrator for access."
        );
      } else {
        setError(msg);
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 duration-500 animate-in fade-in">
      <div>
        <h1 className="text-fluid-h2 font-bold tracking-tight text-foreground">
          Run logs
        </h1>
        <p className="mt-1 text-muted-foreground">
          Request history, agent API calls, and access events from the audit
          table (telemetry middleware).
        </p>
      </div>

      {error ? (
        <Card className="border-border/60 bg-muted/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-5 w-5 text-muted-foreground" />
              Access or load issue
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card className="glass-panel overflow-hidden border-border/50 shadow-sm">
        <CardHeader className="border-b border-border/50 bg-muted/20">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            Request log
          </CardTitle>
          <CardDescription>
            Live data from <code className="font-mono text-xs">GET /audit-logs</code>{" "}
            (newest first).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 px-6 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading audit entries…
            </div>
          ) : rows.length === 0 && !error ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No audit rows yet. Traffic to the API will appear here automatically.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Latency (ms)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((log) => (
                  <TableRow
                    key={log.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <TableCell className="text-xs font-medium text-muted-foreground">
                      {formatTime(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`font-mono text-[10px] ${
                          log.http_method === "GET"
                            ? "border-blue-200 text-blue-500 dark:border-blue-800"
                            : log.http_method === "POST"
                              ? "border-emerald-200 text-emerald-500 dark:border-emerald-800"
                              : "border-red-200 text-red-500 dark:border-red-800"
                        }`}
                      >
                        {log.http_method}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate font-mono text-xs">
                      {log.endpoint}
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate font-mono text-xs text-muted-foreground">
                      {log.actor_id ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${statusClass(log.status_code)}`}
                      >
                        {log.status_code}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {Math.round(log.processing_time_ms)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
