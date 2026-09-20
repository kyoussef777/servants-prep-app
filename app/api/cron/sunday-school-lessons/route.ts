import { NextResponse } from "next/server"
import { ensureSundaySchoolWeeklyLessons } from "@/lib/sunday-school-lessons"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await ensureSundaySchoolWeeklyLessons()
  return NextResponse.json({ success: true, ...result })
}
