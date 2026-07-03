# Today Note Quote Font Polish

## What changed
- Added the custom font asset at `public/fonts/ELEYANG-Plog.ttf`.
- Registered the font with `@font-face` in `src/index.css`.
- Added `today-note-quote-cn` to the main Chinese quote text in the Today Note card.
- Updated the Today Note Chinese quote to use `LXGW WenKai Screen` first, with Chinese handwriting-style fallbacks.
- Reduced the quote size slightly so it feels softer and less like a bold app heading.
- Added `today-note-quote-en` to keep the English subtitle in the existing clean UI style.

## Why the font was updated
- `ELEYANG Plog` did not appear to render the Chinese quote as intended, likely because its Chinese glyph support was missing or unsuitable.
- The quote now prefers a Chinese-capable note-style font instead of falling back to a default bold system Chinese font.

## What stayed unchanged
- English subtitle styling remains in the existing UI font.
- Navigation, buttons, labels, task cards, body text, routing, app logic, and localStorage behavior were not changed.

## Manual QA
1. Open the Today tab.
2. Confirm the Chinese Today Note quote uses the softer handwritten LXGW WenKai Screen style.
3. Confirm the English sub-line under the quote still uses the normal clean UI font.
4. Check that other app text has not inherited the custom quote font.
