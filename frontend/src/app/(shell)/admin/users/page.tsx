"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MoreHorizontal, ShieldAlert, ShieldCheck, UserCheck } from "lucide-react";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UserDirectoryRow } from "@/lib/dashboard-types";
import { apiClient } from "@/lib/api-client";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function UsersAccessPage() {
  const [users, setUsers] = useState<UserDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<UserDirectoryRow[]>("/users");
      setUsers(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load users.";
      if (
        msg.toLowerCase().includes("privileges") ||
        msg.toLowerCase().includes("403") ||
        msg.includes("Forbidden")
      ) {
        setError(
          "Directory is restricted to superusers. Ask an administrator for access."
        );
      } else {
        setError(msg);
      }
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 duration-500 animate-in fade-in">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-fluid-h2 font-bold tracking-tight text-foreground">
            Team &amp; client access
          </h1>
          <p className="mt-1 text-muted-foreground">
            Operators and roles from the database (
            <code className="font-mono text-xs">GET /users</code>).
          </p>
        </div>
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
            <ShieldCheck className="h-5 w-5 text-primary" />
            Directory
          </CardTitle>
          <CardDescription>
            {loading
              ? "Loading…"
              : `${users.length} user(s) — last login column not tracked in this schema.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 px-6 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading directory…
            </div>
          ) : users.length === 0 && !error ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No users returned.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.full_name?.trim() || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.is_superuser ? "default" : "secondary"
                        }
                        className={
                          user.is_superuser
                            ? "bg-primary text-primary-foreground"
                            : ""
                        }
                      >
                        {user.is_superuser ? "Superuser" : "Member"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          user.is_active
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                        }`}
                      >
                        {user.is_active && (
                          <UserCheck className="mr-1 h-3 w-3" />
                        )}
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                      </Button>
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
