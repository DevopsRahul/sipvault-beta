import Link from "next/link";
import { notFound } from "next/navigation";
import { BottleGauge } from "@/components/BottleGauge";
import { OrderForm } from "@/components/OrderForm";
import { LiveRefresh } from "@/components/LiveRefresh";
import { StatusBadge } from "@/components/StatusBadge";
import { db } from "@/lib/db";
import { pourLabel, timeOnly } from "@/lib/format";
import { requireUser } from "@/lib/session";

/**
 * Opened by scanning the QR code on a table: /order/<barId>/<tableNo>
 * Shows the customer's bottles kept at this bar and lets them order pegs to this table.
 */
export default async function OrderPage({ params }: { params: Promise<{ barId: string; tableNo: string }> }) {
  const { barId, tableNo: rawTable } = await params;
  const tableNo = decodeURIComponent(rawTable);
  const user = await requireUser(["CUSTOMER"], `/order/${barId}/${rawTable}`);

  const table = await db.barTable.findUnique({
    where: { barId_tableNo: { barId, tableNo } },
    include: { bar: true },
  });
  if (!table || !table.bar.active) notFound();

  const since = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const [bottles, orders] = await Promise.all([
    db.vaultBottle.findMany({
      where: { userId: user.id, barId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: { product: true },
      orderBy: { purchasedAt: "desc" },
    }),
    db.order.findMany({
      where: { userId: user.id, barId, createdAt: { gte: since } },
      include: { vaultBottle: { include: { product: true } }, table: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <LiveRefresh />
      <div>
        <p className="text-sm text-neutral-400">{table.bar.name}</p>
        <h1 className="text-2xl font-bold">Table {table.tableNo}</h1>
      </div>

      {bottles.length === 0 ? (
        <div className="card space-y-3">
          <p className="text-neutral-300">You don&apos;t have a bottle at {table.bar.name} yet.</p>
          <Link href={`/bars/${barId}`} className="btn-primary">
            Buy a bottle here
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {bottles.map((b) => {
            const availableMl = Math.max(b.remainingMl - b.reservedMl, 0);
            return (
              <div key={b.id} className="card flex gap-4">
                <BottleGauge id={b.id} totalMl={b.totalMl} remainingMl={b.remainingMl} reservedMl={b.reservedMl} />
                <div className="flex-1 space-y-2">
                  <p className="font-semibold">
                    {b.product.brand} {b.product.name}
                  </p>
                  <p className="text-sm text-neutral-400">
                    <span className="text-amber-400">{availableMl} ml left</span> of {b.totalMl} ml
                    {b.reservedMl > 0 && ` · ${b.reservedMl} ml being poured`}
                  </p>
                  <OrderForm
                    bottleId={b.id}
                    pegSizeMl={b.pegSizeMl}
                    availableMl={availableMl}
                    fixedTable={{ id: table.id, tableNo: table.tableNo }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {orders.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Tonight&apos;s orders</h2>
          <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800">
            {orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between p-3 text-sm">
                <span>
                  {pourLabel(o.pourMl, o.vaultBottle.pegSizeMl)} {o.vaultBottle.product.brand} · Table {o.table.tableNo} · {timeOnly(o.createdAt)}
                </span>
                <StatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
