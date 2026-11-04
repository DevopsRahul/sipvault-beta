import { redirect } from "next/navigation";

export default function BarIndex() {
  redirect("/bar/orders");
}
