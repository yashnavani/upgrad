"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Brain, CheckCircle, Loader2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";

type DecisionDto = {
  id: string;
  action_type: string;
  input_context: Record<string, unknown>;
  reasoning: string;
  confidence_score: number;
  status: string;
  proposed_payload: Record<string, unknown>;
  created_at: string;
};

type MeDto = {
  is_superuser: boolean;
};

export default function ApprovalsPage() {
  const { status } = useSession();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [decisions, setDecisions] = useState<DecisionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approveNotes, setApproveNotes] = useState<Record<string, string>>({});
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const me = await apiClient<MeDto>("/users/me");
      if (!me.is_superuser) {
        setAllowed(false);
        setDecisions([]);
        return;
      }
      setAllowed(true);
      const list = await apiClient<DecisionDto[]>("/decisions/pending");
      setDecisions(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load decisions.");
      setAllowed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") void load();
    else if (status === "unauthenticated") {
      setAllowed(false);
      setLoading(false);
    }
  }, [status, load]);

  const approve = async (id: string) => {
    const notes = approveNotes[id]?.trim() || undefined;
    const q = notes
      ? `?notes=${encodeURIComponent(notes)}`
      : "";
    setBusyId(id);
    setError(null);
    try {
      await apiClient(`/decisions/${id}/approve${q}`, { method: "POST" });
      setApproveNotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed.");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string) => {
    const reason = (rejectReason[id] || "").trim();
    if (!reason) {
      setError("Enter a rejection reason (training signal for the model).");
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await apiClient(`/decisions/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setRejectReason((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed.");
    } finally {
      setBusyId(null);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading…
      </div>
    );
  }

  if (allowed === false) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-border/60 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        Pending approvals are limited to superusers. Sign in as an admin or ask
        an operator to grant access.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 duration-500 animate-in fade-in">
      <div>
        <h1 className="text-fluid-h2 font-bold tracking-tight text-foreground">
          Human approvals
        </h1>
        <p className="mt-1 text-muted-foreground">
          Review high-impact agent proposals before they run in a client
          workspace.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {decisions.length === 0 && !error ? (
        <p className="text-sm text-muted-foreground">
          No pending decisions. When the AI proposes a high-value action, it will
          appear here.
        </p>
      ) : null}

      {decisions.map((item) => (
        <Card
          key={item.id}
          className="glass-panel overflow-hidden border-l-4 border-l-primary"
        >
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">{item.action_type}</CardTitle>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  ID: {item.id}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="shrink-0 bg-primary/5 text-primary">
              AI confidence: {Math.round(item.confidence_score * 100)}%
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
              <h4 className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                AI reasoning
              </h4>
              <p className="text-sm leading-relaxed text-foreground/90">
                {item.reasoning}
              </p>
            </div>

            <div className="rounded-xl border border-border/50 bg-background/50 p-4">
              <h4 className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                Proposed payload
              </h4>
              <pre className="max-h-40 overflow-auto font-mono text-xs text-muted-foreground">
                {JSON.stringify(item.proposed_payload, null, 2)}
              </pre>
            </div>

            <div className="space-y-2 border-t border-border/50 pt-4">
              <label className="text-xs font-medium text-muted-foreground">
                Approval notes (optional)
              </label>
              <Input
                value={approveNotes[item.id] ?? ""}
                onChange={(e) =>
                  setApproveNotes((p) => ({ ...p, [item.id]: e.target.value }))
                }
                placeholder="e.g. Verified with finance — OK to execute"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Rejection reason (required to reject)
              </label>
              <Textarea
                value={rejectReason[item.id] ?? ""}
                onChange={(e) =>
                  setRejectReason((p) => ({ ...p, [item.id]: e.target.value }))
                }
                placeholder="Explain why this should not run — this text is fed back into future prompts."
                rows={3}
              />
            </div>

            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
                disabled={busyId === item.id}
                onClick={() => void reject(item.id)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button
                type="button"
                className="bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                disabled={busyId === item.id}
                onClick={() => void approve(item.id)}
              >
                {busyId === item.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Approve
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
