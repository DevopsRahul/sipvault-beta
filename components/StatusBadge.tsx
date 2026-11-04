import type { OrderStatus } from "@prisma/client";

const STYLES: Record<OrderStatus, string> = {
  PLACED: "bg-sky-900 text-sky-200",
  ACCEPTED: "bg-amber-900 text-amber-200",
  SERVED: "bg-emerald-900 text-emerald-200",
  REJECTED: "bg-red-900 text-red-200",
  CANCELLED: "bg-neutral-800 text-neutral-400",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge ${STYLES[status]}`}>{status.toLowerCase()}</span>;
}
