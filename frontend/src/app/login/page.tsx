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
  const [googleLoading, setGoogleLoading] = useState(false);
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

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch {
      setError("Google sign-in failed. Please try again.");
      setGoogleLoading(false);
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
            <span className="text-primary">Luminous</span> SaaS
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enterprise glass interface — sign in to manage agents, policies, and
            workspace operations.
          </p>
        </div>

        <Card className="glass-panel border-border/50">
          <CardHeader>
            <CardTitle>Workspace access</CardTitle>
            <CardDescription>
              Create an operator account or sign in. Credentials are protected
              with Argon2 on the server.
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
                <Button type="submit" className="w-full" disabled={loading || googleLoading}>
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
                  disabled={loading || googleLoading}
                >
                  Create Account
                </Button>
              </div>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign in with Google
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
