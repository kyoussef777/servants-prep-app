# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 15 web application for managing a 2-year Coptic Church Servants Preparation Program. The system tracks student attendance, exams, curriculum, and graduation requirements with role-based access control.

**Tech Stack:** Next.js 15.5.4 (App Router + Turbopack), TypeScript, PostgreSQL, Prisma ORM, NextAuth.js, Tailwind CSS v4, shadcn/ui, Sonner (toast notifications)

## Development Commands

```bash
# Development
npm run dev              # Start dev server with Turbopack (http://localhost:3000)
npm run build            # Production build with Turbopack
npm start                # Start production server
npm run lint             # Run ESLint

# Database (Prisma)
npm run db:generate      # Generate Prisma Client (after schema changes)
npm run db:push          # Push schema to database (no migrations)
npm run db:migrate       # Create and run migrations
npm run db:seed          # Seed database with test data
npm run db:studio        # Open Prisma Studio GUI

# Utility Scripts
tsx scripts/<script>.ts  # Run TypeScript scripts (e.g., data imports)
```

**After schema changes:** Always run `npm run db:generate` to update Prisma Client types.

## Architecture & Key Patterns

### Role-Based Access Control (RBAC)

The app has **5 user roles** with hierarchical permissions defined in `lib/roles.ts`:

1. **SUPER_ADMIN** - Full system access, can manage all users
2. **PRIEST** - Admin access, can manage all except super admins
3. **SERVANT_PREP** - Can manage curriculum/attendance/exams, can only manage STUDENT users
4. **SERVANT** - Can take attendance, enter scores, view mentees, self-assign students (max 5)
5. **STUDENT** - Read-only access to own data

**Key permission helpers:**
- `isAdmin(role)` - Returns true for SUPER_ADMIN, PRIEST, SERVANT_PREP
- `canManageUsers(role)` - SUPER_ADMIN and SERVANT_PREP only
- `canManageAllUsers(role)` - SUPER_ADMIN only (can manage priests)
- `canAssignMentors(role)` - SUPER_ADMIN and PRIEST only
- `canSelfAssignMentees(role)` - SERVANT only (limited to 5 mentees)

**IMPORTANT:** SERVANT_PREP has special restrictions:
- Can only create/edit/delete STUDENT users (not priests or admins)
- API routes enforce this at both query and mutation levels
- UI dropdowns must be filtered to show only allowed roles

### Authentication Flow (NextAuth.js)

**Session Strategy:** JWT-based sessions with role and ID stored in token

**Key Files:**
- `lib/auth.ts` - NextAuth configuration with Credentials provider
- `app/api/auth/[...nextauth]/route.ts` - Auth API routes
- `app/providers.tsx` - SessionProvider wrapper for client components

**Session Usage:**
```typescript
const { data: session } = useSession() // Client components
const session = await getServerSession(authOptions) // Server components/API routes

// Session structure:
session.user = {
  id: string
  email: string
  name: string
  role: UserRole  // Always check this for authorization
}
```

**Protected Routes:** All `/dashboard/*` routes redirect to `/login` if unauthenticated

### Database Schema Architecture

**Key Models & Relationships:**

1. **StudentEnrollment** (1-to-1 with User)
   - `studentId` is UNIQUE (one enrollment per student)
   - No `academicYearId` - simplified model without year tracking
   - Relations: `student` (User), `mentor` (User, optional)
   - Note: Previously had composite key, now uses simple `studentId` unique constraint

2. **AttendanceRecord**
   - Links to: `lesson`, `student`, `recordedBy` (teacher)
   - Statuses: PRESENT, LATE, ABSENT
   - Late attendance calculation: 2 lates = 1 absence

3. **Exam & ExamScore**
   - Exams have `yearLevel`: YEAR_1, YEAR_2, or BOTH
   - 6 exam sections: Bible, Dogma, Church History, Comparative Theology, Sacraments, Psychology & Methodology
   - Scores link to: `exam`, `student`, `gradedBy`

4. **Lesson**
   - Status: SCHEDULED, COMPLETED, CANCELLED
   - Links to: `academicYear`, `examSection`, `createdBy`
   - Has many `attendanceRecords`

**Graduation Requirements Logic:**
- Attendance ≥ 75%: `(present + (lates / 2)) / total_lessons`
- Overall exam average ≥ 75% across all sections
- Minimum 60% in each individual exam section
- Must complete both YEAR_1 and YEAR_2

### API Route Patterns

**Standard Error Handling:**
```typescript
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Role-based authorization
    if (!isAdmin(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Business logic...

  } catch (error: unknown) {
    // Type-safe error handling
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: error instanceof Error && error.message === "Forbidden" ? 403 : 500 }
    )
  }
}
```

**SERVANT_PREP Filtering Pattern:**
```typescript
// API routes must filter queries for SERVANT_PREP users
let whereClause: Record<string, unknown> | undefined

if (session.user.role === UserRole.SERVANT_PREP) {
  whereClause = {
    ...whereClause,
    role: { in: [UserRole.STUDENT, UserRole.SERVANT] }  // Can only see these roles
  }
}

const users = await prisma.user.findMany({ where: whereClause })
```

### UI/UX Patterns

**Toast Notifications (Sonner):**
```typescript
import { toast } from 'sonner'

// Success with timestamp
const now = new Date()
setLastSaved(now)
toast.success('Data saved successfully!', {
  description: now.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  })
})

// Error
toast.error('Failed to save data')
```

**"Last Saved" Timestamps:**
- Add `const [lastSaved, setLastSaved] = useState<Date | null>(null)` to forms
- Update on successful save operations
- Display: `{lastSaved && <p className="text-xs text-gray-500">Last saved {lastSaved.toLocaleString(...)}</p>}`

**shadcn/ui Components:**
- Located in `components/ui/`
- Install new components: `npx shadcn@latest add <component-name>`
- Toaster already configured in `app/layout.tsx`

### Type Safety Best Practices

**Error Handling:**
```typescript
// Always use unknown type, never any
catch (error: unknown) {
  if (error instanceof Error) {
    // Safe to access error.message
  }
}
```

**Prisma Types:**
```typescript
import { UserRole } from "@prisma/client"  // Always import enums from Prisma

// Schema references (updated model names):
prisma.studentEnrollment  // NOT prisma.enrollment
prisma.user
prisma.attendanceRecord
```

**Common Type Errors to Avoid:**
- StudentEnrollment no longer has `academicYearId` field
- StudentEnrollment uses `mentorId`, not `mentorServantId`
- Unique constraint is `studentId`, NOT composite `studentId_academicYearId`

## Important Implementation Notes

### Data Import Scripts

Located in `scripts/` - used for bulk data imports from Excel files:
- `import-attendance.ts` - Import attendance records
- `import-lessons.ts` - Import curriculum lessons
- Run with: `tsx scripts/<script-name>.ts`

### Academic Year Management

- Only ONE academic year can be `isActive: true` at a time
- Active year determines which data is shown in dashboards
- Lessons and exams are tied to academic years

### Mentor-Student System

**Mentor Assignment Rules:**
- SUPER_ADMIN/PRIEST can assign any mentor to any student
- SERVANT role can self-assign up to 5 mentees max
- Each student can only have ONE mentor
- Unassign before reassigning to different mentor

**Self-Assignment Flow:**
```typescript
// Check current mentee count
const count = await prisma.studentEnrollment.count({
  where: { mentorId: servantId }
})
if (count >= 5) throw new Error("Maximum 5 mentees")

// Assign
await prisma.studentEnrollment.update({
  where: { studentId },
  data: { mentorId: servantId }
})
```

### Build Configuration

**ESLint:** Configured to ignore builds (`eslint.ignoreDuringBuilds: true`) but TypeScript errors will fail builds.

**Environment Variables Required:**
```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."  # For Prisma migrations (if using connection pooling)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<generate-with-openssl-rand-base64-32>"
```

## Common Workflows

### Adding a New Role Permission

1. Add permission helper to `lib/roles.ts`
2. Update API route authorization checks
3. Update UI to show/hide features based on permission
4. Test with different role accounts

### Adding a New Exam Section

1. Add enum value to `ExamSectionType` in `prisma/schema.prisma`
2. Run `npm run db:push` to update database
3. Create section record via API or script
4. Section will appear in curriculum and exam management

### Modifying Database Schema

1. Edit `prisma/schema.prisma`
2. Run `npm run db:generate` (updates Prisma Client types)
3. Run `npm run db:push` (updates database) OR `npm run db:migrate` (creates migration)
4. Update affected API routes and UI components
5. Update seed file if needed: `prisma/seed.ts`

### Troubleshooting Build Errors

**Cache Issues:**
```bash
rm -rf .next
npm run dev
```

**Type Errors:** Always run `npm run db:generate` after schema changes

**Common Fixes:**
- Check for `error: unknown` instead of `error: any`
- Verify StudentEnrollment queries use correct field names
- Ensure UserRole enums are imported from `@prisma/client`
