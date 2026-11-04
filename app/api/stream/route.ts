import { auth } from "@/lib/auth";
import { channels, createSubscriber } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream.
 * - Bar owner/staff receive events for their bar (new orders, cancellations).
 * - Customers receive events for themselves (order accepted / served / rejected).
 */
export async function GET(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return new Response("Unauthorized", { status: 401 });

  const isBar = (user.role === "BAR_OWNER" || user.role === "BAR_STAFF") && user.barId;
  const channel = isBar ? channels.bar(user.barId!) : channels.user(user.id);
  const sub = createSubscriber();
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(enc.encode(data));
        } catch {}
      };
      send(`data: ${JSON.stringify({ type: "hello" })}\n\n`);

      if (sub) {
        sub.on("message", (_ch, message) => send(`data: ${message}\n\n`));
        await sub.subscribe(channel);
      }

      // keep-alive comment so proxies don't close an idle connection
      const ping = setInterval(() => send(`: ping\n\n`), 25_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(ping);
        sub?.quit().catch(() => {});
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
