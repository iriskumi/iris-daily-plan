# Active Session Home and Integrations Cleanup

## What changed

- The bulky Expression Review Hub import panel was simplified into a compact Integrations card.
- The normal Integrations view now shows only two primary actions:
  - Open Expression Review Hub
  - Sync available reps
- Manual pasted JSON import is still available, but it now lives under a collapsed Advanced import tools section.
- When a Study session is active, Today shows it as the main active session hero with countdown, elapsed time, remaining time, progress, and Pause / Resume / Complete / Abandon actions.
- Study Dashboard now places the active timer near the top when a session is running. The inactive timer remains in the normal Study flow.
- Other tabs show a compact active-session bar so the running Study session is visible without taking over the page.

## What stayed the same

- Expression Hub import parsing and localStorage queue import support were kept.
- Study timer storage and session record schema were not changed.
- Existing Study Session, English Output Journey, taskStore, Notion, Obsidian export, Media, Exercise, and Today data flows were preserved.

## Notes

- Focus minutes still count only when a Study session is completed.
- The Today active session hero is intentionally only for active Study sessions. Exercise log drafts should not create a fake active session.
- Manual JSON import is intentionally treated as an advanced fallback, not a normal daily action.
