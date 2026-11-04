import { addStaff } from "@/app/actions/bar";
import { ActionForm } from "@/components/ActionForm";
import { db } from "@/lib/db";
import { requireBarOwner } from "@/lib/session";

export default async function BarStaffPage() {
  const owner = await requireBarOwner();
  const staff = await db.user.findMany({
    where: { barId: owner.barId },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Team</h2>
        <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800">
          {staff.map((s) => (
            <li key={s.id} className="flex justify-between p-3 text-sm">
              <span>
                {s.name} <span className="text-neutral-500">· {s.email}</span>
              </span>
              <span className="text-xs text-neutral-400">{s.role === "BAR_OWNER" ? "Owner" : "Staff"}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Add a bartender / waiter</h2>
        <ActionForm action={addStaff} className="card space-y-3">
          <input name="name" className="input" placeholder="Name" required />
          <input name="email" type="email" className="input" placeholder="Login email" required />
          <input name="password" type="password" minLength={8} className="input" placeholder="Temporary password (min 8)" required />
          <button className="btn-primary w-full">Create staff login</button>
        </ActionForm>
        <p className="text-xs text-neutral-500">Staff can see and serve orders but cannot change the menu, tables or team.</p>
      </div>
    </div>
  );
}
