import { redirect } from "next/navigation";
/** @module Legacy authentication URL compatibility */
export default function ParentAuthPage() {
  redirect("/login");
}
