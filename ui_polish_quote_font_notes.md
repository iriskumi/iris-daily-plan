# Today Note Quote Font Polish

## What changed
- Added the custom font asset at `public/fonts/ELEYANG-Plog.ttf`.
- Registered the font with `@font-face` in `src/index.css`.
- Added `today-note-quote-cn` to the main Chinese quote text in the Today Note card.
- Scoped the ELEYANG Plog font only to the Today Note Chinese quote.

## What stayed unchanged
- English subtitle styling remains in the existing UI font.
- Navigation, buttons, labels, task cards, body text, routing, app logic, and localStorage behavior were not changed.

## Manual QA
1. Open the Today tab.
2. Confirm the Chinese Today Note quote uses the softer handwritten ELEYANG Plog font.
3. Confirm the English sub-line under the quote still uses the normal clean UI font.
4. Check that other app text has not inherited the custom quote font.
