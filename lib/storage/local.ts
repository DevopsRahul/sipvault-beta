import { promises as fs } from "fs";
import path from "path";
import type { Storage } from "./types";

// BETA driver: writes files to UPLOAD_DIR (a Docker volume on the server).
// Caddy serves that volume at /media/*.

export function uploadRoot() {
  return path.resolve(process.env.UPLOAD_DIR || "./uploads");
}

/** Resolve a key to a file path, refusing anything that escapes the upload folder. */
export function safePath(key: string) {
  const root = uploadRoot();
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export class LocalStorage implements Storage {
  async put(key: string, body: Buffer) {
    const file = safePath(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
  }

  async delete(key: string) {
    await fs.rm(safePath(key), { force: true });
  }
}
