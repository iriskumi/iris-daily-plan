# Daily Hub SuperTodo Block Queue Changelog

## Phase 1 - Data Foundation

- Restored the project files from the latest committed state after the workspace appeared empty.
- Added day mode types and configuration for Full Day, Normal Day, Late Start Day, and Rescue Day.
- Added a date-keyed Day Block Queue model with block type, area, project, priority, energy, estimate, due date, status, subtasks, tags, timestamps, completion, and skipped reason fields.
- Added migration helpers that convert existing active tasks into queue blocks without deleting or replacing the existing task inbox.
- Added localStorage persistence for block queues keyed by date.
- Added backup/export and import support for block queues.
- Added basic queue helper logic for sorting, suggested next block, minimum viable 25-minute conversion, overview stats, and due-date bucketing.

## Verification

- Passed: npm run build.
- Partial: Vite dev server started successfully on localhost; the sandboxed health check could not connect back to it.
