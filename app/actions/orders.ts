"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { channels, publish } from "@/lib/redis";
import { requireBarUser, requireUser } from "@/lib/session";
import type { FormState } from "@/lib/types";

/** Largest single pour a customer can order at once. */
const MAX_POUR_ML = 300;

const orderSchema = z.object({
  bottleId: z.string().min(1),
  tableId: z.string().min(1, "Choose your table"),
  ml: z.coerce.number().int().min(1).max(MAX_POUR_ML),
  note: z.string().trim().max(200).optional(),
});

/**
 * Customer orders an amount in ml (e.g. 90 ml) from a vault bottle.
 * The amount must be a whole number of pegs for that bottle (30 ml peg -> 30, 60, 90 ...).
 * The ml is RESERVED atomically in a single SQL UPDATE, so two quick taps (or two phones)
 * can never order more than what is left in the bottle.
 */
export async function placeOrder(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser(["CUSTOMER"]);
  const parsed = orderSchema.safeParse({
    bottleId: fd.get("bottleId"),
    tableId: fd.get("tableId"),
    ml: fd.get("ml"),
    note: fd.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid order." };
  const { bottleId, tableId, ml, note } = parsed.data;

  const bottle = await db.vaultBottle.findFirst({
    where: { id: bottleId, userId: user.id },
    include: { product: true },
  });
  if (!bottle) return { error: "Bottle not found." };

  const table = await db.barTable.findFirst({ where: { id: tableId, barId: bottle.barId } });
  if (!table) return { error: "This bottle is kept at a different bar." };

  if (ml % bottle.pegSizeMl !== 0) {
    return { error: `Order in steps of ${bottle.pegSizeMl} ml.` };
  }
  const pourMl = ml;
  const pegs = ml / bottle.pegSizeMl;

  const order = await db.$transaction(async (tx) => {
    const reserved = await tx.$executeRaw`
      UPDATE "VaultBottle"
         SET "reservedMl" = "reservedMl" + ${pourMl}
       WHERE "id" = ${bottle.id}
         AND "userId" = ${user.id}
         AND "status" = 'ACTIVE'
         AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
         AND "remainingMl" - "reservedMl" >= ${pourMl}`;
    if (reserved !== 1) return null;
    return tx.order.create({
      data: {
        vaultBottleId: bottle.id,
        userId: user.id,
        barId: bottle.barId,
        tableId: table.id,
        pegs,
        pourMl,
        note,
      },
    });
  });

  if (!order) return { error: "Not enough left in this bottle, or it has expired." };

  await publish(channels.bar(bottle.barId), { type: "order_placed", orderId: order.id, tableNo: table.tableNo });
  revalidatePath("/", "layout");
  const left = bottle.remainingMl - bottle.reservedMl - pourMl;
  return {
    ok: `Order sent: ${pourMl} ml ${bottle.product.brand} ${bottle.product.name} to table ${table.tableNo}. ${left} ml left in your bottle.`,
  };
}

/** Customer cancels an order the bar has not accepted yet. */
export async function cancelOrder(orderId: string) {
  const user = await requireUser(["CUSTOMER"]);
  const order = await db.$transaction(async (tx) => {
    const o = await tx.order.findFirst({ where: { id: orderId, userId: user.id } });
    if (!o) return null;
    const moved = await tx.order.updateMany({ where: { id: o.id, status: "PLACED" }, data: { status: "CANCELLED" } });
    if (moved.count !== 1) return null;
    await tx.vaultBottle.update({ where: { id: o.vaultBottleId }, data: { reservedMl: { decrement: o.pourMl } } });
    return o;
  });
  if (order) await publish(channels.bar(order.barId), { type: "order_cancelled", orderId: order.id });
  revalidatePath("/", "layout");
}

const ALLOWED_FROM: Record<"ACCEPTED" | "SERVED" | "REJECTED", OrderStatus[]> = {
  ACCEPTED: ["PLACED"],
  SERVED: ["PLACED", "ACCEPTED"],
  REJECTED: ["PLACED", "ACCEPTED"],
};

/**
 * Bar staff move an order forward.
 * SERVED   -> reservation becomes a real deduction + ledger entry (bottle visually drains)
 * REJECTED -> reservation released
 */
export async function updateOrderStatus(orderId: string, next: "ACCEPTED" | "SERVED" | "REJECTED") {
  const staff = await requireBarUser();

  const order = await db.$transaction(async (tx) => {
    const o = await tx.order.findFirst({ where: { id: orderId, barId: staff.barId } });
    if (!o) return null;

    // Conditional update = safe even if two bartenders click at the same moment.
    const moved = await tx.order.updateMany({
      where: { id: o.id, status: { in: ALLOWED_FROM[next] } },
      data: { status: next },
    });
    if (moved.count !== 1) return null;

    if (next === "SERVED") {
      const b = await tx.vaultBottle.update({
        where: { id: o.vaultBottleId },
        data: { reservedMl: { decrement: o.pourMl }, remainingMl: { decrement: o.pourMl } },
      });
      if (b.remainingMl <= 0) {
        await tx.vaultBottle.update({ where: { id: b.id }, data: { status: "EMPTY" } });
      }
      await tx.pourLedger.create({
        data: { vaultBottleId: o.vaultBottleId, orderId: o.id, deltaMl: -o.pourMl, reason: "POUR" },
      });
    } else if (next === "REJECTED") {
      await tx.vaultBottle.update({ where: { id: o.vaultBottleId }, data: { reservedMl: { decrement: o.pourMl } } });
    }
    return o;
  });

  if (order) {
    await publish(channels.user(order.userId), { type: "order_updated", orderId: order.id, status: next });
    await publish(channels.bar(order.barId), { type: "order_updated", orderId: order.id, status: next });
  }
  revalidatePath("/bar/orders");
}
