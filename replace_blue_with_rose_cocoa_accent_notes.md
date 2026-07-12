# Replace blue with rose-cocoa accent — notes

**Date:** 2026-07-12  
**Scope:** CSS / token polish only (follow-up to Phase 1 workspace refresh)

---

## Why

Phase 1 improved clarity (white cards, readable text, cleaner structure), but the **blue accent** (`#6F96D6`) felt borrowed from Job Search Hub — too cool/corporate for Daily Hub’s cream/beige Korean soft workspace.

This pass **keeps Phase 1 structure** and swaps primary/selected accents to **muted rose-cocoa**.

---

## New accent tokens

| Token | Value | Role |
|-------|-------|------|
| `--accent-primary` | `#B8897F` | Primary buttons, active progress |
| `--accent-primary-hover` | `#A9786F` | Hover / strong fill |
| `--accent-soft` | `#F4E7E3` | Selected nav, chips, progress track |
| `--accent-border` | `#E5CFC8` | Selected outlines |
| `--accent-text` | `#6F4E45` | Active tab text, chip labels |

Mapped to existing aliases:

- `--color-accent` → `--accent-primary`
- `--color-accent-strong` → `--accent-primary-hover`
- `--color-accent-soft` → `--accent-soft`
- `--color-accent-muted` → `--accent-border`
- `--accent` / `--accent-2` → same chain

Removed from Daily Hub UI: `#6F96D6`, `#5C85CC`, `#EEF4FC`, `#CFDEF4`, `#4A6FA8`, blue-tinted shadows.

---

## What changed

### Navigation

- Active tab: `accent-soft` background + `accent-border` border + `accent-text`
- Hover: subtle rose tint (`accent-soft`)
- Inactive: warm gray `#7A726A` (unchanged readability)

### Primary buttons (non-Focus)

Flat rose-cocoa fill — **no heavy brown gradient**:

- Add to Today, Start, Open in Study, Schedule, Save, Import, Sync
- Shadow: `rgba(184, 137, 127, 0.22)` (warm, not blue)

### Focus Mode (preserved)

- `.today-active-session-hero .today-active-actions .btn-primary` — still warm cocoa gradient for **Complete**
- `.today-active-progress span` — still warm progress fill
- Serif timer unchanged

### Progress & selection

- General progress bars: rose-cocoa gradient on `accent-soft` track
- Selected chips / filter active / in-progress queue: `accent-soft` + `accent-border`
- Calendar scheduled badge: rose-cocoa (was blue inline rule)

### Semantic colors (unchanged)

- Success green, warning amber, danger rose for overdue/status

### Still kept from Phase 1

- White cards `#FFFFFF`
- Background `#F4F2EE`
- Sans workspace typography outside Focus
- Reduced decorative Today art hidden

---

## Files touched

- `src/index.css` — `:root` tokens + nav, buttons, progress, overrides
- `replace_blue_with_rose_cocoa_accent_notes.md` — this file

---

## Verification

- `npm run build` — pass
- `git diff --check` — pass
- Manual: refresh http://localhost:5173/ — Today tab active state and primary buttons should read **warm rose-cocoa**, not blue

---

## Not changed

- Component logic, routes, localStorage, schemas
- Focus Mode layout and Complete behavior
- Media tab can still use `--color-media-rose` (`#C98F8A`) for entertainment-specific actions
