"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/types";

/**
 * Generic form wrapper for server actions that return { error } / { ok }.
 * Shows the message under the form and disables inputs while submitting.
 */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {pending && <p className="text-sm text-neutral-400">Working…</p>}
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-400">{state.ok}</p>}
    </form>
  );
}
