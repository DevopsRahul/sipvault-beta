import { notFound } from "next/navigation";
import { buyBottle } from "@/app/actions/purchase";
import { BottleGauge } from "@/components/BottleGauge";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { mediaUrl } from "@/lib/storage";

export default async function BarMenuPage({ params }: { params: Promise<{ barId: string }> }) {
  const { barId } = await params;
  await requireUser(["CUSTOMER"], `/bars/${barId}`);

  const bar = await db.bar.findFirst({
    where: { id: barId, active: true },
    include: {
      menu: {
        where: { active: true },
        include: { product: true },
        orderBy: [{ product: { category: "asc" } }, { priceMinor: "asc" }],
      },
    },
  });
  if (!bar) notFound();

  const isMock = (process.env.PAYMENT_PROVIDER || "mock") === "mock";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bar.name}</h1>
        <p className="text-sm text-neutral-400">
          Bottles bought here are kept at {bar.name} for {bar.keepDays} days.
        </p>
        {isMock && (
          <p className="mt-2 text-xs text-amber-400">Beta: payments are simulated, no real money is charged.</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bar.menu.map((item) => {
          const img = mediaUrl(item.product.imageKey);
          return (
            <div key={item.id} className="card flex flex-col gap-3">
              <div className="flex items-center gap-3">
                {img ? (
                  <img src={img} alt="" className="h-20 w-20 rounded object-cover" />
                ) : (
                  <BottleGauge id={item.id} totalMl={1} remainingMl={1} size={80} />
                )}
                <div>
                  <p className="text-xs uppercase text-neutral-500">{item.product.category}</p>
                  <p className="font-semibold">
                    {item.product.brand} {item.product.name}
                  </p>
                  <p className="text-sm text-neutral-400">
                    {item.product.volumeMl} ml · {Math.floor(item.product.volumeMl / item.pegSizeMl)} pegs of {item.pegSizeMl} ml
                  </p>
                </div>
              </div>
              <form action={buyBottle.bind(null, item.id)} className="mt-auto flex items-center justify-between">
                <span className="text-lg font-bold text-amber-400">{money(item.priceMinor)}</span>
                <button className="btn-primary">Buy bottle</button>
              </form>
            </div>
          );
        })}
        {bar.menu.length === 0 && <p className="text-neutral-500">This bar has no bottles listed yet.</p>}
      </div>
    </div>
  );
}
