import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "./auth";

export async function currentUser() {
  const session = await auth();
  return session?.user?.id ? session.user : null;
}

/** Use at the top of pages / server actions. Redirects to login or home if not allowed. */
export async function requireUser(roles?: Role[], callbackUrl?: string) {
  const user = await currentUser();
  if (!user) {
    redirect(callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login");
  }
  if (roles && !roles.includes(user.role)) redirect("/");
  return user;
}

/** Bar owner or bar staff, guaranteed to have a barId. */
export async function requireBarUser() {
  const user = await requireUser(["BAR_OWNER", "BAR_STAFF"]);
  if (!user.barId) redirect("/");
  return { ...user, barId: user.barId };
}

/** Only the bar owner (menu, tables, staff management). */
export async function requireBarOwner() {
  const user = await requireBarUser();
  if (user.role !== "BAR_OWNER") redirect("/bar/orders");
  return user;
}

export function homeFor(role: Role) {
  if (role === "ADMIN") return "/admin";
  if (role === "CUSTOMER") return "/vault";
  return "/bar/orders";
}
