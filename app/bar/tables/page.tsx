import QRCode from "qrcode";
import { addTables } from "@/app/actions/bar";
import { ActionForm } from "@/components/ActionForm";
import { db } from "@/lib/db";
import { requireBarOwner } from "@/lib/session";

/** Tables + printable QR codes. Each QR opens /order/<barId>/<tableNo>. */
export default async function BarTablesPage() {
  const owner = await requireBarOwner();
  const tables = await db.barTable.findMany({ where: { barId: owner.barId } });
  tables.sort((a, b) => a.tableNo.localeCompare(b.tableNo, undefined, { numeric: true }));

  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const withQr = await Promise.all(
    tables.map(async (t) => {
      const url = `${appUrl}/order/${owner.barId}/${encodeURIComponent(t.tableNo)}`;
      return { ...t, url, qr: await QRCode.toDataURL(url, { margin: 1, width: 220 }) };
    }),
  );

  return (
    <div className="space-y-6">
      <ActionForm action={addTables} className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Table name / number</label>
          <input name="tableNo" className="input" placeholder="e.g. 7 or Patio-2" />
        </div>
        <span className="pb-2 text-neutral-500">or</span>
        <div>
          <label className="label">Create tables 1..N</label>
          <input name="count" type="number" min={1} max={200} className="input" placeholder="e.g. 20" />
        </div>
        <button className="btn-primary">Add</button>
      </ActionForm>

      <p className="text-sm text-neutral-400">Print these and place one on each table (Ctrl+P prints this page).</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {withQr.map((t) => (
          <div key={t.id} className="card flex flex-col items-center gap-2 bg-white text-neutral-900">
            <img src={t.qr} alt={`QR for table ${t.tableNo}`} className="w-full" />
            <p className="text-lg font-bold">Table {t.tableNo}</p>
            <p className="text-xs">Scan to order from your SipVault</p>
          </div>
        ))}
      </div>
    </div>
  );
}
