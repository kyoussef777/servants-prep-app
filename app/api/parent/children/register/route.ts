import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth-helpers'
import { handleApiError } from '@/lib/api-utils'
import { isValidLevel } from '@/lib/sunday-school-class'
import { notifyChildRegistrationSubmitted } from '@/lib/notifications'
import { RegistrationStatus, UserRole } from '@prisma/client'

// POST /api/parent/children/register
// Auth: PARENT only. Creates a pending ChildRegistrationRequest — the real
// SundaySchoolChild row and the parent<->child guardian link are only
// created once a coordinator/admin reviews and approves the request.
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole([UserRole.PARENT])

    const body = await req.json()
    const {
      firstName,
      lastName,
      birthDate,
      intendedLevel,
      guardianName,
      guardianPhone,
      guardianEmail,
      notes,
    } = body

    if (!firstName || !lastName || !birthDate || !intendedLevel) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!isValidLevel(intendedLevel)) {
      return NextResponse.json(
        { error: 'Invalid intended level' },
        { status: 400 }
      )
    }

    const parsedBirthDate = new Date(birthDate)
    if (isNaN(parsedBirthDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid birth date' },
        { status: 400 }
      )
    }

    const request = await prisma.childRegistrationRequest.create({
      data: {
        submittedByUserId: user.id,
        status: RegistrationStatus.PENDING,
        firstName,
        lastName,
        birthDate: parsedBirthDate,
        intendedLevel,
        guardianName: guardianName || user.name,
        guardianPhone: guardianPhone || '',
        guardianEmail: guardianEmail || user.email,
        notes: notes || null,
      },
    })

    notifyChildRegistrationSubmitted({
      childName: `${firstName} ${lastName}`,
      requestId: request.id,
      level: intendedLevel,
    }).catch(() => {})

    return NextResponse.json(
      {
        id: request.id,
        message: 'Registration request submitted successfully! It is now pending review.',
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    return handleApiError(error)
  }
}
