"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { saveImage } from "@/lib/uploads";
import type { FormState } from "@/lib/types";

const barSchema = z.object({
  name: z.string().trim().min(2, "Enter the bar name"),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  licenseNo: z.string().trim().optional(),
  keepDays: z.coerce.number().int().min(1).max(365),
  ownerName: z.string().trim().min(2, "Enter the owner's name"),
  ownerEmail: z.string().trim().toLowerCase().email("Enter the owner's email"),
  ownerPassword: z.string().min(8, "Owner password must be at least 8 characters"),
});

/** Admin onboards a bar together with its owner login. */
export async function createBar(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireUser(["ADMIN"]);
  const p = barSchema.safeParse({
    name: fd.get("name"),
    address: fd.get("address") || undefined,
    city: fd.get("city") || undefined,
    licenseNo: fd.get("licenseNo") || undefined,
    keepDays: fd.get("keepDays") || 90,
    ownerName: fd.get("ownerName"),
    ownerEmail: fd.get("ownerEmail"),
    ownerPassword: fd.get("ownerPassword"),
  });
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;

  if (await db.user.findUnique({ where: { email: d.ownerEmail } })) {
    return { error: "Owner email is already registered." };
  }

  const passwordHash = await bcrypt.hash(d.ownerPassword, 10);
  await db.$transaction(async (tx) => {
    const bar = await tx.bar.create({
      data: { name: d.name, address: d.address, city: d.city, licenseNo: d.licenseNo, keepDays: d.keepDays },
    });
    await tx.user.create({
      data: { name: d.ownerName, email: d.ownerEmail, passwordHash, role: "BAR_OWNER", barId: bar.id },
    });
  });
  revalidatePath("/admin");
  return { ok: `Bar "${d.name}" created. Owner can log in as ${d.ownerEmail}.` };
}

const productSchema = z.object({
  brand: z.string().trim().min(1, "Enter the brand"),
  name: z.string().trim().min(1, "Enter the product name"),
  category: z.string().trim().min(1, "Choose a category"),
  volumeMl: z.coerce.number().int().min(50).max(5000),
});

/** Admin adds a product to the global catalog (with optional bottle image). */
export async function createProduct(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireUser(["ADMIN"]);
  const p = productSchema.safeParse({
    brand: fd.get("brand"),
    name: fd.get("name"),
    category: fd.get("category"),
    volumeMl: fd.get("volumeMl") || 750,
  });
  if (!p.success) return { error: p.error.issues[0].message };

  let imageKey: string | null = null;
  try {
    imageKey = await saveImage(fd.get("image"), "products");
  } catch (e) {
    return { error: (e as Error).message };
  }

  await db.product.create({ data: { ...p.data, imageKey } });
  revalidatePath("/admin");
  return { ok: `${p.data.brand} ${p.data.name} added to the catalog.` };
}

export async function toggleBar(barId: string) {
  await requireUser(["ADMIN"]);
  const bar = await db.bar.findUnique({ where: { id: barId } });
  if (bar) await db.bar.update({ where: { id: bar.id }, data: { active: !bar.active } });
  revalidatePath("/admin");
}
