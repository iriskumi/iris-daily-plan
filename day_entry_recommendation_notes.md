# Day Entry Recommendation Notes

## Product Intent

- Make Today feel like the place to enter the day, not just a set of available tools.
- Support the realistic goal of either:
  - 8 hours / 480 minutes of counted serious work, or
  - 5 completed serious Study/session tasks.
- Keep the app grounded in actual evidence: completed timed sessions and queue tasks.

## What Was Added

- Today now records a lightweight local entry record when the Today page is opened:
  - date
  - first opened time
  - last seen time
  - open count
- Storage key: `iris-today-entry-records`.
- A new Day Entry card appears after the Start hero and Daily Rhythm panel.
- The card shows:
  - first opened time
  - last seen time
  - current time-window label
  - 8h evidence progress
  - 5 serious tasks progress
  - recommended current task from the existing Today queue
  - direct Start 25 min / Study / Queue actions

## Recommendation Logic

- The recommendation is intentionally simple and local:
  - morning: start the next queue task while attention is fresh
  - midday/afternoon: do one serious 25-minute block before the day gets vague
  - evening: choose a contained or lighter useful block
  - late night: review or prepare tomorrow's first task
- If a queue task exists, it is used as the recommended task.
- If no queue task exists, the card points the user to Study or the queue.

## Boundaries

- This does not monitor other desktop apps or computer activity.
- It only records Daily Hub open/return times in localStorage.
- No task schema, timer logic, queue handoff, StudySessionRecord, Today Done, routing, or existing queue behavior was changed.
