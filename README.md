# Servants Prep

A web application for a Coptic Orthodox church, running two modes that share one
deployment, one database, and one login:

1. **Servants Prep** — the 2-year Servants Preparation Program: student
   attendance, exams, curriculum, mentors, and graduation requirements.
2. **Sunday School** — the Sunday School ministry: classes by grade (Pre-K–12)
   grouped into age-group bands, the children in them, and weekly child
   attendance.

The two are deliberately independent — no Sunday School data references the prep
program, and vice versa.

## Documentation

| Document | For |
|---|---|
| [`AGENTS.md`](AGENTS.md) | The working guide — commands, layout, conventions, gotchas. Start here, whether you are a person or an AI coding agent. |
| [`docs/permissions.md`](docs/permissions.md) | Every role and permission, and the Sunday School authority model |
| [`docs/sunday-school-mode.md`](docs/sunday-school-mode.md) | Sunday School mode end to end |

## Features

### Servants Prep
- **Six roles** with distinct permissions: Super Admin, Priest, Servants Prep
  Leader, Mentor, Student, Sunday School Servant
- **Academic years** with enrollment management, including late-start students
- **Curriculum** — weekly lessons with resources, ordering, and exam days
- **Attendance** — Present / Late / Absent / Excused, with expected absences and
  a late-start curve
- **Exams** — eight sections, per-section and overall requirements
- **Graduation tracking** — live validation of every requirement
- **Mentors** — each student assigned a mentor, with mentee dashboards
- **Async students** — note submissions and serving verification for students
  who cannot attend in person
- **Registration** — invite codes and a review queue for new applicants
- **Analytics** — progress, at-risk students, trends, class averages

### Sunday School
- **Age groups** (Elementary / Middle / High) as editable data, each owning a
  set of grades
- **Classes** per academic year, each with assigned servants
- **Coordinators** at class or age-group level, with authority scoped accordingly
- **Children** rosters with guardian contact, visible only to that class's
  servants and to admins
- **Weekly attendance** per child, with per-class rates

### Shared experience and branding
- **Compact SP / SS mode switcher** for eligible users, with an animated
  transition between the two ministry workspaces
- **Consistent page width and navigation** across Servants Prep and Sunday
  School so switching modes does not shift the surrounding interface
- **Mode-aware branding** — Sunday School uses the St. Mark logo, browser title,
  and transparent favicon while Servants Prep keeps its own identity
- **Neutral charcoal dark mode** shared across the application
- **Mode-aware account controls** that keep the signed-in user's name and role
  legible, preserve the active workspace for Dashboard and My Account, and hide
  Prep-only settings from the Sunday School menu
- **Cross-mode user administration** so Super Admins can open the complete user
  list without leaving either ministry workspace
- **Privacy Policy and Terms of Service** in the shared footer and account menu;
  their routes preserve the active mode and authenticated navigation

## Tech stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript
- **Styling:** Tailwind CSS v4, shadcn/ui
- **Database:** PostgreSQL (Neon) with Prisma ORM
- **Auth:** NextAuth.js, JWT sessions
- **Data fetching:** SWR
- **Testing:** Vitest
- **Package manager:** Bun

## Getting started

**Prerequisites:** Bun 1.3+ and a PostgreSQL database.

```bash
# 1. Install dependencies
bun install

# 2. Create .env (see below)

# 3. Set up the database
bun db:generate      # generate Prisma Client
bun db:push          # push the schema
bun db:seed          # seed sample data

# 4. Run
bun dev              # http://localhost:3000
```

### Environment variables

Create a `.env` in the project root:

```env
SP_DATABASE_URL="postgresql://user:password@host/db"          # pooled
SP_DATABASE_URL_UNPOOLED="postgresql://user:password@host/db" # direct, for migrations
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
```

Generate a secret with `openssl rand -base64 32`. Never commit `.env`.

## Commands

```bash
bun dev                  # dev server
bun run build            # production build
bun lint                 # ESLint
bunx tsc --noEmit        # typecheck

bun test                 # tests, watch mode
bun test:run             # tests, once
bun test:coverage        # with coverage

bun db:generate          # regenerate Prisma Client (required after schema changes)
bun db:push              # push schema without migrations
bun db:migrate           # create and run a migration
bun db:seed              # seed sample data
bun db:studio            # Prisma Studio

bun scripts/admin.ts create-admin <email> [name]   # create a Super Admin
bun scripts/admin.ts reset-password <email>
bun scripts/admin.ts list-admins
bun scripts/admin.ts db-stats
```

`bun run build` runs `prisma db push` first, so it needs a reachable database.
To verify compilation without one, run `bunx next build`.

## Roles

| Role | Prep program | Sunday School | Manages users |
|---|---|---|---|
| Super Admin | Full | Full, every class | All users |
| Priest | Full, read-only | Reads every class | None |
| Servants Prep Leader | Full | Only if personally assigned | Students, Mentors |
| Mentor | Own mentees, read-only | None | None |
| Student | Own data, read-only | None | None |
| Sunday School Servant | None | Only their assignments | None |

Sunday School authority comes from an **assignment**, not a role — which is how
one person can serve both sides. See [`docs/permissions.md`](docs/permissions.md).

## Graduation requirements

A student must meet all four:

1. **Attendance ≥ 75%** — `(present + lates/2) / (total_lessons - excused)`.
   Two lates equal one absence; excused lessons are excluded; exam days do not
   count.
2. **Overall exam average ≥ 75%** across all sections.
3. **At least 60%** in every individual section.
4. **Both Year 1 and Year 2** completed.

## Security notes

- All API routes are authenticated; authorization is enforced server-side on
  every request, never from client state
- Passwords hashed with bcrypt; sessions are JWT-based
- Guardian contact for children is restricted to that class's servants and to
  admins
- `.env` files and spreadsheet exports are gitignored — they may contain real
  personal data
- No personal data belongs in the repository, including in seed data

## Deployment

Deployed on Vercel. Set `SP_DATABASE_URL`, `SP_DATABASE_URL_UNPOOLED`,
`NEXTAUTH_URL`, and `NEXTAUTH_SECRET` in the project settings, then deploy.

`/api/health` verifies database connectivity after a deploy.

## Contributing

Read [`AGENTS.md`](AGENTS.md) first. Before committing:

```bash
bun db:generate    # only if prisma/schema.prisma changed
bunx tsc --noEmit
bun lint
bun test:run
```
