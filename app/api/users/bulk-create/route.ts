import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"

// POST /api/users/bulk-create - Create multiple students at once (SUPER_ADMIN only)
export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    // Only SUPER_ADMIN can bulk create users
    if (user.role !== UserRole.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { students, defaultPassword } = await request.json()

    if (!students || !Array.isArray(students) || students.length === 0) {
      return NextResponse.json(
        { error: "Students array is required" },
        { status: 400 }
      )
    }

    if (!defaultPassword) {
      return NextResponse.json(
        { error: "Default password is required" },
        { status: 400 }
      )
    }

    // Hash the default password once
    const hashedPassword = await bcrypt.hash(defaultPassword, 10)

    const results = {
      created: [] as any[],
      errors: [] as { name: string; error: string }[]
    }

    // Process each student
    for (const student of students) {
      try {
        const { name, email, phone, yearLevel } = student

        if (!name) {
          results.errors.push({ name: name || 'Unknown', error: 'Name is required' })
          continue
        }

        // Generate temp email if not provided
        const studentEmail = email || `temp_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}@temp.church.com`

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: studentEmail }
        })

        if (existingUser) {
          results.errors.push({ name, error: 'Email already exists' })
          continue
        }

        // Create user
        const newUser = await prisma.user.create({
          data: {
            name,
            email: studentEmail,
            password: hashedPassword,
            role: UserRole.STUDENT,
            phone: phone || null
          }
        })

        // Create enrollment if yearLevel is provided
        if (yearLevel && (yearLevel === 'YEAR_1' || yearLevel === 'YEAR_2')) {
          await prisma.studentEnrollment.create({
            data: {
              studentId: newUser.id,
              yearLevel,
              isActive: true
            }
          })
        }

        results.created.push({
          id: newUser.id,
          name: newUser.name,
          email: newUser.email
        })

      } catch (error) {
        console.error('Error creating student:', error)
        results.errors.push({
          name: student.name || 'Unknown',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      message: `Created ${results.created.length} student(s)`,
      created: results.created,
      errors: results.errors,
      totalRequested: students.length,
      totalCreated: results.created.length,
      totalErrors: results.errors.length
    }, { status: 201 })

  } catch (error: unknown) {
    console.error('Bulk create error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create students" },
      { status: 500 }
    )
  }
}
