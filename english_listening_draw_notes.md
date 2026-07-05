# English Listening Draw Notes

## What was added
- Added `src/englishListeningDraw.ts` for the daily draw pool, mode rules, localStorage persistence, redraw limit, and Obsidian note prompt.
- Added an English Listening Draw / 今日英语抽签 card in the Study tab.
- Added mode selection, draw, redraw, redraw count, latest draw display, copy prompt, and Start as Study Session.
- Hooked drawn tasks into the existing Study timer instead of adding a separate timer.
- Simplified the feature to two playful modes: `精听 / Shadowing` and `泛听 / Light Input`.

## Storage
- Uses localStorage key `iris-english-listening-draw`.
- Stores one local-date state with `redrawLimit`, `redrawsUsed`, and draw results.
- Resets naturally when the local date changes.
- Keeps the same storage key and maps old mode values into the new modes:
  - old intensive, Australian English, workplace, and output challenge modes map to `shadowing`.
  - old low-energy input maps to `light-input`.

## Material rules
- `精听 / Shadowing` strongly prefers Australian or Australia-relevant material such as Gruen, The Assembly, Utopia, Fisk, Rosehaven, Upper Middle Bogan, Aussie panel shows, workplace/admin clips, and Holmesglen roleplay.
- Secondary shadowing materials include WorkLife, No Stupid Questions, Luke's English Podcast, Coursera AI concept explanation, and TED / WorkLife-style workplace psychology clips.
- `泛听 / Light Input` stays recovery-friendly and uses gentle audiobook, Australian TV, and light podcast materials.
- Light Input stays English Input and does not automatically count as an English Output Rep.
- Shadowing uses English Output so completed Study sessions can flow into the English Output Journey logic.
- The main pool does not include YouGlish, Friends, Modern Family, Brooklyn Nine-Nine, How I Met Your Mother, random search, technical lecture material, or emotionally heavy material.

## Existing behavior preserved
- Study timer still handles active sessions.
- Study Review still reads completed Study session records.
- English Output Journey still counts completed English Output sessions.
- taskStore parallel writes still use the existing Study session flow.
- Notion Study Daily Log export remains schema-compatible.

## Manual QA
1. Open Study tab.
2. Confirm the mode selector only shows `精听 / Shadowing` and `泛听 / Light Input`.
3. Redraw and confirm the daily redraw count decreases.
4. Confirm the same material is avoided where possible within the day.
5. Copy the Obsidian note prompt.
6. Start a drawn task as Study Session.
7. Complete it and confirm it appears in Study Review.
8. Confirm English Output Journey increments for Shadowing draws, not Light Input draws.
