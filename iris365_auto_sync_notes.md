# Iris365 Auto Sync Notes

## What changed
- Added a read-only Iris365 sync helper in `src/iris365Sync.ts`.
- Iris365 now derives today's external proof from:
  - `iris-exercise-log` for Body moved.
  - `iris-english-output-journey` for English output.
- Body moved displays as complete when today's Exercise log has movement minutes.
- English output displays as complete when today's English Output Journey has reps.
- The visible `0 / 3` anchor count uses merged proof:
  - manual Body moved OR Exercise auto proof
  - manual English output OR English Output Journey auto proof
  - manual One real thing done
- Anchor cards show subtle source text, such as `Auto from Exercise · 20 min` or `Manual proof`.

## Boundaries
- Iris365 does not create Exercise logs.
- Iris365 does not create Study Sessions.
- Iris365 does not create English Output reps.
- Existing Iris365 archive data remains intact.
- Existing localStorage key names are unchanged.

## Manual checks
- Log Exercise today, then open Iris365: Body moved should be complete and show minutes.
- Complete English Output / add English reps today, then open Iris365: English output should be complete and show reps.
- Manually check Body moved without Exercise: it should save as manual proof and persist after refresh.
- If Exercise exists and Body moved is manually unchecked, the displayed state should remain complete due to auto proof.
