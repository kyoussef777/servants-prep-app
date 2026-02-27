import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getDriveFiles } from "@/lib/drive"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const folderId = req.nextUrl.searchParams.get("folderId")
  const resourceKey = req.nextUrl.searchParams.get("resourceKey") ?? undefined

  if (!folderId) {
    return NextResponse.json({ error: "Missing folderId" }, { status: 400 })
  }

  const files = await getDriveFiles(folderId, resourceKey)
  return NextResponse.json({ files })
}
