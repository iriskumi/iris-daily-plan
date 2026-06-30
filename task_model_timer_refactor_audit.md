# Task Model / Plan Demotion / Timer Refactor Audit

Date: 2026-06-30  
Scope: audit only. No code changes, no migrations, no refactor implementation.

## 0. Repo State Notes

- Current local branch has the Study Dashboard workflow commit locally but not pushed: `939a20b Add study dashboard workflow`.
- Current working tree also contains unrelated dirty Notion/bills files:
  - `.env.example`
  - `src/components/BillsFinance.tsx`
  - `src/services/notionService.ts`
  - `src/types.ts`
  - `api/notion/sync-paid-bills.ts`
- This audit describes the actual working tree contents, including the Study Dashboard and Study Notion push files now present in the repo.

## 1. Current Files / Components By Area

### Today

- `src/App.tsx`
  - Owns top-level tab state.
  - Renders `TodayCommandCentre` inline.
  - Handles plan generation, low-energy plan reduction, Start Today flow, and routing to Plan.
- `src/components/HomeCommandCentre.tsx`
  - Main Today command center surface.
  - Contains Today Status, Next Best Block, homepage Block Queue, Habit Blocks quick add, filters, inline queue editing, subtasks, and day mode/energy/main focus controls.
- `src/components/DailyCheckin.tsx`
  - Full Daily Check-in form used by Today/Plan generation context.
- `src/productivity.ts`
  - Carry-over suggestions, reminders, reality check, next action helpers.

### Tasks

- `src/components/TaskInbox.tsx`
  - Main task inbox CRUD.
  - Reads/writes `iris-tasks`.
  - Uses `createInboxTask`, `normalizeTask`, `archiveOldTasks`.
- `src/components/RecurringTemplates.tsx`
  - Task template management.
  - Reads/writes `iris_task_templates`.
- `src/focusBlocks.ts`
  - Task normalization, task creation, task-to-focus-block helpers, category/area mapping.
- `src/taskTemplates.ts`
  - Default task templates and quick template IDs.
- `src/types.ts`
  - `Task`, `TaskTemplate`, `FocusSession`, `FocusBlock`, `DayBlock`, `DayBlockQueue`.

### Study Dashboard

- `src/components/StudyDashboard.tsx`
  - Study tab UI.
  - Daily target, Study Task Picker, Study timer, custom task entry, Study Review, Markdown export, Study Notion push.
- `src/studyTypes.ts`
  - Study-specific types:
    - `StudyCategory`
    - `StudyTaskTemplate`
    - `DailyStudyTarget`
    - `StudyActiveSession`
    - `StudySessionRecord`
    - `StudyDailyReview`
- `src/studyTaskLibrary.ts`
  - Static in-code Study Task Library.
  - Not persisted to localStorage.
- `src/studyStorage.ts`
  - Study-specific localStorage wrappers.

### Plan / Legacy Timeline

- `src/components/DailyPlanView.tsx`
  - Generated plan UI, legacy hour-by-hour timeline, block edit/duplicate/delete/reorder, time block follow-up, daily log, Notion export.
- `src/planner.ts`
  - Rule-based planner and helper modules:
    - `taskScoring`
    - `billPrioritization`
    - `workLeadSelection`
    - `timeBlockGeneration`
    - `markdownExport`
    - `planAssembly`
- `src/services/aiService.ts`
  - Calls `/api/generate-plan` and summary/review endpoints.
- `api/generate-plan.ts`
  - Vercel API route for Gemini/OpenAI/DeepSeek plan generation.

### Block Queue

- `src/components/HomeCommandCentre.tsx`
  - Primary current Block Queue UI on Today.
  - Includes filters, inline editing, subtasks, quick add, suggested next block.
- `src/components/BlockQueueView.tsx`
  - Older Plan-tab Block Queue view.
  - Simpler queue operations.
- `src/blockQueue.ts`
  - `DayBlockQueue` creation, merging tasks into queue, day mode configs, sorting, scoring, overview.
- `src/storage.ts`
  - `loadDayBlockQueue`, `saveDayBlockQueue`, `loadBlockQueuesByDate`.

### Quick Add

There are two separate Quick Add concepts:

- Homepage Habit Blocks:
  - File: `src/components/HomeCommandCentre.tsx`.
  - Adds `DayBlock` directly into `iris-block-queues-by-date`.
  - Does not create a `Task`.
- Focus Block quick task:
  - File: inline `FocusBlockWorkflow` in `src/App.tsx`.
  - Adds a real `Task` into `iris-tasks` using `createInboxTask`.

### Focus Garden / Pomodoro

- `src/components/PomodoroTimer.tsx`
  - Older Pomodoro component.
  - Interval-based countdown.
  - Writes completed focus sessions to `iris-focus-sessions`.
- `src/components/FocusGarden.tsx`
  - Displays stats from `iris-focus-sessions`.
- `src/focus.ts`
  - `getFocusStats`, `focusGardenStage`, date helpers, Focus Garden Markdown.
- Inline `FocusBlockWorkflow` in `src/App.tsx`
  - Starts `FocusBlock` records and creates `FocusSession` records on completion.

### Study Timer

- `src/components/StudyDashboard.tsx`
  - Contains the Study timer implementation directly.
  - Uses timestamp-based state and localStorage active-session persistence.
- `src/studyStorage.ts`
  - `loadActiveStudySession`, `saveActiveStudySession`, `clearActiveStudySession`.
- `src/studyTypes.ts`
  - `StudyActiveSession`, `StudySessionRecord`.

### Study Review

- `src/components/StudyDashboard.tsx`
  - Displays completed Study sessions, category breakdown, note destinations, editable review fields.
  - Generates Markdown.
  - Pushes to Notion.
- `src/studyStorage.ts`
  - `loadStudyDailyReview`, `saveStudyDailyReview`.

### Evening Summary

- `src/components/DailyPlanView.tsx`
  - `handleFinishDay` calls `summarizeToday`, saves `DailyLog.eveningSummary`, then pushes Notion Daily Log.
- `api/summarise-today.ts`
  - Server route for Gemini/local summary.
- `src/services/aiService.ts`
  - `summarizeToday`, `reviewUnfinishedTasks`.

### Notion Push

- Existing Daily Hub push:
  - Frontend: `src/services/notionService.ts` → `exportPlanToNotion`.
  - UI: `src/components/DailyPlanView.tsx`.
  - API: `api/notion/push-daily-log.ts`.
- Study Daily Log push:
  - Frontend: `src/services/notionService.ts` → `pushStudyDailyLogToNotion`.
  - UI: `src/components/StudyDashboard.tsx`.
  - API: `api/notion/push-study-daily-log.ts`.
- Schema helper:
  - `api/notion/schema.ts`.
  - `src/notionSchema.ts`.
- Dirty unrelated paid-bills sync:
  - `api/notion/sync-paid-bills.ts`.
  - `src/components/BillsFinance.tsx`.
  - `src/services/notionService.ts` has unstaged paid-bills sync additions.

## 2. Current localStorage Keys And Schemas

### Shared Wrapper

Most `src/storage.ts` keys are saved as:

```ts
{
  schemaVersion: 1,
  value: ...
}
```

The loader also accepts unversioned legacy raw values.

### Core Daily Hub Keys

Defined in `src/storage.ts`:

- `iris-checkin`
  - Legacy single `DailyCheckin`.
  - Migrated to `checkInsByDate`.
- `checkInsByDate`
  - `Record<string, DailyCheckin>`.
  - Keyed by `YYYY-MM-DD`.
- `legacyCheckIns`
  - `DailyCheckin[]` fallback for old check-ins without date.
- `iris-tasks`
  - `Task[]`.
  - Normalized by `normalizeTask`.
  - Main active task store today.
- `iris-opportunities`
  - `WorkOpportunity[]`.
- `iris-bills`
  - `Bill[]`.
- `iris-plan`
  - Legacy single `GeneratedPlan`.
  - Migrated to `plansByDate`.
- `plansByDate`
  - `Record<string, GeneratedPlan>`.
  - Keyed by plan date.
  - Normalized by `normalizeGeneratedPlan`.
- `legacyPlans`
  - `GeneratedPlan[]` fallback for old undated plans.
- `rankedTasksByDate`
  - `Record<string, RankedCheckinTask[]>`.
- `iris-templates`
  - `Template[]`.
- `iris_task_templates`
  - `TaskTemplate[]`.
- `iris-settings`
  - `AppSettings`.
  - Defaults: timezone, sleep target, class flags, recovery block flag.
- `iris-calendar-events`
  - `CalendarEvent[]`.
- `iris-google-calendar-meta`
  - `GoogleCalendarImportMeta`.
  - Local client-side status cache only.
- `iris-daily-logs`
  - `Record<string, DailyLog>`.
- `iris-time-block-follow-ups`
  - `Record<string, Record<string, TimeBlockFollowUp>>`.
- `iris-focus-sessions`
  - `FocusSession[]`.
  - Used by Pomodoro/Focus Garden and Focus Block Workflow.
- `startPlans`
  - `StartPlan[]`.
  - Not version-wrapped; saved raw with `localStorage.setItem`.
- `iris_focus_blocks`
  - Legacy `FocusBlock[]`.
- `focusBlocksByDate`
  - `Record<string, FocusBlock[]>`.
- `iris_meal_anchors`
  - `Record<string, MealAnchor[]>`.
- `mealStatusByDate`
  - `Record<string, MealAnchor[]>`.
- `iris-block-queues-by-date`
  - `Record<string, DayBlockQueue>`.

### Study Keys

Defined in `src/studyStorage.ts`, also version-wrapped with `schemaVersion: 1`:

- `iris-study-targets-by-date`
  - `Record<string, DailyStudyTarget>`.
  - Daily target default: 480 minutes.
- `iris-study-session-records`
  - `StudySessionRecord[]`.
  - Completed and abandoned Study timer records.
- `iris-study-active-session`
  - `StudyActiveSession`.
  - Timestamp-based active timer state.
- `iris-study-reviews-by-date`
  - `Record<string, StudyDailyReview>`.
  - Actual Done, Carry Over, Tomorrow Next Step, optional Notion last pushed time.

### Study Task Library

- `src/studyTaskLibrary.ts`
  - Static TypeScript data.
  - No localStorage key.
  - Template selection state is React component state only.

### Notion-Related Local Data

- Existing Daily Hub:
  - Notion page URL/status is React state in `DailyPlanView`; not persisted.
  - Daily log content is persisted in `iris-daily-logs`.
  - Time block follow-up content is persisted in `iris-time-block-follow-ups`.
  - Focus stats come from `iris-focus-sessions` and `focusBlocksByDate`.
- Study:
  - Last pushed time is persisted as `StudyDailyReview.notionLastPushedAt` under `iris-study-reviews-by-date`.
  - Notion URL/status is React state in `StudyDashboard`; not persisted.

## 3. Current Data Flows

### Quick Add → Where Does It Write?

Two paths:

1. Homepage Habit Blocks:
   - Component: `HomeCommandCentre`.
   - Template source: local `QUICK_ADD_GROUPS`.
   - `addTemplate` → `templateToBlock` → append `DayBlock`.
   - Writes: `saveDayBlockQueue`.
   - Storage: `iris-block-queues-by-date`.
   - Does not write `iris-tasks`.

2. Focus Block quick task:
   - Component: inline `FocusBlockWorkflow` in `App.tsx`.
   - `handleAddQuickTask` → `createInboxTask`.
   - Writes: `saveTasks`.
   - Storage: `iris-tasks`.

### Study Template Selection → Where Does It Write?

- Component: `StudyDashboard`.
- Selecting category/template updates React state:
  - `selectedCategory`
  - `selectedTemplateId`
- No localStorage write on selection.
- Starting a session from selected template writes active timer state to `iris-study-active-session`.
- Completing/abandoning writes a `StudySessionRecord` to `iris-study-session-records`.

### Study Timer Completion → Where Does It Write?

- Component: `StudyDashboard`.
- `completeSession(status)`:
  - Creates `StudySessionRecord`.
  - Writes via `addStudySessionRecord`.
  - Storage: `iris-study-session-records`.
  - Clears `iris-study-active-session`.
- Completed sessions count toward Study target progress.
- Abandoned sessions are saved but excluded from completed minutes/category totals.

### Block Queue Actions → Where Do They Write?

- Component: `HomeCommandCentre` and `BlockQueueView`.
- Actions:
  - start/in-progress
  - done
  - skipped
  - 25-minute conversion
  - move up/down
  - edit title/priority/due/minutes/notes/area/type/energy
  - subtask add/edit/delete/done
  - day mode/energy/main focus changes
- Writes:
  - `saveDayBlockQueue`.
  - Storage: `iris-block-queues-by-date`.
- Important: queue block status does not always update the source `Task`.
  - Queue items derived from tasks retain `sourceTaskId`, but current queue actions mutate the `DayBlock`, not necessarily `iris-tasks`.

### Plan Generation → Where Does It Write?

- Entry: `App.handleGeneratePlan`.
- Reads:
  - `loadGeneratePlanContext`
  - `checkInsByDate`
  - `iris-tasks`
  - `iris-opportunities`
  - `iris-bills`
  - `iris-templates`
  - `iris-settings`
  - `iris-calendar-events`
- Calls:
  - `generatePlanWithAI` → `/api/generate-plan`
  - Falls back to `planAssembly`.
- Writes:
  - `savePlan`.
  - Storage: `plansByDate`.
- Generated time blocks are `TimeBlock[]` inside `GeneratedPlan`.

### Evening Summary Push → What Does It Read?

- Component: `DailyPlanView`.
- `handleFinishDay`:
  - Reads current `plan`.
  - Reads `dailyLog` / `loadDailyLog`.
  - Reads `loadTasks`, `loadBills`, `loadOpportunities`, `loadCalendarEvents`.
  - Reads `loadFocusSessions` for stats.
  - Calls `summarizeToday`.
  - Saves `DailyLog.eveningSummary` to `iris-daily-logs`.
  - Calls `exportPlanToNotion`.
- `handlePushNotion` direct push reads:
  - plan
  - dailyLog
  - focus stats from `iris-focus-sessions`
  - checkin
  - tasks
  - calendarEvents
  - opportunities
  - bills
  - followUps
  - focusBlocks
  - generated Markdown

### Study Review / Notion Push → What Does It Read?

- Component: `StudyDashboard`.
- Reads:
  - `iris-study-session-records`
  - `iris-study-targets-by-date`
  - `iris-study-reviews-by-date`
- Computes:
  - completed sessions
  - total completed minutes
  - category breakdown
  - note destinations
  - Markdown summary
- Push route:
  - `/api/notion/push-study-daily-log`
  - Reads payload from frontend.
  - Does not read localStorage directly.

## 4. Current Timer Implementations

### Pomodoro Timer / Focus Garden

- File: `src/components/PomodoroTimer.tsx`.
- State:
  - `phase`
  - `timeLeft`
  - `running`
  - `sessionsCompleted`
  - distraction counters/messages
- Countdown:
  - `setInterval` decrements `timeLeft` once per second.
  - Not timestamp-based.
- Visibility behavior:
  - On tab hidden during focus, pauses running timer and increments distraction count.
  - Does not recover elapsed time from wall clock.
- Completion:
  - `recordFocusSession` writes to `iris-focus-sessions` via `addFocusSession`.
  - Repeated distractions prevent garden credit.

### Focus Block Workflow Timer

- File: inline `FocusBlockWorkflow` in `src/App.tsx`.
- State:
  - `FocusBlock.plannedEndTime`
  - UI tick state `tick`
- Countdown:
  - Displays `plannedEndTime - tick`.
  - Uses wall-clock timestamp for display.
- Persistence:
  - `FocusBlock` records persist in `focusBlocksByDate` and legacy `iris_focus_blocks`.
  - Active block is the block with `status === 'Doing'`.
- Completion:
  - Updates focus block status and actual end time.
  - On `Done`, writes `FocusSession` to `iris-focus-sessions` and marks source task done.

### Study Timer

- File: `src/components/StudyDashboard.tsx`.
- State:
  - `StudyActiveSession`.
  - `nowMs`.
- Persistence:
  - `iris-study-active-session`.
- Timestamp fields:
  - `sessionStartTime`
  - `durationMinutes`
  - `expectedEndTime`
  - `pausedAccumulatedMs`
  - `pauseStartedAt`
- Recovery:
  - Restores active session from localStorage on component mount.
  - Recalculates remaining time from `Date.now()`.
  - Recalculates on `visibilitychange`.
  - Auto-completes expired running session based on `expectedEndTime`.
- Completion:
  - Writes `StudySessionRecord` to `iris-study-session-records`.

### Timer Overlap And Differences

- Overlap:
  - All timers model focus duration, task title, category/area, and completed minutes.
  - Focus Block Workflow and Study timer both use persisted active state.
  - Pomodoro and Focus Block Workflow both feed Focus Garden via `iris-focus-sessions`.
- Differences:
  - Pomodoro uses interval countdown and pause-on-tab-leave.
  - Focus Block Workflow uses planned end timestamp but has no explicit pause/resume accumulation.
  - Study timer has the strongest timestamp model with pause accumulation and refresh recovery.
  - Study sessions are separate from Focus Garden sessions, so Study time does not feed Focus Garden unless bridged later.

## 5. Current Notion Payloads

### Evening Summary / Daily Hub Payload

Frontend:

- `src/services/notionService.ts`
  - `exportPlanToNotion(plan, dailyLog, focusStats, context)`.
- `src/components/DailyPlanView.tsx`
  - `handlePushNotion`.
  - `handleFinishDay`.

Payload type:

- `NotionDailyLogPayload` in `src/types.ts`:
  - `plan`
  - `dailyLog`
  - `focusStats`
  - `focusBlocks`
  - `followUps`
  - `checkin`
  - `tasks`
  - `calendarEvents`
  - `opportunities`
  - `bills`
  - `markdown`

API route:

- `api/notion/push-daily-log.ts`.

Database properties used:

- Required/attempted:
  - `Date`
  - `Summary`
  - `Planner Source`
  - `Carry Over`
- Time properties:
  - `Focus Minutes`
  - `Vibe Coding Minutes`
  - `Cyber Minutes`
  - `AI Minutes`
  - `English Output Minutes`
  - `Expression Review Minutes`
  - `Job Minutes`
  - `Admin Minutes`
  - `Study Minutes`
  - `Recovery Minutes`
  - `Completed Blocks`
  - `Partial Blocks`
  - `Skipped Blocks`
  - `Main Focus Area`
  - `Useful Output Summary`

Current duplicate behavior:

- The current Daily Hub route creates a page directly.
- It does not query by Date before creating.
- Study route has stronger duplicate protection than Daily Hub route right now.

### Study Daily Log Payload

Frontend:

- `src/components/StudyDashboard.tsx` → `pushStudyLogToNotion`.
- `src/services/notionService.ts` → `pushStudyDailyLogToNotion`.

Payload shape:

- `date`
- `targetMinutes`
- `completedMinutes`
- `sessionCount`
- `categoryBreakdown`
- `noteDestinations`
- `sessions`
- `review`
- `markdown`

API route:

- `api/notion/push-study-daily-log.ts`.

Database properties used:

- Core:
  - `Date`
  - `Planner Source`
  - `Focus Minutes`
  - `Study Minutes`
  - `AI Minutes`
  - `Admin Minutes`
  - `Carry Over`
  - `Summary`
- Optional:
  - `English Minutes`
  - `Japanese Minutes`
  - `Cyber Minutes`
  - `SQL/Data Minutes`
  - `Job/Career Minutes`
  - `Review Minutes`
  - `Session Count`
  - `Top Category`
  - `Obsidian Notes`
  - `Actual Done`
  - `Tomorrow Next Step`

Duplicate behavior:

- Requires a usable `Date` property.
- Queries database by `Date`.
- Updates existing page when found.
- Creates only if no page exists.
- If Date query cannot be performed, fails instead of risking duplicate.

## 6. Proposed Migration Map

### Proposed Unified Store

Candidate key:

- `iris-task-store`

Candidate shape:

```ts
interface TaskStore {
  schemaVersion: number
  migratedAt: string
  tasks: UnifiedTask[]
  templates: UnifiedTaskTemplate[]
  sessions: UnifiedTaskSession[]
  activeTimer?: UnifiedActiveTimer
}
```

### Old Key → New Unified Field

- `iris-tasks`
  - `Task[]` → `TaskStore.tasks[]`
  - Source: `task-inbox`
  - Preserve old `id`.
- `iris-block-queues-by-date`
  - `DayBlockQueue.blocks[]` → either:
    - `TaskStore.tasks[]` for manual quick-add blocks without `sourceTaskId`, or
    - scheduling metadata on existing task for blocks with `sourceTaskId`.
  - Queue-level fields (`mode`, `targetBlocks`, `currentEnergy`, `mainFocus`) should not become task fields directly; use separate day planning metadata or task schedule view state.
- `src/studyTaskLibrary.ts`
  - Static `StudyTaskTemplate[]` → `TaskStore.templates[]`.
  - Do not migrate templates into active tasks.
- `iris-study-session-records`
  - `StudySessionRecord[]` → `Task.sessions[]` or `TaskStore.sessions[]` linked by `taskTemplateId`, `customTaskId`, or newly assigned `taskId`.
- `iris-study-active-session`
  - `StudyActiveSession` → shared `UnifiedActiveTimer`.
- `iris-focus-sessions`
  - `FocusSession[]` → `Task.sessions[]` / `TaskStore.sessions[]`.
- `focusBlocksByDate` and `iris_focus_blocks`
  - `FocusBlock[]` → scheduled/active timer records linked to tasks.
- `plansByDate`
  - `GeneratedPlan.timeBlocks[]` should stay as historical plan snapshots.
  - If converted to tasks, mark source as `plan-generated`.
- `iris-daily-logs`
  - Keep as daily review/log store, not task store.
- `iris-study-reviews-by-date`
  - Keep as Study daily review/log store, not task store.

### Old Study Session → `Task.sessions[]`

Map:

- `StudySessionRecord.id` → `TaskSession.id`
- `taskTemplateId` → `sourceTemplateId`
- `customTaskId` → `sourceCustomTaskId`
- `title` / `category` → task lookup or fallback denormalized fields
- `startedAt`, `completedAt`
- `plannedMinutes`, `actualMinutes`
- `status`
- `noteDestination`
- `notes`
- `resourceUsed`

Concern:

- Existing Study sessions may not have a durable `taskId`.
- Template sessions currently do not create active tasks.
- Migration may need to create synthetic task records for past sessions or maintain a separate session table.

### Old Block Queue Item → `Task.scheduledDate / scheduledBlockId`

For `DayBlock.sourceTaskId`:

- Link to existing `Task.id`.
- Add:
  - `scheduledDate = DayBlock.date`
  - `scheduledBlockId = DayBlock.id`
  - `scheduleStatus = DayBlock.status`
  - `scheduledMinutes = DayBlock.estimatedMinutes`
  - queue metadata if needed.

For manual quick-add `DayBlock` without `sourceTaskId`:

- Create a new `Task`:
  - `source = 'quick-add-block'`
  - `scheduledDate = block.date`
  - `scheduledBlockId = block.id`
  - keep block title/type/area/priority/subtasks/tags.

### Old Plan-Generated Task → `Task` with `source: plan-generated`

Generated plan time blocks:

- If `TimeBlock.taskId` exists, link to existing task.
- If no task exists:
  - Create `Task` with source `plan-generated`.
  - Preserve `baseBlockId`, `TimeBlock.id`, `startTime`, `endTime`, `date`.
- Do not delete or rewrite historical `GeneratedPlan` snapshots during first migration.

## 7. Risks And Edge Cases

### Duplicate Tasks

- Same conceptual item may exist in:
  - `iris-tasks`
  - `DayBlockQueue.blocks`
  - `GeneratedPlan.timeBlocks`
  - `StudySessionRecord` title-only sessions
- Homepage Quick Add creates queue-only blocks, not tasks.
- Study templates do not create tasks until timer start, and even then only create session records.
- Migration needs dedupe heuristics:
  - exact title + date + source
  - source IDs where present
  - avoid merging historical sessions into active tasks too aggressively.

### Templates Polluting Active Tasks

- Study Task Library and `DEFAULT_TASK_TEMPLATES` are templates, not tasks.
- Migrating templates into `tasks[]` would flood Today/Block Queue.
- Unified model should distinguish:
  - `template`
  - `active task`
  - `scheduled block`
  - `historical session`

### Lost Sessions

- Study sessions and Focus Garden sessions currently live in separate stores.
- Moving them into a unified task store risks losing:
  - abandoned Study sessions
  - distraction-excluded Pomodoro sessions
  - old focus block sessions
- Recommendation: keep old session arrays read-only during first migration and write migrated copy with migration marker.

### Broken Notion Push

- Daily Hub Notion expects `NotionDailyLogPayload`.
- Study Notion expects Study payload.
- A unified task model could break category minute calculations if categories/areas change.
- Existing Notion property names differ:
  - Daily Hub uses `English Output Minutes`, `Job Minutes`.
  - Study uses `English Minutes`, `Job/Career Minutes`, `SQL/Data Minutes`.
- Need compatibility mapping layer rather than direct model field names.

### Timer Recovery Mismatch

- Study timer is timestamp-based.
- Pomodoro is interval-based and intentionally pauses on tab leave.
- Focus Block Workflow uses planned end timestamp but lacks pause accumulation.
- Shared engine needs mode flags:
  - `pauseOnHidden` for Pomodoro behavior.
  - `countHiddenTime` for Study behavior.
  - `allowPauseAccumulation`.
  - `autoCompleteWhenExpired`.

### localStorage Migration Running Twice

- Existing `migrateDailyStorage` runs opportunistically whenever checkins/plans load.
- A task migration that mutates multiple keys could run repeatedly if not marked.
- Use explicit migration metadata:
  - `iris-task-store-migration`
  - source key checksums/counts
  - migration version
  - migratedAt
- Migration must be idempotent:
  - preserve IDs
  - skip already migrated source IDs
  - never delete old keys in Step 1.

### Date Boundaries

- Study sessions are loaded by `completedAt` date.
- Focus sessions use explicit `date`.
- Active timers can cross midnight.
- Unified model needs a clear rule:
  - count by completion date, start date, or assigned session date.

### Plan Demotion Risk

- Plan currently owns important behavior:
  - generated schedule
  - manual edits
  - follow-ups
  - Notion export
  - Start block as focus
  - low-energy plan reduction
- Demoting Plan too early could hide functionality before equivalent task/timer paths exist.

## 8. Recommended Incremental Implementation Plan

### Step 1: `taskStore` + Migration Only

Goal:

- Add new unified store and read-only migration layer.
- Do not change UI behavior yet.

Tasks:

- Create `src/taskStoreTypes.ts`.
- Create `src/taskStore.ts`.
- Add localStorage key `iris-task-store`.
- Add migration function:
  - from `iris-tasks`
  - from queue-only quick-add blocks
  - from Study session records
  - from Focus sessions/focus blocks
- Do not delete old keys.
- Add migration marker with version and source IDs.
- Add tests or testable helpers for idempotency.

Success criteria:

- App still reads old stores.
- New task store can be inspected/exported.
- Running migration twice produces same task/session counts.

### Step 2: Plan Demotion + Settings Toggle Only

Goal:

- Make Plan less central without removing it.

Tasks:

- Add setting:
  - `planMode: 'full' | 'compact' | 'legacy-hidden'` or similar.
- Default to current behavior.
- Add compact Plan view option.
- Keep legacy timeline accessible.
- Do not migrate plan time blocks yet.
- Ensure Notion export still uses `GeneratedPlan`.

Success criteria:

- Today/Study become primary execution surfaces.
- Plan remains available and export-compatible.

### Step 3: Shared Timer Engine Only

Goal:

- Extract timer mechanics without changing task model or Notion payloads.

Tasks:

- Create `src/timerEngine.ts`.
- Model:
  - `start`
  - `pause`
  - `resume`
  - `complete`
  - `abandon`
  - `remainingMs`
  - `elapsedMs`
  - `restore`
- Support modes:
  - Study timer: timestamp-based, count hidden time, auto-complete expired.
  - Pomodoro: preserve pause-on-hidden behavior if desired.
  - Focus Block: planned end timestamp with optional pause.
- Migrate Study timer implementation first because it already matches desired engine.
- Then adapt Focus Block Workflow.
- Pomodoro can be last because it has custom distraction/garden logic.

Success criteria:

- Study timer behavior unchanged.
- Existing Focus Garden stats still work.
- Refresh/tab switch behavior is explicit and tested.

### Step 4: Notion / Export Compatibility Pass

Goal:

- Preserve exports while internal data model evolves.

Tasks:

- Build adapter functions:
  - `taskStoreToNotionDailyLogPayload`
  - `taskStoreToStudyDailyLogPayload`
  - `taskStoreToMarkdown`
- Keep existing API routes stable.
- Add duplicate protection to existing `push-daily-log` route to match Study route safety.
- Ensure category minute mappings are centralized.

Success criteria:

- Existing Daily Hub Notion export still works.
- Study Notion push still works.
- Missing optional Notion properties still skip safely.
- No duplicate Daily Log pages by date.

## 9. Summary Recommendation

Do not start by replacing UI components.

Start with a parallel `taskStore` and idempotent migration. The current app has three task-like systems:

- `Task` inbox.
- `DayBlock` queue.
- `StudyTaskTemplate` + `StudySessionRecord`.

They overlap but are not interchangeable yet. The safest refactor is to build a unifying data layer first, keep all current surfaces reading their old stores, then slowly point one workflow at a time to the unified store.

The Study timer is the best candidate to become the first shared timer-engine implementation because it already has the desired timestamp-based model.
