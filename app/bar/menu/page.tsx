import { saveMenuItem, toggleMenuItem } from "@/app/actions/bar";
import { ActionForm } from "@/components/ActionForm";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { requireBarOwner } from "@/lib/session";

export default async function BarMenuAdminPage() {
  const owner = await requireBarOwner();
  const [menu, catalog] = await Promise.all([
    db.barProduct.findMany({
      where: { barId: owner.barId },
      include: { product: true },
      orderBy: { product: { brand: "asc" } },
    }),
    db.product.findMany({ orderBy: [{ category: "asc" }, { brand: "asc" }] }),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-3">
        <h2 className="text-lg font-semibold">Your menu</h2>
        <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800">
          {menu.map((m) => (
            <li key={m.id} className={`flex items-center justify-between p-3 text-sm ${m.active ? "" : "opacity-50"}`}>
              <div>
                <p className="font-medium">
                  {m.product.brand} {m.product.name}
                </p>
                <p className="text-xs text-neutral-500">
                  {m.product.category} · {m.product.volumeMl} ml · peg {m.pegSizeMl} ml
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-amber-400">{money(m.priceMinor)}</span>
                <form action={toggleMenuItem.bind(null, m.id)}>
                  <button className="btn">{m.active ? "Hide" : "Show"}</button>
                </form>
              </div>
            </li>
          ))}
          {menu.length === 0 && <li className="p-3 text-sm text-neutral-500">No items yet. Add one on the right.</li>}
        </ul>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Add / update item</h2>
        <ActionForm action={saveMenuItem} className="card space-y-3">
          <div>
            <label className="label">Product (from catalog)</label>
            <select name="productId" className="input" required defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {catalog.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.category} — {p.brand} {p.name} ({p.volumeMl} ml)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Bottle price ({process.env.CURRENCY || "INR"})</label>
            <input name="price" type="number" step="0.01" min="1" className="input" required />
          </div>
          <div>
            <label className="label">Peg size (ml)</label>
            <input name="pegSizeMl" type="number" defaultValue={30} min={15} max={120} className="input" />
          </div>
          <button className="btn-primary w-full">Save</button>
        </ActionForm>
        <p className="text-xs text-neutral-500">Missing a product? Ask the SipVault admin to add it to the catalog.</p>
      </div>
    </div>
  );
}
