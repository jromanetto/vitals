import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import type { NutritionPref } from "@/lib/nutrition/types";

export const runtime = "nodejs";

const DEFAULT: NutritionPref = { dietType: "omnivore", allergies: [], aversions: "", budget: "medium", cuisines: [] };

const VALID_DIETS = ["omnivore", "pescatarian", "vegetarian", "vegan", "keto", "carnivore"] as const;
const VALID_BUDGETS = ["low", "medium", "premium"] as const;
const VALID_ALLERGIES = ["gluten", "lactose", "nuts", "eggs", "soy", "shellfish", "fish"] as const;

function safeJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
}

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { row } = await convexServer().query(api.profile.nutritionPref, { secret: bridgeSecret(), authUserId: s.userId });
  if (!row) return NextResponse.json(DEFAULT);
  return NextResponse.json({
    dietType: row.dietType as NutritionPref["dietType"],
    allergies: safeJsonArray(row.allergies),
    aversions: row.aversions ?? "",
    budget: row.budget as NutritionPref["budget"],
    cuisines: safeJsonArray(row.cuisines),
  });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as Partial<NutritionPref> | null;
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const dietType = VALID_DIETS.includes(body.dietType as never) ? body.dietType! : "omnivore";
  const budget = VALID_BUDGETS.includes(body.budget as never) ? body.budget! : "medium";
  const allergies = (Array.isArray(body.allergies) ? body.allergies : []).filter((a) => VALID_ALLERGIES.includes(a as never));
  const aversions = typeof body.aversions === "string" ? body.aversions.slice(0, 500) : "";
  const cuisines = (Array.isArray(body.cuisines) ? body.cuisines : []).slice(0, 10).map(String);

  await convexServer().mutation(api.profile.upsertNutritionPref, {
    secret: bridgeSecret(), authUserId: s.userId,
    dietType, allergies: JSON.stringify(allergies), aversions, budget, cuisines: JSON.stringify(cuisines),
  });

  return NextResponse.json({ ok: true, prefs: { dietType, allergies, aversions, budget, cuisines } });
}
