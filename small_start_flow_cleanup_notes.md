# Small Start Flow Cleanup Notes

## Scope

This was a small UX cleanup only. No localStorage schema, taskStore data model, Study timer internals, Notion export, Obsidian export, Media, Exercise, Iris365, or integrations were changed.

## What changed

- Restored `Tasks` as a top-level navigation item.
- Moved the full Task Inbox/Templates surface out of Plan.
- Replaced the embedded Plan task area with a small `Need to manage tasks?` card and `Open Tasks` button.
- Clarified start labels across the app:
  - Block Queue starts are now `Start 25-min Study` / `Start 50-min Study`.
  - Task Inbox starts are now `Start Pomodoro`, or `Start 25-min Pomodoro` / `Start 50-min Pomodoro` for long tasks.
  - Plan time block start is now `Start timeline focus`.
  - Today Quick Start is now `Start gentle session`.
  - Low-energy rescue timers are labelled as rescue timers.
- Added subtle Task Inbox copy:
  - `Pomodoro sessions are separate from Study Sessions unless started from Study.`

## Long task behavior

Tasks with `estimatedMinutes >= 90` now show:

- `Large task`
- `{estimatedMinutes} min total`
- `Start 25-min Pomodoro`
- `Start 50-min Pomodoro`

The original `estimatedMinutes` value is preserved. Starting or completing a 25/50-minute Pomodoro does not automatically mark the full large task complete.

## Counting boundaries

- Study time is still counted from completed Study Sessions.
- Pomodoro/Focus Garden time is still counted by Pomodoro completion.
- Quick Start remains a Today traces / Visible Effort flow.
- Queue presence and Task Inbox presence do not count as progress by themselves.

## Follow-up ideas

- Consider giving Task Inbox a lightweight `Later` action if it becomes noisy again.
- Consider a single shared active-session banner if multiple timer systems continue to feel confusing.
