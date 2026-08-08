# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 15 web application with two modes sharing one deployment, database, and login:

1. **Servants Prep** (`/dashboard/admin`, `/dashboard/mentor`, `/dashboard/student`) — the 2-year Coptic Church Servants Preparation Program: student attendance, exams, curriculum, and graduation requirements.
2. **Sunday School** (`/dashboard/servants`) — the Sunday School class itself: classes by grade (Pre-K–12), the children in them, and weekly child attendance.

The two are deliberately independent: no Sunday School model references a prep model, and the `SERVANT` role has no prep-side permission.

**Tech Stack:** Next.js 15.5 (App Router + Turbopack), TypeScript, PostgreSQL, Prisma ORM, NextAuth.js, Tailwind CSS v4, shadcn/ui, Sonner (toasts), SWR (data fetching), Vitest (testing)

**Package Manager:** Bun 1.3+

## Development Commands

```bash
# Development
bun dev                  # Start dev server with Turbopack (http://localhost:3000)
bun run build            # Production build
bun lint                 # Run ESLint

# Testing (Vitest)
bun test                 # Run tests in watch mode
bun test:run             # Run tests once
bun test:coverage        # Run tests with coverage report

# Database (Prisma)
bun db:generate          # Generate Prisma Client (REQUIRED after schema changes)
bun db:push              # Push schema to database (no migrations)
bun db:migrate           # Create and run migrations
bun db:seed              # Seed database with test data
bun db:studio            # Open Prisma Studio GUI

# Admin CLI
bun scripts/admin.ts reset-password <email>       # Reset user password
bun scripts/admin.ts create-admin <email> [name]  # Create SUPER_ADMIN user
bun scripts/admin.ts list-admins                  # List admin users
bun scripts/admin.ts db-stats                     # Show database statistics
```

**After schema changes:** Always run `bun db:generate` to update Prisma Client types.

## Architecture & Key Patterns

### Role-Based Access Control (RBAC)

Six user roles with hierarchical permissions defined in `lib/roles.ts`:

| Role | Dashboard Access | Can Edit Data | User Management |
|------|-----------------|---------------|-----------------|
| SUPER_ADMIN | Full (both modes) | Yes | All users |
| PRIEST | Full (read-only, both modes) | No | None |
| SERVANT_PREP | Full (both modes) | Yes | STUDENT, MENTOR & SERVANT only |
| MENTOR | Own mentees only | No | None |
| STUDENT | Own data only | No | None |
| SERVANT | Sunday School mode only | Sunday School only | None |

**Key permission helpers:**
- `isAdmin(role)` - SUPER_ADMIN, PRIEST, SERVANT_PREP (can view admin dashboard)
- `canManageUsers(role)` - SUPER_ADMIN and SERVANT_PREP only
- `canManageData(role)` - SUPER_ADMIN and SERVANT_PREP (attendance, exams, curriculum)
- `isReadOnlyAdmin(role)` - PRIEST only (has view access but cannot edit)
- `canViewStudents(role)` - All admin roles + MENTOR (filtered by assignment)
- `canAccessSundaySchool(role)` - SERVANT + all admin roles
- `canManageSundaySchoolClasses(role)` - SUPER_ADMIN and SERVANT_PREP (create classes, assign servants)
- `canTakeSundaySchoolAttendance(role)` / `canManageSundaySchoolChildren(role)` - SERVANT + SUPER_ADMIN + SERVANT_PREP (PRIEST read-only)
- `canServantPrepManageRole(targetRole)` - the roles a SERVANT_PREP may create/edit/delete (`SERVANT_PREP_MANAGEABLE_ROLES`)

**Important:** SERVANT_PREP can only create/edit/delete STUDENT, MENTOR, and SERVANT users. API routes enforce this at both query and mutation levels.

**SERVANT isolation:** every prep-side helper is an explicit allowlist, so SERVANT is denied prep access by construction. `__tests__/lib/roles.test.ts` pins this — keep that test passing when adding a helper.

### Authentication (NextAuth.js)

**Session Strategy:** JWT with role and ID stored in token

```typescript
// Client components
const { data: session } = useSession()

// Server components/API routes
const session = await getServerSession(authOptions)

// Auth helpers (lib/auth-helpers.ts)
const user = await getCurrentUser()        // Returns user or null
const user = await requireAuth()           // Throws "Unauthorized" if no session
const user = await requireRole([...])      // Throws "Forbidden" if wrong role
```

**Protected Routes:** All `/dashboard/*` routes redirect to `/login` if unauthenticated. Users with `mustChangePassword: true` are redirected to `/change-password`.

### Database Schema (Key Models)

```
User (1) ←──→ (1) StudentEnrollment ←──→ (1) User (mentor)
                    ↓
                    → FatherOfConfession (optional)

Lesson ←──→ AttendanceRecord ←──→ User (student)
   ↓
   → LessonResource[] (multiple links per lesson)

Exam ←──→ ExamScore ←──→ User (student)

StudentNote ←──→ User (student, author)

# Sunday School mode (independent of everything above)
SundaySchoolClass ←──→ SundaySchoolClassServant ←──→ User (SERVANT)
   ↓                ↓
   → SundaySchoolChild[]      → SundaySchoolSession[] (one per week)
                                    ↓
                                    → SundaySchoolChildAttendance ←──→ SundaySchoolChild
```

**Sunday School mode notes:**
- Children are data rows (`SundaySchoolChild`), not `User`s — they never log in. Guardian contact is returned only by `/api/sunday-school/children*`, to servants of that child's class and to admins.
- `SundaySchoolSession.date` is normalized to **midnight UTC** (`normalizeSessionDate` in `lib/sunday-school-class.ts`) so `@@unique([classId, date])` gives one session per class per day. Render with `formatDateUTC`.
- Sessions are created on first save, not on page load, so browsing dates leaves no empty rows.
- `SundaySchoolLevel` (Pre-K–12) is a separate enum from the prep-side `SundaySchoolGrade` (Pre-K–`GRADE_6_PLUS`), which belongs to the async-student serving-verification flow and is untouched by this mode.
- A `SERVANT` is scoped to their assigned classes via `getServantClassIds` in `lib/api-utils.ts` (same contract as `getMentorStudentIds`: returns `undefined` when no filter is needed).

**Key Fields:**
- `StudentEnrollment.studentId` is UNIQUE (one enrollment per student)
- `StudentEnrollment.academicYearId` - nullable, tracks enrollment start year
- `Lesson.isExamDay` - if true, attendance NOT counted toward graduation
- `AttendanceRecord.status` - PRESENT, LATE, ABSENT, EXCUSED

**Enums (import from `@prisma/client`):**
- `UserRole`: SUPER_ADMIN, PRIEST, SERVANT_PREP, MENTOR, STUDENT, SERVANT
- `YearLevel`: YEAR_1, YEAR_2
- `AttendanceStatus`: PRESENT, LATE, ABSENT, EXCUSED
- `LessonStatus`: SCHEDULED, CANCELLED, COMPLETED
- `ExamSectionType`: 8 sections (BIBLE_STUDIES, DOGMA, etc.)
- `SundaySchoolLevel`: PRE_K, KINDERGARTEN, GRADE_1 … GRADE_12 (Sunday School mode)

### Graduation Requirements

Students must meet ALL requirements:
1. **Attendance ≥ 75%:** `(present + (lates / 2)) / (total_lessons - excused)`
   - 2 lates = 1 absence
   - EXCUSED excluded from calculation
   - `isExamDay` lessons excluded
2. **Overall exam average ≥ 75%** across all sections
3. **Minimum 60%** in each individual exam section
4. **Complete both YEAR_1 and YEAR_2**

### API Route Patterns

**Standard structure:**
```typescript
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!canManageData(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    // Business logic...
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
```

**Key API Endpoints:**
- `/api/users` - User CRUD + bulk operations (`/bulk-create`, `/bulk-delete`, `/bulk-disable`, `/bulk-reset-password`)
- `/api/students/[id]/analytics` - Individual student stats
- `/api/students/analytics/batch` - Batch analytics for multiple students
- `/api/enrollments` - Enrollment management + `/self-assign`, `/unassign-mentor`
- `/api/attendance/batch` - Batch attendance updates
- `/api/fathers-of-confession` - Father of confession management
- `/api/students/[id]/notes` - Student notes
- `/api/health` - Database connectivity check

**Sunday School mode endpoints** (`app/api/sunday-school/`) — note the older `assignments`, `codes`, `logs`, and `progress` routes in the same folder belong to the *prep* serving-verification flow, not this mode:
- `/api/sunday-school/classes` (+ `/[id]`, `/[id]/servants`) - class CRUD and servant assignment
- `/api/sunday-school/children` (+ `/[id]`) - child roster CRUD (the only place guardian contact is returned)
- `/api/sunday-school/sessions` (+ `/[id]`, `/[id]/attendance`) - weekly sessions and their roster
- `/api/sunday-school/attendance/batch` - bulk child attendance save
- `/api/sunday-school/dashboard` - per-class summary for the mode's landing page

### UI Patterns

**Toast Notifications (Sonner):**
```typescript
import { toast } from 'sonner'
toast.success('Saved!', { description: new Date().toLocaleString() })
toast.error('Failed to save')
```

**shadcn/ui Components:** Located in `components/ui/`. Install new: `npx shadcn@latest add <name>`

**SWR Caching (`lib/swr.ts`):**
- Default: 5-second deduplication
- Static data (academic years, exam sections): 1-minute cache with disabled revalidation

### Type Safety

- Always use `error: unknown` in catch blocks, then `error instanceof Error`
- Import enums from `@prisma/client`, not redeclare them
- After schema changes, run `bun db:generate` before building

## Environment Variables

```env
# Database (Neon)
SP_DATABASE_URL="postgresql://..."          # Pooled connection
SP_DATABASE_URL_UNPOOLED="postgresql://..." # Direct connection (migrations)

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<openssl rand -base64 32>"
```

## Common Workflows

### Modifying Database Schema
1. Edit `prisma/schema.prisma`
2. Run `bun db:generate` (updates types)
3. Run `bun db:push` or `bun db:migrate`
4. Update affected API routes and components

### Adding a New Role Permission
1. Add helper to `lib/roles.ts`
2. Update API authorization checks
3. Update UI to show/hide based on permission

### Troubleshooting
- **Type errors after schema change:** Run `bun db:generate`
- **Cache issues:** `rm -rf .next && bun dev`
- **Build failing:** Check `error: unknown` vs `error: any`

## Production (Vercel)

**URL:** `https://servants-prep-app.vercel.app`

**Required Env Vars:** `SP_DATABASE_URL`, `SP_DATABASE_URL_UNPOOLED`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`

**Health Check:** `/api/health` - verify database connectivity after deployment
