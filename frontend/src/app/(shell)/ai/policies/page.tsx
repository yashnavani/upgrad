"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Settings2, Sparkles } from "lucide-react";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type PolicyDto = {
  id: string;
  name: string;
  description: string | null;
  natural_language: string;
  policy_type: "logical" | "natural_language";
  is_active: boolean;
  priority: number;
  refined_instruction?: string | null;
  tags?: string[];
};

function displayDescription(p: PolicyDto): string {
  if (p.description?.trim()) return p.description;
  const nl = p.natural_language.trim();
  return nl.length > 160 ? `${nl.slice(0, 157)}…` : nl;
}

export default function AIPoliciesPage() {
  const [policies, setPolicies] = useState<PolicyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPolicyType, setFormPolicyType] = useState<
    "logical" | "natural_language"
  >("logical");
  const [formNaturalLanguage, setFormNaturalLanguage] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [suggestionActionId, setSuggestionActionId] = useState<string | null>(
    null
  );

  const loadPolicies = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await apiClient<PolicyDto[]>("/policies");
      setPolicies(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load policies.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPolicies();
  }, [loadPolicies]);

  const optimizationSuggestions = useMemo(() => {
    return policies.filter((p) => {
      if (p.is_active) return false;
      const tags = p.tags ?? [];
      if (tags.includes("ai-optimized")) return true;
      return p.name.startsWith("AI Suggestion:");
    });
  }, [policies]);

  const activePolicies = useMemo(
    () => policies.filter((p) => !optimizationSuggestions.some((s) => s.id === p.id)),
    [policies, optimizationSuggestions]
  );

  const applySuggestion = async (id: string) => {
    setSuggestionActionId(id);
    setError(null);
    const prev = policies;
    setPolicies((p) => p.map((x) => (x.id === id ? { ...x, is_active: true } : x)));
    try {
      await apiClient<PolicyDto>(`/policies/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: true }),
      });
      await loadPolicies();
    } catch (e) {
      setPolicies(prev);
      setError(e instanceof Error ? e.message : "Failed to apply policy.");
    } finally {
      setSuggestionActionId(null);
    }
  };

  const dismissSuggestion = async (id: string) => {
    setSuggestionActionId(id);
    setError(null);
    const prev = policies;
    setPolicies((p) => p.filter((x) => x.id !== id));
    try {
      await apiClient(`/policies/${id}`, { method: "DELETE" });
    } catch (e) {
      setPolicies(prev);
      setError(e instanceof Error ? e.message : "Failed to dismiss suggestion.");
    } finally {
      setSuggestionActionId(null);
    }
  };

  const togglePolicy = async (id: string, active: boolean) => {
    setTogglingId(id);
    setError(null);
    const prev = policies;
    setPolicies((p) => p.map((x) => (x.id === id ? { ...x, is_active: active } : x)));
    try {
      await apiClient<PolicyDto>(`/policies/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: active }),
      });
    } catch (e) {
      setPolicies(prev);
      setError(e instanceof Error ? e.message : "Failed to update policy.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreate = async () => {
    const name = formName.trim();
    const natural_language = formNaturalLanguage.trim();
    if (!name || !natural_language) {
      setError("Name and rule text are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await apiClient<PolicyDto>("/policies", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: formDescription.trim() || null,
          natural_language,
          policy_type: formPolicyType,
        }),
      });
      setPolicies((p) => [...p, created].sort((a, b) => a.priority - b.priority));
      setCreateOpen(false);
      setFormName("");
      setFormNaturalLanguage("");
      setFormDescription("");
      setFormPolicyType("logical");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create policy.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 duration-500 animate-in fade-in">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-fluid-h2 font-bold tracking-tight text-foreground">
            AI Policies
          </h1>
          <p className="mt-1 text-muted-foreground">
            Define how the AI assistant and automation are allowed to behave.
          </p>
        </div>
        <Button
          type="button"
          className="rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Policy
        </Button>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading policies…</p>
      ) : null}

      <Tabs defaultValue="policies" className="w-full">
        <TabsList className="mb-6 rounded-xl border border-border/50 bg-muted/50 p-1">
          <TabsTrigger
            value="policies"
            className={cn(
              "rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
            )}
          >
            Policies
          </TabsTrigger>
          <TabsTrigger
            value="suggestions"
            className={cn(
              "rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
            )}
          >
            <Sparkles className="mr-2 h-4 w-4 text-violet-500" />
            Suggestions
            {optimizationSuggestions.length > 0 ? (
              <Badge
                variant="secondary"
                className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-[10px]"
              >
                {optimizationSuggestions.length}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="policies" className="mt-0 space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {activePolicies.map((policy) => (
              <Card
                key={policy.id}
                className="glass-panel flex flex-col justify-between transition-colors hover:border-primary/50"
              >
                <CardHeader className="pb-4">
                  <div className="mb-2 flex items-start justify-between">
                    <Badge
                      variant="outline"
                      className="border-primary/20 bg-primary/5 font-mono text-[10px] tracking-wider text-primary uppercase"
                    >
                      {policy.policy_type.replace("_", " ")}
                    </Badge>
                    <Switch
                      checked={policy.is_active}
                      disabled={togglingId === policy.id}
                      onCheckedChange={(v) => void togglePolicy(policy.id, v)}
                      aria-label={`Toggle ${policy.name}`}
                    />
                  </div>
                  <CardTitle className="text-lg">{policy.name}</CardTitle>
                  <CardDescription className="mt-2 text-sm leading-relaxed">
                    {displayDescription(policy)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 pb-4">
                  <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-4">
                    <span className="font-mono text-xs text-muted-foreground">
                      ID: {policy.id}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:bg-primary/10 hover:text-primary"
                      type="button"
                    >
                      <Settings2 className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="suggestions" className="mt-0 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              AI optimization proposals
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Draft policies synthesized from recurring human corrections. Apply to
            activate system-wide, or dismiss if you disagree.
          </p>
          {optimizationSuggestions.length === 0 ? (
            <p className="rounded-lg border border-border/60 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
              No pending proposals. The nightly worker creates drafts when enough
              feedback exists (typically three or more recent corrections).
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {optimizationSuggestions.map((s) => (
                <Card
                  key={s.id}
                  className="glass-panel border-l-4 border-l-violet-500"
                >
                  <CardHeader>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <CardTitle className="text-base">{s.name}</CardTitle>
                      <Badge className="w-fit bg-violet-500/15 text-violet-700 dark:text-violet-300">
                        Optimization
                      </Badge>
                    </div>
                    <CardDescription className="text-sm leading-relaxed">
                      {s.description?.trim() ||
                        "Pattern detected from recent human feedback."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <p className="max-w-3xl text-sm italic text-foreground/80">
                      {s.refined_instruction?.trim() ||
                        s.natural_language.trim()}
                    </p>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={suggestionActionId === s.id}
                        onClick={() => void dismissSuggestion(s.id)}
                      >
                        Ignore
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-violet-600 text-white hover:bg-violet-700"
                        disabled={suggestionActionId === s.id}
                        onClick={() => void applySuggestion(s.id)}
                      >
                        {suggestionActionId === s.id
                          ? "Working…"
                          : "Apply system upgrade"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create policy</DialogTitle>
            <DialogDescription>
              Save a rule to the database. The Cognitive Router can load these
              later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <label htmlFor="policy-name" className="text-xs font-medium">
                Name
              </label>
              <Input
                id="policy-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Auto-approve low value"
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="policy-type" className="text-xs font-medium">
                Type
              </label>
              <select
                id="policy-type"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={formPolicyType}
                onChange={(e) =>
                  setFormPolicyType(
                    e.target.value as "logical" | "natural_language"
                  )
                }
              >
                <option value="logical">Logical (structured rules)</option>
                <option value="natural_language">Natural language</option>
              </select>
            </div>
            <div className="grid gap-1">
              <label htmlFor="policy-nl" className="text-xs font-medium">
                Rule / instruction
              </label>
              <Textarea
                id="policy-nl"
                value={formNaturalLanguage}
                onChange={(e) => setFormNaturalLanguage(e.target.value)}
                placeholder="Describe the rule in plain language…"
                rows={4}
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="policy-desc" className="text-xs font-medium">
                Short description (optional)
              </label>
              <Input
                id="policy-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Shown on the card"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreate()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
