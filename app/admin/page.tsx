import { createBar, createProduct, toggleBar } from "@/app/actions/admin";
import { ActionForm } from "@/components/ActionForm";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { mediaUrl } from "@/lib/storage";

const CATEGORIES = ["Whisky", "Vodka", "Rum", "Gin", "Tequila", "Brandy", "Wine", "Beer", "Liqueur", "Other"];

export default async function AdminPage() {
  const [bars, products, stats] = await Promise.all([
    db.bar.findMany({
      include: { users: { where: { role: "BAR_OWNER" } }, _count: { select: { bottles: true, orders: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.product.findMany({ orderBy: [{ category: "asc" }, { brand: "asc" }] }),
    db.purchase.aggregate({ where: { status: "PAID" }, _sum: { amountMinor: true }, _count: true }),
  ]);
  const customers = await db.user.count({ where: { role: "CUSTOMER" } });

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Bars" value={bars.length} />
        <Stat label="Customers" value={customers} />
        <Stat label="Bottles sold" value={stats._count} />
        <Stat label="Gross sales" value={money(stats._sum.amountMinor ?? 0)} />
      </div>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-lg font-semibold">Bars</h2>
          <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800">
            {bars.map((b) => (
              <li key={b.id} className={`flex items-center justify-between p-3 text-sm ${b.active ? "" : "opacity-50"}`}>
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-xs text-neutral-500">
                    {b.city ?? "—"} · owner {b.users[0]?.email ?? "none"} · {b._count.bottles} bottles · {b._count.orders} orders
                  </p>
                </div>
                <form action={toggleBar.bind(null, b.id)}>
                  <button className="btn">{b.active ? "Disable" : "Enable"}</button>
                </form>
              </li>
            ))}
            {bars.length === 0 && <li className="p-3 text-sm text-neutral-500">No bars yet.</li>}
          </ul>
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Onboard a bar</h2>
          <ActionForm action={createBar} className="card space-y-2">
            <input name="name" className="input" placeholder="Bar name" required />
            <input name="address" className="input" placeholder="Address" />
            <input name="city" className="input" placeholder="City" />
            <input name="licenseNo" className="input" placeholder="Liquor licence no." />
            <label className="label pt-1">Keep bottles for (days)</label>
            <input name="keepDays" type="number" defaultValue={90} min={1} max={365} className="input" />
            <p className="label pt-2">Owner login</p>
            <input name="ownerName" className="input" placeholder="Owner name" required />
            <input name="ownerEmail" type="email" className="input" placeholder="Owner email" required />
            <input name="ownerPassword" type="password" minLength={8} className="input" placeholder="Temporary password" required />
            <button className="btn-primary w-full">Create bar</button>
          </ActionForm>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-lg font-semibold">Product catalog ({products.length})</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {products.map((p) => {
              const img = mediaUrl(p.imageKey);
              return (
                <div key={p.id} className="card flex items-center gap-3 text-sm">
                  {img ? (
                    <img src={img} alt="" className="h-12 w-12 rounded object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded bg-neutral-800" />
                  )}
                  <div>
                    <p className="font-medium">
                      {p.brand} {p.name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {p.category} · {p.volumeMl} ml
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Add product</h2>
          <ActionForm action={createProduct} className="card space-y-2">
            <input name="brand" className="input" placeholder="Brand (e.g. Glenfiddich)" required />
            <input name="name" className="input" placeholder="Name (e.g. 12 Year Old)" required />
            <select name="category" className="input" required defaultValue="Whisky">
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input name="volumeMl" type="number" defaultValue={750} min={50} className="input" placeholder="Volume ml" />
            <label className="label pt-1">Bottle image (JPG/PNG/WEBP, max 5 MB)</label>
            <input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="input" />
            <button className="btn-primary w-full">Add to catalog</button>
          </ActionForm>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <p className="text-xs uppercase text-neutral-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
