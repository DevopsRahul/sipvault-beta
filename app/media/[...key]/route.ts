import { promises as fs } from "fs";
import path from "path";
import { safePath } from "@/lib/storage/local";

export const runtime = "nodejs";

// Serves uploaded images from the local upload folder.
// On the SERVER, Caddy answers /media/* directly from the volume, so this route is only
// hit during local development (npm run dev) or if Caddy is bypassed.

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  try {
    const file = safePath(key.join("/"));
    const data = await fs.readFile(file);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
