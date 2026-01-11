"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { loading: authLoading, signInWithPassword, signInWithOtp } = useAuth();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [useMagic, setUseMagic] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      if (useMagic) {
        const res = await signInWithOtp(email);
        if (res) {
          setError(res);
        } else {
          setMessage("Magic link sent. Check your email.");
        }
      } else {
        const res = await signInWithPassword(email, password);
        if (res) {
          setError(res);
        } else {
          router.push("/dashboard");
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = authLoading || submitting || !email || (!useMagic && !password);

  return (
    <main style={{ maxWidth: 420, margin: "4rem auto", padding: "0 1rem" }}>
      <h1 style={{ marginBottom: "1rem" }}>Sign in</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem" }}>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>

        {!useMagic && (
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required={!useMagic}
            />
          </label>
        )}

        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            checked={useMagic}
            onChange={(e) => setUseMagic(e.target.checked)}
          />
          <span>Use magic link instead of password</span>
        </label>

        <button type="submit" disabled={disabled}>
          {submitting ? "Signing in…" : useMagic ? "Send magic link" : "Sign in"}
        </button>
      </form>

      {error && (
        <p style={{ color: "crimson", marginTop: "0.75rem" }} role="alert">
          {error}
        </p>
      )}
      {message && (
        <p style={{ color: "green", marginTop: "0.75rem" }} role="status">
          {message}
        </p>
      )}
    </main>
  );
}

