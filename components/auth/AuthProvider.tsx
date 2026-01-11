"use client";

import React from "react";
import type { Session, User, Provider as OAuthProvider } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<null | string>;
  signInWithOtp: (email: string) => Promise<null | string>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<null | string>;
  signOut: () => Promise<null | string>;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [supabase] = React.useState(() => createBrowserSupabaseClient());

  React.useEffect(() => {
    let isMounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    })();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = React.useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const signInWithOtp = React.useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    return error ? error.message : null;
  }, []);

  const signInWithOAuth = React.useCallback(async (provider: OAuthProvider) => {
    const { error } = await supabase.auth.signInWithOAuth({ provider });
    return error ? error.message : null;
  }, []);

  const signOut = React.useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return error ? error.message : null;
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    loading,
    signInWithPassword,
    signInWithOtp,
    signInWithOAuth,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

