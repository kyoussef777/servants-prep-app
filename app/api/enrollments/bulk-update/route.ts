import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageEnrollments } from '@/lib/roles'
import { enrollmentStatusUpdate } from '@/lib/api-utils'

interface BulkUpdateRequest {
  enrollmentIds: string[]
  updates: {
    yearLevel?: 'YEAR_1' | 'YEAR_2'
    status?: 'ACTIVE' | 'GRADUATED' | 'WITHDRAWN'
    isActive?: boolean
    graduationNote?: string  // Required when graduating students who don't meet requirements
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!canManageEnrollments(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body: BulkUpdateRequest = await req.json()
    const { enrollmentIds, updates } = body

    if (!enrollmentIds || !Array.isArray(enrollmentIds) || enrollmentIds.length === 0) {
      return NextResponse.json({ error: 'enrollmentIds array is required' }, { status: 400 })
    }

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'updates object is required' }, { status: 400 })
    }

    // Build the update data
    const updateData: Record<string, unknown> = {}

    if (updates.yearLevel) {
      updateData.yearLevel = updates.yearLevel
    }

    if (updates.status) {
      Object.assign(updateData, await enrollmentStatusUpdate(updates.status, updates.graduationNote))
    }

    if (updates.isActive !== undefined && !updates.status) {
      updateData.isActive = updates.isActive
    }

    // Perform bulk update using a transaction
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.studentEnrollment.updateMany({
        where: {
          id: { in: enrollmentIds }
        },
        data: updateData
      })

      return updated
    })

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${result.count} enrollment(s)`,
      count: result.count
    })
  } catch (error: unknown) {
    console.error('Bulk update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update enrollments' },
      { status: 500 }
    )
  }
}
