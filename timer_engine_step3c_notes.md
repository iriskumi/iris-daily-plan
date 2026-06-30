# Timer Engine Step 3C Notes

## What changed

- Connected `PomodoroTimer` to the shared `timerEngine`.
- Pomodoro focus and break phases now use `TimerSession` with:
  - `engine: 'pomodoro'`
  - `startedAt`
  - `durationPlannedMin`
  - `pausedIntervals`
  - `Date.now()` based remaining time
- Pomodoro active state is persisted under:
  - `iris-pomodoro-timer-engine-active`
- Refresh during an active Pomodoro restores:
  - current phase
  - running/paused state
  - completed session count
  - distraction count/message
  - active timer session

## Preserved behavior

- Pomodoro UI was not redesigned.
- Focus Garden UI was not redesigned.
- Focus Garden stats still read `iris-focus-sessions`.
- Eligible completed Pomodoro focus sessions still write old `FocusSession` records to `iris-focus-sessions`.
- Repeated distractions still prevent garden credit.
- Leaving the tab during focus still:
  - pauses the session
  - increments distraction count
  - shows the existing distraction message
- Hidden tab time is not counted as focused time.
- Break phase behavior is preserved.

## timerEngine behavior

- Manual Pause records a paused interval.
- Manual Resume resumes the active timer session.
- Tab hidden during focus records a paused interval.
- Returning to the tab does not auto-resume; the user resumes with the existing Resume button, matching old behavior.
- Expired running focus sessions complete from `timerEngine.remainingMs()`.
- Expired running break sessions advance the existing Pomodoro phase flow.

## taskStore

- Completed Pomodoro sessions are mirrored to taskStore only when a real `taskId` exists.
- No synthetic task is created for Pomodoro sessions without a task id.
- `iris-focus-sessions` remains the source of truth for Focus Garden for now.

## What was intentionally not changed

- Study timer behavior was not changed.
- Focus Block Workflow behavior was not changed.
- Today / Study / Plan / Tasks layout was not changed.
- Notion payloads were not changed.
- Focus Garden stats model was not changed.

## Manual QA checklist

1. Start Pomodoro focus session.
2. Confirm countdown works.
3. Switch browser tab during focus.
4. Confirm distraction/pause behavior matches old behavior.
5. Return to tab and resume/continue as expected.
6. Complete Pomodoro focus session.
7. Confirm `iris-focus-sessions` updated.
8. Confirm Focus Garden stats update.
9. Confirm Focus Garden visual still works.
10. Confirm Study timer still works.
11. Confirm Focus Block Workflow still works.
12. Refresh during Pomodoro and confirm behavior is acceptable/documented.
13. Today / Study / Plan / Tasks still open.
