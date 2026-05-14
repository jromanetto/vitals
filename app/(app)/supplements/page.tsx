import { redirect } from "next/navigation";

export default function SupplementsRedirectPage() {
  redirect("/stack?tab=supplements");
}
