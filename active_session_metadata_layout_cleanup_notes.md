# Active Session Metadata Layout Cleanup

## Scope

- Redesigned the Today page active session hero as a wide, single-column surface.
- Removed the tall right-side `CURRENT TASK` information panel.
- Kept this as a UI-only cleanup; timer logic, active session state, Study session records, queue handoff, task store, localStorage, Today Done, Study Review, and routing were not changed.

## UI Changes

- The active task title now appears only once in the hero.
- Category, planned duration, source, pause state, method, and note destination are shown as compact, quiet metadata.
- The note destination shows the readable note name by default, with the full path available in the browser tooltip and collapsed session details.
- Pause, Complete, and Abandon remain the main action row.
- Open in Study remains available as a quieter secondary action.

## Verification

- Run `npm run build`.
- Run `git diff --check`.
