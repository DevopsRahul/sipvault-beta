import Link from "next/link";
import { db } from "@/lib/db";
import { requireBarUser } from "@/lib/session";

// Everything under /bar/* is the BAR PORTAL (owner + staff only).
export default async function BarLayout({ children }: { children: React.ReactNode }) {
  const user = await requireBarUser();
  const bar = await db.bar.findUnique({ where: { id: user.barId } });
  const isOwner = user.role === "BAR_OWNER";

  const tabs = [
    { href: "/bar/orders", label: "Live Orders" },
    { href: "/bar/bottles", label: "Customer Bottles" },
    ...(isOwner
      ? [
          { href: "/bar/menu", label: "Menu & Prices" },
          { href: "/bar/tables", label: "Tables & QR" },
          { href: "/bar/staff", label: "Staff" },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-neutral-500">Bar portal · {isOwner ? "Owner" : "Staff"}</p>
          <h1 className="text-2xl font-bold">{bar?.name}</h1>
        </div>
        <nav className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} className="btn">
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
