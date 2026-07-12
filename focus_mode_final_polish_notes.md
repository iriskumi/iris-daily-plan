# Focus Mode Final Polish Notes

## Scope

- Polished the dedicated Today Focus Mode without changing timer engine logic, Study session state, StudySessionRecord, localStorage keys, Today Done, Study Review, or routing.
- Kept the approved centered editorial layout, warm ivory/cocoa palette, large countdown, and strong Complete button hierarchy.

## Changes

- Timer display now refreshes every second while still using the existing timer engine `elapsedMs` and `remainingMs` calculations.
- Progress labels now read `elapsed` and `left`.
- Status pill is dynamic: `FOCUSING`, `PAUSED`, or `FINAL 5 MIN`.
- `Open in Study` is now `Back to Study`.
- Abandon is a quiet text-style action with a lightweight confirmation dialog.
- Session metadata now appears as a compact strip under the timer card:
  - Source
  - Method
  - Note destination
- The full note path stays out of the main UI and can be copied from the small note-path button when available.
- Today dashboard modules and next-action cards are hidden while a Study focus session is active.
- Removed the visible motivational footer pattern from the focus state.

## Verification

- Run `npm run build`.
- Run `git diff --check`.
