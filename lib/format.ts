const currency = process.env.CURRENCY || "INR";
const timeZone = process.env.DISPLAY_TIMEZONE || "Asia/Kolkata";

/** 250000 (paise) -> "₹2,500.00" */
export function money(minor: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(minor / 100);
}

export function dateTime(d: Date) {
  return d.toLocaleString("en-IN", { timeZone, dateStyle: "medium", timeStyle: "short" });
}

export function date(d: Date) {
  return d.toLocaleDateString("en-IN", { timeZone, dateStyle: "medium" });
}

export function timeOnly(d: Date) {
  return d.toLocaleTimeString("en-IN", { timeZone, timeStyle: "short" });
}
