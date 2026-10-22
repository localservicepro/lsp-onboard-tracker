// Auth context for the LSP Onboarding Checklist.
// Staff sign-in via Cloud email/password. Only approved staff (present in
// public.staff) may access client records. No public registration.

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase } from "../integrations/supabase/client";

export interface StaffIdentity {
  userId: string;
  email: string | null;
  approved: boolean;
  displayName: string;
}

interface AuthApi {
  staff: StaffIdentity | null;
  ready: boolean;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<StaffIdentity | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setStaff(null);
        return;
      }
      const userId = session.user.id;
      const email = session.user.email ?? null;
      const { data: staffRow } = await supabase
        .from("staff")
        .select("id, display_name")
        .eq("user_id", userId)
        .maybeSingle();
      setStaff({
        userId,
        email,
        approved: !!staffRow,
        displayName: (staffRow as { display_name?: string } | null)?.display_name ?? email ?? "Staff",
      });
    } catch (e) {
      setStaff(null);
      setError(e instanceof Error ? e.message : "Session check failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refresh();
      setReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!session) {
        setStaff(null);
        setReady(true);
      } else {
        void refresh();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) return { ok: false, error: signInErr.message };
      await refresh();
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign-in failed";
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setStaff(null);
  }, []);

  return (
    <AuthContext.Provider value={{ staff, ready, loading, error, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}