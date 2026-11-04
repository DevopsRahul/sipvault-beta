"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/types";

function safeCallback(url: FormDataEntryValue | null) {
  const s = typeof url === "string" ? url : "/";
  // only allow relative paths on our own site (prevents open-redirects)
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

export async function loginAction(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    await signIn("credentials", {
      email: fd.get("email"),
      password: fd.get("password"),
      redirectTo: safeCallback(fd.get("callbackUrl")),
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Invalid email or password." };
    throw e; // a successful signIn "throws" a redirect - let Next.js handle it
  }
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().max(20).optional(),
  dob: z.coerce.date({ invalid_type_error: "Enter your date of birth" }),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function ageOn(dob: Date, now = new Date()) {
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

export async function registerAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: fd.get("name"),
    email: fd.get("email"),
    phone: fd.get("phone") || undefined,
    dob: fd.get("dob"),
    password: fd.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const minAge = Number(process.env.LEGAL_DRINKING_AGE || 21);
  if (ageOn(parsed.data.dob) < minAge) {
    return { error: `You must be at least ${minAge} years old to use SipVault.` };
  }

  const exists = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return { error: "An account with this email already exists." };

  await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      dob: parsed.data.dob,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: "CUSTOMER",
    },
  });

  await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: "/vault",
  });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
