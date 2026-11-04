import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { currentUser } from "@/lib/session";

export async function Nav() {
  const user = await currentUser();

  const links =
    user?.role === "CUSTOMER"
      ? [
          { href: "/vault", label: "My Vault" },
          { href: "/bars", label: "Buy a Bottle" },
        ]
      : user?.role === "BAR_OWNER" || user?.role === "BAR_STAFF"
        ? [{ href: "/bar/orders", label: "Bar Portal" }]
        : user?.role === "ADMIN"
          ? [{ href: "/admin", label: "Admin" }]
          : [];

  return (
    <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur sticky top-0 z-10">
      <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-amber-400">
          SipVault
        </Link>
        <div className="flex flex-1 gap-3 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-neutral-300 hover:text-white">
              {l.label}
            </Link>
          ))}
        </div>
        {user ? (
          <form action={logoutAction} className="flex items-center gap-3 text-sm">
            <span className="hidden text-neutral-400 sm:inline">{user.name}</span>
            <button className="btn">Log out</button>
          </form>
        ) : (
          <Link href="/login" className="btn text-sm">
            Log in
          </Link>
        )}
      </nav>
    </header>
  );
}
