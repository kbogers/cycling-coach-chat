import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const url =
      process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
    const token =
      process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error(
        "Redis not configured. Set KV_REST_API_URL + KV_REST_API_TOKEN (Vercel KV) " +
          "or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.",
      );
    }
    redis = new Redis({ url, token });
  }
  return redis;
}
