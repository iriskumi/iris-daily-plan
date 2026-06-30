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

## Phase 2 - Block Queue View

- Added a Block Queue view at the top of the Plan tab while keeping the existing timeline view unchanged below it.
- Added Today Overview stats for selected day mode, target blocks, completed blocks, remaining blocks, completed focus minutes, and must-do progress.
- Added a Suggested Next Block card using the Phase 1 recommendation helper.
- Rendered queue block cards with title, priority, type, area/project, estimated minutes, due date, subtask progress, status, and energy level.
- Added basic block actions: Start, Complete, Skip, Convert to 25-min version, Move up, and Move down.
- Added day mode selection in the Block Queue surface.
- Preserved manual queue order during task migration so Move up/down survives reload.
- Kept filters, compact editing, subtask add/edit/delete, grouping, and sorting deferred to later phases.

## Phase 2 Verification

- Passed: npm run build.
- Partial: Vite dev server started successfully on localhost; the sandboxed health check could not connect back to it.

## Phase 2 Manual QA Checklist

- Open the Plan tab and confirm Block Queue appears above the existing Daily Plan timeline.
- Confirm Today Overview shows day mode, target blocks, completed blocks, remaining blocks, focus minutes, and must-do progress.
- Confirm Suggested Next Block appears when active queue blocks exist.
- Click Start on a block and confirm its status changes to In progress.
- Click Complete on a block and confirm completed count and focus minutes update.
- Click Skip on a block and confirm it does not collapse the rest of the queue.
- Click 25-min on a long block and confirm the estimate becomes 25 minutes.
- Move a block up/down and refresh to confirm order persists.
- Confirm the old Time Blocks timeline still renders and existing plan actions remain available.

## Homepage Refactor - Calm Command Centre

- Rebuilt the Today homepage around one main question: what is my next useful block?
- Added a compact Today Status card showing day mode, completed/target blocks, focus minutes, must-do progress, remaining blocks, and current energy when available.
- Added a dominant Next Best Block card with area/project, priority, estimate, suggestion reason, and one primary action: Start next block.
- Added a compact homepage Block Queue directly below the next block card with Start, Complete, Skip, and Move up/down actions.
- Replaced the old Quick Add button row with habit-based block templates for Cyber, AI Project, English, SQL / Excel, Admin, Reading, and Reset.
- Moved Low-energy mode, Focus tools, Admin reminders, Start Today / sync, and Daily Check-in into lower collapsible panels.
- Kept existing components and workflows available without letting them dominate the first screen.

## Homepage Refactor Verification

- Passed: npm run build.

## Interactive Today Status

- Made the Today Status card interactive without restoring the full multi-step check-in to the first screen.
- Added compact Day Mode chips: Full Day, Normal Day, Late Start, Rescue Day, Evening Class, Saturday Class, Work Shift, and Admin Catch-Up.
- Added compact Energy chips: Low, Medium, High.
- Added compact Main Focus chips: Cyber, AI Project, English, SQL / Excel, Admin, Reading, and Health.
- Persisted selected day mode, current energy, and main focus in today’s block queue localStorage record.
- Day mode changes now update target block count and Block Queue overview immediately.
- Suggested next block now considers current energy and main focus:
  - Low energy prefers low-input, admin, recovery, and lower-energy blocks.
  - High energy can lift deep work and output blocks.
  - Main focus gives matching area blocks a stronger recommendation score.
- Expanded block queue day modes to support Evening Class, Saturday Class, Work Shift, and Admin Catch-Up.
- Renamed the lower collapsed Daily Check-in panel to **Full check-in** so the old flow remains available without dominating the homepage.

## Interactive Today Status Verification

- Passed: npm run build.

## Phase 3 - Filters, Subtasks, Due Dates, Compact Editing

- Added compact Block Queue filters on the Today homepage:
  - Priority: All, Must, Should, Could.
  - Status: All, Not started, In progress, Done, Skipped.
  - Area: All, Cyber, AI Project, English, SQL / Excel, Work Admin, Life Admin, Health, Reading, Other.
  - Due: All, Overdue, Due today, Upcoming, No due date.
- Added a Reset filters action.
- Filters apply only to the visible queue and do not alter stored block data.
- Preserved manual block order when filters are cleared.
- Added subtask support inside expanded block cards:
  - Add subtask.
  - Mark done/undone.
  - Edit subtask title.
  - Delete subtask.
  - Show progress on collapsed cards.
- Added a gentle suggestion when all subtasks are done, without auto-completing the parent block.
- Added compact inline editing for block cards:
  - Title.
  - Priority.
  - Due date.
  - Estimated minutes.
  - Project.
  - Notes.
  - Area.
  - Type.
  - Energy level.
- Added due-date labels for no due date, due today, overdue, and upcoming.
- Kept Start, Complete, Skip, 25-minute conversion, and Move up/down actions working on the same cards.
- Kept Phase 4 grouping/sorting out of scope.

## Phase 3 Verification

- Passed: npm run build.
- Passed: git diff --check.
- Partial: Vite dev server started successfully on localhost; the sandboxed health check could not connect back to it.

## Quick Add Template Refresh

- Replaced the previous generic Habit Blocks with study-system-specific Quick Add categories:
  - English Output
  - English Input
  - Japanese
  - AI Coding
  - SQL / Excel
  - Review / NotebookLM
  - Admin / Life
  - Cyber
  - Reset
- Split English into daytime output and lower-pressure input blocks.
- Renamed AI Project to AI Coding.
- Added Japanese as a light maintenance / language identity category.
- Moved Cyber later in the category order so the homepage opens with lower-emotional-load daily habits.
- Added notes to every Quick Add template so each created block has a clear starting instruction.
- Added subtasks to Shadowing full cycle and Oral summary practice.
- Added subtle evening mode behavior:
  - Shows "Evening mode: low-noise input works better now."
  - Marks high-output/deep-work templates as daytime recommended after 17:00.
- Added subtle Rescue Day highlighting for easiest useful blocks.
- Kept the homepage layout and data model unchanged.

## Quick Add Template Verification

- Passed: npm run build.

## Quick Add Category Reorder + Japanese

- Updated Habit Blocks order to:
  - English Output
  - English Input
  - Japanese
  - AI Coding
  - SQL / Excel
  - Review / NotebookLM
  - Admin / Life
  - Cyber
  - Reset
- Set the default selected category to English Output.
- Added Japanese templates:
  - Japanese light listening.
  - Japanese light reading.
  - Japanese expression review.
  - Japanese speaking maintenance.
  - Japan work memory / JET notes.
- Added Japanese as a Block Queue area so Japanese blocks keep their area/type/priority/energy metadata.
- Softened Cyber template notes:
  - Cyber assessment writing: one section only.
  - Lab evidence + screenshots: capture evidence, not perfect report writing.
  - NotebookLM cyber review: explicitly low-input.
  - Security concept drill: optional/could.

## Quick Add Category Reorder Verification

- Passed: npm run build.

## Quick Add Job / Career Category

- Added a separate Job / Career Habit Blocks category.
- Updated category order to:
  - English Output
  - English Input
  - Japanese
  - AI Coding
  - SQL / Excel
  - Job / Career
  - Review / NotebookLM
  - Admin / Life
  - Cyber
  - Reset
- Added Job / Career templates:
  - CV update block.
  - Cover letter draft.
  - LinkedIn profile polish.
  - Interview practice.
  - Selection criteria / STAR answer.
  - Job search review.
  - Portfolio / project write-up.
  - Career positioning block.
- Moved job-specific work out of Admin / Life.
- Added life-only Admin / Life templates:
  - Life admin catch-up.
  - Receipts / documents tidy-up.
- Rescue Day now highlights low-pressure career options: Job search review, LinkedIn profile polish, and Career positioning block.
- Higher-output career templates remain available and are marked daytime recommended by the existing evening-mode rules.

## Quick Add Job / Career Verification

- Passed: npm run build.

## Queue Calm Pass

- Collapsed Block Queue filters behind a compact Filters button.
- Added active filter count, for example `Filters · 2 active`.
- Kept Reset visible only when filters are active.
- Simplified visible block card actions to:
  - Start
  - Done
  - Skip
  - More
- Moved tertiary actions behind More:
  - Edit
  - 25 min
  - Move up
  - Move down
  - Subtasks/checklist area
- Clarified the main CTA from `Start next block` to `Begin next block`.
- Added helper text: `Start the queue item. Timer optional.`
- Hid `No due date` labels by default.
- Kept visible due labels only for overdue, due today, and upcoming dated blocks.
- Reduced secondary start wording:
  - `Start Today / sync` became `Sync & refresh`.
  - `Start Today` became `Refresh today`.
  - `Start legacy focus` became `Open timeline focus`.
  - `Start a Focus Block` became `Focus block`.
- Did not implement Phase 4 grouping/sorting.

## Queue Calm Pass Verification

- Passed: npm run build.

## Phase 3 - Filters, Subtasks, Compact Editing

- Added filter bar with Priority, Status, Energy, Due Date, and Area filters above the Block Queue.
- Filters combine with AND logic; active filter pills show a filled selected style.
- Empty filter state shows a calm inline message.
- Added compact inline editing on block cards (no modals): title, priority, energy, estimate, due date, type, notes.
- Only one card editable at a time; opening a second closes the first without saving.
- Added subtask view, add, inline edit, and delete on each block card.
- Subtask completion state persists to localStorage immediately.
- Added non-blocking parent completion suggestion when all subtasks are done.
- App passes npm run build.

## Study Dashboard Phase S1

- Added a separate Study tab between Today and Plan while keeping the existing Today / Plan / Tasks workflow intact.
- Added Study Dashboard shell focused on study targets, study task templates, and future session review.
- Added daily study target state with default 8 hours, quick targets for 3h / 5h / 6h / 8h, custom target input, progress bar, completed focus minutes, remaining focus minutes, and completed session count.
- Added typed Study task library with the requested categories:
  - English Output
  - English Input
  - Japanese
  - AI Coding
  - SQL / Excel
  - Job / Career
  - Review / NotebookLM
  - Admin / Life
  - Cyber
  - Reset
- Added study template fields for default duration, alternative durations, energy, type, resource suggestion, study method, note destination, subtasks, evening-friendly flag, and rescue-friendly flag.
- Added typed study session records for future completed / abandoned focus sessions.
- Added localStorage persistence for daily study targets and future session records without changing existing Daily Hub storage keys.
- Left the focus timer, active-session persistence, Obsidian copy helpers, and full Study review for later phases.

## Study Dashboard Phase S1 Verification

- Passed: npm run build.

## Study Dashboard Phase S2

- Expanded the preloaded Study Task Library across all requested categories with multiple realistic templates.
- Kept the existing `StudyTaskTemplate` shape and included id, title, category, duration options, energy, type, resource suggestion, study method, note destination, subtasks, evening-friendly flag, and rescue-friendly flag for every template.
- Upgraded the Study Task Picker with:
  - Category selector.
  - Selectable template cards.
  - Selected task preview.
  - Resource suggestion, study method, Obsidian note destination, subtasks, default duration, and alternative durations.
- Added custom task entry for one-off study tasks with title, category, duration, note destination, and notes.
- Added Obsidian helper copy buttons for note path and task summary.
- Kept Obsidian as manual clipboard-only support with no API integration.
- Left the focus timer, active session persistence, and Study Review page out of scope for this phase.

## Study Dashboard Phase S2 Verification

- Passed: npm run build.
- Passed: git diff --check.

## Study Dashboard Phase S3

- Added a robust Study Focus Timer to the Study tab only.
- Timer starts from the selected Study task with:
  - Start 25.
  - Start 50.
  - Custom duration.
- Added custom task timer start from the Custom Task section.
- Added pause, resume, complete, and abandon controls.
- Added active Study session localStorage persistence under a separate Study key.
- Active sessions store:
  - sessionStartTime.
  - durationMinutes.
  - expectedEndTime.
  - pausedAccumulatedMs.
  - pauseStartedAt when paused.
- Remaining time is recalculated from `Date.now()` rather than relying only on `setInterval`.
- Timer recalculates on browser tab visibility changes.
- Timer restores active sessions after refresh and completes expired running sessions from timestamps.
- Completing or abandoning a session creates a Study session record with:
  - id.
  - taskTemplateId or customTaskId.
  - title.
  - category.
  - startedAt.
  - completedAt.
  - plannedMinutes.
  - actualMinutes.
  - status.
  - noteDestination.
  - notes.
  - resourceUsed.
- Completed sessions update the Daily Study Target progress and completed session count.
- Did not implement the separate Study Review page.

## Study Dashboard Phase S3 Verification

- Passed: npm run build.
- Passed: git diff --check.

## Study Dashboard Phase S4

- Added Study Review using completed Study session records from Phase S3.
- Review shows:
  - Sessions completed today.
  - Total focus time.
  - Focus time by category.
  - Note destinations used.
  - Actual done summary field.
  - Carry-over field.
  - Tomorrow’s smallest next step field.
- Added date-keyed Study Review localStorage persistence without touching existing Daily Hub logs.
- Added editable fields:
  - Actual Done.
  - Carry Over.
  - Tomorrow’s Smallest Next Step.
- Added Copy daily study summary as Markdown.
- Markdown export includes target, completed focus time, session count, per-session records, category breakdown, actual done, carry-over, and tomorrow’s smallest next step.
- Did not add Notion push.
- Did not change Today / Plan / Tasks.

## Study Dashboard Phase S4 Verification

- Passed: npm run build.
- Passed: git diff --check.

## Study Dashboard Phase S5

- Added Study Daily Log push to Notion from the Study Review section.
- Added a dedicated Vercel route: `/api/notion/push-study-daily-log`.
- Reused the existing Notion connection environment variables and Daily Logs database target.
- Study push maps:
  - Date.
  - Planner Source = `study-dashboard`.
  - Focus Minutes.
  - Study Minutes when present.
  - AI Minutes.
  - Admin Minutes.
  - Carry Over.
  - Summary.
- Optional fields are filled only when compatible properties exist:
  - English Minutes.
  - Japanese Minutes.
  - Cyber Minutes.
  - SQL/Data Minutes.
  - Job/Career Minutes.
  - Review Minutes.
  - Session Count.
  - Top Category.
  - Obsidian Notes.
  - Actual Done.
  - Tomorrow Next Step.
- Missing optional Notion properties are skipped safely and details remain in the page content / Summary.
- Study push queries the Daily Logs database by Date and updates an existing page when found.
- If the database lacks a usable Date property or cannot be queried by date, the push fails safely instead of creating a possible duplicate.
- Page content includes Study Sessions, Category Breakdown, Actual Done, Carry Over, Tomorrow’s Smallest Next Step, and Markdown Summary.
- UI now shows Push to Notion, success/failure status, Notion page link when available, and last pushed time.
- Abandoned sessions are excluded from completed minutes and pushed session totals.
- Existing Daily Hub Notion export remains unchanged.

## Study Dashboard Phase S5 Verification

- Passed: npm run build.
- Passed: git diff --check.
