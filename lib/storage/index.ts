import { LocalStorage } from "./local";
import { S3Storage } from "./s3";
import type { Storage } from "./types";

// Switch between local disk (beta) and S3 (prod) with ONE env var: STORAGE_DRIVER=local|s3
let instance: Storage | null = null;

export function storage(): Storage {
  if (!instance) {
    instance = process.env.STORAGE_DRIVER === "s3" ? new S3Storage() : new LocalStorage();
  }
  return instance;
}

/**
 * The DB stores only the key ("products/abc.webp"). The public URL is built here at render time,
 * so moving from /media (beta) to https://cdn.example.com (prod) needs no DB changes.
 */
export function mediaUrl(key?: string | null) {
  if (!key) return null;
  const base = (process.env.MEDIA_BASE_URL || "/media").replace(/\/$/, "");
  return `${base}/${key}`;
}
