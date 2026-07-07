# Block Queue / Study Session Flow Simplification

## Product rule

Block Queue is only today's candidate menu. It does not count as progress by itself.

Study/focus minutes are counted only after a Study/Timer session is completed. A queued task, suggested task, skipped task, or task moved later does not add focus minutes.

## What changed

- Suggested Next Block now has one clear primary action: `Start 25-min`.
- Block Queue cards now use:
  - `Start 25-min`
  - `Start 50-min`
  - `Done without timer`
  - `Later`
  - `Skip`
  - `Remove from today`
- `Start 25-min` and `Start 50-min` create an active Study timer session.
- Today page automatically opens Study after starting a queue session.
- `Done without timer` marks the queue block done, but does not add focus minutes.
- `Later` and `Remove from today` hide a block from today's queue without deleting the task.
- Hidden source-task blocks are preserved so they do not reappear after refresh.

## Large task behavior

Tasks estimated at 90 minutes or more are shown as large tasks.

The visible action title becomes a smaller first-pass version, for example:

- `AI Agents course - 25-min pass`
- `First 25 min: {task title}`

The original task title remains visible in the detail copy. The app does not force the full long task to be completed today.

## Study Review consistency

Study Review and Daily Study Log remain session-based:

- completed sessions count
- completed session minutes count
- category breakdown comes from completed sessions
- queued, skipped, later, or suggested blocks do not count

## Known limitation

Completing a Study timer started from a queue block does not currently auto-mark the queue block as done. This keeps the counting rule explicit, but Phase 4 could add a gentle follow-up prompt after a queue-started timer completes.
