# Task Store Step 1A Notes

## 1. Files Added

- `src/taskStoreTypes.ts`
  - Defines the parallel unified task model types.
- `src/taskStore.ts`
  - Defines read/write helpers for the new store.
  - Adds `exportTaskStoreJson()`.
  - Adds `getTaskStoreSummary()`.
- `src/taskStoreMigration.ts`
  - Defines an opt-in migration preview and migration writer.
  - No UI imports this file yet.

## 2. Keys Read

The Step 1A migration preview reads old keys only. It does not mutate them.

- `iris-tasks`
- `iris-block-queues-by-date`
- `iris-study-session-records`
- `iris-study-active-session`
- `iris-focus-sessions`
- `iris_focus_blocks`
- `focusBlocksByDate`

It also reads static templates from:

- `src/studyTaskLibrary.ts`

## 3. Keys Written

Only these new keys are written when `migrateTaskStoreStep1A()` is called manually:

- `iris-task-store`
- `iris-task-store-migration`

No old keys are deleted or mutated.

## 4. Migration Summary

Migration sources:

- `iris-tasks` becomes `UnifiedTask[]` with `source: "task-inbox"`.
- `iris-block-queues-by-date`:
  - Blocks with `sourceTaskId` update scheduling metadata on the matching migrated task when possible.
  - Blocks without a matching source task become `UnifiedTask` records with `source: "quick-add-block"`.
- Static Study task templates become `UnifiedTaskTemplate[]`.
- `iris-study-session-records` becomes `UnifiedTaskSession[]` with `engine: "study"`.
  - Because historical Study sessions may not have durable task IDs, matching synthetic history tasks are created.
- `iris-study-active-session` becomes `UnifiedActiveTimer`.
- `iris-focus-sessions` becomes `UnifiedTaskSession[]` with best-effort engine detection.
- `focusBlocksByDate` and `iris_focus_blocks` become focus-block sessions and best-effort scheduled metadata on existing tasks.
- `plansByDate` is intentionally not converted in Step 1A.

## 5. Idempotency

The migration uses deterministic IDs and upserts by `id`.

- Existing task IDs are preserved for `iris-tasks`.
- Study template IDs are preserved.
- Study session IDs are preserved.
- Focus sessions are namespaced as `focus-session:{oldId}`.
- Focus blocks are namespaced as `focus-block:{oldId}`.
- Quick-add queue-only tasks are namespaced as `quick-add-block:{blockId}`.
- Synthetic Study history tasks are namespaced as `study-history:{templateId|customTaskId|sessionId}`.

Running `migrateTaskStoreStep1A()` more than once should not duplicate tasks, templates, or sessions.

The migration marker stores:

- migration version
- migratedAt
- source task IDs
- queue block IDs
- study template IDs
- study session IDs
- focus session IDs
- focus block IDs
- active timer IDs

## 6. Intentionally Not Changed

- Today still reads old stores.
- Study still reads old Study stores.
- Plan still reads `plansByDate`.
- Tasks still reads `iris-tasks`.
- Block Queue still reads `iris-block-queues-by-date`.
- Timers are unchanged.
- Notion push is unchanged.
- Plan is not demoted.
- No old localStorage keys are deleted.
- No migration runs automatically on app load.

## 7. Manual Test Steps

In a browser console after loading the app, import or expose the migration helpers during a later debug UI step.

Suggested manual checks for a future debug surface:

1. Call `previewTaskStoreMigrationSummary()`.
2. Confirm task/template/session counts look plausible.
3. Call `migrateTaskStoreStep1A()`.
4. Confirm `localStorage.getItem("iris-task-store")` exists.
5. Confirm `localStorage.getItem("iris-task-store-migration")` exists.
6. Call `migrateTaskStoreStep1A()` again.
7. Confirm counts do not increase unexpectedly.
8. Confirm Today / Study / Plan / Tasks behavior remains unchanged.
9. Export with `exportTaskStoreJson()` and inspect source/context/engine counts.
