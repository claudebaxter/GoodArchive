"use client";

import React from "react";
import Link from "next/link";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; id: string }
  | { status: "error"; message: string };

export default function HomePage() {
  const [state, setState] = React.useState<SubmitState>({ status: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget; // capture before any awaits (React pools events)
    setState({ status: "submitting" });
    const form = new FormData(formEl);
    const tagsInput = String(form.get("tags") || "");
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const payload = {
      platform: String(form.get("platform") || ""),
      public_handle: String(form.get("public_handle") || ""),
      display_name: form.get("display_name")
        ? String(form.get("display_name"))
        : undefined,
      permalink: String(form.get("permalink") || ""),
      tags,
      note: form.get("note") ? String(form.get("note")) : undefined,
    };
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "submit_failed");
      }
      setState({ status: "success", id: data.id });
      formEl.reset();
    } catch (err: any) {
      setState({ status: "error", message: err?.message || "submit_failed" });
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <nav style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem" }}>
        <Link href="/">Submit</Link>
        <Link href="/feed">Feed</Link>
        <Link href="/search">Search</Link>
        <Link href="/dashboard">Dashboard</Link>
      </nav>
      <h1>Submit a public entry</h1>
      <p style={{ color: "#555" }}>
        Submit public links only. Private data is not accepted.
      </p>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Platform</span>
          <input name="platform" placeholder="twitter" required />
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Public handle</span>
          <input name="public_handle" placeholder="exampleuser" required />
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Display name (optional)</span>
          <input name="display_name" placeholder="Example User" />
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Permalink</span>
          <input type="url" name="permalink" placeholder="https://..." required />
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Tags (comma-separated)</span>
          <input name="tags" placeholder="politics, rhetoric" />
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Note (optional)</span>
          <textarea name="note" rows={3} />
        </label>
        <button type="submit" disabled={state.status === "submitting"}>
          {state.status === "submitting" ? "Submitting…" : "Submit"}
        </button>
      </form>
      {state.status === "success" && (
        <p style={{ color: "green", marginTop: "0.75rem" }}>
          Submitted. Entry id: {state.id}
        </p>
      )}
      {state.status === "error" && (
        <p style={{ color: "crimson", marginTop: "0.75rem" }}>
          Error: {state.message}
        </p>
      )}
    </main>
  );
}