# Study Session Task Selection Bug Notes

## Audit: session start paths
- Today Start Study: previously created a generic 25-minute Study session with `Review / NotebookLM` as the fallback category. It now opens the current Today next block in Study when available, otherwise asks the user to choose a task first.
- Today Next / Block Queue: writes a one-time `iris-study-selected-task-handoff` and navigates to Study. Study consumes it once and uses the handed-off title/category/id.
- Plan -> Open in Study: uses the same queue handoff path as Today queue. It selects the exact queue-linked task and does not auto-start.
- Study Task Picker: templates are still selectable, but there is no default first-template selection. A template starts only after the user explicitly selects it.
- English Listening Draw: starts from the drawn result title/category/id directly.
- Custom Study task: starts only when the user enters a title.
- Active session restore: restores the stored active session title/category without re-resolving to a template fallback.

## Fixes
- Removed implicit fallback to the first Study Task Library template.
- Removed Today Start Study's automatic generic `Review / NotebookLM` session creation.
- Pressing Study Start with no queue handoff or selected template now shows `Choose a task first.` and scrolls to the task picker.
- Category selector no longer auto-selects the first template in that category.
- Queue handoff clears stale template selection.
- Selecting a template clears stale queue handoff state.
- `iris-study-focus-target` is consumed once for both `english` and `timer` targets.
- Development-only `[StudySessionStart]` logging now records requested/resolved task id, title, and source.

## Preserved
- Timer engine behavior.
- Active session persistence.
- StudySessionRecord schema.
- taskStore writes.
- Today Done and Study Review.
- Existing completed records.

## Manual checks
1. Today Start Study with a Next block opens that exact block in Study.
2. Today Start Study with no Next block does not start a session and asks to choose a task.
3. Plan -> Open in Study -> Start uses the exact queue task.
4. Study with no selected task -> Start shows `Choose a task first.`
5. Selecting `Review / NotebookLM` manually still starts that template.
6. English Listening Draw starts the drawn task.
