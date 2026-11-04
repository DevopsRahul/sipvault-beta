import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { ActionForm } from "@/components/ActionForm";
import { currentUser, homeFor } from "@/lib/session";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const user = await currentUser();
  if (user) redirect(homeFor(user.role));
  const { callbackUrl } = await searchParams;

  return (
    <div className="mx-auto max-w-sm space-y-6 py-10">
      <h1 className="text-2xl font-bold">Log in</h1>
      <ActionForm action={loginAction} className="card space-y-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/"} />
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <button className="btn-primary w-full">Log in</button>
      </ActionForm>
      <p className="text-sm text-neutral-400">
        New to SipVault?{" "}
        <Link href="/register" className="text-amber-400">
          Create an account
        </Link>
      </p>
    </div>
  );
}
