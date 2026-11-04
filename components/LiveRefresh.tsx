"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Opens a Server-Sent Events connection to /api/stream. Whenever the server publishes an
 * event for this user/bar, the page re-fetches its data (router.refresh) - no reload needed.
 * `beep` plays a short sound (used on the bar's order screen for new orders).
 */
export function LiveRefresh({ beep = false }: { beep?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onmessage = (e) => {
      let type = "";
      try {
        type = JSON.parse(e.data).type;
      } catch {}
      if (type === "hello") return;
      router.refresh();
      if (beep && type === "order_placed") playBeep();
    };
    // EventSource reconnects automatically if the connection drops.
    return () => es.close();
  }, [router, beep]);

  return null;
}

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    // browsers block audio until the user has clicked on the page once
  }
}
