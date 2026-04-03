"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { BrainCircuit, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"
).replace(/\/$/, "");

const REGISTER_TIMEOUT_MS = 15_000;

function describeApiConnectionError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lowered = msg.toLowerCase();
  if (
    lowered.includes("failed to fetch") ||
    lowered.includes("networkerror") ||
    lowered.includes("load failed") ||
    lowered.includes("aborted") ||
    lowered.includes("network request failed")
  ) {
    return `Cannot reach the API (${API_URL}). Start the stack with docker compose up from the project root, or run the FastAPI server on port 8000, then try again.`;
  }
  return msg || "Could not reach the API server.";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError(
          "Sign-in failed. Check your email and password, and ensure the API is running (e.g. docker compose up so port 8000 is up)."
        );
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Sign-in failed unexpectedly."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        detail?: string | { msg?: string }[];
        message?: string;
      };

      if (!res.ok) {
        const d = data.detail;
        if (typeof d === "string") setError(d);
        else if (Array.isArray(d))
          setError(d.map((x) => x.msg).filter(Boolean).join("; "));
        else setError("Registration failed.");
        return;
      }

      setError(null);
      setInfo(data.message ?? "Account created. Sign in below.");
    } catch (err) {
      setError(describeApiConnectionError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-in space-y-8 duration-500 fade-in slide-in-from-bottom-4">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 rounded-2xl bg-primary/20 p-3">
            <BrainCircuit className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Master Foundation
          </h1>
          <p className="mt-2 text-muted-foreground">
            Native identity — sign in with your enterprise credentials.
          </p>
        </div>

        <Card className="glass-panel border-border/50">
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
            <CardDescription>
              Register once, then sign in. Passwords are Argon2-hashed on the
              server.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  minLength={8}
                  className="bg-muted/50"
                />
              </div>
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Full name (optional, for register)"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  className="bg-muted/50"
                />
              </div>

              {info && (
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {info}
                </p>
              )}
              {error && (
                <p className="text-sm font-medium text-destructive">{error}</p>
              )}

              <div className="space-y-2 pt-2">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Sign In"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleSignUp}
                  disabled={loading}
                >
                  Create Account
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
