# Phase 1 Visual Refresh Notes

**Date:** 2026-07-12  
**Reference:** `iris_daily_hub_visual_refresh_audit.md`  
**Scope:** CSS / design tokens only — no functionality changes.

---

## Summary

Phase 1 shifts Iris Daily Plan Hub from beige-on-beige “quiet luxury diary” toward a **Korean clean workspace** feel: light cream shell, white cards, blue primary actions, improved text contrast, sans-serif operational typography, while **preserving Focus Mode** (serif timer + warm cocoa Complete).

---

## Token before / after

| Token | Before | After |
|-------|--------|-------|
| Background | `#F7F1EA` | `#F4F2EE` |
| Card / surface | `#FFFBF5` gradient | `#FFFFFF` |
| Border | `#E7D9CC` / soft brown rgba | `#E3E0DA` |
| Text primary | `#342721` | `#2A2522` |
| Text muted | `#75655B` / `#9A8B80` | `#7A726A` |
| Primary action | Cocoa gradient `#C8A48D→#9D725E` | Blue `#6F96D6` |
| Primary hover | `#815947` | `#5C85CC` |
| Selected soft | `#EFE0D5` beige | `#EEF4FC` blue |
| Warm accent | (same as primary) | `#9D725E` (Focus Complete only) |
| Media rose | brown gradient | `#C98F8A` |

New semantic tokens: `--color-success`, `--color-warning`, `--color-danger` (+ soft backgrounds).

Fonts added: **Inter**, **Bricolage Grotesque** (Google Fonts import).

---

## What changed

### Global (`src/index.css`)

1. **`:root` block** (~line 9588) — Phase 1 palette and aliases mapped to existing `--accent`, `--text`, `--surface`, etc.
2. **Page shell** — Simpler cream gradient background; header uses light wash.
3. **Cards** — White `#FFFFFF`, solid `#E3E0DA` border, soft blue-gray shadow.
4. **Buttons** — `.btn-primary` → solid blue; `.btn-secondary` → white outline; sentence case.
5. **Focus exception** — `.today-active-session-hero .today-active-actions .btn-primary` stays warm cocoa gradient for **Complete**.
6. **Typography** — Page titles / card headings → `--font-display-workspace` (Bricolage/Inter); Focus timer keeps Cormorant.
7. **Labels** — Form/section labels: 0.8125rem semibold, no forced uppercase.
8. **Navigation** — Active tab: `#EEF4FC` background + blue text; inactive tabs darker muted.
9. **Progress bars** — 8–10px height, blue fill on soft blue track.
10. **Badges** — Semantic tints: today/calendar=blue soft, life kind=warm, deadline urgent/soons= danger/warning, scope connected=green.
11. **Decorative reduction** — Hidden Today coffee/notebook CSS art and ✦ panel marker.
12. **Media tab** — Rose primary buttons and scoped `--media-*` tokens aligned to Phase 1.
13. **End-of-file override block** — Wins cascade over later beige-specific rules (Today, Media, Study focus shell, etc.).

### Not changed

- Component TSX logic
- Routes, localStorage, schemas
- Focus Mode layout and timer scale
- Feature set

---

## Manual QA checklist

| Area | Check |
|------|-------|
| Today | Next/Start blue; active session Complete warm cocoa; less beige decoration |
| Tasks | White cards; readable form labels; action buttons distinct |
| Study | Focus hero readable; Start blue |
| Plan | Queue cards white; Start here clear |
| Iris365 | Progress bars thicker / bluer |
| Exercise | Gentle white cards |
| Media | Rose primary buttons |
| Integrations | Scope chips color-coded |
| Focus Mode | Serif timer intact; Complete not blue |

---

## Files touched

- `src/index.css` — all Phase 1 changes
- `phase1_visual_refresh_notes.md` — this file

---

## Next (Phase 2, not in scope)

- Consolidate / remove obsolete mid-file theme blocks (~8156, ~9081, pink diary remnants)
- Per-page component polish (TaskInbox badge reduction, Today hero typography scale)
- Optional sidebar-style nav layout
- English listening draw rose secondary styling refinement
