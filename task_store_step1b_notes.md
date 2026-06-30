# Task Store Step 1B Notes

## What Study actions now write to taskStore

- Starting a Study session from a preloaded template creates or updates a parallel `UnifiedTask` in `iris-task-store`.
  - `source`: `study-template-instance`
  - `context`: `study`
  - `templateId`: Study template id
  - `status`: `in-progress`
  - Includes category, energy, estimated minutes, note destination, resource suggestion, study method, and subtasks.
- Starting a custom Study session creates or updates a parallel `UnifiedTask` in `iris-task-store`.
  - `source`: `manual`
  - `context`: `study`
  - `status`: `in-progress`
  - Includes title, category, estimated minutes, note destination, and custom notes.
- Completing a Study session writes a parallel `UnifiedTaskSession`.
  - `engine`: `study`
  - `outcome`: `completed`
  - Linked to the matching task when a template id or custom task id exists.
  - The linked task status becomes `done`.
- Abandoning a Study session writes a parallel `UnifiedTaskSession`.
  - `engine`: `study`
  - `outcome`: `abandoned`
  - The linked task status becomes `abandoned` only when that task has no completed sessions.
- Active Study session changes are mirrored into `taskStore.activeTimer`, while the app still relies on the existing active-session storage.

## What still writes to old Study storage

- `iris-study-active-session` is still the active timer source used by the Study UI.
- `iris-study-session-records` is still written on completion and abandonment.
- Study Review still reads completed and abandoned records from `iris-study-session-records`.
- Study daily target and review localStorage keys are unchanged.
- Notion Study Daily Log push still reads the existing Study session and review data.

## Duplicate session write prevention

- Completed and abandoned Study sessions now use the active session id as the `StudySessionRecord.id`.
- The parallel `UnifiedTaskSession.id` uses the same id.
- `taskStore` writes use an upsert-by-id helper, so writing the same session id again updates the existing session instead of appending a duplicate.
- Template task ids are deterministic: `study-template-instance:{templateId}`.
- Custom task ids are deterministic for each custom active task: `manual-study:{customTaskId}`.

## Browser console test helpers

Use dynamic imports in the browser console while running the Vite dev server:

```js
const taskStore = await import('/src/taskStore.ts')
taskStore.getTaskStoreSummary()
JSON.parse(taskStore.exportTaskStoreJson())
taskStore.getStudySessionSummaryFromTaskStore()
```

Useful localStorage checks:

```js
JSON.parse(localStorage.getItem('iris-study-session-records'))
JSON.parse(localStorage.getItem('iris-task-store'))
```

## What was intentionally not changed

- Today, Plan, Tasks, Quick Add, Block Queue, Focus Garden, and Pomodoro behavior were not switched to `taskStore`.
- No old localStorage keys were deleted or migrated in place.
- No Study Review UI data source was changed.
- No Notion payload shape was changed.
- No Plan demotion was implemented.
- No shared timer engine was implemented.
- No Quick Add taskStore writes were implemented.

## Manual test checklist

1. Start a 25-minute Study session from a template.
2. Complete it.
3. Confirm old Study Review still shows the session.
4. Confirm `iris-study-session-records` still updated.
5. Confirm `iris-task-store` now has one matching `UnifiedTask` and one matching `UnifiedTaskSession`.
6. Repeat with a custom task.
7. Abandon one session and confirm `outcome: "abandoned"` in `iris-task-store`.
8. Refresh browser and confirm Study tab still works.
9. Run `getTaskStoreSummary()` through the dynamic import above and verify counts are reasonable.
10. Confirm Notion Study push still works as before.
