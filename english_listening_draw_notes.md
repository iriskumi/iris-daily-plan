# English Listening Draw Notes

## What was added
- Added `src/englishListeningDraw.ts` for the daily draw pool, mode rules, localStorage persistence, redraw limit, and Obsidian note prompt.
- Added an English Listening Draw / 今日英语抽签 card in the Study tab.
- Added mode selection, draw, redraw, redraw count, latest draw display, copy prompt, and Start as Study Session.
- Hooked drawn tasks into the existing Study timer instead of adding a separate timer.

## Storage
- Uses localStorage key `iris-english-listening-draw`.
- Stores one local-date state with `redrawLimit`, `redrawsUsed`, and draw results.
- Resets naturally when the local date changes.

## Material rules
- Intensive Listening / Shadowing excludes lookup tools, generic search, overly technical lectures, passive audiobook-only tasks, and Friends.
- Low-energy Input stays English Input and does not automatically count as an English Output Rep.
- Output/shadowing modes use English Output so completed Study sessions can flow into the English Output Journey logic.

## Existing behavior preserved
- Study timer still handles active sessions.
- Study Review still reads completed Study session records.
- English Output Journey still counts completed English Output sessions.
- taskStore parallel writes still use the existing Study session flow.
- Notion Study Daily Log export remains schema-compatible.

## Manual QA
1. Open Study tab.
2. Draw one material in each mode.
3. Redraw and confirm the daily redraw count decreases.
4. Confirm the same material is avoided where possible within the day.
5. Copy the Obsidian note prompt.
6. Start a drawn task as Study Session.
7. Complete it and confirm it appears in Study Review.
8. Confirm English Output Journey increments for English Output draws, not Low-energy Input draws.
