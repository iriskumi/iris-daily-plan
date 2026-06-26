# Daily Hub SuperTodo Block Queue Plan

## Goal

Shift Iris Daily Plan Hub from a fixed timetable-first planner into a flexible task/block system that still preserves the existing timeline, Gemini planning, integrations, Pomodoro, Focus Garden, Actual Done / Notes, Evening Summary, and Notion Daily Log.

The new default planning model is a Block Queue View: a ranked list of useful blocks that can survive late starts, low energy, skipped blocks, and day changes.

## Principles

- Daily Plan Hub remains the main app. This is not a separate SuperTodo clone.
- Timeline View stays available as an optional way to inspect generated schedules.
- Success is measured by completed blocks, useful output, and focus minutes, not perfect timetable adherence.
- Existing localStorage data must migrate forward without resets.
- Each phase must build, leave the app usable, and record a changelog entry.

## Phase 1 - Data Foundation

Status: in progress

- Add day modes: Full Day, Normal Day, Late Start Day, Rescue Day.
- Add block queue data types for task-oriented planning.
- Add migration helpers from existing tasks into day block queues.
- Persist queues in localStorage by date.
- Include block queues in JSON backup/import.
- Keep existing task and generated plan models compatible.

## Phase 2 - Block Queue View

Status: pending

- Add a Block Queue section/view as the main task-oriented planning surface.
- Show Today Overview: selected mode, target blocks, completed blocks, remaining blocks, completed focus minutes, must-do progress, and suggested next block.
- Render block cards with title, priority, type, area/project, estimate, due date, subtask progress, status, and energy.
- Add actions: Start, Complete, Skip, Convert to 25-min version, Edit, Add subtask, Move up/down.

## Phase 3 - Filters, Subtasks, Compact Editing

Status: pending

- Add priority filters: All, Must, Should, Could.
- Add status filters: Not started, In progress, Done, Skipped.
- Add area and due-date filters.
- Add compact inline editing for title, priority, due date, estimate, project, and notes.
- Add subtask add/edit/delete behavior.
- Suggest parent completion when every subtask is done, without forcing it.

## Phase 4 - Grouping, Sorting, Recommendation Logic

Status: pending

- Add grouping by priority, area, project, due date, and status.
- Add sorting by priority, due date, estimated time, energy level, and manual order.
- Add suggested next block rules:
  - Must before should before could.
  - Due soon before no due date.
  - High-output work earlier in the day.
  - After 17:00, prefer low-input, admin, reading, recovery, and review.
  - Rescue Day chooses the easiest useful must/should block.
- Add late-start reduction logic that cuts could tasks first.

## Phase 5 - Timeline Optional + Polish

Status: pending

- Make Block Queue the main planning view.
- Move the old generated timetable into optional Timeline View.
- Polish mobile layout, card density, badges, and calm visual hierarchy.
- Test persistence after refresh.
- Verify Notion export and Markdown copy still work.

## Manual QA Checklist

- Existing tasks still load.
- New block queue can be created from existing tasks.
- Block can be completed.
- Block can be skipped with a reason.
- Subtasks work.
- Filters work.
- Day mode changes target block count.
- Late Start Day cuts could tasks first.
- After 17:00 suggested next block prefers low-input/admin/recovery.
- localStorage persists after refresh.
