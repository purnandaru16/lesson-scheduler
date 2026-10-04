# Phase 2 - Schedule Module

## Scope completed

### Master data
- Added Teacher CRUD.
- Teacher records can optionally link to a profile, enabling teacher-specific RLS.

### Scheduling
- Added FullCalendar React integration using the current v7 package layout.
- Mobile starts in `listWeek`; desktop starts in `timeGridWeek`.
- Calendar also exposes month/day/list views.
- Added one-off and weekly schedule creation.
- Weekly plans are materialized into `schedule_occurrences` for a bounded date range.
- Added server-side conflict protection for teacher and student overlaps.
- Added staff/admin reschedule and status update.
- Added teacher status-only update.
- Added admin-only occurrence deletion.

### Security
- RLS remains the primary authorization boundary.
- Teacher UI and RPC behavior prevent cancellation/deletion/rescheduling by a teacher.
- Schedule creation validates active student, teacher, subject, and lesson time.

## Known limitations

- Subject CRUD is not yet exposed in the UI; initial subjects are seeded by migration.
- Recurring schedules currently materialize their occurrences only until the selected end date.
- Schedule exceptions UI (cancel one occurrence, make-up, replacement) is planned for the next scheduling increment.
- Drag/drop calendar editing is intentionally deferred until exception semantics are implemented.
