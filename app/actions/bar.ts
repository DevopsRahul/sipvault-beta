"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBarOwner } from "@/lib/session";
import type { FormState } from "@/lib/types";

const menuSchema = z.object({
  productId: z.string().min(1, "Choose a product"),
  price: z.coerce.number().positive("Enter a price"),
  pegSizeMl: z.coerce.number().int().min(15).max(120),
});

/** Owner adds a catalog product to their bar's menu (or updates its price / peg size). */
export async function saveMenuItem(_prev: FormState, fd: FormData): Promise<FormState> {
  const owner = await requireBarOwner();
  const p = menuSchema.safeParse({
    productId: fd.get("productId"),
    price: fd.get("price"),
    pegSizeMl: fd.get("pegSizeMl") || 30,
  });
  if (!p.success) return { error: p.error.issues[0].message };

  const priceMinor = Math.round(p.data.price * 100);
  await db.barProduct.upsert({
    where: { barId_productId: { barId: owner.barId, productId: p.data.productId } },
    update: { priceMinor, pegSizeMl: p.data.pegSizeMl, active: true },
    create: { barId: owner.barId, productId: p.data.productId, priceMinor, pegSizeMl: p.data.pegSizeMl },
  });
  revalidatePath("/bar/menu");
  return { ok: "Menu updated." };
}

export async function toggleMenuItem(barProductId: string) {
  const owner = await requireBarOwner();
  const item = await db.barProduct.findFirst({ where: { id: barProductId, barId: owner.barId } });
  if (item) await db.barProduct.update({ where: { id: item.id }, data: { active: !item.active } });
  revalidatePath("/bar/menu");
}

/** Add one table ("12", "Patio-3") or a range (count = 10 creates 1..10). */
export async function addTables(_prev: FormState, fd: FormData): Promise<FormState> {
  const owner = await requireBarOwner();
  const single = String(fd.get("tableNo") || "").trim();
  const count = Number(fd.get("count") || 0);

  const names: string[] = [];
  if (single) names.push(single.slice(0, 20));
  if (count > 0 && count <= 200) for (let i = 1; i <= count; i++) names.push(String(i));
  if (names.length === 0) return { error: "Enter a table number or a count." };

  const res = await db.barTable.createMany({
    data: names.map((tableNo) => ({ barId: owner.barId, tableNo })),
    skipDuplicates: true,
  });
  revalidatePath("/bar/tables");
  return { ok: `${res.count} table(s) added.` };
}

const staffSchema = z.object({
  name: z.string().trim().min(2, "Enter a name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function addStaff(_prev: FormState, fd: FormData): Promise<FormState> {
  const owner = await requireBarOwner();
  const p = staffSchema.safeParse({ name: fd.get("name"), email: fd.get("email"), password: fd.get("password") });
  if (!p.success) return { error: p.error.issues[0].message };
  if (await db.user.findUnique({ where: { email: p.data.email } })) {
    return { error: "That email is already registered." };
  }
  await db.user.create({
    data: {
      name: p.data.name,
      email: p.data.email,
      passwordHash: await bcrypt.hash(p.data.password, 10),
      role: "BAR_STAFF",
      barId: owner.barId,
    },
  });
  revalidatePath("/bar/staff");
  return { ok: `Staff account created for ${p.data.email}.` };
}
