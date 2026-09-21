"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button, Card, Input } from "@/components/ui";

type Mode = "signin" | "signup" | "recover" | "reset" | "verify" | "guest-recover";
const headings: Record<Mode, string> = { signin: "Welcome back", signup: "Create an account", recover: "Reset your password", reset: "Choose a new password", verify: "Verify your email", "guest-recover": "Recover your guest pantry" };

export default function SignInPage() {
  const { user, household, loading, error: sessionError, signIn, signUp, startGuest, recoverGuest, requestPasswordReset, resetPassword, resendVerification } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [guestCode, setGuestCode] = useState("");
  const [replacementCode, setReplacementCode] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) { setResetToken(token); setMode("reset"); }
    if (params.has("error")) setError("This email link is invalid or expired. Request a new link below.");
    // Keep reset tokens out of subsequent history entries/referrers.
    if (token || params.has("error")) window.history.replaceState(null, "", "/sign-in/");
  }, []);

  useEffect(() => {
    if (loading || busy || sessionError || mode === "reset" || mode === "guest-recover" || replacementCode) return;
    if (user && household) router.replace("/");
    else if (user) router.replace("/onboarding");
  }, [user, household, loading, busy, sessionError, mode, replacementCode, router]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
    setPassword("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "guest-recover") {
        const result = await recoverGuest(guestCode);
        // A session refresh can fail after the server has already rotated the
        // code. Preserve that replacement before surfacing any error.
        if (result.recoveryCode) { setReplacementCode(result.recoveryCode); setGuestCode(""); }
        if (result.error) setError(result.error);
        return;
      }
      const result = mode === "signin" ? await signIn(email, password)
        : mode === "signup" ? await signUp(email, password)
        : mode === "recover" ? await requestPasswordReset(email)
        : mode === "verify" ? await resendVerification(email)
        : await resetPassword(resetToken, password);
      if (result.error) { setError(result.error); return; }
      setPassword("");
      if (mode === "signup" || mode === "verify") setNotice("If this address needs verification, a link will arrive in your inbox. Check your spam folder too, then return here to sign in.");
      if (mode === "recover") setNotice("If an account exists for this email, a password reset link will arrive in your inbox. The link expires in 30 minutes.");
      if (mode === "reset") {
        setResetToken("");
        setMode("signin");
        setNotice("Your password has been changed and previous sessions revoked. Sign in with your new password.");
      }
    } catch { setError("The request could not be completed. Please retry."); }
    finally { setBusy(false); }
  }

  async function beginGuest() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await startGuest();
      if (result.error) setError(result.error);
    } catch { setError("Your guest pantry could not be opened. Please retry."); }
    finally { setBusy(false); }
  }

  async function copyRecoveryCode() {
    try { await navigator.clipboard.writeText(replacementCode); setNotice("Recovery code copied. Save it somewhere private."); }
    catch { setNotice("Select and copy the recovery code below, then save it somewhere private."); }
  }

  const needsEmail = mode !== "reset" && mode !== "guest-recover";
  const needsPassword = mode === "signin" || mode === "signup" || mode === "reset";
  return (
    <div className="min-h-screen grid place-items-center px-4 bg-[var(--bg)]">
      <Card className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/illustrations/logo.svg" alt="Pantry Pal" className="size-9 rounded-xl shadow-sm" draggable={false} />
          <div><div className="font-semibold">Pantry Pal</div><div className="text-xs text-[var(--text-muted)]">Cook more · waste less</div></div>
        </div>
        <h1 className="text-xl font-semibold mb-1">{headings[mode]}</h1>
        <p className="text-sm text-[var(--text-muted)] mb-5">
          {mode === "signin" ? "Sign in to access your household, or start without an email." : mode === "signup" ? "Create your account, verify your email, then join or create a household." : mode === "reset" ? "Use 8–128 characters for your new password." : mode === "guest-recover" ? "Use your saved recovery code to reopen the same pantry. Recovery replaces the code and signs out its other browsers." : "Enter your account email to request a link."}
        </p>
        {sessionError && <div role="alert" className="text-sm mb-3 text-[var(--danger)]">{sessionError} <a href="/offline-shopping/" className="underline">Open saved shopping list</a></div>}
        {notice && <div role="status" className="text-sm rounded-lg border border-[var(--border)] bg-[var(--accent-soft)] p-4 mb-4">{notice}</div>}
        {replacementCode ? <div className="space-y-3">
          <h2 className="font-semibold">Save your new recovery code</h2>
          <p className="text-sm text-[var(--text-muted)]">Your previous code no longer works. This replacement is shown only here. Anyone with this code can access your guest pantry.</p>
          <label htmlFor="replacement-code" className="text-sm block">New guest recovery code</label>
          <textarea id="replacement-code" readOnly value={replacementCode} autoComplete="off" spellCheck={false} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-sm break-all" rows={4} />
          {error && <div role="alert" className="text-sm text-[var(--danger)]">{error} Your replacement code is still valid; save it before leaving.</div>}
          <Button type="button" className="w-full" onClick={copyRecoveryCode}>Copy recovery code</Button>
          <Button type="button" className="w-full" disabled={busy} onClick={() => { setReplacementCode(""); switchMode("signin"); }}>I&apos;ve saved my recovery code</Button>
        </div> : <form onSubmit={submit} className="space-y-3">
          {mode === "guest-recover" && <div>
            <label htmlFor="guest-code" className="text-xs text-[var(--text-muted)] block mb-1">Guest recovery code</label>
            <Input id="guest-code" required maxLength={256} autoComplete="off" autoCapitalize="none" spellCheck={false} value={guestCode} onChange={(event) => setGuestCode(event.target.value)} disabled={busy} />
          </div>}
          {needsEmail && <div>
            <label htmlFor="auth-email" className="text-xs text-[var(--text-muted)] block mb-1">Email</label>
            <Input id="auth-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} />
          </div>}
          {needsPassword && <div>
            <label htmlFor="auth-password" className="text-xs text-[var(--text-muted)] block mb-1">{mode === "reset" ? "New password" : "Password"}</label>
            <Input id="auth-password" type="password" required minLength={mode === "signin" ? 1 : 8} maxLength={128} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
          </div>}
          {error && <div role="alert" className="text-sm text-[var(--danger)] bg-[var(--danger-soft)] rounded-lg px-3 py-2">{error}</div>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Working…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : mode === "reset" ? "Save new password" : mode === "guest-recover" ? "Recover guest account" : "Send link"}</Button>
          {mode === "signin" ? <div className="grid gap-2">
            <Button type="button" disabled={busy || loading} onClick={beginGuest} className="w-full">Continue as guest</Button>
            <p className="text-xs text-[var(--text-muted)]">Your pantry saves online and this browser remembers you. Create a recovery code from your account menu to return after clearing browser data or switching devices.</p>
            <button type="button" disabled={busy} onClick={() => switchMode("guest-recover")} className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text)]">Recover a guest account</button>
            <button type="button" disabled={busy} onClick={() => switchMode("signup")} className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text)]">Don&apos;t have an account? Sign up</button>
            <button type="button" disabled={busy} onClick={() => switchMode("recover")} className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text)]">Forgot password?</button>
            <button type="button" disabled={busy} onClick={() => switchMode("verify")} className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text)]">Resend verification email</button>
          </div> : <button type="button" disabled={busy} onClick={() => switchMode("signin")} className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text)]">Back to sign in</button>}
        </form>}
      </Card>
    </div>
  );
}
