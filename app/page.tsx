"use client";

import React from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; id: string }
  | { status: "error"; message: string };

export default function HomePage() {
  const [state, setState] = React.useState<SubmitState>({ status: "idle" });
  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY;
  const previewRef = React.useRef<HTMLImageElement | null>(null);
  const captchaIdRef = React.useRef<string | number | null>(null);
  const pathname = usePathname();

  React.useEffect(() => {
    if (!siteKey) return;
    const el = document.getElementById("hcaptcha-container");
    if (!el) return;
    let attempts = 0;
    let cancelled = false;

    const renderWidget = () => {
      if (cancelled) return false;
      const hcaptcha = (window as any)?.hcaptcha;
      if (!hcaptcha?.render) return false;
      try {
        if (captchaIdRef.current != null) {
          hcaptcha.remove?.(captchaIdRef.current);
          captchaIdRef.current = null;
        }
        el.innerHTML = "";
        captchaIdRef.current = hcaptcha.render(el, { sitekey: siteKey }) ?? null;
        return true;
      } catch {
        return false;
      }
    };

    if (renderWidget()) return;

    const interval = setInterval(() => {
      attempts += 1;
      if (renderWidget() || attempts > 20) {
        clearInterval(interval);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearInterval(interval);
      try {
        if (captchaIdRef.current != null) {
          (window as any)?.hcaptcha?.remove?.(captchaIdRef.current);
          captchaIdRef.current = null;
        }
      } catch {}
    };
  }, [siteKey, pathname]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget; // capture before any awaits (React pools events)
    setState({ status: "submitting" });
    const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY;
    let hcaptchaToken: string | undefined;
    try {
      hcaptchaToken = (window as any)?.hcaptcha?.getResponse?.() || undefined;
    } catch {}
    if (siteKey && !hcaptchaToken) {
      setState({ status: "error", message: "captcha_required" });
      return;
    }
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
    if (siteKey && hcaptchaToken) {
      payload.hcaptcha_token = hcaptchaToken;
    }
    // Optional screenshot upload first
    const file = (form.get("screenshot") as File | null) || null;
    if (file && file.size > 0) {
      // Request a signed upload URL after captcha verification
      const upReq = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hcaptcha_token: hcaptchaToken,
          mime: file.type,
          size: file.size,
        }),
      });
      const upJson = await upReq.json();
      if (!upReq.ok) {
        throw new Error(upJson?.error || "upload_url_failed");
      }
      const putRes = await fetch(upJson.signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error("upload_failed");
      }
      payload.screenshot_path = upJson.path;
      payload.submission_token = upJson.submission_token;
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
      if (previewRef.current) {
        previewRef.current.src = "";
        previewRef.current.style.display = "none";
      }
    } catch (err: any) {
      setState({ status: "error", message: err?.message || "submit_failed" });
    } finally {
      try {
        if (siteKey) (window as any)?.hcaptcha?.reset?.();
      } catch {}
    }
  }

  return (
    <main>
      {siteKey && (
        <Script
          src="https://hcaptcha.com/1/api.js?render=explicit"
          async
          defer
          strategy="afterInteractive"
        />
      )}
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
              const img = previewRef.current;
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
          <img
            ref={previewRef}
            id="preview-img"
            alt="preview"
            style={{ display: "none", marginTop: "0.5rem", maxWidth: "100%", height: "auto", border: "1px solid #eee" }}
          />
        </label>
        <label>
          <span>Tags (comma-separated)</span>
          <input name="tags" placeholder="politics, rhetoric" />
        </label>
        <label className="full">
          <span>Note (optional)</span>
          <textarea name="note" rows={3} />
        </label>
        {siteKey && (
          <div className="full" style={{ marginTop: "0.25rem" }}>
            <div id="hcaptcha-container" className="h-captcha"></div>
          </div>
        )}
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