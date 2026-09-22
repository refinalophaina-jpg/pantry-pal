"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button, Input, Label } from "@/components/ui";

type Mode = "signin" | "signup" | "recover" | "reset" | "verify" | "guest-recover";
const headings: Record<Mode, string> = { signin: "Welcome back", signup: "Create an account", recover: "Reset your password", reset: "Choose a new password", verify: "Verify your email", "guest-recover": "Recover your guest pantry" };
const leads: Record<Mode, string> = {
  signin: "Sign in to your household.",
  signup: "Verify your email, then create or join a household.",
  recover: "We’ll email a reset link to this address.",
  reset: "Use 8–128 characters.",
  verify: "We’ll resend the verification link.",
  "guest-recover": "Paste your saved recovery code. Recovery replaces the code and signs out its other browsers.",
};

const linkClass = "min-h-11 cursor-pointer text-sm text-[var(--text-muted)] underline-offset-4 hover:text-[var(--text)] hover:underline disabled:opacity-50";

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
  const submitLabel = busy ? "Working…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : mode === "reset" ? "Save new password" : mode === "guest-recover" ? "Recover guest account" : "Send link";

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--bg)] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/illustrations/logo.svg" alt="" aria-hidden="true" className="size-9 rounded-lg" draggable={false} />
          <span className="font-medium">Pantry Pal</span>
        </div>
        <h1 className="text-2xl sm:text-3xl">{headings[mode]}</h1>
        <p className="mb-6 mt-1 text-sm text-[var(--text-muted)]">{leads[mode]}</p>
        {sessionError && <div role="alert" className="mb-4 text-sm text-[var(--danger)]">{sessionError} <a href="/offline-shopping/" className="underline underline-offset-4">Open saved shopping list</a></div>}
        {notice && <div role="status" className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">{notice}</div>}
        {replacementCode ? <div className="space-y-3">
          <h2 className="font-medium">Save your new recovery code</h2>
          <p className="text-sm text-[var(--text-muted)]">Your previous code no longer works. This replacement is shown only here. Anyone with this code can access your guest pantry.</p>
          <Label htmlFor="replacement-code">New guest recovery code</Label>
          <textarea id="replacement-code" readOnly value={replacementCode} autoComplete="off" spellCheck={false} className="w-full break-all rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 font-mono text-sm" rows={4} />
          {error && <div role="alert" className="text-sm text-[var(--danger)]">{error} Your replacement code is still valid; save it before leaving.</div>}
          <Button type="button" variant="secondary" className="w-full" onClick={copyRecoveryCode}>Copy recovery code</Button>
          <Button type="button" className="w-full" disabled={busy} onClick={() => { setReplacementCode(""); switchMode("signin"); }}>I&apos;ve saved my recovery code</Button>
        </div> : <form onSubmit={submit} className="space-y-4">
          {mode === "guest-recover" && <div>
            <Label htmlFor="guest-code">Guest recovery code</Label>
            <Input id="guest-code" required maxLength={256} autoComplete="off" autoCapitalize="none" spellCheck={false} value={guestCode} onChange={(event) => setGuestCode(event.target.value)} disabled={busy} />
          </div>}
          {needsEmail && <div>
            <Label htmlFor="auth-email">Email</Label>
            <Input id="auth-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} />
          </div>}
          {needsPassword && <div>
            <Label htmlFor="auth-password">{mode === "reset" ? "New password" : "Password"}</Label>
            <Input id="auth-password" type="password" required minLength={mode === "signin" ? 1 : 8} maxLength={128} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
          </div>}
          {error && <div role="alert" className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
          <Button type="submit" className="w-full" disabled={busy}>{submitLabel}</Button>
          {mode === "signin" ? <>
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
              <button type="button" disabled={busy} onClick={() => switchMode("signup")} className={linkClass}>Create an account</button>
              <button type="button" disabled={busy} onClick={() => switchMode("recover")} className={linkClass}>Forgot password?</button>
            </div>
            <div className="border-t border-[var(--border)] pt-4">
              <Button type="button" variant="secondary" disabled={busy || loading} onClick={beginGuest} className="w-full">Continue as guest</Button>
              <p className="mt-2 text-sm text-[var(--text-muted)]">No email needed. This browser remembers your pantry; add a recovery code later to open it elsewhere.</p>
              <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1">
                <button type="button" disabled={busy} onClick={() => switchMode("guest-recover")} className={linkClass}>Recover a guest account</button>
                <button type="button" disabled={busy} onClick={() => switchMode("verify")} className={linkClass}>Resend verification email</button>
              </div>
            </div>
          </> : <div className="flex justify-center"><button type="button" disabled={busy} onClick={() => switchMode("signin")} className={linkClass}>Back to sign in</button></div>}
        </form>}
      </div>
    </div>
  );
}
