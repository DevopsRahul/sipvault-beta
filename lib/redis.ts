import Redis from "ioredis";

// Redis is used ONLY for pub/sub: when an order changes we publish an event, and the
// /api/stream endpoint (Server-Sent Events) pushes it to open browsers so the bar portal
// and the customer's vault refresh instantly. If REDIS_URL is not set the app still works,
// pages just won't auto-refresh.

const url = process.env.REDIS_URL;
const globalForRedis = globalThis as unknown as { redisPub?: Redis };

function publisher(): Redis | null {
  if (!url) return null;
  if (!globalForRedis.redisPub) {
    globalForRedis.redisPub = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
    globalForRedis.redisPub.on("error", (e) => console.error("[redis]", e.message));
  }
  return globalForRedis.redisPub;
}

export async function publish(channel: string, payload: Record<string, unknown>) {
  const r = publisher();
  if (!r) return;
  try {
    await r.publish(channel, JSON.stringify(payload));
  } catch (e) {
    console.error("[redis] publish failed", e);
  }
}

/** A subscriber needs its own connection (a subscribed connection can't run other commands). */
export function createSubscriber(): Redis | null {
  if (!url) return null;
  const sub = new Redis(url);
  sub.on("error", (e) => console.error("[redis sub]", e.message));
  return sub;
}

export const channels = {
  bar: (barId: string) => `bar:${barId}`,
  user: (userId: string) => `user:${userId}`,
};
