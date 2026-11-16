import { placeOrder } from "@/app/actions/orders";
import { ActionForm } from "@/components/ActionForm";

const MAX_POUR_ML = 300; // keep in sync with app/actions/orders.ts

/**
 * "Order from this bottle" form: pick an amount in ml (steps of the bottle's peg size)
 * and the table to serve it to.
 * - Pass `fixedTable` when the table is already known (QR code page).
 * - Pass `tables` to let the customer choose (My Vault page).
 */
export function OrderForm({
  bottleId,
  pegSizeMl,
  availableMl,
  fixedTable,
  tables = [],
}: {
  bottleId: string;
  pegSizeMl: number;
  availableMl: number;
  fixedTable?: { id: string; tableNo: string };
  tables?: { id: string; tableNo: string }[];
}) {
  const maxMl = Math.min(availableMl, MAX_POUR_ML);
  const amounts: number[] = [];
  for (let ml = pegSizeMl; ml <= maxMl; ml += pegSizeMl) amounts.push(ml);

  if (amounts.length === 0) {
    return <p className="text-sm text-neutral-500">Not enough left for another peg.</p>;
  }
  if (!fixedTable && tables.length === 0) {
    return <p className="text-sm text-neutral-500">This bar has no tables set up yet.</p>;
  }

  const defaultMl = amounts.includes(90) ? 90 : amounts[0];

  return (
    <ActionForm action={placeOrder} className="space-y-2">
      <input type="hidden" name="bottleId" value={bottleId} />
      <div className="flex gap-2">
        <select name="ml" className="input" defaultValue={String(defaultMl)} aria-label="Amount">
          {amounts.map((ml) => (
            <option key={ml} value={ml}>
              {ml} ml ({ml / pegSizeMl} peg{ml === pegSizeMl ? "" : "s"})
            </option>
          ))}
        </select>
        {fixedTable ? (
          <input type="hidden" name="tableId" value={fixedTable.id} />
        ) : (
          <select name="tableId" className="input" defaultValue="" aria-label="Table" required>
            <option value="" disabled>
              Table…
            </option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                Table {t.tableNo}
              </option>
            ))}
          </select>
        )}
      </div>
      <input name="note" className="input" placeholder="Note: on the rocks, with soda…" maxLength={200} />
      <button className="btn-primary w-full">
        {fixedTable ? `Order to table ${fixedTable.tableNo}` : "Order now"}
      </button>
    </ActionForm>
  );
}
