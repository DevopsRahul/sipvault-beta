import Link from "next/link";
import { redirect } from "next/navigation";
import { BottleGauge } from "@/components/BottleGauge";
import { currentUser, homeFor } from "@/lib/session";

export default async function Home() {
  const user = await currentUser();
  if (user) redirect(homeFor(user.role));

  return (
    <section className="flex flex-col items-center gap-6 py-16 text-center">
      <BottleGauge id="hero" totalMl={750} remainingMl={480} size={180} />
      <h1 className="text-4xl font-bold">
        Your bottle. <span className="text-amber-400">Your bar.</span>
      </h1>
      <p className="max-w-md text-neutral-400">
        Buy a bottle once, keep it in your SipVault at your favourite bar, and order pegs from it every
        time you visit. Watch it empty as you enjoy it.
      </p>
      <div className="flex gap-3">
        <Link href="/register" className="btn-primary">
          Create account
        </Link>
        <Link href="/login" className="btn">
          Log in
        </Link>
      </div>
    </section>
  );
}
