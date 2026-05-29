"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button, Card, Input } from "@/components/ui";

export default function SignInPage() {
  const { user, household, loading, signIn, signUp } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user && household) router.replace("/");
    else if (user && !household) router.replace("/onboarding");
  }, [user, household, loading, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const op = mode === "signin" ? signIn : signUp;
    const result = await op(email, password);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (mode === "signup") setPendingConfirm(true);
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-[var(--bg)]">
      <Card className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/illustrations/logo.svg"
            alt="Pantry Pal"
            className="size-9 rounded-xl shadow-sm"
            draggable={false}
          />
          <div>
            <div className="font-semibold">Pantry Pal</div>
            <div className="text-xs text-[var(--text-muted)]">
              Cook more · waste less
            </div>
          </div>
        </div>

        <h1 className="text-xl font-semibold mb-1">
          {mode === "signin" ? "Welcome back" : "Create an account"}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-5">
          {mode === "signin"
            ? "Sign in to access your household."
            : "Join your partner's kitchen — or start a fresh one."}
        </p>

        {pendingConfirm ? (
          <div className="text-sm rounded-lg border border-[var(--border)] bg-[var(--accent-soft)] p-4">
            <div className="font-medium mb-1">Check your email</div>
            <div className="text-[var(--text-muted)]">
              We sent a confirmation link to <strong>{email}</strong>. Click it
              and come back to sign in.
            </div>
            <button
              onClick={() => {
                setPendingConfirm(false);
                setMode("signin");
              }}
              className="text-[var(--accent-hover)] text-xs mt-2 underline"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-muted)] block mb-1">
                Email
              </label>
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--text-muted)] block mb-1">
                Password
              </label>
              <Input
                type="password"
                required
                minLength={6}
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <div className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy
                ? "Working…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
              }}
              className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              {mode === "signin"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
