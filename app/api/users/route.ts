import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"
import { isAdmin, canManageUsers } from "@/lib/roles"

// GET /api/users - List all users (Admin only, or MENTOR role can view students)
// Query params:
//   ?role=STUDENT - filter by role
//   ?page=1&limit=50 - pagination (default: all results for backwards compatibility)
//   ?search=john - search by name
export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const roleFilter = searchParams.get('role')
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : null
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50
    const search = searchParams.get('search')

    // MENTOR role can only view their assigned STUDENT mentees
    if (user.role === UserRole.MENTOR) {
      if (roleFilter && roleFilter !== UserRole.STUDENT) {
        return NextResponse.json(
          { error: "Forbidden: Mentors can only view students" },
          { status: 403 }
        )
      }
      // MENTOR can only see students assigned to them as mentees
    } else if (!isAdmin(user.role)) {
      // Non-admin, non-mentor roles are forbidden
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    // SERVANT_PREP can only see STUDENT and MENTOR users
    // MENTOR can only see their assigned STUDENT mentees
    let whereClause: Record<string, unknown> = {}

    if (roleFilter) {
      whereClause.role = roleFilter as UserRole
    }

    if (search) {
      whereClause.name = { contains: search, mode: 'insensitive' }
    }

    if (user.role === UserRole.SERVANT_PREP) {
      // SERVANT_PREP can see STUDENT, MENTOR, and other SERVANT_PREP users (for mentor assignment)
      whereClause = {
        ...whereClause,
        role: roleFilter ? (roleFilter as UserRole) : { in: [UserRole.STUDENT, UserRole.MENTOR, UserRole.SERVANT_PREP] }
      }
    } else if (user.role === UserRole.MENTOR) {
      // Filter to only students where this mentor is assigned
      whereClause = {
        ...whereClause,
        role: UserRole.STUDENT,
        enrollments: {
          some: {
            mentorId: user.id
          }
        }
      }
    }

    // Build query options
    const queryOptions: {
      where: Record<string, unknown>
      select: Record<string, unknown>
      orderBy: { name: 'asc' }
      skip?: number
      take?: number
    } = {
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isDisabled: true,
        createdAt: true,
        updatedAt: true,
        enrollments: {
          select: {
            id: true,
            yearLevel: true,
            isActive: true,
            status: true,
            notes: true,
            mentor: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        _count: {
          select: {
            mentoredStudents: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    }

    // Add pagination if requested
    if (page !== null) {
      queryOptions.skip = (page - 1) * limit
      queryOptions.take = limit
    }

    // If pagination requested, also get total count
    if (page !== null) {
      const [users, total] = await Promise.all([
        prisma.user.findMany(queryOptions),
        prisma.user.count({ where: whereClause })
      ])

      return NextResponse.json({
        data: users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      })
    }

    // No pagination - return all (backwards compatible)
    const users = await prisma.user.findMany(queryOptions)
    return NextResponse.json(users)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch users" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}

// POST /api/users - Create a new user
// SUPER_ADMIN can create any user, SERVANT_PREP can only create STUDENT and MENTOR users
export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth()

    // Check if user can manage users
    if (!canManageUsers(currentUser.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, name, phone, password, role } = body

    if (!email || !name || !password || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // SERVANT_PREP can only create STUDENT and MENTOR users
    if (currentUser.role === UserRole.SERVANT_PREP && role !== UserRole.STUDENT && role !== UserRole.MENTOR) {
      return NextResponse.json(
        { error: "Servants Prep can only create Student and Mentor users" },
        { status: 403 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        phone: phone || null,
        password: hashedPassword,
        role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      }
    })

    return NextResponse.json(newUser, { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create user" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}
