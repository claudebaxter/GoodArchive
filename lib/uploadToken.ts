import { randomUUID } from "crypto";
import { Redis } from "@upstash/redis";

const TOKEN_TTL_SECONDS = 5 * 60; // 5 minutes

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function createSubmissionToken(ip: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  const token = randomUUID();
  await redis.set(`submission_token:${token}`, ip, { ex: TOKEN_TTL_SECONDS });
  return token;
}

export async function consumeSubmissionToken(token: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const key = `submission_token:${token}`;
  const val = await redis.get<string>(key);
  if (!val) return false;
  await redis.del(key);
  return true;
}

