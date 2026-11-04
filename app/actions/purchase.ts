"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { chargeCustomer } from "@/lib/payments";
import { channels, publish } from "@/lib/redis";
import { requireUser } from "@/lib/session";

/** Customer buys a bottle at a bar -> it appears in their vault. */
export async function buyBottle(barProductId: string) {
  const user = await requireUser(["CUSTOMER"]);

  const item = await db.barProduct.findFirst({
    where: { id: barProductId, active: true, bar: { active: true } },
    include: { product: true, bar: true },
  });
  if (!item) throw new Error("This bottle is not available any more.");

  const payment = await chargeCustomer({
    amountMinor: item.priceMinor,
    userId: user.id,
    description: `${item.product.brand} ${item.product.name} @ ${item.bar.name}`,
  });

  const expiresAt = new Date(Date.now() + item.bar.keepDays * 24 * 60 * 60 * 1000);

  const bottle = await db.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({
      data: {
        userId: user.id,
        barId: item.barId,
        barProductId: item.id,
        amountMinor: item.priceMinor,
        provider: payment.provider,
        paymentRef: payment.ref,
        status: "PAID",
      },
    });
    const b = await tx.vaultBottle.create({
      data: {
        userId: user.id,
        barId: item.barId,
        productId: item.productId,
        totalMl: item.product.volumeMl,
        remainingMl: item.product.volumeMl,
        pegSizeMl: item.pegSizeMl,
        expiresAt,
      },
    });
    await tx.purchase.update({ where: { id: purchase.id }, data: { vaultBottleId: b.id } });
    await tx.pourLedger.create({ data: { vaultBottleId: b.id, deltaMl: b.totalMl, reason: "PURCHASE" } });
    return b;
  });

  await publish(channels.bar(item.barId), { type: "bottle_purchased", bottleId: bottle.id });
  redirect(`/vault?new=${bottle.id}`);
}
