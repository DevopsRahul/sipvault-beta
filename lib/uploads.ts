import { randomUUID } from "crypto";
import { storage } from "./storage";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_BYTES = 5 * 1024 * 1024;

/** Validate and store an uploaded image. Returns the storage key, or null if no file was sent. */
export async function saveImage(file: FormDataEntryValue | null, folder: string): Promise<string | null> {
  if (!file || typeof file === "string" || file.size === 0) return null;
  const ext = ALLOWED[file.type];
  if (!ext) throw new Error("Only JPG, PNG or WEBP images are allowed.");
  if (file.size > MAX_BYTES) throw new Error("Image must be 5 MB or smaller.");
  const key = `${folder}/${randomUUID()}.${ext}`;
  await storage().put(key, Buffer.from(await file.arrayBuffer()), file.type);
  return key;
}
