# Phase 3 - Schedule Exception Engine

## Implemented

- Cancel a single lesson occurrence without modifying the recurring series.
- Reschedule a single occurrence to a different date/time.
- Create a make-up occurrence from an existing lesson.
- Replace the teacher for one occurrence.
- Persist every operational exception in `schedule_exceptions`.
- Persist mutation history in `audit_logs`.
- Keep conflict detection server-side and transaction-safe.
- Prevent teachers from changing timing, ownership, cancellation, deletion, or replacement.
- Extend generic staff schedule edits so date/time changes also create a `RESCHEDULED` exception record.

## Exception semantics

```text
Recurring series
      |
      +-- normal occurrence
      |
      +-- CANCELLED      -> original occurrence stays in series, status changes
      +-- RESCHEDULED    -> same occurrence moves to a new date/time
      +-- MAKEUP         -> original occurrence may be cancelled + new occurrence is created
      +-- REPLACEMENT    -> same occurrence keeps date/time but teacher changes
```

The recurring series remains the source of the normal weekly pattern. Exceptions are operational overrides for individual occurrences.

## Security model

All exception RPCs require `STAFF` or `ADMIN` and are exposed only through authenticated execution grants.

- `cancel_schedule_occurrence`
- `reschedule_schedule_occurrence`
- `replace_schedule_teacher`
- `create_makeup_schedule_occurrence`

Teachers can still use `update_lesson_status` for `SCHEDULED`, `COMPLETED`, or `NO_SHOW` only on their assigned lessons.

## Next increment

- Calendar drag/drop should call the reschedule RPC rather than directly mutating rows.
- Add exception history in the lesson detail view.
- Add a dedicated Subject CRUD screen.
- Add recurrence-series management and future occurrence generation/roll-forward.
- Add reminder/notification foundation only after schedule behavior is stable.

## Migration order

The `MAKEUP` enum value is deliberately added in its own migration before the exception RPC migration. Apply migrations in filename order.
