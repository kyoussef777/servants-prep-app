# Sunday School Production Migration Runbook

This runbook applies the Sunday School identity, permission, enrollment,
placement, guardian, import, rollover, feedback, visitation, and confidential
priest-note foundation. It does not remove Servants Prep legacy columns or
switch production authorization by itself.

## Safety rules

- Never run `prisma db push` against a shared database.
- Use the pooled URL for the application and the direct URL for migrations.
- Never place a production or branch connection string in a command committed
  to Git, logs, screenshots, or documentation.
- Rehearse on a fresh, auto-expiring Neon child branch created from current
  production immediately before the rehearsal.
- Production-derived branches contain private data. Do not connect them to a
  public preview deployment.
- Stop if any reconciliation query differs from the expected source count.
- Stop if the production host, project, database name, or migration history is
  not exactly the expected target.
- Do not run migrations automatically from a Vercel build. A person must run
  and verify the database deployment before merging or promoting the app.

## Checked-in migration history

- `prisma/migrations/0_init/migration.sql` describes the schema that already
  existed before Prisma Migrate was adopted.
- `0_init` is executed only for a brand-new empty database.
- Existing databases mark it applied with `prisma migrate resolve`.
- `20260915010000_sunday_school_foundation` is the additive feature migration.
- `20260919170000_repair_mentor_sunday_school_compatibility` repairs the
  role/assignment compatibility needed by users who serve in both ministries.
- `20260920160000_add_priest_confidential_visitation_notes` creates the private
  note table.
- `20260920170000_add_priest_note_notification` adds the priest-note alert type.
- `20260920180000_attach_priest_notes_to_visitations` makes every private note
  belong to one exact visitation.

The three private-note migrations must be deployed in the same uninterrupted
`prisma migrate deploy` run. The last migration assumes no application wrote
rows into the table created by the first migration. This is true for the first
production release because the live application does not know that table.

## Release artifacts

- Pull request: `https://github.com/kyoussef777/servants-prep-app/pull/15`
- Release branch: `feature/sunday-school-mode-ux`
- Migration directory: `prisma/migrations`
- Runtime database URL: pooled `SP_DATABASE_URL`
- Migration database URL: direct `SP_DATABASE_URL_UNPOOLED`

Do not put either URL in Git, Vercel build logs, screenshots, chat, or the
runbook. Credentials shared during development must be rotated before launch.

## Branch rehearsal

Export the branch URLs into the shell without printing them:

```bash
export SP_DATABASE_URL='<pooled branch URL>'
export SP_DATABASE_URL_UNPOOLED='<direct branch URL>'
```

Verify that the branch is the intended target before any write:

```bash
psql "$SP_DATABASE_URL_UNPOOLED" -X -Atc \
  'select current_database(), inet_server_addr(), count(*) from "User";'
```

Mark the baseline and deploy the additive migration:

```bash
bunx prisma migrate resolve --applied 0_init
bunx prisma migrate deploy
```

Confirm that the database and Prisma schema agree:

```bash
bunx prisma migrate diff \
  --from-url "$SP_DATABASE_URL_UNPOOLED" \
  --to-schema-datamodel prisma/schema.prisma \
  --exit-code
```

An empty diff is required.

The isolated production copy used for local development has already completed
all six checked-in migrations with an empty pending-migration list. Repeat the
rehearsal on a fresh production-derived Neon branch immediately before launch
so the rehearsal includes the latest production data and migration history.

## Reconciliation

```sql
select count(*) from "User";
select count(*) from "StudentEnrollment";
select count(*) from "StudentEnrollment" where "mentorId" is not null;
select count(*) from "MentorAssignment";
select count(*) from "MentorAssignment" where "endedAt" is null;
select count(*) from "SundaySchoolClass";
select count(*) from "SundaySchoolChild";
select count(*) from "SundaySchoolEnrollment";
select count(*) from "SundaySchoolClassPlacement" where "endedAt" is null;

select role, count(*)
from "User"
group by role
order by role;

select tag, count(*)
from "UserRoleAssignment"
where "revokedAt" is null
group by tag
order by tag;
```

The September 15, 2026 rehearsal source contained:

- 104 users
- 66 Servants Prep enrollments
- 60 legacy mentor links
- 52 active mentor assignments after excluding withdrawn enrollments
- 8 closed historical mentor assignments
- one existing Sunday School class
- no Sunday School children or placements

Counts are observations, not hard-coded application assumptions. Repeat the
source queries immediately before production deployment.

## Constraint smoke tests

Run these inside a transaction that is always rolled back:

```sql
begin;

-- A second active copy of a role grant must fail.
-- A second active mentor for an enrollment must fail.
-- A staff assignment with both or neither scope must fail.
-- A second open Sunday School year must fail.
-- An overlapping Sunday School year must fail.
-- A second active class placement must fail.

rollback;
```

Automated integration tests should create valid fixture rows, assert each
constraint violation, and roll back rather than relying on hand-written IDs.

## Production gate

Production deployment requires all of the following:

1. Database and Blob credentials previously shared during planning are rotated.
2. Vercel runtime variables are updated by the project owner.
3. The web runtime uses a restricted role; the migration owner is not used by
   the application.
4. A fresh Neon branch rehearsal passes with an empty schema diff.
5. Application tests, typechecking, linting, and the production build pass.
6. A restore point is available and the rollback procedure has been rehearsed.
7. Backfill counts are reconciled and signed off.

## Production preflight

Export the production URLs in the operator's shell without printing them, then
confirm the target through the direct connection:

```bash
psql "$SP_DATABASE_URL_UNPOOLED" -X -Atc \
  'select current_database(), current_user, inet_server_addr();'
```

Record the current application release and create a Neon restore point (or
confirm the project's point-in-time restore window). Then inspect migration
history without changing it:

```sql
select to_regclass('public._prisma_migrations');

select migration_name, finished_at, rolled_back_at
from "_prisma_migrations"
order by started_at;
```

If `_prisma_migrations` does not exist on the existing production database,
confirm that its schema is the pre-Sunday-School baseline and run the baseline
command exactly once:

```bash
bunx prisma migrate resolve --applied 0_init
```

If `20260920160000_add_priest_confidential_visitation_notes` is already marked
applied while `20260920180000_attach_priest_notes_to_visitations` is not, stop.
Count the intermediate table's rows before continuing:

```sql
select count(*) from "SundaySchoolPriestNote";
```

A nonzero result requires a bespoke backfill and must not use the checked-in
`20260920180000` migration unchanged.

## Production execution

Keep the currently deployed app online; it does not reference the new Sunday
School tables. From the reviewed release commit, run:

```bash
bunx prisma migrate status
bunx prisma migrate deploy
bunx prisma migrate status
```

The final status must report that the database schema is up to date. Verify the
confidential-note shape before merging or promoting the application:

```sql
select column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'SundaySchoolPriestNote'
order by ordinal_position;

select e.enumlabel
from pg_type t
join pg_enum e on e.enumtypid = t.oid
where t.typname = 'NotificationType'
order by e.enumsortorder;
```

`visitationId` must exist and be non-nullable, `childId` must not exist, and
`PRIEST_NOTE_CREATED` must be present. Only then merge PR 15 and promote the
resulting `main` deployment.

## Post-deploy smoke tests

Use non-production personal information or dedicated test records:

1. Sign in as a Super Admin and verify multi-tag user editing and View As.
2. Verify a Sunday School servant sees only assigned class/age-group scope.
3. Open a child, save a visitation without a private note, and verify it works.
4. Save a second visitation with a private note.
5. Verify the author can see that note after saving.
6. Verify another non-priest servant cannot see the note.
7. Verify an active Priest-tagged user can see it and receives a generic alert.
8. Verify the alert and shared visitation response contain no private text or
   child-identifying details.
9. Verify Servants Prep login, students, attendance, exams, and mentor dashboard
   still load.

Monitor Vercel errors, authentication failures, and Neon query/error metrics
through the observation window before declaring the release complete.

## Rollback

- If migration deployment fails, do not merge the PR. Save the error and
  migration status, then repair forward on a branch before retrying.
- If the application fails after a successful database migration, immediately
  roll back the Vercel deployment to the previous `main` release. The previous
  app ignores the additive tables, so the migrated database can remain in place
  while the application fix is prepared.
- Do not manually delete new tables, enum values, or migration-history rows.
- If data integrity is affected, stop writes and restore through Neon's restore
  workflow under the project owner's supervision.

Legacy columns are removed only in a later contract migration after an
observation period.
