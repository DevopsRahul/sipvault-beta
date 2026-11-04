import Link from "next/link";
import { redirect } from "next/navigation";
import { registerAction } from "@/app/actions/auth";
import { ActionForm } from "@/components/ActionForm";
import { currentUser, homeFor } from "@/lib/session";

export default async function RegisterPage() {
  const user = await currentUser();
  if (user) redirect(homeFor(user.role));
  const minAge = Number(process.env.LEGAL_DRINKING_AGE || 21);

  return (
    <div className="mx-auto max-w-sm space-y-6 py-10">
      <h1 className="text-2xl font-bold">Create your vault</h1>
      <ActionForm action={registerAction} className="card space-y-4">
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input className="input" id="name" name="name" required autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone (optional)</label>
          <input className="input" id="phone" name="phone" type="tel" autoComplete="tel" />
        </div>
        <div>
          <label className="label" htmlFor="dob">Date of birth</label>
          <input className="input" id="dob" name="dob" type="date" required />
          <p className="mt-1 text-xs text-neutral-500">You must be {minAge}+ to use SipVault.</p>
        </div>
        <div>
          <label className="label" htmlFor="password">Password (min 8 characters)</label>
          <input className="input" id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
        </div>
        <button className="btn-primary w-full">Create account</button>
      </ActionForm>
      <p className="text-sm text-neutral-400">
        Already have an account?{" "}
        <Link href="/login" className="text-amber-400">
          Log in
        </Link>
      </p>
    </div>
  );
}
