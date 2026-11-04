import { requireUser } from "@/lib/session";

// Everything under /admin/* is for platform ADMINs only.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireUser(["ADMIN"]);
  return <>{children}</>;
}
