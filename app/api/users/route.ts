import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-helpers"
import { UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"
import { isAdmin, canManageUsers, canManageAllUsers } from "@/lib/roles"

// GET /api/users - List all users (Admin only)
// Optional query params: ?role=STUDENT to filter by role
export async function GET(request: Request) {
  try {
    const user = await requireAuth()

    // Check if user has admin access
    if (!isAdmin(user.role)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const roleFilter = searchParams.get('role')

    // SERVANT_PREP can only see STUDENT and SERVANT users
    let whereClause: Record<string, unknown> | undefined = roleFilter ? { role: roleFilter as UserRole } : undefined

    if (user.role === UserRole.SERVANT_PREP) {
      whereClause = {
        ...whereClause,
        role: roleFilter ? (roleFilter as UserRole) : { in: [UserRole.STUDENT, UserRole.SERVANT] }
      }
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
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
    })

    return NextResponse.json(users)
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch users" },
      { status: (error instanceof Error && error.message === "Forbidden") ? 403 : 500 }
    )
  }
}

// POST /api/users - Create a new user
// SUPER_ADMIN can create any user, SERVANT_PREP can only create STUDENT users
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
    const { email, name, password, role } = body

    if (!email || !name || !password || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // SERVANT_PREP can only create STUDENT users
    if (currentUser.role === UserRole.SERVANT_PREP && role !== UserRole.STUDENT) {
      return NextResponse.json(
        { error: "Servants Prep can only create Student users" },
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
        password: hashedPassword,
        role,
      },
      select: {
        id: true,
        email: true,
        name: true,
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
