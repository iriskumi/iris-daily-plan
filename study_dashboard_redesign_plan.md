# Study Dashboard Redesign Plan

## Goal

Add a separate Study tab that supports task-oriented study work without replacing the existing Daily Hub, Today page, Plan timeline, Tasks workflow, integrations, or current localStorage data.

## Phase S1 - Foundation

Status: Completed.

- Added Study tab shell.
- Added daily study target state.
- Added initial task library data structure.
- Added session record types.
- Added separate study localStorage helpers.
- Kept the existing Daily Hub intact.

## Phase S2 - Full Task Library and Picker

Status: Completed.

- Populated the full preloaded Study Task Library across:
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
- Added category selector and selectable template cards.
- Added selected task preview with resource suggestion, study method, note destination, subtasks, and duration options.
- Added custom task entry for one-off study tasks.
- Added clipboard-only Obsidian helpers:
  - Copy note path.
  - Copy task summary.
- Did not add real Obsidian API integration.
- Did not implement the focus timer.
- Did not implement a separate Study Review page.

## Phase S3 - Focus Timer

Status: Completed.

- Add 25 / 50 minute focus sessions.
- Add custom duration start.
- Persist active session in localStorage.
- Use timestamp-based remaining time with `Date.now()`.
- Recalculate correctly on tab visibility change and browser refresh.
- Add pause, resume, complete, and abandon actions.
- Save completed and abandoned session records.
- Update Daily Study Target progress from completed sessions.

## Phase S4 - Session Records and Study Review

Status: Completed.

- Save completed and abandoned study sessions.
- Show sessions completed today.
- Show total focus time and focus time by category.
- Show note destinations used.
- Add actual done summary and carry-over.
- Add Markdown copy for daily study summary.
- Persist Study Review fields by date in localStorage.
- Keep Notion push out of scope.

## Phase S5 - Notion Study Daily Log Push

Status: Completed.

- Add Push to Notion from Study Review.
- Create or update one Daily Logs page per date.
- Use `study-dashboard` as Planner Source.
- Push completed Study focus minutes and category minutes.
- Skip missing optional Notion properties safely.
- Include full Study Review details in page content.
- Persist last pushed time in the Study Review record.
