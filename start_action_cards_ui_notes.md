# Today Start Action Cards UI Notes

## What changed
- Refined Today Start actions from oversized rounded buttons into compact horizontal action cards.
- Kept the same click behavior and routing.
- Changed the visible exercise label from `Log Exercise` to `Exercise`.
- Fixed the desktop hero layout so the cards sit in a readable right-side content area instead of being squeezed into a narrow column.
- Added helper lines:
  - Study: `Start a focus session`
  - English: `Listening or output`
  - Exercise: `Log movement`
- Added consistent soft icon containers and lighter beige card styling.

## What was not changed
- No session start/completion logic changed.
- No exercise log logic changed.
- No statistics or Today Done behavior changed.
- No localStorage data models changed.

## Manual QA
1. Open Today with no active session.
2. Confirm the three actions appear as compact horizontal cards.
3. Click Study and confirm it still starts/focuses a Study session.
4. Click English and confirm it still opens the Study English area.
5. Click Exercise and confirm it still opens the Exercise movement log.
6. Confirm mobile stacks the cards cleanly.
