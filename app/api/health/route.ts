import { db } from "@/lib/db";

// Used by the Docker healthcheck and uptime monitors: GET /api/health -> {"status":"ok"}
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "db_error" }, { status: 503 });
  }
}
