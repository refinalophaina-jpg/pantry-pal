"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

export interface HouseholdInfo {
  id: string;
  name: string;
  role: "owner" | "member";
}

interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  household: HouseholdInfo | null;

  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;

  createHousehold: (name: string) => Promise<{ error?: string }>;
  joinHousehold: (code: string) => Promise<{ error?: string }>;
  createInvite: () => Promise<{ code?: string; error?: string }>;
  refreshHousehold: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [household, setHousehold] = useState<HouseholdInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHousehold = useCallback(async (userId: string) => {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("household_members")
      .select("role, household:households(id, name)")
      .eq("user_id", userId)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error || !data || !data.household) {
      setHousehold(null);
      return;
    }
    const h = data.household as unknown as { id: string; name: string };
    setHousehold({
      id: h.id,
      name: h.name,
      role: (data.role as "owner" | "member") ?? "member",
    });
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadHousehold(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, sess) => {
      setSession(sess);
      if (sess?.user) {
        await loadHousehold(sess.user.id);
      } else {
        setHousehold(null);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadHousehold]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return error ? { error: error.message } : {};
    },
    [],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signUp({ email, password });
      return error ? { error: error.message } : {};
    },
    [],
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    setHousehold(null);
  }, []);

  const createHousehold = useCallback(
    async (name: string) => {
      const supabase = getSupabase();
      const user = session?.user;
      if (!user) return { error: "Not signed in" };
      const { data, error } = await supabase
        .from("households")
        .insert({ name, created_by: user.id })
        .select("id, name")
        .single();
      if (error || !data) return { error: error?.message ?? "Insert failed" };
      setHousehold({ id: data.id, name: data.name, role: "owner" });
      return {};
    },
    [session],
  );

  const joinHousehold = useCallback(
    async (code: string) => {
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc("redeem_household_invite", {
        p_code: code.trim().toUpperCase(),
      });
      if (error) return { error: error.message };
      if (!data) return { error: "Invite invalid" };
      if (session?.user) await loadHousehold(session.user.id);
      return {};
    },
    [session, loadHousehold],
  );

  const createInvite = useCallback(async () => {
    if (!household) return { error: "No household" };
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("create_household_invite", {
      p_household_id: household.id,
    });
    if (error || !data) return { error: error?.message ?? "Failed" };
    return { code: data as string };
  }, [household]);

  const refreshHousehold = useCallback(async () => {
    if (session?.user) await loadHousehold(session.user.id);
  }, [session, loadHousehold]);

  return (
    <AuthCtx.Provider
      value={{
        loading,
        session,
        user: session?.user ?? null,
        household,
        signIn,
        signUp,
        signOut,
        createHousehold,
        joinHousehold,
        createInvite,
        refreshHousehold,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
