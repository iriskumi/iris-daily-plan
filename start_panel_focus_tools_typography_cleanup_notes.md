# Start Panel / Focus Tools / Typography Cleanup

## What changed

- Today Start Panel now shows only three primary entries:
  - Start Study
  - Start English
  - Start Exercise
- Removed visible Start Admin and Start Reset buttons from the Today Start Panel.
- Removed Reset from the Today Done visible stats/list so it does not feel like another formal task system.
- Removed the Today "Focus tools" panel that exposed Pomodoro, Focus Garden, and legacy next action.
- Added CSS guards that hide legacy Pomodoro / Focus Garden UI components while preserving code and localStorage data.
- Updated Chinese soft typography variables and Today Note styling toward a lighter LXGW WenKai / 小清新 notebook feel.
- Applied the softer Chinese font treatment to gentle Chinese helper copy and Exercise mission copy.

## What stayed intact

- Study Sessions and Study Timer
- Study Review
- English Output Journey
- English Listening Draw
- Exercise Log
- Media Log
- Plan
- Notion push
- Obsidian export
- Expression Hub import
- Existing localStorage data

## Data safety

No legacy localStorage keys were deleted or migrated.

Focus Garden, Pomodoro, Proof Vault, and older Quick Start data remain preserved; they are just not prominent in the main user-facing flow.

## Remaining review

- Decide later whether Admin should appear only as a Study category, a Task category, or both.
- Decide later whether Reset belongs only inside Before I Spiral / bedtime mode rather than Today Done.
