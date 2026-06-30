# Timer Engine Step 3B Notes

## What changed

- Connected the existing Focus Block Workflow to the shared `timerEngine`.
- Added active focus-block timer persistence under:
  - `iris-focus-block-timer-engine-active`
- Focus Block active timers now use:
  - `engine: 'focus-block'`
  - `startedAt`
  - `durationPlannedMin`
  - `pausedIntervals`
  - `Date.now()` through `timerEngine.remainingMs()`
- Refresh recovery now restores an active Focus Block timer from the engine key.
- If no engine timer exists yet, an active `Doing` FocusBlock is safely upgraded from existing block fields:
  - `id`
  - `taskId`
  - `minutes`
  - `startTime`
- Tab switching recalculates remaining time by refreshing `Date.now()`.

## Existing behavior preserved

- Focus Block UI was not redesigned.
- Starting a Focus Block still writes the old FocusBlock record.
- Old focus block storage remains compatible:
  - `focusBlocksByDate`
  - `iris_focus_blocks`
- Completing a Focus Block with `Done` still writes to `iris-focus-sessions`.
- Focus Garden stats still read `iris-focus-sessions`.
- Linked task behavior is preserved:
  - `Done` marks task `Done`
  - `Partial` marks task `Planned`
  - `Skipped` marks task `Skipped`
  - `Changed` marks task `Planned`
- Adding 5 minutes still extends the current block and now also updates the active timer session duration.

## taskStore mirror

- Completing, skipping, partially completing, or changing a Focus Block also writes a parallel taskStore session.
- taskStore session uses:
  - `engine: 'focus-block'`
  - `outcome: 'completed'` for `Done`
  - `outcome: 'abandoned'` for `Partial`, `Skipped`, and `Changed`
- This does not replace old storage and does not affect Focus Garden stats.

## Duplicate safety

- `iris-focus-sessions` writes are now idempotent by session id.
- Focus Block completion uses deterministic session id:
  - `focus-session:{focusBlockId}`
- taskStore sessions also upsert by id.

## What was intentionally not changed

- Study timer from Step 3A was not changed.
- PomodoroTimer was not changed.
- FocusGarden was not changed.
- Today / Study / Plan / Tasks layout was not changed.
- Plan behavior was not changed.
- Notion payloads were not changed.
- Shared timer migration for Pomodoro / Focus Garden is deferred to a later step.

## Manual QA checklist

1. Start a Focus Block from existing workflow.
2. Confirm countdown displays correctly.
3. Switch browser tabs and return.
4. Confirm remaining time recalculates correctly.
5. Refresh during active focus block.
6. Confirm active focus block restores.
7. Complete focus block.
8. Confirm `iris-focus-sessions` still receives a FocusSession.
9. Confirm Focus Garden stats still update.
10. Confirm linked task behavior remains the same.
11. Confirm Study timer from Step 3A still works.
12. Confirm Today / Study / Plan / Tasks still open.
