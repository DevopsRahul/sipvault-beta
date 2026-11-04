import { BottleGauge } from "@/components/BottleGauge";
import { db } from "@/lib/db";
import { date } from "@/lib/format";
import { requireBarUser } from "@/lib/session";

/** Physical stock the bar is holding for customers. */
export default async function BarBottlesPage() {
  const user = await requireBarUser();
  const bottles = await db.vaultBottle.findMany({
    where: { barId: user.barId, status: "ACTIVE" },
    include: { product: true, user: true },
    orderBy: { expiresAt: "asc" },
  });
  const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Bottles held for customers ({bottles.length})</h2>
      <div className="overflow-x-auto rounded-xl border border-neutral-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-900 text-xs uppercase text-neutral-400">
            <tr>
              <th className="p-3"></th>
              <th className="p-3">Customer</th>
              <th className="p-3">Bottle</th>
              <th className="p-3">Left</th>
              <th className="p-3">Keep until</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {bottles.map((b) => (
              <tr key={b.id}>
                <td className="p-3">
                  <BottleGauge id={b.id} totalMl={b.totalMl} remainingMl={b.remainingMl} reservedMl={b.reservedMl} size={48} />
                </td>
                <td className="p-3">
                  {b.user.name}
                  <div className="text-xs text-neutral-500">{b.user.phone ?? b.user.email}</div>
                </td>
                <td className="p-3">
                  {b.product.brand} {b.product.name}
                </td>
                <td className="p-3">
                  {b.remainingMl} / {b.totalMl} ml
                </td>
                <td className={`p-3 ${b.expiresAt && b.expiresAt < soon ? "text-red-400" : ""}`}>
                  {b.expiresAt ? date(b.expiresAt) : "—"}
                </td>
              </tr>
            ))}
            {bottles.length === 0 && (
              <tr>
                <td className="p-3 text-neutral-500" colSpan={5}>
                  No customer bottles yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
