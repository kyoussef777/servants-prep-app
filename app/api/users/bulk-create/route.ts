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

    const results: {
      created: Array<{ id: string; name: string; email: string }>,
      errors: Array<{ name: string; error: string }>
    } = {
      created: [],
      errors: []
    }

    // Prepare all student data first
    const studentsToProcess: Array<{
      name: string
      email: string
      phone: string | null
      yearLevel: string | null
    }> = []

    // Generate emails and validate
    for (const student of students) {
      const { name, email, phone, yearLevel } = student

      if (!name) {
        results.errors.push({ name: name || 'Unknown', error: 'Name is required' })
        continue
      }

      // Generate temp email if not provided (with unique timestamp per student)
      const studentEmail = email || `temp_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@temp.church.com`

      studentsToProcess.push({
        name,
        email: studentEmail,
        phone: phone || null,
        yearLevel: yearLevel || null
      })
    }

    // Batch check for existing emails (single query instead of N queries)
    const emails = studentsToProcess.map(s => s.email)
    const existingUsers = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { email: true }
    })
    const existingEmailSet = new Set(existingUsers.map(u => u.email))

    // Filter out students with existing emails
    const validStudents = studentsToProcess.filter(student => {
      if (existingEmailSet.has(student.email)) {
        results.errors.push({ name: student.name, error: 'Email already exists' })
        return false
      }
      return true
    })

    // Create all valid users in a transaction
    if (validStudents.length > 0) {
      const createdUsers = await prisma.$transaction(async (tx) => {
        const users = []

        for (const student of validStudents) {
          try {
            // Create user
            const newUser = await tx.user.create({
              data: {
                name: student.name,
                email: student.email,
                password: hashedPassword,
                role: UserRole.STUDENT,
                phone: student.phone
              }
            })

            // Create enrollment if yearLevel is provided
            if (student.yearLevel && (student.yearLevel === 'YEAR_1' || student.yearLevel === 'YEAR_2')) {
              await tx.studentEnrollment.create({
                data: {
                  studentId: newUser.id,
                  yearLevel: student.yearLevel,
                  isActive: true
                }
              })
            }

            users.push({
              id: newUser.id,
              name: newUser.name,
              email: newUser.email
            })
          } catch (error) {
            console.error('Error creating student in transaction:', error)
            results.errors.push({
              name: student.name,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }
        }

        return users
      })

      results.created.push(...createdUsers)
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
