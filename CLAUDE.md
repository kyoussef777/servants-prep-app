# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 15 web application for managing a 2-year Coptic Church Servants Preparation Program. The system tracks student attendance, exams, curriculum, and graduation requirements with role-based access control.

**Tech Stack:** Next.js 15.5.4 (App Router + Turbopack), TypeScript, PostgreSQL, Prisma ORM, NextAuth.js, Tailwind CSS v4, shadcn/ui, Sonner (toast notifications)

**Package Manager:** Bun 1.3+ (migrated from npm for faster installs and better performance)

## Development Commands

```bash
# Package Management
bun install              # Install all dependencies (alias: bun i)
bun add <package>        # Add a dependency
bun add -d <package>     # Add a dev dependency
bun remove <package>     # Remove a dependency (alias: bun rm)
bun update               # Update dependencies

# Development
bun dev                  # Start dev server with Turbopack (http://localhost:3000)
bun run build            # Production build with Turbopack
bun start                # Start production server
bun lint                 # Run ESLint

# Database (Prisma)
bun db:generate          # Generate Prisma Client (after schema changes)
bun db:push              # Push schema to database (no migrations)
bun db:migrate           # Create and run migrations
bun db:seed              # Seed database with test data
bun db:studio            # Open Prisma Studio GUI

# Utility Scripts
bun scripts/<script>.ts  # Run TypeScript scripts directly with Bun (no tsx needed)
```

**After schema changes:** Always run `bun db:generate` to update Prisma Client types.

**Note:** Bun can run TypeScript files directly without transpilation, so `tsx` is optional. Use `bun <file>.ts` instead.

## Architecture & Key Patterns

### Role-Based Access Control (RBAC)

The app has **5 user roles** with hierarchical permissions defined in `lib/roles.ts`:

1. **SUPER_ADMIN** - Full system access, can manage all users
2. **PRIEST** - Admin access, can manage all except super admins
3. **SERVANT_PREP** - Can manage curriculum/attendance/exams, can only manage STUDENT and MENTOR users
4. **MENTOR** - Read-only access to view assigned mentees, analytics, attendance, and exam scores
5. **STUDENT** - Read-only access to own data

**Key permission helpers:**
- `isAdmin(role)` - Returns true for SUPER_ADMIN, PRIEST, SERVANT_PREP
- `canManageUsers(role)` - SUPER_ADMIN and SERVANT_PREP only
- `canManageAllUsers(role)` - SUPER_ADMIN only (can manage priests)
- `canAssignMentors(role)` - SUPER_ADMIN and PRIEST only
- `canViewStudents(role)` - SUPER_ADMIN, PRIEST, SERVANT_PREP, MENTOR (filtered by assignment for MENTOR)

**IMPORTANT Restrictions:**

**SERVANT_PREP:**
- Can only create/edit/delete STUDENT and MENTOR users (not priests or admins)
- API routes enforce this at both query and mutation levels
- UI dropdowns must be filtered to show only allowed roles

**MENTOR:**
- Read-only access only - cannot create/edit attendance or exam scores
- Can only view data for students assigned to them as mentees
- API routes filter `/api/enrollments?mentorId={userId}` to show only assigned students
- Maximum 5 mentees per mentor (enforced at assignment level)

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
  mustChangePassword: boolean  // True for new users
}
```

**Auth Helpers (`lib/auth-helpers.ts`):**
```typescript
import { getCurrentUser, requireAuth, requireRole } from '@/lib/auth-helpers'

const user = await getCurrentUser()        // Returns user or null
const user = await requireAuth()           // Throws "Unauthorized" if no session
const user = await requireRole([UserRole.PRIEST, UserRole.SUPER_ADMIN])  // Throws "Forbidden" if wrong role
```

**Protected Routes:** All `/dashboard/*` routes redirect to `/login` if unauthenticated. New users with `mustChangePassword: true` are redirected to `/change-password`.

### Database Schema Architecture

**Key Models & Relationships:**

1. **StudentEnrollment** (1-to-1 with User)
   - `studentId` is UNIQUE (one enrollment per student)
   - No `academicYearId` - simplified model without year tracking
   - Relations: `student` (User), `mentor` (User, optional)
   - Note: Previously had composite key, now uses simple `studentId` unique constraint

2. **AttendanceRecord**
   - Links to: `lesson`, `student`, `recordedBy` (teacher)
   - Statuses: PRESENT, LATE, ABSENT, EXCUSED
   - Late attendance calculation: 2 lates = 1 absence
   - EXCUSED absences do not count against the student (excluded from both numerator and denominator)

3. **Exam & ExamScore**
   - Exams have `yearLevel`: YEAR_1, YEAR_2, or BOTH
   - 8 exam sections: Bible Studies, Dogma, Comparative Theology, Ritual Theology & Sacraments, Church History & Coptic Heritage, Spirituality of the Servant, Psychology & Methodology, Miscellaneous
   - Scores link to: `exam`, `student`, `gradedBy`

4. **Lesson**
   - Status: SCHEDULED, COMPLETED, CANCELLED
   - `isExamDay`: Boolean flag - when true, attendance is NOT counted toward graduation requirements
   - Links to: `academicYear`, `examSection`, `createdBy`
   - Has many `attendanceRecords` and `resources` (LessonResource)
   - **Note:** Lessons do NOT have a yearLevel field - they apply to all students

5. **LessonResource**
   - Allows multiple resource links per lesson (e.g., PowerPoint, PDF, video)
   - Fields: `title`, `url`, `type` (optional)
   - Cascade deletes when lesson is deleted

**Graduation Requirements Logic:**
- **Attendance ≥ 75%:** `(present + (lates / 2)) / (total_lessons - excused)`
  - **Formula A** is used consistently across ALL APIs (`/api/students/[id]/analytics` and `/api/students/analytics/batch`)
  - This counts what's present, not what's absent
  - 2 lates = 1 absence
  - EXCUSED absences are excluded from both numerator and denominator
  - Lessons marked as `isExamDay: true` are excluded from attendance calculations
- Overall exam average ≥ 75% across all sections
- Minimum 60% in each individual exam section
- Must complete both YEAR_1 and YEAR_2

**Important Note on Year-Based Attendance:**
- The batch analytics API shows Year 1/Year 2 attendance based on student's **current year level**
- Year 1 students: Year 1 attendance = all current attendance, Year 2 attendance = 0
- Year 2 students: Year 2 attendance = all current attendance, Year 1 attendance = 0 (historical data not tracked)
- **Limitation:** Lessons are not tagged with year levels, so cannot separate "Year 1 lessons" vs "Year 2 lessons"
- This is a simplified model - students who progress from Year 1→Year 2 will show 0% for Year 1 attendance
- For proper year-based tracking, consider adding `yearLevel` field to Lesson model in future

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
    role: { in: [UserRole.STUDENT, UserRole.MENTOR] }  // Can only see these roles
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

### Admin CLI Tool

**Location:** `scripts/admin.ts`

A comprehensive CLI tool for database administration and user management:

**Available Commands:**
```bash
bun scripts/admin.ts reset-password <email>       # Reset a user's password
bun scripts/admin.ts create-admin <email> [name]  # Create a SUPER_ADMIN user
bun scripts/admin.ts list-admins                  # List all admin users
bun scripts/admin.ts list-sections                # List all exam sections
bun scripts/admin.ts db-stats                     # Show database statistics
```

**Examples:**
```bash
bun scripts/admin.ts reset-password john@church.com
bun scripts/admin.ts create-admin admin@church.com "Fr. Michael"
bun scripts/admin.ts db-stats
```

**Note:** The admin tool generates secure random passwords and displays them once. Save them securely!

### Academic Year Management

- Only ONE academic year can be `isActive: true` at a time
- Active year determines which data is shown in dashboards
- Lessons and exams are tied to academic years

### Mentor-Student System

**Mentor Assignment Rules:**
- SUPER_ADMIN/PRIEST can assign any mentor to any student via Enrollments page
- Each mentor can have up to 5 mentees maximum
- Each student can only have ONE mentor
- Unassign before reassigning to different mentor

**Note:** Self-assignment feature for mentors is not currently implemented in the UI. Assignments must be done by administrators through the Enrollments page.

### Build Configuration

**ESLint:** Configured to ignore builds (`eslint.ignoreDuringBuilds: true`) but TypeScript errors will fail builds.

**Environment Variables Required:**
```env
# Database Configuration (Neon with SP_ prefix)
SP_DATABASE_URL="postgresql://..."  # Primary database URL with connection pooling
SP_DATABASE_URL_UNPOOLED="postgresql://..."  # Direct connection for Prisma migrations
SP_POSTGRES_PRISMA_URL="postgresql://..."  # Optimized Prisma connection string
SP_POSTGRES_URL="postgresql://..."  # Additional Neon URLs
SP_POSTGRES_URL_NON_POOLING="postgresql://..."
SP_POSTGRES_URL_NO_SSL="postgresql://..."
SP_POSTGRES_USER="..."
SP_POSTGRES_PASSWORD="..."
SP_POSTGRES_DATABASE="..."
SP_POSTGRES_HOST="..."
SP_PGHOST="..."
SP_PGHOST_UNPOOLED="..."
SP_PGUSER="..."
SP_PGDATABASE="..."
SP_PGPASSWORD="..."
SP_NEON_PROJECT_ID="..."

# NextAuth.js Configuration
NEXTAUTH_URL="http://localhost:3000"  # or your production URL
NEXTAUTH_SECRET="<generate-with-openssl-rand-base64-32>"
```

**Note:** The `SP_` prefix is used for all Servants Prep database-related environment variables to maintain consistency with the Vercel/Neon integration.

## Current Implementation Status

### Dashboard Pages

**Admin Dashboard (`/dashboard/admin`):**
- `/dashboard/admin` - Main admin dashboard with statistics and quick links
- `/dashboard/admin/users` - User management (create/edit/delete users with role-based filtering)
- `/dashboard/admin/students` - Student management with analytics, enrollment, and detailed views
- `/dashboard/admin/attendance` - Attendance tracking and management (filters out CANCELLED and exam day lessons)
- `/dashboard/admin/curriculum` - Curriculum and lesson management (with expanded edit mode, resources, and exam day marking)
- `/dashboard/admin/exams` - Exam management and grading
- `/dashboard/admin/enrollments` - Student enrollment and mentor assignment
- `/dashboard/admin/mentees` - View mentee assignments (for SERVANT_PREP role with mentees)

**Mentor Dashboard (`/dashboard/mentor`):**
- `/dashboard/mentor` - Mentor dashboard with quick links to mentee data
- `/dashboard/mentor/my-mentees` - View and manage assigned mentees (read-only)
- `/dashboard/mentor/analytics` - View analytics for assigned mentees

**Student Dashboard (`/dashboard/student`):**
- `/dashboard/student` - Student dashboard (view own data)

### API Routes

**Implemented API Endpoints:**

- **`/api/auth/*`** - Authentication (NextAuth.js)
  - `[...nextauth]/route.ts` - Auth endpoints
  - `change-password/route.ts` - Password change endpoint

- **`/api/users`** - User management
  - `GET /api/users` - List users (with role-based filtering)
  - `POST /api/users` - Create user
  - `GET /api/users/[id]` - Get user details
  - `PATCH /api/users/[id]` - Update user
  - `DELETE /api/users/[id]` - Delete user

- **`/api/students`** - Student operations
  - `GET /api/students/[id]/analytics` - Individual student analytics
  - `GET /api/students/analytics/batch` - Batch analytics for multiple students

- **`/api/enrollments`** - Student enrollment management
  - CRUD operations for student enrollments and mentor assignments

- **`/api/attendance`** - Attendance tracking
  - `POST /api/attendance/batch` - Batch attendance operations

- **`/api/lessons`** - Lesson management
  - CRUD operations for curriculum lessons

- **`/api/exams`** - Exam management
  - CRUD operations for exams

- **`/api/exam-scores`** - Exam score management
  - `GET /api/exam-scores/[id]` - Get exam score details
  - CRUD operations for exam scores

- **`/api/exam-sections`** - Exam section configuration
  - CRUD operations for exam sections

- **`/api/academic-years`** - Academic year management
  - CRUD operations for academic years

- **`/api/dashboard`** - Dashboard data aggregation
  - Provides aggregated statistics for dashboards

- **`/api/health`** - System health check
  - `GET /api/health` - Verify database connectivity and environment configuration

### UI Components

**shadcn/ui Components in Use:**
- Button, Card, Input, Label, Badge, Dialog, Textarea
- Select, Dropdown Menu, Tabs
- Toast notifications (Sonner)
- Skeleton (loading states)

**Custom Components:**
- `StudentDetailsModal` - Detailed student information modal
- `BulkStudentImport` - Bulk student import functionality

### Curriculum Page Features

**Expanded Edit Mode:**
- When editing a lesson, the table row expands vertically to show all fields without horizontal scrolling
- Uses `colSpan` to span all columns and displays a form layout with multiple rows
- Includes: title, subtitle, date, section, description, status, cancellation reason, exam day toggle, and resources

**Lesson Resources:**
- Each lesson can have multiple resource links (e.g., PowerPoint, PDF, video)
- Resources are managed in the expanded edit mode with add/remove functionality
- Each resource has a title (required) and URL (required), with optional type
- Resources are displayed as clickable links on lesson cards

**Exam Day Marking:**
- Lessons can be marked as "Exam Day" using a checkbox in edit mode
- Exam day lessons display a yellow "Exam Day" badge
- Attendance on exam day lessons does NOT count toward graduation requirements
- Exam day lessons are filtered out from the attendance page

### Attendance Page Features

**Lesson Filtering:**
- CANCELLED lessons are filtered out (not shown in either scheduled or completed tabs)
- Exam day lessons (`isExamDay: true`) are filtered out from both tabs
- This ensures attendance is only tracked for regular class sessions

**Attendance Statuses:**
- PRESENT - Student attended the class
- LATE - Student arrived late (counts as 0.5 present for graduation calculation)
- ABSENT - Student did not attend
- EXCUSED - Student had a valid excuse (excluded from graduation calculation entirely)

### SWR Integration

**Location:** `lib/swr.ts`

The application uses SWR (Stale-While-Revalidate) for efficient client-side data fetching and caching:
- Automatic revalidation on focus
- Optimistic UI updates
- Built-in error handling and retry logic
- Used in dashboard pages for real-time data updates
- **Static data caching:** Academic years and exam sections use aggressive caching (`staticDataConfig`) with 1-minute deduplication

### Performance Optimizations

**Implemented Performance Enhancements:**

1. **Database Indexes (December 2025):**
   - Compound index on `AttendanceRecord([studentId, lessonId])` for faster student attendance queries
   - Compound indexes on `StudentEnrollment([mentorId, isActive])` and `([mentorId, status])` for mentor filtering
   - Compound index on `ExamScore([studentId, examId])` for student exam score lookups
   - **Impact:** 30-50% faster queries on filtered joins

2. **Optimized Data Fetching:**
   - **Individual Student Analytics:** Uses `select` to fetch only needed fields (status, arrivedAt) instead of full lesson objects - **40-60% reduction** in data transfer
   - **Student Details Modal:** Limited to recent 6 months + max 50 exams and 100 lessons - **70-80% reduction** for students with long history
   - **Mentor Analytics Page:** Switched from N+1 queries (one per mentee) to single batch API call - **80-90% reduction** in API calls

3. **Batch Operations:**
   - **Attendance Updates:** Groups simple status-only updates using `updateMany` instead of individual updates - **50% faster** for 30+ students
   - **Analytics Fetching:** Batch analytics API uses database aggregation with `groupBy` instead of fetching individual records

4. **SWR Caching Strategy:**
   - Default config: 5-second deduplication for dynamic data
   - Static config: 1-minute deduplication with disabled revalidation for academic years and exam sections
   - Eliminates redundant API calls for rarely-changing data

5. **Parallel Fetching:**
   - Dashboard stats endpoint fetches all 7 metrics in parallel using `Promise.all()`
   - Student management page fetches students and academic years concurrently

**Performance Monitoring:**
- All optimizations maintain data consistency using Prisma transactions where needed
- Expected response times: Individual analytics <200ms, Batch analytics <500ms for 100+ students

## Common Workflows

### Adding a New Role Permission

1. Add permission helper to `lib/roles.ts`
2. Update API route authorization checks
3. Update UI to show/hide features based on permission
4. Test with different role accounts

### Adding a New Exam Section

1. Add enum value to `ExamSectionType` in `prisma/schema.prisma`
2. Run `bun db:push` to update database
3. Create section record via API or script
4. Section will appear in curriculum and exam management

### Modifying Database Schema

1. Edit `prisma/schema.prisma`
2. Run `bun db:generate` (updates Prisma Client types)
3. Run `bun db:push` (updates database) OR `bun db:migrate` (creates migration)
4. Update affected API routes and UI components
5. Update seed file if needed: `prisma/seed.ts`

### Troubleshooting Build Errors

**Cache Issues:**
```bash
rm -rf .next
bun dev
```

**Type Errors:** Always run `bun db:generate` after schema changes

**Common Fixes:**
- Check for `error: unknown` instead of `error: any`
- Verify StudentEnrollment queries use correct field names
- Ensure UserRole enums are imported from `@prisma/client`

## Bun Migration Notes

**Migration Date:** December 2025

This project was migrated from npm to Bun for improved performance:

**Benefits:**
- 4-6x faster dependency installation
- Native TypeScript support (no need for `tsx` or `ts-node`)
- Compatible with all existing npm packages
- Smaller disk footprint (uses hardlinks)

**Lockfile:**
- `bun.lockb` - Bun's binary lockfile (auto-generated from package-lock.json)
- The old `package-lock.json` was removed during migration

**Running Scripts:**
- TypeScript files can be run directly: `bun scripts/myScript.ts`
- No need for `tsx` or `ts-node` prefix
- All npm scripts work with `bun` prefix: `bun dev`, `bun build`, etc.

**Compatibility:**
- Bun reads `.npmrc` configuration files
- Works with all existing Node.js packages
- node_modules structure remains the same

## Production Deployment (Vercel)

**Deployment URL:** `https://servants-prep-app.vercel.app`

### Required Vercel Environment Variables

Configure these in Vercel Project Settings > Environment Variables:

```env
# Database (Neon with SP_ prefix)
SP_DATABASE_URL="postgresql://..."  # Pooled connection
SP_DATABASE_URL_UNPOOLED="postgresql://..."  # Direct connection for migrations

# NextAuth.js
NEXTAUTH_URL="https://servants-prep-app.vercel.app"  # Must match production URL
NEXTAUTH_SECRET="<secure-random-string>"  # Generate with: openssl rand -base64 32

# Additional Neon variables (if using Vercel Neon integration)
SP_POSTGRES_PRISMA_URL="postgresql://..."
SP_POSTGRES_URL="postgresql://..."
SP_POSTGRES_URL_NON_POOLING="postgresql://..."
SP_POSTGRES_USER="..."
SP_POSTGRES_PASSWORD="..."
SP_POSTGRES_DATABASE="..."
SP_POSTGRES_HOST="..."
```

### Vercel Deployment Checklist

1. **Environment Variables**: Verify all required env vars are set in Vercel dashboard
2. **Bun Auto-Detection**: Vercel automatically detects Bun via `bun.lockb` file (no config needed)
3. **Database Connection**: Production uses `SP_DATABASE_URL` from Vercel env vars (not local .env)
4. **Redeploy After Env Changes**: Always redeploy after updating environment variables
5. **Health Check**: After deployment, visit `/api/health` to verify database connectivity

### Troubleshooting Production Issues

**Login Issues (401 Unauthorized):**
- Verify `NEXTAUTH_SECRET` matches between local and Vercel
- Check `NEXTAUTH_URL` is set to correct production URL
- Ensure database connection works via `/api/health` endpoint
- Password changes must target production database (use Vercel env vars)
- Redeploy after changing authentication-related env vars

**Database Connection Issues:**
- Visit `/api/health` endpoint to check connectivity status
- Verify `SP_DATABASE_URL` is correctly set in Vercel
- Check Neon database is not in sleep mode (free tier)
- Ensure database allows connections from Vercel IP ranges

**Debug Commands:**
```bash
# Verify production database user (connect with Vercel env vars)
bun scripts/verify-password.ts <email> <password>

# Reset password on production database
bun scripts/set-simple-password.ts <email> <password>

# Check database stats
bun scripts/admin.ts db-stats
```
