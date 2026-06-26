# Phase 3 Manual QA Notes

## What Was Tested

- `npm run build` completed successfully.
- TypeScript accepted the Phase 3 filter, subtask, due-date, and compact editing changes.
- `git diff --check` completed successfully.
- Vite dev server started successfully on localhost; the sandboxed curl check could not connect back to it.
- Existing queue actions remain wired on the same block cards:
  - Start
  - Complete
  - Skip
  - Move up/down
  - Convert suggested next block to 25 minutes
- `git diff --check` should be run after final edits.

## Manual QA Checklist

- Existing blocks still appear.
- Priority filter works.
- Status filter works.
- Area filter works.
- Due-date filter works.
- Reset filters works.
- Can add a subtask.
- Can complete/uncomplete a subtask.
- Can edit a subtask title.
- Can delete a subtask.
- Subtask progress updates.
- Completing all subtasks suggests parent completion but does not force it.
- Can edit block title.
- Can edit priority.
- Can edit due date.
- Can edit estimate.
- Can edit project.
- Can edit notes.
- Changes persist after refresh.
- Start/Complete/Skip/25-min/Move up/down still work.

## What Still Needs Review

- Real-browser mobile QA for dense queues with many subtasks.
- Whether filter state should be persisted per day; Phase 3 currently keeps filters session-only.
- Whether compact edit should also sync changes back to source Task Inbox tasks when a queue block came from a task.
- Whether the Plan tab Block Queue should receive the same expanded edit/subtask controls, or stay as a cleaner overview while Today remains the main working surface.

## Known Limitations

- Phase 3 does not implement grouping or advanced sorting. Those remain Phase 4.
- Subtasks live on the Day Block Queue record and do not automatically create Task Inbox checklist items.
- Due dates are local block metadata only; no calendar reminders or integration were added.
