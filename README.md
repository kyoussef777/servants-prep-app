# Servants Preparation Program

A web-based application for managing a 2-year Coptic church servants preparation program, tracking attendance, exams, and student progress with role-based access control.

## Features

- **Role-Based Access Control**: Priest, Servant, and Student roles with specific permissions
- **Academic Year Management**: Track multiple academic years with enrollment management
- **Lesson Scheduling**: Weekly Friday lessons (7:00 PM EST) with curriculum planning
- **Attendance Tracking**: Mark students as Present, Late, or Absent with automatic calculations
- **Exam Management**: Five exam sections (Bible, Dogma, Church History, Comparative Theology, Sacraments)
- **Graduation Requirements**: Real-time validation of 75% attendance and exam requirements
- **Mentor-Student System**: Each student assigned to a servant mentor for guidance
- **Analytics Dashboard**: Track student progress, at-risk students, and graduation eligibility

## Tech Stack

- **Frontend**: Next.js 14+, React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes (serverless)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with JWT sessions

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Create a `.env` file in the root directory:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/servants_prep?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-change-this-in-production"
```

Generate a secure secret for `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

### 3. Set up the database

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push

# Seed the database with sample data
npm run db:seed
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.


## User Roles & Permissions

### Priest
- Full access to all features
- Manage users, academic years, and enrollments
- Assign mentors to students
- View all analytics and reports
- Manage curriculum and lessons

### Servant/Teacher
- Take attendance for lessons
- Enter and edit exam scores
- View assigned mentees and their progress
- Create and manage lessons
- Access class-wide analytics

### Student
- Read-only access to own data
- View attendance and exam scores
- Track graduation progress
- See assigned mentor information
- View upcoming lessons

## Graduation Requirements

Students must meet the following requirements to graduate:

1. **Attendance**: ≥75% attendance rate
   - Formula: (Present + (Lates / 2)) / Total Lessons
   - 2 lates automatically count as 1 absence

2. **Exam Performance**:
   - Overall average across all 5 sections: ≥75%
   - Minimum score in each section: ≥60%

3. **Completion**: Complete both Year 1 AND Year 2

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Database commands
npm run db:generate    # Generate Prisma Client
npm run db:push        # Push schema changes to database
npm run db:migrate     # Create and run migrations
npm run db:seed        # Seed database with sample data
npm run db:studio      # Open Prisma Studio (database GUI)

# Linting
npm run lint
```

## Security Best Practices

### Environment Variables
- **Never commit `.env` files** to version control
- Always use `.env.example` as a template with placeholder values
- Generate strong secrets: `openssl rand -base64 32`
- Use different secrets for development and production

### Database
- Use connection pooling in production (e.g., Supabase pgBouncer)
- Set up database backups
- Use read replicas for analytics if needed
- Never expose database credentials in client-side code

### Authentication
- All API routes are protected with `requireAuth()` helper
- Role-based access control enforced at API level
- Passwords are hashed with bcrypt (10 rounds)
- Session-based authentication with NextAuth.js

### Data Privacy
- Test/seed data uses generic emails (e.g., priest@church.com)
- Excel/CSV files are excluded from git (may contain real data)
- No personally identifiable information (PII) in codebase

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project to Vercel
3. Set environment variables in Vercel dashboard:
   - `DATABASE_URL` - Your production database connection string
   - `DIRECT_URL` - Direct database connection (for migrations)
   - `NEXTAUTH_URL` - Your production URL (e.g., https://yourapp.vercel.app)
   - `NEXTAUTH_SECRET` - Generate a new secret for production
4. Deploy

### Database Hosting

- **Supabase** (Recommended): Free tier available with PostgreSQL + connection pooling
- **Vercel Postgres**: Built-in PostgreSQL for Vercel projects
- **Railway**: Easy PostgreSQL hosting

## Project Structure

```
servants-prep-app/
├── app/
│   ├── api/              # API routes
│   ├── dashboard/        # Dashboard pages
│   ├── login/            # Login page
│   └── layout.tsx        # Root layout
├── components/ui/        # shadcn/ui components
├── lib/                  # Utilities and configurations
├── prisma/               # Database schema and seeds
└── types/                # TypeScript type definitions
```
