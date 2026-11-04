import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function BarsPage() {
  await requireUser(["CUSTOMER"], "/bars");
  const bars = await db.bar.findMany({
    where: { active: true },
    include: { _count: { select: { menu: { where: { active: true } } } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Choose a bar</h1>
        <p className="text-sm text-neutral-400">Your bottle is kept at the bar you buy it from.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {bars.map((bar) => (
          <Link key={bar.id} href={`/bars/${bar.id}`} className="card hover:border-amber-600">
            <p className="text-lg font-semibold">{bar.name}</p>
            <p className="text-sm text-neutral-400">{[bar.address, bar.city].filter(Boolean).join(", ")}</p>
            <p className="mt-2 text-xs text-neutral-500">
              {bar._count.menu} bottles available · kept for {bar.keepDays} days
            </p>
          </Link>
        ))}
        {bars.length === 0 && <p className="text-neutral-500">No bars are live yet.</p>}
      </div>
    </div>
  );
}
