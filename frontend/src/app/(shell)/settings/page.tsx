"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, ShieldAlert, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";

type MeDto = {
  id: string;
  email: string;
  full_name: string | null;
  is_superuser: boolean;
};

type SettingRow = {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  updated_by_id: string | null;
  created_at: string;
  updated_at: string;
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function SettingsPage() {
  const [me, setMe] = useState<MeDto | null>(null);
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { value: string; description: string }>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const loadMe = useCallback(async () => {
    return apiClient<MeDto>("/users/me");
  }, []);

  const loadSettings = useCallback(async () => {
    return apiClient<SettingRow[]>("/settings");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setSettingsError(null);
      try {
        const profile = await loadMe();
        if (cancelled) return;
        setMe(profile);

        if (profile.is_superuser) {
          try {
            const rows = await loadSettings();
            if (cancelled) return;
            setSettings(rows);
            const next: Record<string, { value: string; description: string }> = {};
            for (const r of rows) {
              next[r.key] = {
                value: r.value ?? "",
                description: r.description ?? "",
              };
            }
            setDrafts(next);
          } catch (e) {
            if (cancelled) return;
            setSettingsError(
              e instanceof Error ? e.message : "Could not load workspace settings."
            );
            setSettings([]);
          }
        } else {
          setSettings([]);
          setDrafts({});
        }
      } catch (e) {
        if (cancelled) return;
        setSettingsError(
          e instanceof Error ? e.message : "Could not load your profile."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMe, loadSettings]);

  const saveSetting = async (key: string) => {
    const d = drafts[key];
    if (!d) return;
    setSavingKey(key);
    setSettingsError(null);
    try {
      const updated = await apiClient<SettingRow>(
        `/settings/${encodeURIComponent(key)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            value: d.value.trim() === "" ? null : d.value,
            description: d.description.trim() === "" ? null : d.description,
          }),
        }
      );
      setSettings((prev) => {
        const i = prev.findIndex((x) => x.key === key);
        if (i === -1) return [...prev, updated].sort((a, b) => a.key.localeCompare(b.key));
        const copy = [...prev];
        copy[i] = updated;
        return copy;
      });
      setDrafts((prev) => ({
        ...prev,
        [key]: {
          value: updated.value ?? "",
          description: updated.description ?? "",
        },
      }));
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSavingKey(null);
    }
  };

  const createSetting = async () => {
    const key = newKey.trim();
    if (!key) {
      setSettingsError("Setting key is required.");
      return;
    }
    setCreating(true);
    setSettingsError(null);
    try {
      const updated = await apiClient<SettingRow>(
        `/settings/${encodeURIComponent(key)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            value: newValue.trim() === "" ? null : newValue,
            description: newDescription.trim() === "" ? null : newDescription,
          }),
        }
      );
      setSettings((prev) => {
        if (prev.some((x) => x.key === key)) {
          return prev.map((x) => (x.key === key ? updated : x));
        }
        return [...prev, updated].sort((a, b) => a.key.localeCompare(b.key));
      });
      setDrafts((prev) => ({
        ...prev,
        [key]: {
          value: updated.value ?? "",
          description: updated.description ?? "",
        },
      }));
      setNewKey("");
      setNewValue("");
      setNewDescription("");
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : "Could not create setting.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex max-w-3xl items-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading workspace…
      </div>
    );
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
        {settingsError ?? "Unable to load profile. Sign in again."}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Workspace settings
        </h1>
        <p className="mt-1 text-muted-foreground">
          Your account profile and, for administrators, key–value configuration
          stored in the API database.
        </p>
      </div>

      {settingsError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {settingsError}
        </p>
      ) : null}

      <Card className="border border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-primary" />
            Profile
          </CardTitle>
          <CardDescription>
            From <code className="font-mono text-xs">GET /users/me</code> (system actor; no login).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium text-foreground">{me.email}</span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground">Full name</span>
            <span className="font-medium text-foreground">
              {me.full_name?.trim() ? me.full_name : "—"}
            </span>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium text-foreground">
              {me.is_superuser ? "Administrator" : "Member"}
            </span>
          </div>
        </CardContent>
      </Card>

      {!me.is_superuser ? (
        <Card className="border border-border bg-muted/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-5 w-5 text-muted-foreground" />
              Workspace configuration
            </CardTitle>
            <CardDescription>
              System settings are restricted to administrators. Ask a superuser to
              adjust keys in the database or grant you admin access.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">System settings</CardTitle>
              <CardDescription>
                Stored as <code className="font-mono text-xs">SystemSetting</code> rows.
                Changes call <code className="font-mono text-xs">PUT /settings/{"{key}"}</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No settings yet. Add a key below (e.g. feature flags or limits).
                </p>
              ) : (
                <ul className="space-y-6">
                  {settings.map((row) => {
                    const d = drafts[row.key] ?? {
                      value: row.value ?? "",
                      description: row.description ?? "",
                    };
                    return (
                      <li
                        key={row.id}
                        className="rounded-xl border border-border bg-muted/10 p-4"
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                            {row.key}
                          </code>
                          <span className="text-xs text-muted-foreground">
                            Updated {formatWhen(row.updated_at)}
                          </span>
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">
                              Value
                            </label>
                            <Textarea
                              value={d.value}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [row.key]: {
                                    ...d,
                                    value: e.target.value,
                                  },
                                }))
                              }
                              rows={3}
                              className="font-mono text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">
                              Description
                            </label>
                            <Input
                              value={d.description}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [row.key]: {
                                    ...d,
                                    description: e.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            disabled={savingKey === row.key}
                            onClick={() => void saveSetting(row.key)}
                          >
                            {savingKey === row.key ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Save className="mr-1.5 h-4 w-4" />
                                Save
                              </>
                            )}
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="border-t border-border pt-6">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Add or upsert a setting
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Key
                    </label>
                    <Input
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      placeholder="e.g. max_agent_tokens"
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Value
                    </label>
                    <Textarea
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      rows={2}
                      className="font-mono text-sm"
                      placeholder="JSON or plain text"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Description (optional)
                    </label>
                    <Input
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Human-readable purpose"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  className="mt-3"
                  disabled={creating || !newKey.trim()}
                  onClick={() => void createSetting()}
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Create / update key"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
