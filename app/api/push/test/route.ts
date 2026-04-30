import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { sendToUser } from "@/lib/push";

export const runtime = "nodejs";

export async function POST() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const result = await sendToUser(userId, {
      title: "Vitals — test",
      body: "Tes notifications push fonctionnent.",
      url: "/profile/security",
      tag: "vitals-test",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "send_failed" }, { status: 500 });
  }
}
