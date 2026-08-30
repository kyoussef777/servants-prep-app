# Sunday School mode

Reference for the Sunday School side of the application: the classes, the
children in them, and weekly child attendance. For the authorization rules that
govern all of it, see [`permissions.md`](permissions.md).

## What it is, and what it is not

Sunday School mode (`/dashboard/servants`) manages the church's actual Sunday
School ministry. It shares a deployment, database, and login with the Servants
Prep program but is otherwise independent — **no model here references a prep
model**.

It was built inside this app rather than as a separate deployment so that auth,
UI components, and the schema live in one place instead of being maintained
twice.

### ⚠️ Not the same as the prep-side "Sunday School" feature

The prep program has its own, older, unrelated Sunday School feature: async prep
students must serve a number of weeks, and they prove it with weekly per-grade
codes. Both live under `app/api/sunday-school/`. Check a route's header comment
before editing it.

| Prep-side (serving verification) | Sunday School mode (this document) |
|---|---|
| `SundaySchoolAssignment` | `SundaySchoolServantAssignment` |
| `SundaySchoolGrade` (Pre-K … `GRADE_6_PLUS`) | `SundaySchoolLevel` (Pre-K … `GRADE_12`) |
| `SundaySchoolCode`, `SundaySchoolLog` | `SundaySchoolSession`, `SundaySchoolChildAttendance` |
| Routes: `assignments/`, `codes/`, `logs/`, `progress/` | Routes: `age-groups/`, `servant-assignments/`, `classes/`, `children/`, `sessions/`, `attendance/`, `dashboard/`, `assignable-servants/` |
| `lib/sunday-school-utils.ts` | `lib/sunday-school-class.ts`, `lib/sunday-school-access.ts` |
| `canManageSundaySchool()` in `lib/roles.ts` | `getSundaySchoolAccess()` |

The two grade enums are separate on purpose: the prep-side one ends in a
`GRADE_6_PLUS` catch-all that is already baked into live data, so it could not
be extended to cover a Pre-K–12 ministry without migrating it.

## Data model

```
SundaySchoolAgeGroup          Elementary / Middle / High — owns a set of levels
        ↑
        │ band derived from class.level (no foreign key)
        │
SundaySchoolClass ──────────→ SundaySchoolServantAssignment ──→ User
   │  name, level, academicYearId    authority + exactly one scope,
   │                                 scoped to an academic year
   ├──→ SundaySchoolChild[]          name, level, guardian contact
   │
   └──→ SundaySchoolSession[]        one weekly meeting, unique per (class, date)
              │
              └──→ SundaySchoolChildAttendance ←── SundaySchoolChild
                       AttendanceStatus per child per session
```

### Models

| Model | Notes |
|---|---|
| `SundaySchoolAgeGroup` | `name`, `levels: SundaySchoolLevel[]`, `sortOrder`, `isActive`. A Postgres enum array, so no join table. |
| `SundaySchoolClass` | `name`, `level`, `academicYearId` (**required**), `isActive`. Unique on `(name, academicYearId)`. |
| `SundaySchoolServantAssignment` | `userId`, `academicYearId`, `authority`, and exactly one of `classId` / `ageGroupId`. |
| `SundaySchoolChild` | Names, `level`, optional `classId`, `birthDate`, guardian contact, `notes`, `isActive`. |
| `SundaySchoolSession` | `classId`, `date`, optional `topic` / `notes`, `takenBy`. Unique on `(classId, date)`. |
| `SundaySchoolChildAttendance` | `sessionId`, `childId`, `status`, `notes`, `recordedBy`. Unique on `(sessionId, childId)`. |

Reuses the app-wide `AttendanceStatus` (`PRESENT` / `LATE` / `ABSENT` /
`EXCUSED`), so `components/attendance-status-buttons.tsx` works unchanged.

### Design decisions worth understanding

**Children are data rows, not users.** They never log in, have no `User`
record, and no password. Guardian contact belongs to minors and is returned
only by the child routes, only to people who serve that child's class and to
admins.

**A class's band is derived, not stored.** There is no `ageGroupId` on
`SundaySchoolClass`. Whichever age group lists the class's `level` owns it.
Moving Grade 6 from Middle to Elementary re-parents every Grade 6 class and
hands them to a different coordinator — data entry, not a migration. The cost is
an invariant Prisma cannot enforce: **a level belongs to at most one age
group**, checked by `assertLevelsUnclaimed` on every age-group write.

**Assignments are per academic year.** Staffing is redone each year and last
year's roster stays as history, matching how enrollments and lessons already
scope. `SundaySchoolClass.academicYearId` is required for the same reason — a
class with no year would be one nobody could be assigned to.

**Sessions are created on save, not on page load.** Browsing dates on the
attendance page leaves no empty rows behind, and `PRIEST` can look without
writing. The `POST /sessions` route is idempotent: it returns the existing
session for a `(class, date)` rather than failing on the unique constraint.

**Session dates are midnight UTC.** `normalizeSessionDate` in
`lib/sunday-school-class.ts` enforces it, so `@@unique([classId, date])` gives
exactly one session per class per day. Render with `formatDateUTC` from
`lib/utils.ts` — a local-midnight `Date` shifts the day for viewers west of UTC.

**Attendance rate uses recorded marks as the denominator**, not
`sessions × children`. A child added mid-year does not drag the class rate down
for the weeks before they joined. The formula itself is the app-wide
`calculateAttendanceStats` (late counts half, excused excluded), shown as a
plain rate with none of the graduation framing.

## API routes

All under `app/api/sunday-school/`. Every one resolves authority with
`getSundaySchoolAccess` and then a per-class predicate — see
[`permissions.md`](permissions.md).

| Route | Methods | Who |
|---|---|---|
| `age-groups` | GET, POST | Read: anyone with access. Write: `SUPER_ADMIN` |
| `age-groups/[id]` | PATCH, DELETE | `SUPER_ADMIN` |
| `servant-assignments` | GET, POST, DELETE | Coordinator of the scope being assigned into; band assignments are `SUPER_ADMIN` only |
| `assignable-servants` | GET | Anyone who can staff something |
| `classes` | GET, POST | Read: scoped. Create: `SUPER_ADMIN`, or band coordinator at that level |
| `classes/[id]` | GET, PATCH, DELETE | View: scoped. Edit: class coordinator. Delete: band coordinator or `SUPER_ADMIN` |
| `children` | GET, POST | People who serve the class |
| `children/[id]` | GET, PATCH, DELETE | People who serve the child's class |
| `sessions` | GET, POST | People who serve the class |
| `sessions/[id]` | PATCH, DELETE | People who serve the class |
| `sessions/[id]/attendance` | GET | Anyone who can view the class |
| `attendance/batch` | POST | People who serve the class |
| `dashboard` | GET | Anyone with access |

Two that exist for specific reasons:

- **`assignable-servants`** — a coordinator is often a plain `SERVANT`, and
  `/api/users` is admin-only, so staffing a class would 403. This returns just
  enough to populate a picker (id, name, email, role) for assignable roles only,
  and keeps `/api/users` closed to servants.
- **`dashboard`** — a per-class summary grouped by age group, deliberately
  carrying **no guardian contact**.

List and detail responses include `canServe` / `canCoordinate` / `canDelete`
per class, so the UI never re-derives authority. The server still re-checks
every write.

## Pages

Under `app/dashboard/servants/`, all guarded by `useSundaySchoolGuard()`.

| Page | Purpose |
|---|---|
| `page.tsx` | Landing: classes grouped by age group, attendance-due badges, totals |
| `attendance/page.tsx` | The core screen — pick class and week, mark each child, batch save |
| `classes/page.tsx` | Class list; "New class" appears only for levels you may create at |
| `classes/[id]/page.tsx` | Class detail: servants (with the staffing panel for coordinators), roster, recent sessions |
| `children/page.tsx` | Child roster CRUD including guardian fields |
| `age-groups/page.tsx` | `SUPER_ADMIN` only — bands and the grades each owns |

`components/navbar.tsx` shows a **mode switcher** between Servants Prep and
Sunday School for anyone with a foot in both — which is how a `SERVANT_PREP`
who also serves moves between them. A `SERVANT` has only one mode and sees no
switcher.

## Extending it

**Adding a capability to an existing role of authority** — add a predicate to
`lib/sunday-school-access.ts`, cover it in
`__tests__/lib/sunday-school-access.test.ts` including its denial cases, then
enforce it in the route and reflect it in the API payload's `can*` flags.

**Adding a new kind of authority** — do *not* add a `UserRole`. Extend the
assignment model: either a new `SundaySchoolAuthority` value, or a new scope
column alongside `classId` / `ageGroupId`. If you add a scope, update the
exactly-one-scope validation in `assignments/route.ts` and the expansion logic
in `getSundaySchoolAccess`.

**Adding a field to a child or class** — remember that anything resembling
contact information for a minor must stay out of `dashboard/route.ts` and the
command palette.

## Local setup

```bash
bun db:generate && bun db:push
bun db:seed        # seeds Elementary / Middle / High, a class, servants, children
bun dev
```

The seed creates `servant@church.com` (a servant on one class) and
`elementary.coordinator@church.com` (coordinator of the whole Elementary band),
both with the shared seed password. In development, `SUPER_ADMIN` users can use
the impersonation panel (`components/dev-impersonation.tsx`) to view the app as
either.

Worth exercising when changing this area:

1. An **unassigned `SERVANT_PREP`** is redirected away from `/dashboard/servants`
   and gets 403 from the API — the regression this model exists to prevent.
2. Assigning that same person to a class gives them access and the mode
   switcher, without changing their role.
3. A **band coordinator** sees every class in their band and none outside it,
   and can create a class at their levels but not others.
4. A **class coordinator** can staff their class but cannot create or delete one.
5. Moving a grade between age groups re-parents its classes.
6. `PRIEST` sees everything and is refused every write.
