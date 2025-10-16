import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"

// GET /api/exam-sections - List all exam sections
export async function GET() {
  try {
    await requireAuth()

    const sections = await prisma.examSection.findMany({
      orderBy: {
        displayName: 'asc'
      }
    })

    return NextResponse.json(sections)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch exam sections" },
      { status: 500 }
    )
  }
}
