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
    const payload: any = {
      platform: String(form.get("platform") || ""),
      public_handle: String(form.get("public_handle") || ""),
      display_name: form.get("display_name")
        ? String(form.get("display_name"))
        : undefined,
      permalink: String(form.get("permalink") || ""),
      tags,
      note: form.get("note") ? String(form.get("note")) : undefined,
    };
    // Optional screenshot upload first
    const file = (form.get("screenshot") as File | null) || null;
    if (file && file.size > 0) {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/screenshots", { method: "POST", body: fd });
      const upJson = await up.json();
      if (!up.ok) {
        throw new Error(upJson?.error || "screenshot_upload_failed");
      }
      payload.screenshot_path = upJson.key;
    }
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
    <main>
      <h1 className="page-title">Submit a public entry</h1>
      <p className="muted">Submit public links only. Private data is not accepted.</p>
      <div className="card form-card">
      <form onSubmit={onSubmit} className="form-grid">
        <label>
          <span>Platform</span>
          <input name="platform" placeholder="twitter" required />
        </label>
        <label>
          <span>Public handle</span>
          <input name="public_handle" placeholder="exampleuser" required />
        </label>
        <label>
          <span>Display name (optional)</span>
          <input name="display_name" placeholder="Example User" />
        </label>
        <label>
          <span>Permalink</span>
          <input type="url" name="permalink" placeholder="https://..." required />
        </label>
        <label className="full">
          <span>Screenshot (PNG or JPEG, max 10MB)</span>
          <input
            type="file"
            name="screenshot"
            accept="image/png,image/jpeg"
            onChange={(ev) => {
              const img = document.getElementById("preview-img") as HTMLImageElement | null;
              if (!img) return;
              const f = (ev.target as HTMLInputElement).files?.[0];
              if (!f) {
                img.src = "";
                img.style.display = "none";
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                img.src = String(reader.result || "");
                img.style.display = "block";
              };
              reader.readAsDataURL(f);
            }}
          />
          <img id="preview-img" alt="preview" style={{ display: "none", marginTop: "0.5rem", maxWidth: "100%", height: "auto", border: "1px solid #eee" }} />
        </label>
        <label>
          <span>Tags (comma-separated)</span>
          <input name="tags" placeholder="politics, rhetoric" />
        </label>
        <label className="full">
          <span>Note (optional)</span>
          <textarea name="note" rows={3} />
        </label>
        <div className="full">
          <small className="muted">
            Please provide readable screenshots. Unreadable screenshots may be rejected.
          </small>
        </div>
        <div className="full">
          <button className="btn btn-primary" type="submit" disabled={state.status === "submitting"}>
            {state.status === "submitting" ? "Submitting…" : "Submit"}
          </button>
        </div>
      </form>
      </div>
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