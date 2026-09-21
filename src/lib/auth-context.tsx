"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { apiRequest, ApiError, invalidateApiRequests } from "./api-client";
import { clearOfflineShopping, readOfflineShopping } from "./offline-shopping";

export interface HouseholdInfo { id: string; name: string; role: "owner" | "member" }
export interface AuthUser { id: string; email: string; name: string; emailVerified: boolean; isAnonymous?: boolean }
export interface AuthSession { id: string; expiresAt: string; user: AuthUser }
type SessionResponse = { user: AuthUser; session: { id: string; expiresAt: string } } | null;
type AuthResult = { error?: string };
type GuestRecoveryResult = { recoveryCode?: string; error?: string };
interface AuthState {
  loading: boolean;
  error: string | null;
  session: AuthSession | null;
  user: AuthUser | null;
  household: HouseholdInfo | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  startGuest: () => Promise<AuthResult>;
  recoverGuest: (code: string) => Promise<GuestRecoveryResult>;
  rotateGuestRecovery: () => Promise<GuestRecoveryResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  resetPassword: (token: string, newPassword: string) => Promise<AuthResult>;
  resendVerification: (email: string) => Promise<AuthResult>;
  createHousehold: (name: string) => Promise<AuthResult>;
  joinHousehold: (code: string) => Promise<AuthResult>;
  createInvite: () => Promise<{ code?: string; error?: string }>;
  refreshHousehold: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);
const AUTH_EVENT = "pantry:auth-change";
const message = (error: unknown) => error instanceof Error ? error.message : "The request could not be completed. Please retry.";

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [household, setHousehold] = useState<HouseholdInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentSession = useRef<AuthSession | null>(null);
  const currentHousehold = useRef<HouseholdInfo | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);
  const authenticating = useRef(false);

  const applyIdentity = useCallback((next: AuthSession | null, home: HouseholdInfo | null) => {
    if (currentSession.current?.user.id !== next?.user.id || currentHousehold.current?.id !== home?.id) {
      invalidateApiRequests();
      if ((currentSession.current && currentSession.current.user.id !== next?.user.id) || (currentHousehold.current && currentHousehold.current.id !== home?.id)) void clearOfflineShopping();
    }
    currentSession.current = next;
    currentHousehold.current = home;
    setSession(next);
    setHousehold(home);
  }, []);

  const notifyTabs = useCallback(() => {
    // This contains no credential or user data. Cookies remain HttpOnly.
    try { localStorage.setItem(AUTH_EVENT, `${Date.now()}:${Math.random()}`); } catch { /* Private browsing may disable storage. */ }
  }, []);

  const refresh = useCallback(async () => {
    const revision = ++generation.current;
    try {
      const result = await apiRequest<SessionResponse>("/api/auth/get-session", { identityScoped: false });
      if (!mounted.current || revision !== generation.current) return;
      const next = result ? { id: result.session.id, expiresAt: result.session.expiresAt, user: result.user } : null;
      if (!next) void clearOfflineShopping();
      else if (!currentSession.current) {
        void readOfflineShopping().then((saved) => {
          if (revision === generation.current && saved && saved.userId !== next.user.id) void clearOfflineShopping();
        }).catch(() => {});
      }
      // Remove the previous account before fetching the next account's household.
      if (currentSession.current?.user.id !== next?.user.id) applyIdentity(next, null);
      const homes = next ? await apiRequest<{ data: HouseholdInfo[] }>("/api/households", { identityScoped: false }) : { data: [] };
      if (!mounted.current || revision !== generation.current) return;
      applyIdentity(next, homes.data[0] ?? null);
      setError(null);
    } catch (cause) {
      if (!mounted.current || revision !== generation.current) return;
      if (cause instanceof ApiError && cause.status === 401) { void clearOfflineShopping(); applyIdentity(null, null); }
      else if (cause instanceof ApiError && cause.status === 403) { void clearOfflineShopping(); applyIdentity(currentSession.current, null); }
      // Membership/server failure is not equivalent to a new account without a home.
      setError(message(cause));
      throw cause;
    } finally {
      if (mounted.current && revision === generation.current) setLoading(false);
    }
  }, [applyIdentity]);

  useEffect(() => {
    mounted.current = true;
    const reload = () => {
      if (!authenticating.current && document.visibilityState !== "hidden") void refresh().catch(() => {});
    };
    const onStorage = (event: StorageEvent) => { if (event.key === AUTH_EVENT) reload(); };
    reload();
    window.addEventListener("focus", reload);
    window.addEventListener("online", reload);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", reload);
    return () => {
      mounted.current = false;
      generation.current++;
      window.removeEventListener("focus", reload);
      window.removeEventListener("online", reload);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", reload);
    };
  }, [refresh]);

  const authAction = useCallback(async (path: string, body: unknown): Promise<AuthResult> => {
    try {
      await apiRequest(path, { method: "POST", body, identityScoped: false });
      return {};
    } catch (cause) { return { error: message(cause) }; }
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    authenticating.current = true;
    const revision = ++generation.current;
    invalidateApiRequests();
    try {
      const result = await authAction("/api/auth/sign-in/email", { email: email.trim(), password });
      if (result.error) return result;
      if (!mounted.current || revision !== generation.current) return { error: "Your session changed. Please retry." };
      await refresh();
      if (!currentSession.current) return { error: "Your browser could not keep the sign-in session. Enable cookies for Pantry Pal and try again." };
      notifyTabs();
      return {};
    } catch (cause) { return { error: message(cause) }; }
    finally { authenticating.current = false; }
  }, [authAction, refresh, notifyTabs]);

  const signUp = useCallback((email: string, password: string) => authAction("/api/auth/sign-up/email", {
    name: email.trim().split("@")[0], email: email.trim(), password, callbackURL: "/sign-in/",
  }), [authAction]);

  const startGuest = useCallback(async (): Promise<AuthResult> => {
    authenticating.current = true;
    const revision = ++generation.current;
    invalidateApiRequests();
    try {
      const result = await authAction("/api/auth/sign-in/anonymous", {});
      if (result.error) return result;
      if (!mounted.current || revision !== generation.current) return { error: "Your session changed. Please retry." };
      await refresh();
      if (!currentSession.current?.user.isAnonymous) return { error: "Your browser could not keep the guest session. Enable cookies for Pantry Pal and try again." };
      notifyTabs();
      return {};
    } catch (cause) { return { error: message(cause) }; }
    finally { authenticating.current = false; }
  }, [authAction, refresh, notifyTabs]);

  const recoverGuest = useCallback(async (code: string): Promise<GuestRecoveryResult> => {
    authenticating.current = true;
    const revision = ++generation.current;
    invalidateApiRequests();
    let recoveryCode: string | undefined;
    try {
      const result = await apiRequest<{ recoveryCode: string }>("/api/auth/guest/recover", { method: "POST", body: { code }, identityScoped: false });
      recoveryCode = result.recoveryCode;
      if (!mounted.current || revision !== generation.current) return { recoveryCode, error: "Your session changed. Save the replacement code and retry." };
      await refresh();
      notifyTabs();
      return { recoveryCode, ...(!currentSession.current?.user.isAnonymous ? { error: "Your browser could not keep the session. Save this replacement code and enable cookies before retrying." } : {}) };
    } catch (cause) { return { recoveryCode, error: message(cause) }; }
    finally { authenticating.current = false; }
  }, [refresh, notifyTabs]);

  const rotateGuestRecovery = useCallback(async (): Promise<GuestRecoveryResult> => {
    if (!currentSession.current?.user.isAnonymous) return { error: "Recovery codes are only available for guest accounts." };
    const revision = generation.current;
    try {
      const result = await apiRequest<{ recoveryCode: string }>("/api/auth/guest/recovery-code", { method: "POST", body: {} });
      if (!mounted.current || revision !== generation.current) return { error: "Your session changed. Please retry." };
      return result;
    } catch (cause) { return { error: message(cause) }; }
  }, []);

  const signOut = useCallback(async () => {
    authenticating.current = true;
    const revision = ++generation.current;
    invalidateApiRequests();
    void clearOfflineShopping();
    try {
      await apiRequest("/api/auth/sign-out", { method: "POST", body: {}, identityScoped: false });
      if (!mounted.current || revision !== generation.current) return;
      applyIdentity(null, null);
      setError(null);
      notifyTabs();
    } catch (cause) { setError(`Sign out failed: ${message(cause)}`); }
    finally { authenticating.current = false; setLoading(false); }
  }, [applyIdentity, notifyTabs]);

  const requestPasswordReset = useCallback((email: string) => authAction("/api/auth/request-password-reset", {
    email: email.trim(), redirectTo: `${window.location.origin}/sign-in/`,
  }), [authAction]);
  const resendVerification = useCallback((email: string) => authAction("/api/auth/send-verification-email", {
    email: email.trim(), callbackURL: "/sign-in/",
  }), [authAction]);
  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    authenticating.current = true;
    generation.current++;
    invalidateApiRequests();
    try {
      const result = await authAction("/api/auth/reset-password", { token, newPassword });
      if (!result.error) { applyIdentity(null, null); notifyTabs(); }
      return result;
    } finally { authenticating.current = false; }
  }, [authAction, applyIdentity, notifyTabs]);

  const changeHousehold = useCallback(async (path: string, body: unknown): Promise<AuthResult> => {
    if (!currentSession.current) return { error: "Not signed in" };
    const revision = generation.current;
    try {
      const result = await apiRequest<{ data: HouseholdInfo }>(path, { method: "POST", body });
      if (!mounted.current || revision !== generation.current) return { error: "Your session changed. Please retry." };
      applyIdentity(currentSession.current, result.data);
      setError(null);
      notifyTabs();
      return {};
    } catch (cause) { return { error: message(cause) }; }
  }, [applyIdentity, notifyTabs]);
  const createHousehold = useCallback((name: string) => changeHousehold("/api/households", { name: name.trim() }), [changeHousehold]);
  const joinHousehold = useCallback((code: string) => changeHousehold("/api/invites/redeem", { code: code.trim().toUpperCase() }), [changeHousehold]);
  const createInvite = useCallback(async () => {
    const home = currentHousehold.current;
    if (!home) return { error: "No household" };
    try { return await apiRequest<{ code: string }>(`/api/households/${encodeURIComponent(home.id)}/invites`, { method: "POST", body: {} }); }
    catch (cause) { return { error: message(cause) }; }
  }, []);

  const refreshHousehold = useCallback(async () => { await refresh().catch(() => {}); }, [refresh]);
  return <AuthCtx.Provider value={{ loading, error, session, user: session?.user ?? null, household, signIn, signUp, signOut, startGuest, recoverGuest, rotateGuestRecovery, requestPasswordReset, resetPassword, resendVerification, createHousehold, joinHousehold, createInvite, refreshHousehold }}>{children}</AuthCtx.Provider>;
}
