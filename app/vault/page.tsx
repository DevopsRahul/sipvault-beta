import Link from "next/link";
import { cancelOrder } from "@/app/actions/orders";
import { BottleGauge } from "@/components/BottleGauge";
import { LiveRefresh } from "@/components/LiveRefresh";
import { OrderForm } from "@/components/OrderForm";
import { StatusBadge } from "@/components/StatusBadge";
import { db } from "@/lib/db";
import { date, dateTime, pourLabel } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { mediaUrl } from "@/lib/storage";

export default async function VaultPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const user = await requireUser(["CUSTOMER"], "/vault");
  const { new: newId } = await searchParams;

  const [bottles, orders] = await Promise.all([
    db.vaultBottle.findMany({
      where: { userId: user.id },
      include: { product: true, bar: true },
      orderBy: [{ status: "asc" }, { purchasedAt: "desc" }],
    }),
    db.order.findMany({
      where: { userId: user.id },
      include: { vaultBottle: { include: { product: true } }, table: true, bar: true },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const now = new Date();

  // Tables of every bar where the customer keeps a bottle (for the "Order now" form).
  const barIds = [...new Set(bottles.map((b) => b.barId))];
  const tables = barIds.length
    ? await db.barTable.findMany({ where: { barId: { in: barIds } }, select: { id: true, barId: true, tableNo: true } })
    : [];
  tables.sort((a, b) => a.tableNo.localeCompare(b.tableNo, undefined, { numeric: true }));

  return (
    <div className="space-y-8">
      <LiveRefresh />
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Vault</h1>
          <p className="text-sm text-neutral-400">
            At the bar? Scan the QR code on your table to order from your bottles.
          </p>
        </div>
        <Link href="/bars" className="btn-primary">
          + Buy a bottle
        </Link>
      </div>

      {newId && <p className="card border-emerald-800 text-emerald-300">Bottle added to your vault. Cheers!</p>}

      {bottles.length === 0 ? (
        <div className="card text-neutral-400">Your vault is empty. Buy your first bottle to get started.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {bottles.map((b) => {
            const expired = b.expiresAt != null && b.expiresAt < now;
            const available = Math.max(b.remainingMl - b.reservedMl, 0);
            const canOrder = b.status === "ACTIVE" && !expired;
            const img = mediaUrl(b.product.imageKey);
            return (
              <div key={b.id} className={`card flex gap-4 ${b.status !== "ACTIVE" || expired ? "opacity-50" : ""}`}>
                <BottleGauge id={b.id} totalMl={b.totalMl} remainingMl={b.remainingMl} reservedMl={b.reservedMl} />
                <div className="min-w-0 flex-1 space-y-1">
                  {img && <img src={img} alt="" className="mb-1 h-10 w-10 rounded object-cover" />}
                  <p className="font-semibold">
                    {b.product.brand} {b.product.name}
                  </p>
                  <p className="text-sm text-neutral-400">{b.bar.name}</p>
                  <p className="text-sm">
                    <span className="text-lg font-bold text-amber-400">{available} ml</span> left of {b.totalMl} ml
                  </p>
                  <p className="text-xs text-neutral-400">
                    ≈ {Math.floor(available / b.pegSizeMl)} pegs of {b.pegSizeMl} ml
                    {b.reservedMl > 0 && ` · ${b.reservedMl} ml ordered, waiting for the bar`}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {b.status === "EMPTY" ? "Finished" : expired ? "Expired" : b.expiresAt ? `Kept until ${date(b.expiresAt)}` : ""}
                  </p>
                  {canOrder && (
                    <div className="pt-2">
                      <OrderForm
                        bottleId={b.id}
                        pegSizeMl={b.pegSizeMl}
                        availableMl={available}
                        tables={tables.filter((t) => t.barId === b.barId)}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent orders</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-neutral-500">No orders yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <p>
                    {pourLabel(o.pourMl, o.vaultBottle.pegSizeMl)} {o.vaultBottle.product.brand} {o.vaultBottle.product.name}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {o.bar.name} · Table {o.table.tableNo} · {dateTime(o.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={o.status} />
                  {o.status === "PLACED" && (
                    <form action={cancelOrder.bind(null, o.id)}>
                      <button className="btn-danger">Cancel</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
