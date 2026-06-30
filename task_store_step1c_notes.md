# Task Store Step 1C Notes

## What Quick Add now writes to taskStore

- Homepage Habit Blocks now keep writing to `iris-block-queues-by-date` as before.
- When a Habit Block is added, the app also writes one parallel `UnifiedTask` to `iris-task-store.tasks`.
  - `source`: `quick-add-block`
  - `oldSource`: `iris-block-queues-by-date`
  - `oldSourceId`: original `DayBlock.id`
  - `scheduledDate`: block date
  - `scheduledBlockId`: original `DayBlock.id`
  - Includes title, category, priority, energy, estimated minutes, status, notes, and subtasks.
- The new DayBlock also stores `unifiedTaskId` so the queue item can be traced to the parallel taskStore record without changing `sourceTaskId` semantics.

## Focus Block quick task writes

- Focus Block quick task creation still writes to `iris-tasks` exactly as before.
- The same created task is also mirrored into `iris-task-store.tasks`.
  - `source`: `task-inbox`
  - `context`: `null`
  - `status`: `todo` for normal quick-created inbox tasks
  - `oldSource`: `iris-tasks`
  - `oldSourceId`: original `Task.id`

## Duplicate safety

- Habit Block taskStore ids are deterministic: `quick-add-block:{DayBlock.id}`.
- Focus quick task taskStore ids reuse the original `Task.id`.
- Writes use taskStore upsert-by-id behavior, so the same Quick Add action cannot append duplicate records if the same id is written again.
- Step 1A migration also uses the same ids, so running migration after Step 1C should update existing taskStore records rather than doubling them.

## What was intentionally not changed

- Today and Block Queue UI still read their old queue/task stores.
- Old localStorage keys were not deleted.
- Study timer and Study Review were not changed.
- Plan generation and Plan storage were not changed.
- Notion payloads were not changed.
- Shared timer engine was not implemented.
- Quick Add edits/status updates were not switched to taskStore as a source of truth.

## Browser console checks

Use these while running the app locally:

```js
const taskStore = await import('/src/taskStore.ts')
taskStore.getTaskStoreSummary()
JSON.parse(taskStore.exportTaskStoreJson()).tasks.filter(task => task.source === 'quick-add-block')
JSON.parse(taskStore.exportTaskStoreJson()).tasks.filter(task => task.source === 'task-inbox')
```

Old storage checks:

```js
JSON.parse(localStorage.getItem('iris-block-queues-by-date'))
JSON.parse(localStorage.getItem('iris-tasks'))
JSON.parse(localStorage.getItem('iris-task-store'))
```

## Manual QA

1. Add a Homepage Habit Block.
2. Confirm it appears in Today Block Queue as before.
3. Confirm `iris-block-queues-by-date` updated as before.
4. Confirm `iris-task-store` has one matching `UnifiedTask`.
5. Add a Focus Block quick task.
6. Confirm `iris-tasks` updated as before.
7. Confirm `iris-task-store` has one matching `UnifiedTask`.
8. Refresh page and confirm Today / Study / Plan / Tasks still work.
9. Run migration again and confirm counts do not double.
