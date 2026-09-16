# Sunday School Foundation Migration Runbook

This runbook applies the additive identity, permission, enrollment, placement,
guardian, import, rollover, and audit foundation. It does not remove legacy
columns and does not switch production authorization by itself.

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

## Checked-in migration history

- `prisma/migrations/0_init/migration.sql` describes the schema that already
  existed before Prisma Migrate was adopted.
- `0_init` is executed only for a brand-new empty database.
- Existing databases mark it applied with `prisma migrate resolve`.
- `20260915010000_sunday_school_foundation` is the additive feature migration.

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

Only then run `prisma migrate resolve --applied 0_init` once on production,
followed by `prisma migrate deploy`. The application cutover remains a separate,
reversible deployment. Legacy columns are removed only in a later contract
migration after an observation period.
