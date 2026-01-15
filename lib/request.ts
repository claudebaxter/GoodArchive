import type { NextRequest } from "next/server";

export function getClientIp(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  const xr = req.headers.get("x-real-ip");
  if (xr) return xr;
  // Fallback – Next.js doesn't expose remote address portably
  return "0.0.0.0";
}

