import { redirect } from "next/navigation";

export default function NutritionRedirectPage() {
  redirect("/stack?tab=nutrition");
}
