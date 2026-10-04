# Lesson Scheduler - Technical Design

**Status:** Active development
**Target:** Web application, mobile-first (80% mobile / 20% desktop)
**Deployment target:** $0 operating cost for MVP
**Primary goal:** Provide a simple, reliable, and fast application for managing students, lesson times, and recurring/one-off lesson schedules.

---

## 1. Product Overview

Lesson Scheduler is a web application for managing tutoring/lesson operations.

Core capabilities:

- User authentication
- Role-based access control
- Student management
- Teacher management
- Subject management
- Lesson-time management
- Daily/weekly/monthly schedule views
- One-off lesson scheduling
- Recurring lesson scheduling
- Reschedule/cancel lesson handling
- Mobile-first UX
- PWA support
- Future reminder/notification support

The application is intentionally designed as a **modular web application**, not microservices. The initial workload does not justify the operational complexity of distributed services.

---

## 2. Goals

### 2.1 Functional goals

1. Users can log in securely.
2. Authorized users can maintain students, teachers, subjects, and lesson times.
3. Authorized users can create and maintain schedules.
4. The system supports recurring schedules.
5. The system supports schedule exceptions such as cancellation and rescheduling.
6. The system prevents schedule conflicts.
7. The application works well on mobile and desktop.
8. The application can be deployed with a $0 infrastructure budget for the MVP.
9. The architecture remains portable enough to migrate away from managed services later.

### 2.2 Non-functional goals

- Mobile-first responsive UI
- Secure by default
- RBAC enforced on the backend/data layer
- Database-level authorization with Row Level Security (RLS)
- Low operational overhead
- Good Core Web Vitals
- Clear separation between UI, data access, and domain logic
- Automated deployment from Git
- Database migrations stored in source control

---

## 3. Non-Goals for MVP

The following should not be implemented in the first iteration unless a real requirement appears:

- Native Android application
- Native iOS application
- Microservice architecture
- Kubernetes
- Dedicated Redis cluster
- Complex event-driven architecture
- Advanced analytics/data warehouse
- Payment processing
- SMS integration
- WhatsApp integration
- Complex notification orchestration
- Offline-first synchronization of the entire database

These can be introduced later without invalidating the core architecture.

---

# 4. Architecture Decision

## 4.1 Recommended architecture

```text
                    +----------------------+
                    |     Mobile/Desktop   |
                    |        Browser       |
                    +----------+-----------+
                               |
                             HTTPS
                               |
                    +----------v-----------+
                    |   Cloudflare Pages   |
                    |                      |
                    | React + TypeScript   |
                    | Vite                 |
                    | Tailwind CSS         |
                    | shadcn/ui            |
                    | TanStack Query       |
                    | React Hook Form      |
                    | Zod                  |
                    | FullCalendar         |
                    | PWA                  |
                    +----------+-----------+
                               |
                          Supabase SDK
                               |
                  +------------v-------------+
                  |         Supabase         |
                  |                          |
                  | PostgreSQL               |
                  | Auth                     |
                  | Row Level Security       |
                  | Storage                  |
                  | Edge Functions (optional)|
                  +--------------------------+
```

## 4.2 Why not Spring Boot for the MVP?

Spring Boot remains a valid future architecture, especially when domain/business logic becomes significantly more complex.

For a strict $0 deployment target, however, a managed backend is operationally simpler:

```text
MVP
React -> Supabase

Future, if required
React -> Spring Boot -> PostgreSQL
```

The application should therefore avoid coupling business behavior so tightly to Supabase that migration becomes impossible.

---

# 5. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React | UI application |
| Language | TypeScript | Static typing |
| Build | Vite | Fast development/build tooling |
| Styling | Tailwind CSS | Responsive/mobile-first styling |
| UI components | shadcn/ui | Reusable accessible components |
| Server state | TanStack Query | API/data fetching, caching, mutation |
| Forms | React Hook Form | Form state |
| Validation | Zod | Runtime/schema validation |
| Calendar | FullCalendar | Calendar/time-grid/drag-drop UI |
| Backend platform | Supabase | Managed backend platform |
| Database | PostgreSQL | Relational data store |
| Authentication | Supabase Auth | Identity/authentication |
| Authorization | PostgreSQL RLS | Data-level access control |
| File storage | Supabase Storage | Optional attachments |
| Server-side functions | Supabase Edge Functions | Optional background/server logic |
| Hosting | Cloudflare Pages | Static frontend hosting |
| Source control | GitHub | Repository and CI/CD source |
| PWA | Web App Manifest + Service Worker | Installable web app |

---

# 6. Frontend Architecture

## 6.1 Project structure

```text
frontend/
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── students/
│   │   ├── teachers/
│   │   ├── subjects/
│   │   ├── lesson-times/
│   │   └── schedules/
│   ├── hooks/
│   ├── lib/
│   ├── services/
│   ├── types/
│   └── routes/
├── public/
└── package.json
```

Use feature-oriented organization. Avoid a large global `services/`, `utils/`, or `components/` folder becoming a dumping ground.

## 6.2 State management

Use TanStack Query for server state:

- Fetching
- Caching
- Refetching
- Mutation state
- Optimistic UI where appropriate

Do not introduce Redux unless a concrete client-only state requirement justifies it.

Client-only state should remain local or use small purpose-built stores only when necessary.

## 6.3 Forms

Use:

```text
React Hook Form
       +
      Zod
```

Validation should exist in the UI for UX, but important validation/security must also exist at the data/backend layer.

---

# 7. Mobile-First UX

The application should be designed for mobile first and enhanced for desktop.

## 7.1 Mobile navigation

Recommended navigation:

```text
+-------------------------+
| Lesson Scheduler        |
+-------------------------+
| Today's Schedule        |
|                         |
| 09:00  Budi             |
|        Mathematics      |
|                         |
| 11:00  Sinta            |
|        English          |
|                         |
| 19:00  Andi             |
|        Physics          |
|                         |
|                   [+]   |
+-------------------------+
| Home | Calendar | More  |
+-------------------------+
```

Desktop may use a sidebar and a wider calendar.

## 7.2 UX principles

- One-handed interaction where practical
- Large touch targets
- Minimal form fields per screen
- Bottom navigation on mobile
- Floating/add button for schedule creation
- Avoid dense desktop-only tables on mobile
- Calendar can switch between agenda/day/week depending on viewport
- Loading states should preserve layout to reduce visual shift

---

# 8. Domain Model

The scheduling model should separate **recurring schedule definition** from **actual lesson occurrence**.

This is one of the most important architecture decisions in the application.

## 8.1 Core entities

```text
User/Profile
Teacher
Student
Subject
LessonTime
ScheduleSeries
ScheduleOccurrence
ScheduleException
AuditLog
```

## 8.2 Relationships

```text
profiles
   |
   +---- teachers
   |
   +---- role

students
   |
   +---- schedule_series

teachers
   |
   +---- schedule_series

subjects
   |
   +---- schedule_series

lesson_times
   |
   +---- schedule_series

schedule_series
   |
   +---- schedule_occurrences
   |
   +---- schedule_exceptions
```

---

# 9. Data Model

## 9.1 profiles

```text
id              UUID PK, references auth.users
full_name       TEXT
role            TEXT/ENUM
active          BOOLEAN
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

## 9.2 students

```text
id              BIGINT/UUID PK
name            TEXT NOT NULL
phone           TEXT
email           TEXT
birth_date      DATE
address         TEXT
status          TEXT
notes           TEXT
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

## 9.3 teachers

```text
id              BIGINT/UUID PK
profile_id      UUID nullable/unique where applicable
name            TEXT NOT NULL
phone           TEXT
email           TEXT
status          TEXT
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

## 9.4 subjects

```text
id              BIGINT/UUID PK
name            TEXT NOT NULL UNIQUE
active          BOOLEAN
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

## 9.5 lesson_times

A lesson time is a reusable definition of a standard time slot.

```text
id              BIGINT/UUID PK
name            TEXT NOT NULL
start_time      TIME NOT NULL
end_time        TIME NOT NULL
duration_min    INTEGER
active          BOOLEAN
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

Examples:

```text
Morning 1       08:00 - 09:00
Morning 2       09:00 - 10:00
Afternoon 1     14:00 - 15:00
Evening 1       19:00 - 20:00
Evening 2       20:00 - 21:00
```

## 9.6 schedule_series

Defines a recurring or schedule template.

```text
id                  BIGINT/UUID PK
student_id          FK students
teacher_id          FK teachers
subject_id          FK subjects
lesson_time_id      FK lesson_times
recurrence_type     TEXT/ENUM
day_of_week         INTEGER
start_date          DATE
end_date            DATE nullable
status              TEXT
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

For MVP, recurrence can begin with weekly schedules.

## 9.7 schedule_occurrences

Represents the actual scheduled lesson instance.

```text
id                  BIGINT/UUID PK
series_id           FK schedule_series nullable
student_id          FK students
teacher_id          FK teachers
subject_id          FK subjects
lesson_date         DATE
start_time          TIME
end_time            TIME
status              TEXT
notes               TEXT
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

Occurrence data should be treated as the authoritative operational record for an actual lesson.

## 9.8 schedule_exceptions

Represents deviations from a recurrence.

```text
id                  BIGINT/UUID PK
series_id           FK schedule_series
original_date       DATE
type                TEXT
replacement_date    DATE nullable
replacement_start   TIME nullable
replacement_end     TIME nullable
reason              TEXT
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

Example types:

```text
CANCELLED
RESCHEDULED
REPLACEMENT
SKIPPED
```

## 9.9 audit_logs

Keep a minimal audit trail for important changes.

```text
id                  BIGINT/UUID PK
actor_user_id       UUID
entity_type         TEXT
entity_id           TEXT
action              TEXT
old_data            JSONB nullable
new_data            JSONB nullable
created_at          TIMESTAMPTZ
```

---

# 10. Scheduling Rules

Scheduling is the highest-risk domain area and should receive explicit rules.

## 10.1 Conflict detection

At minimum, prevent overlapping schedules for the same teacher and student.

For intervals `A` and `B`, an overlap exists when:

```text
A.start < B.end
AND
B.start < A.end
```

The rule must be enforced beyond frontend validation.

Recommended layers:

```text
Frontend validation
       |
       v
RPC / server-side validation
       |
       v
Database constraints/transaction strategy
```

This protects against concurrent writes from multiple clients.

## 10.2 Recurring schedule

A recurring schedule should support:

- Start date
- Optional end date
- Day of week
- Lesson time
- Student
- Teacher
- Subject

The first MVP implementation may support weekly recurrence only.

## 10.3 Rescheduling

Rescheduling one occurrence must not silently modify the entire series.

Example:

```text
Normal:
Every Monday 19:00

Exception:
2026-10-12 -> Monday 20:00
```

The exception applies only to the selected occurrence.

## 10.4 Cancellation

Cancellation should operate on an occurrence unless the user explicitly requests series cancellation.

---

# 11. API / Data Access Strategy

For the MVP, the frontend may use Supabase directly through the Supabase client for standard CRUD.

Example:

```typescript
const { data, error } = await supabase
  .from('students')
  .select('*')
  .order('name');
```

Prefer database views/RPC functions for operations where domain rules are too complex for direct CRUD.

Examples:

```text
create_schedule()
reschedule_occurrence()
cancel_occurrence()
get_calendar_events()
```

This avoids moving complicated authorization and scheduling rules entirely into browser code.

---

# 12. Authentication and Authorization

## 12.1 Authentication

MVP authentication:

```text
Email + Password
```

Potential future options:

- Google login
- Apple login
- Magic link
- Enterprise SSO

Do not add these until there is an actual requirement.

## 12.2 RBAC

Recommended roles:

### ADMIN

- Manage users
- Manage teachers
- Manage students
- Manage subjects
- Manage lesson times
- Manage schedules
- View all data

### STAFF

- Manage students
- Manage schedules
- View lesson times
- View operational data

### TEACHER

- View own schedules
- View assigned students
- Update lesson status

Role names and capabilities should be centralized rather than scattered throughout frontend code.

---

# 13. Row Level Security (RLS)

RLS is a mandatory security boundary.

Rules should follow the principle:

```text
Authenticated user
        |
        v
       Role
        |
        v
Allowed operation
        |
        v
Allowed rows only
```

Examples:

```text
ADMIN
  -> all relevant rows

STAFF
  -> operational rows

TEACHER
  -> assigned schedules/students only
```

Important:

- Enable RLS on all exposed application tables.
- Do not expose `service_role` credentials to the browser.
- Never rely only on hidden/disabled frontend buttons for security.
- Test negative access scenarios explicitly.

---

# 14. Security Requirements

## Required

- HTTPS only
- Secure authentication
- RLS on all exposed tables
- Input validation
- Strong database constraints
- No secret keys in frontend code except publishable/client-safe credentials
- No service-role key in browser bundles
- Least privilege for database access
- Audit logging for sensitive operations
- Secure password recovery flow
- Rate limiting where appropriate

## Secret management

Frontend may contain only public/client-safe configuration such as the Supabase URL and publishable/anonymous client key where applicable.

Secrets for privileged operations must exist only in server-side/Edge Function environments.

---

# 15. Performance Requirements

## 15.1 Initial targets

```text
LCP < 2.5s
INP < 200ms
CLS < 0.1
```

Targets are especially important on mobile networks and low-end devices.

## 15.2 Query strategy

Calendar queries must be range-based.

Good:

```text
WHERE lesson_date BETWEEN :from AND :to
```

Avoid:

```text
SELECT all schedules for all dates
```

## 15.3 Indexes

At minimum consider indexes for:

```text
schedule_occurrences(lesson_date)
schedule_occurrences(teacher_id, lesson_date)
schedule_occurrences(student_id, lesson_date)
schedule_series(student_id)
schedule_series(teacher_id)
```

Final indexes should be driven by actual query patterns and query plans.

---

# 16. PWA

The application should be installable as a PWA.

Required MVP pieces:

- Web App Manifest
- App icon
- Theme metadata
- Service worker
- Cache application shell
- Installability

Offline behavior should initially be limited to application-shell caching rather than full data synchronization.

The app must clearly communicate when live data is unavailable.

---

# 17. Notification Strategy

Notifications are intentionally deferred until scheduling is stable.

Future implementation:

```text
Schedule occurrence
       |
       v
Notification job/function
       |
       v
Web Push
       |
       v
Mobile browser/PWA
```

Potential notification types:

- Upcoming lesson reminder
- Schedule changed
- Lesson cancelled
- Lesson rescheduled

Avoid building a complex notification engine in MVP.

---

# 18. Deployment Architecture

```text
Developer
   |
   v
GitHub
   |
   +----------------------+
   |                      |
   v                      v
Cloudflare Pages       Supabase
   |                      |
   |                      +-- PostgreSQL
   |                      +-- Auth
   |                      +-- RLS
   |                      +-- Storage
   |                      +-- Edge Functions
   |
   v
Public HTTPS URL
```

## 18.1 Deployment strategy

- `main` = production
- Pull requests = preview deployments
- GitHub is the source of truth
- Database schema changes are committed as migrations
- Production database changes must be migration-based

## 18.2 Domain

MVP can use a platform-provided domain.

Custom domain can be added later if a free domain is available/owned by the project.

---

# 19. Repository Structure

Recommended monorepo:

```text
lesson-scheduler/
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── supabase/
│   ├── migrations/
│   ├── functions/
│   ├── seed.sql
│   └── config.toml
│
├── docs/
│   └── architecture/
│
├── DESIGN.md
├── README.md
├── .gitignore
└── package.json
```

The database schema must always be reconstructable from repository migrations.

---

# 20. Development Roadmap

## Phase 0 - Product & Architecture

### Deliverables

- User stories
- Wireframes
- ERD
- Role matrix
- Scheduling rules
- RLS strategy
- Initial repository

### Exit criteria

The team can explain the schedule lifecycle without ambiguity.

---

## Phase 1 - Foundation

### Build

- React + TypeScript + Vite
- Tailwind CSS
- shadcn/ui
- Supabase project
- Environment configuration
- GitHub repository
- Cloudflare Pages

### Exit criteria

A blank application is automatically deployed from GitHub.

---

## Phase 2 - Authentication & RBAC

### Build

- Login
- Logout
- Password recovery
- Profile
- Roles
- Initial RLS policies

### Exit criteria

Unauthorized users cannot read or mutate protected data.

---

## Phase 3 - Master Data

### Build

- Student CRUD
- Teacher CRUD
- Subject CRUD
- Lesson Time CRUD

### Exit criteria

All master-data workflows are usable on mobile and desktop.

---

## Phase 4 - Scheduling Engine

### Build

- Day view
- Week view
- Month view
- Create schedule
- Edit schedule
- Cancel schedule
- Recurring schedule
- Exceptions
- Conflict checking

### Exit criteria

The system can correctly represent normal, recurring, cancelled, and rescheduled lessons.

---

## Phase 5 - Dashboard & UX Polish

### Build

- Today's schedule
- Upcoming schedule
- Quick-add schedule
- Mobile navigation
- Loading/empty/error states
- Search/filter

### Exit criteria

Daily workflow can be completed comfortably from a mobile phone.

---

## Phase 6 - PWA

### Build

- Web manifest
- Service worker
- Install prompt
- App icons
- Application-shell caching

### Exit criteria

The application is installable on supported mobile browsers.

---

## Phase 7 - Notifications

Optional after MVP.

### Build

- Web push subscription
- Reminder scheduling
- Schedule-change notifications

### Exit criteria

Users receive reminders only for relevant schedules and can disable them.

---

## Phase 8 - Production Hardening

### Build

- Security review
- RLS review
- Performance review
- Database indexing review
- Error logging
- Audit logs
- Backup/export strategy
- Disaster recovery notes

### Exit criteria

The application is ready for broader public use.

---

# 21. Testing Strategy

## Unit tests

Test pure business rules such as:

- Time overlap
- Recurrence generation
- Schedule status transition
- Exception handling

## Integration tests

Test:

- Database constraints
- RPC functions
- RLS policies
- Authentication flows

## End-to-end tests

Critical scenarios:

1. Login
2. Create student
3. Create lesson time
4. Create schedule
5. Create recurring schedule
6. Cancel one occurrence
7. Reschedule one occurrence
8. Reject schedule conflict
9. Verify role restrictions

Recommended future tooling:

```text
Vitest
Playwright
Supabase local development
```

---

# 22. Observability

MVP should at least provide:

- Browser error tracking/logging
- Supabase logs
- Function logs where Edge Functions exist
- Basic audit logs for important actions

Future:

- Centralized error tracking
- Performance monitoring
- Availability monitoring
- Business metrics

---

# 23. Cost Strategy

The intended MVP target is **$0 recurring infrastructure cost** using free-tier offerings.

Expected services:

```text
GitHub             $0
Cloudflare Pages   $0
Supabase           $0
```

Important: free-tier limits and platform policies can change. Exact quotas and eligibility must be verified against the current provider documentation before production launch.

The application should therefore:

- Avoid unnecessary storage
- Keep database queries efficient
- Avoid large media files
- Avoid background jobs unless needed
- Monitor usage before hitting free-tier limits
- Keep the database schema portable

---

# 24. Portability / Future Migration

The application should not make Supabase impossible to replace.

## Current

```text
React
  |
  +---- Supabase Auth
  |
  +---- PostgreSQL
  |
  +---- RLS
```

## Possible future

```text
React
  |
  v
Spring Boot API
  |
  +---- PostgreSQL
  +---- Redis (optional)
  +---- Spring Security
```

If migration becomes necessary, the likely changes are concentrated in:

- Authentication integration
- Data-access layer
- API boundary
- Authorization implementation
- Server-side business logic

The domain model and database structure should remain broadly reusable.

---

# 25. Decision Log

## ADR-001: Use managed backend for MVP

**Decision:** Supabase instead of self-hosted Spring Boot.

**Reason:** Lowest operational overhead for a $0 deployment target while still providing PostgreSQL, authentication, authorization primitives, storage, and server-side functions.

**Revisit when:**

- Complex business rules require a dedicated service layer
- Provider limitations become a problem
- Enterprise integration is required
- Background processing becomes substantial
- Traffic or security requirements justify dedicated infrastructure

## ADR-002: Mobile-first responsive web app

**Decision:** Responsive PWA instead of native apps.

**Reason:** The product is primarily a scheduling/business tool. A single web codebase minimizes development and deployment cost.

## ADR-003: No microservices

**Decision:** Modular monolith architecture.

**Reason:** The domain is initially small. Operational complexity of microservices would provide little value.

## ADR-004: Separate recurring schedule from actual occurrence

**Decision:** Use `schedule_series`, `schedule_occurrences`, and `schedule_exceptions`.

**Reason:** Prevents recurring schedule logic from becoming tangled with one-off changes, cancellations, and rescheduling.

---

# 26. MVP Definition of Done

The MVP is complete when all of the following are true:

- [ ] User can log in and log out
- [ ] User roles are enforced
- [ ] Students can be maintained
- [ ] Teachers can be maintained
- [ ] Subjects can be maintained
- [ ] Lesson times can be maintained
- [ ] A lesson can be scheduled
- [ ] Recurring lessons are supported
- [ ] A single lesson can be cancelled
- [ ] A single lesson can be rescheduled
- [ ] Scheduling conflicts are rejected
- [ ] Daily schedule works on mobile
- [ ] Weekly/monthly calendar works on desktop
- [ ] RLS policies cover all application tables
- [ ] No privileged secret is exposed to the browser
- [ ] Database migrations are stored in Git
- [ ] Application is deployed publicly over HTTPS
- [ ] Application is installable as a PWA
- [ ] Basic automated tests exist for scheduling rules
- [ ] Lighthouse/Core Web Vitals targets are reviewed

---

# 27. Recommended Build Order

Do not start by building every page.

Build in this order:

```text
1. ERD
2. Database migrations
3. RLS + RBAC
4. Authentication
5. Student / Teacher / Subject / Lesson Time
6. Schedule data model
7. Conflict detection
8. Schedule CRUD
9. Recurring schedule
10. Reschedule / cancellation
11. Mobile dashboard
12. Desktop calendar
13. PWA
14. Notifications
15. Production hardening
```

The scheduling data model and authorization rules are the foundation. UI polish should come after those two pieces are stable.

---

# 28. Future Features

Potential future additions:

- Attendance
- Student notes/history
- Teacher availability
- Room/location management
- Payment tracking
- Parent accounts
- Parent portal
- Online lesson links
- Reports
- Export to Excel/CSV
- Calendar synchronization
- Google Calendar integration
- WhatsApp notification integration
- Push notifications
- Analytics
- Subscription/billing

These should be added only after the MVP scheduling workflow is stable.

---

# 29. Summary

The recommended MVP architecture is:

```text
React
+ TypeScript
+ Vite
+ Tailwind CSS
+ shadcn/ui
+ TanStack Query
+ React Hook Form
+ Zod
+ FullCalendar
+ PWA
        |
        v
Supabase
+ PostgreSQL
+ Auth
+ RLS
+ Storage
+ Edge Functions (optional)
        |
        v
Cloudflare Pages
        |
        v
Public HTTPS Web App
```

The design prioritizes:

1. **$0 infrastructure cost for the MVP**
2. **Mobile-first usability**
3. **Strong authorization using RBAC + RLS**
4. **Correct scheduling semantics**
5. **Simple operations and deployment**
6. **A path to Spring Boot later if complexity justifies it**

The next technical milestone should be the complete **ERD + Supabase SQL migrations + RLS policies**, with special attention to `schedule_series`, `schedule_occurrences`, `schedule_exceptions`, and conflict prevention.

---

# 18. Implementation Status

## Phase 1 - Foundation

Completed:

- React + TypeScript + Vite project skeleton
- Supabase client integration
- Authentication and protected routes
- Profiles and RBAC model
- PostgreSQL RLS baseline
- Student CRUD
- Lesson Time CRUD
- PWA manifest
- Responsive application shell

## Phase 2 - Scheduling

Completed:

- Teacher CRUD with optional profile linking
- FullCalendar React v7 integration
- Mobile `listWeek` default and desktop `timeGridWeek` default
- One-off schedule creation
- Weekly recurring schedule materialization
- Student/teacher overlap protection using PostgreSQL transaction advisory locks
- Staff/admin reschedule and status management
- Teacher status-only update
- Admin-only occurrence deletion
- Live dashboard counts for students, teachers, lesson times, and today's lessons

Deferred to the next increment:

- Subject CRUD UI
- Calendar drag/drop editing
- Recurring-series edit/cancel UX
- Notifications/reminders
- Automated tests against a real Supabase/PostgreSQL environment

## 19. Scheduling Security Rules

The frontend is never treated as the authorization boundary.

Schedule mutation rules:

| Operation | ADMIN | STAFF | TEACHER |
|---|---:|---:|---:|
| Create schedule | Yes | Yes | No |
| Reschedule | Yes | Yes | No |
| Cancel occurrence | Yes | Yes via status | No |
| Delete occurrence | Yes | No | No |
| Update lesson status | Yes | Yes | Yes, assigned lessons only |
| View assigned lessons | Yes | Yes | Yes |

Conflict checks are executed in PostgreSQL rather than relying on client-side JavaScript validation.


---

---

# 20. Local Development Workflow

The repository supports a fully local Supabase development environment in addition to the hosted Supabase deployment target.

## 20.1 Repository-managed local stack

```text
Git repository
   |
   +-- supabase/config.toml
   +-- supabase/migrations/
   +-- supabase/seed.sql
   |
   +-- Supabase CLI
           |
           v
     Local Supabase stack
       - PostgreSQL
       - Auth
       - REST API
       - Studio
       - Storage
```

The local stack is intended for development and testing. It must not be exposed publicly.

## 20.2 Reproducibility

A clean local database is reproducible with:

```bash
npm run db:start
npm run db:reset
npm run db:env
```

`db:reset` applies every migration in order and then applies `supabase/seed.sql`.

## 20.3 Secrets

The frontend receives only the local API URL and browser-safe publishable/anon key. The Supabase service-role/secret key is never written to `frontend/.env.local`.

Local configuration is safe to commit when it contains no secrets. Machine-specific state and environment files remain ignored by Git.
