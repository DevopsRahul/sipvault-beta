import { updateOrderStatus } from "@/app/actions/orders";
import { LiveRefresh } from "@/components/LiveRefresh";
import { StatusBadge } from "@/components/StatusBadge";
import { db } from "@/lib/db";
import { timeOnly } from "@/lib/format";
import { requireBarUser } from "@/lib/session";

export default async function BarOrdersPage() {
  const user = await requireBarUser();
  const startOfShift = new Date(Date.now() - 12 * 60 * 60 * 1000);

  const [open, done] = await Promise.all([
    db.order.findMany({
      where: { barId: user.barId, status: { in: ["PLACED", "ACCEPTED"] } },
      include: { table: true, user: true, vaultBottle: { include: { product: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.order.findMany({
      where: { barId: user.barId, status: { in: ["SERVED", "REJECTED", "CANCELLED"] }, updatedAt: { gte: startOfShift } },
      include: { table: true, user: true, vaultBottle: { include: { product: true } } },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <div className="space-y-8">
      <LiveRefresh beep />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Open orders <span className="text-amber-400">({open.length})</span>
        </h2>
        {open.length === 0 && <p className="text-neutral-500">No open orders. New orders appear here automatically.</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {open.map((o) => (
            <div key={o.id} className={`card space-y-2 ${o.status === "PLACED" ? "border-sky-700" : "border-amber-700"}`}>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">Table {o.table.tableNo}</span>
                <StatusBadge status={o.status} />
              </div>
              <p className="font-semibold">
                {o.pegs} × {o.vaultBottle.pegSizeMl} ml — {o.vaultBottle.product.brand} {o.vaultBottle.product.name}
              </p>
              <p className="text-sm text-neutral-400">
                {o.user.name} · {timeOnly(o.createdAt)} · bottle has {o.vaultBottle.remainingMl} ml
              </p>
              {o.note && <p className="rounded bg-neutral-800 p-2 text-sm">“{o.note}”</p>}
              <div className="flex gap-2 pt-1">
                {o.status === "PLACED" && (
                  <form action={updateOrderStatus.bind(null, o.id, "ACCEPTED")}>
                    <button className="btn">Accept</button>
                  </form>
                )}
                <form action={updateOrderStatus.bind(null, o.id, "SERVED")}>
                  <button className="btn-primary">Mark served</button>
                </form>
                <form action={updateOrderStatus.bind(null, o.id, "REJECTED")}>
                  <button className="btn-danger">Reject</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Completed this shift</h2>
        <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800">
          {done.map((o) => (
            <li key={o.id} className="flex items-center justify-between p-3 text-sm">
              <span>
                Table {o.table.tableNo} · {o.pegs} × {o.vaultBottle.product.brand} {o.vaultBottle.product.name} · {o.user.name}
              </span>
              <span className="flex items-center gap-2 text-neutral-500">
                {timeOnly(o.updatedAt)} <StatusBadge status={o.status} />
              </span>
            </li>
          ))}
          {done.length === 0 && <li className="p-3 text-sm text-neutral-500">Nothing yet.</li>}
        </ul>
      </section>
    </div>
  );
}
