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

- [ ] Filter by Must - only Must blocks show.
- [ ] Filter by In Progress - only In Progress blocks show.
- [ ] Filter by Low energy - only Low energy blocks show.
- [ ] Filter by Today due date - only blocks due today show.
- [ ] Two filters active together - AND logic works.
- [ ] No matching blocks - calm empty state shows.
- [ ] Clear filter - all blocks return.
- [ ] Click pencil on a block - card expands into edit mode in place.
- [ ] Edit title and save - new title shows on card and persists after reload.
- [ ] Edit priority and save - badge updates.
- [ ] Cancel edit - original values unchanged.
- [ ] Open edit on block B while block A is in edit mode - block A closes without saving.
- [ ] Add a subtask - appears at bottom of list.
- [ ] Check a subtask - strike-through and count updates.
- [ ] Edit a subtask label inline - saves on Enter.
- [ ] Delete a subtask - removed immediately, count updates.
- [ ] Check last subtask - completion suggestion appears inline.
- [ ] Click "Yes, complete it" - block marked Done, suggestion disappears.
- [ ] Click "Not yet" - suggestion dismisses, block stays In Progress.
- [ ] All existing Phase 2 actions still work: Start, Complete, Skip, Move, 25-min.
- [ ] Reload page - filter state resets, subtask states and edits persist.
- [ ] npm run build passes with no errors.

## What Still Needs Review

- Real-browser mobile QA for dense queues with many subtasks.
- Whether filter state should be persisted per day; Phase 3 currently keeps filters session-only.
- Whether compact edit should also sync changes back to source Task Inbox tasks when a queue block came from a task.
- Whether the Plan tab Block Queue should receive the same expanded edit/subtask controls, or stay as a cleaner overview while Today remains the main working surface.

## Known Limitations

- Phase 3 does not implement grouping or advanced sorting. Those remain Phase 4.
- Subtasks live on the Day Block Queue record and do not automatically create Task Inbox checklist items.
- Due dates are local block metadata only; no calendar reminders or integration were added.
