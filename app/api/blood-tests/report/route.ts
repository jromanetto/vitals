import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { generateBloodReport } from "@/lib/blood-report";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const dateParam = url.searchParams.get("date");
  const date = dateParam ? parseInt(dateParam, 10) : undefined;

  const { status, json } = await generateBloodReport(userId, { force, date });
  return NextResponse.json(json, { status });
}
