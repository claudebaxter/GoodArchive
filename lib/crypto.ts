import "server-only";
import { createHmac, randomBytes } from "crypto";

const IP_HASH_SECRET = process.env.IP_HASH_SECRET || "";

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip || !IP_HASH_SECRET) return null;
  const h = createHmac("sha256", IP_HASH_SECRET);
  h.update(ip);
  return h.digest("hex");
}

export function randomKey(len = 16): string {
  return randomBytes(len).toString("hex");
}

