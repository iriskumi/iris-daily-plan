# Iris Daily Hub — Visual Refresh Audit & Design Direction

**Date:** 2026-07-12  
**Scope:** Read-only UI/style audit of Iris Daily Plan Hub  
**Goal:** Propose a visual refresh that keeps warmth and personality while moving toward the clearer, lighter, action-first feel of Iris Job Search Hub and Expression Review Hub.

**No code changes in this document.** Implementation is deferred to a follow-up phase.

---

## Executive summary

Iris Daily Plan Hub currently reads as a **warm editorial diary**: layered beige gradients, Cormorant Garamond headings, cocoa-brown primary buttons, pill controls with wide letter-spacing, and decorative card flourishes (✧, ♡, ✦, CSS “coffee cup” motifs). That was charming early on, but after Job Search Hub and Expression Review Hub it now feels **soft, same-y, and low-contrast** — more “lifestyle planner” than “action workspace.”

Your newer apps succeed because they feel like **tools**:

| Quality | Job Search / Expression Review direction | Daily Hub today |
|--------|------------------------------------------|-----------------|
| Surfaces | Near-white cards on light app background | Cream-on-cream gradients everywhere |
| Primary actions | Soft blue (`#6F96D6`) — obvious, scannable | Cocoa gradient on almost every CTA |
| Typography | Inter / Bricolage Grotesque — sans throughout | Serif page titles + sans body = blog/planner mix |
| Navigation | Sidebar workspace, clear active state | Horizontal top tabs, muted inactive labels |
| Contrast | `#2B313B` text on `#FFFFFF` | `#9A8B80` labels on `#F7F1EA` |
| Decoration | Minimal; structure carries mood | Decorative pseudo-elements, editorial imagery |
| Mental model | “What do I do next?” | “What mood am I in?” |

**Recommended direction:** **Korean clean workspace with warm undertone** — light cream app shell, white/near-white cards, blue-gray for primary actions, cocoa/beige reserved for Focus Mode completion, Media comfort, and personal accents. Daily Hub should feel **awake and actionable**, not beige-corporate and not scrapbook-soft.

---

## Visual diagnosis

### Root cause: stylesheet accumulation

Almost all styling lives in a single file: `src/index.css` (~14,400 lines). There are **four stacked `:root` theme blocks** (original cream diary → Korean warm → pink diary → “quiet luxury beige polish”). The last block wins, but earlier rules still leak through page-specific overrides, duplicate button definitions, and conflicting gradients.

**Effective runtime palette (bottom `:root`, ~line 9589):**

| Token | Value |
|-------|-------|
| Background | `#F7F1EA` / wash `#FBF7F1` |
| Card | `#FFFBF5` |
| Surface soft | `#F1E7DC` |
| Border | `#E7D9CC` |
| Text | `#342721` |
| Text muted | `#75655B` |
| Text soft | `#9A8B80` |
| Section label | `#A28F80` |
| Accent strong (primary button) | `#9D725E` |
| Accent soft | `#EFE0D5` |

**Primary button (final theme):** gradient `#C8A48D → #9D725E`, cream text — used for Start, Add to Today, Open in Study, Schedule, Save, Generate, etc.

### Problem 1 — Beige-on-beige, low contrast

| Area | Issue |
|------|-------|
| **Page background + cards** | `#F7F1EA` page + `#FFFBF5` cards + `rgba(166,134,114,0.18)` borders → cards **float into** background |
| **Section labels** | `#A28F80` at 0.69rem, uppercase, 0.12em tracking — hard to read on cream |
| **Nav inactive tabs** | `#9A8B80` — tabs feel disabled even when valid |
| **Ghost / tertiary text** | `--text-3`, task location lines, placeholders at ~62% opacity brown |
| **Completed tasks** | `.task-done` at `opacity: 0.45` — too faint for scanability |
| **Form labels** | Same uppercase micro-label treatment as decorative section labels |

**WCAG risk:** Small uppercase labels and muted browns on warm backgrounds likely fail AA for body-sized helper text.

### Problem 2 — Serif overuse outside Focus Mode

| Element | Font | Effect |
|---------|------|--------|
| `.page-title` | Cormorant Garamond | Every tab feels like a magazine spread |
| Today hero / grounding quotes | Noto Serif SC / display | Editorial, not operational |
| Focus timer (`.today-active-timer`) | `--font-display` serif | **Correct** — keep here |
| Active session confirm dialogs | Serif headings | Breaks tool consistency |
| Buttons, badges, nav, forms | Sans (Zen Kaku / PingFang) | Good — but drowned by serif headers |

Job Search Hub uses **Bricolage Grotesque** for display — still personality, but **sans and workspace-native**. Expression Review Hub copy (“One clear next step, not a dashboard to stare at”) matches that tool tone.

### Problem 3 — One brown button style for everything

Primary (`.btn-primary`), secondary (`.btn-secondary`), queue actions (`.block-queue-action-primary`), Today cards, Media tab, and English draw cards all use **variations of cocoa gradient or cocoa outline**. Result:

- **Add to Today** looks like **Archive** looks like **Schedule**
- No color semantics — user must read every label
- Action hierarchy relies on size/position alone

Job Search workspace mode: **`--accent-blue: #6F96D6`** for primary; warm cocoa only in brand/avatar contexts.

### Problem 4 — Decorative “mood board” layers

Still present or recently added:

- `.card::after`, `.task-card::after` — ✧ ornament (disabled in final theme but file still carries pink-diary rules)
- `.home-secondary-panel summary::before` — ✦ in pink circle
- `.today-next-image-panel` — CSS coffee cup, notebook, radial ring art
- `.grounding-banner` — large gradient quote block
- Multiple radial background washes on `body`, `.app-shell`, `.page`

These compete with **Start / Next / Done / Queue** for attention — especially when tired.

### Problem 5 — Weak action hierarchy by page

| Page | Hierarchy issue |
|------|-------------------|
| **Today** | Hero imagery + grounding quote + module chips + collapsible panels — Start/Next competes with decoration |
| **Tasks** | Primary row (Add to today / Open in Study / Schedule) uses same brown `.btn-primary` / `.btn-secondary`; badges dense |
| **Study** | Hero cards, journey widgets, template grid — timer cockpit improved but still surrounded by equal-weight cards |
| **Plan** | Queue cards visually similar to Tasks; “Start here” hero uses same brown CTA |
| **Integrations** | Long forms, scope status chips in beige — feels admin-heavy |
| **Iris365** | Many same-shaped cards; progress bars thin and pale |
| **Exercise / Media** | Shared `life-system-card` shell — appropriate, but still beige-primary buttons |
| **Focus Mode** | Strong centered layout — **preserve**; only completion/abandon colors need semantic separation |

### Problem 6 — Forms feel heavy

- `.inline-form` uses full card gradient shell identical to task cards
- Tri-state **Energy / Type** pill groups + many rows — visually dense
- Inputs: `rgba(255,253,248,0.78)` fill on cream — low edge definition
- Focus ring: brown `rgba(157,114,94,0.22)` — subtle
- Uppercase micro-labels on every field

Job Search Hub forms: **0.84rem semibold labels**, `#7A645A`, white-ish inputs, **14px radius**, clearer borders.

### Problem 7 — Navigation ≠ workspace

Daily Hub: **horizontal scrolling tab bar** (` .nav-tabs`), 12px uppercase tabs, icon + label cramped.

Newer hubs: **sticky sidebar**, larger nav targets (50px min-height), blue-tint active fill (`#EEF4FC`), left-aligned brand.

Daily Hub’s tab model is fine for mobile breadth, but styling should borrow **sidebar clarity** (active state, contrast) even if layout stays top-nav.

### Problem 8 — Icons and chips

- Lucide icons at 13–14px everywhere — functional but repetitive
- `.badge`, `.filter-chip`, `.queue-badge` all use `--accent-light` beige fill — **status types don’t color-code**
- Calendar / today / large-task badges differ in name only, not hue

---

## Comparison: what to borrow from newer hubs

### Iris Job Search Hub (`iris-job-search-hub/src/styles.css`)

**Workspace theme (`.app` blue mode, ~line 1688):**

| Token | Value | Borrow for Daily Hub |
|-------|-------|----------------------|
| App background | `#FAF6F1` → workspace `#F5F7FA` | Light warm gray-cream shell |
| Main surface | `#FFFFFF` in `main` | White content panel |
| Text primary | `#2B313B` | Stronger body contrast |
| Text secondary | `#5B6675` | Subtitles, meta |
| Text muted | `#7C8794` | Helpers (not `#9A8B80`) |
| Accent blue | `#6F96D6` | Primary actions |
| Blue hover | `#5C85CC` | Button hover |
| Blue soft | `#CFDEF4` | Selected nav / chip |
| Blue faint | `#EEF4FC` | Active row background |
| Border | `#E6EBF2` | Card edges |
| Shadow | `0 8px 24px rgba(86,103,125,0.06)` | Card lift without brown glow |

**Structural patterns to adopt:**

- White card on lighter app bg (not gradient-in-gradient)
- Sidebar-style **selected state** logic applied to nav tabs
- Primary button = solid blue, not gradient brown
- Status chips with faint colored backgrounds
- `Inter`-class readability for dense UI

**Keep from Job Search warm mode:** cream shell option, personal brand warmth — as **accent**, not dominant.

### Expression Review Hub (live + import integration)

Not in local repo; observed product principles from UI copy and shared Iris family:

- **“One clear next step”** — Primary actions block above metrics
- **Small default batch** — calm, not dashboard-heavy
- **Library pulse** — numbers visible, not buried in prose
- Visual language aligns with Job Search workspace (light surfaces, blue actions, sans type)

Daily Hub should mirror this **primary-actions-first** layout on Today and Tasks, not Expression’s exact chrome.

---

## Design principles (refreshed)

1. **Action layer first** — The next useful action is the loudest element on screen; decoration never outranks Start / Add to Today / Open in Study.
2. **Warmth through accent, not saturation** — Cream shell + white cards + cocoa only where it means “personal” or “complete.”
3. **Tool, not mood board** — Remove ornamental pseudo-elements from operational views; keep elegance inside Focus Mode.
4. **One primary action color** — Blue-gray for forward motion; cocoa for Focus complete; rose/beige for Media/low-energy.
5. **Readable by default** — No required reading of 0.69rem uppercase brown labels.
6. **Progress must be visible** — Bars, counts, and Done states use contrast and hue, not opacity fade alone.
7. **Consolidate tokens** — One `:root` source of truth; delete superseded theme blocks in implementation phase.

---

## Proposed color system

Suggested CSS tokens for Phase 1. Map to existing `--color-*` / `--text-*` aliases during migration.

| Token | Hex | Usage |
|-------|-----|-------|
| **Background** | `#F4F2EE` | App shell — warm off-white, cooler than current `#F7F1EA` |
| **Background wash** | `#FAFAF8` | Top gradient stop, header backdrop |
| **Surface** | `#FFFFFF` | Cards, modals, main panels |
| **Surface soft** | `#F7F4F0` | Secondary panels, collapsible sections |
| **Surface warm** | `#F3EBE3` | Focus Mode backdrop, Media comfort zones |
| **Border** | `#E3E0DA` | Default card border — neutral-warm |
| **Border strong** | `#CFC8BE` | Inputs, dividers |
| **Border focus** | `#6F96D6` | Focus rings (replace brown ring) |
| **Text primary** | `#2A2522` | Headings, task titles, body |
| **Text secondary** | `#5C534C` | Subtitles, descriptions |
| **Text muted** | `#7A726A` | Meta, timestamps — **darker than today’s `#9A8B80`** |
| **Text faint** | `#A39A92` | Placeholders only |
| **Accent primary** | `#6F96D6` | Primary buttons, links, active nav |
| **Accent primary hover** | `#5C85CC` | Hover/pressed primary |
| **Accent soft** | `#EEF4FC` | Selected chips, nav active bg |
| **Accent muted** | `#CFDEF4` | Badge borders, subtle highlights |
| **Warm accent** | `#9D725E` | Focus complete, personal emphasis, bear brand |
| **Warm accent soft** | `#F3E8DF` | Warm chips, Life task tags |
| **Media accent** | `#C98F8A` | Media / comfort / entertainment |
| **Media soft** | `#F8EDEB` | Media card tint |
| **Success muted** | `#6F957D` on `#EEF6F1` | Done, synced, paid |
| **Warning muted** | `#B39A62` on `#FBF6EA` | Due soon, reconnect |
| **Danger muted** | `#A96D6D` on `#F9EEEE` | Overdue, abandon, delete hover |

**Gradient policy:** Retire brown gradients on default `.btn-primary`. Allow **one** warm gradient only on Focus Mode “Complete” celebration if desired.

---

## Typography system

### Font stacks

| Role | Stack | Notes |
|------|-------|-------|
| **UI / body** | `'Inter', 'PingFang SC', 'Noto Sans SC', system-ui, sans-serif` | Add Inter (already pattern in Job Search) |
| **Display / page title** | `'Bricolage Grotesque', 'Inter', sans-serif` **or** keep Cormorant **only on Today + Focus** | Prefer sans display for Tasks, Plan, Study, Integrations |
| **Focus timer** | `'Cormorant Garamond', 'Noto Serif SC', serif` | Preserve elegant timer |
| **Chinese soft copy** | `'LXGW WenKai Screen', 'Noto Sans SC', sans-serif` | Exercise/Media emotional lines — optional, not forms |
| **Monospace / stats** | `ui-monospace, 'SF Mono', monospace` | Timer digits optional tabular nums |

### Usage rules

| Element | Font | Size guidance |
|---------|------|---------------|
| Page title (Tasks, Plan, Study) | Sans display | `1.35–1.75rem`, weight 600, **sentence case** |
| Page title (Today hero only) | Serif or sans — pick one | Reduce from current `clamp(3rem…)` editorial scale |
| Section label | Sans, **not uppercase by default** | `0.78rem`, weight 600, `#7A726A`, optional small caps |
| Task title | Sans | `0.95–1rem`, weight 600 |
| Button | Sans | `0.875rem`, weight 600, normal case (drop 0.12em tracking) |
| Badge / chip | Sans | `0.75rem`, weight 500 |
| Focus timer | Serif display | Keep current scale |
| Form labels | Sans | `0.8125rem`, weight 600, `#5C534C` |

### Button typography change

Current: uppercase + wide letter-spacing on `.btn`, `.nav-tab`.  
Target: **Sentence case** for buttons and tabs; uppercase only for tiny stat labels if needed.

---

## Action color rules

| Action type | Color | Examples |
|-------------|-------|----------|
| **Primary forward** | Accent primary blue `#6F96D6` | Add to Today, Start 25 min, Open in Study, Save task, Create calendar event, Import, Sync |
| **Secondary** | White surface + border `#E3E0DA`, text `#2A2522` | Cancel, Close, Copy details, Remove from today |
| **Tertiary / ghost** | Transparent, text `#7A726A` | Edit, Archive, collapse toggles |
| **Warm complete** | Warm accent `#9D725E` | Focus Mode Complete, session done celebration |
| **Warm personal** | Warm accent soft bg | Life task kind badge, grounding (if kept) |
| **Media / comfort** | Media accent `#C98F8A` | Media log, comfort library, low-energy suggestions |
| **Danger** | Danger muted | Delete, Abandon session, overdue |
| **Success** | Success muted | Synced, Done, In today |

**Do not** use cocoa gradient for Schedule **and** Add to Today **and** Start — blue primary + outlined secondary creates instant hierarchy.

Optional semantic button classes (Phase 2): `.btn-action-primary`, `.btn-action-warm`, `.btn-action-media` — or data attributes on existing `.btn-primary` variants.

---

## Page-by-page recommendations

### Today (`HomeCommandCentre`, `StartNowDashboard`)

**Direction:** Action-first cockpit — not editorial homepage.

| Keep | Change |
|------|--------|
| Active session hero + large timer (Focus) | Reduce/remove CSS coffee/notebook art (`.today-next-coffee`, `.today-next-notebook`) |
| Next useful action card | White card, blue primary CTA, sans headline |
| Today Done evidence | Stronger progress bar contrast (`#6F96D6` fill on `#EEF4FC` track) |
| Collapsible queue/note | Softer panel borders; remove ✦ summary ornament |

**Layout priority:** `[Active session OR Next action]` → `[Progress strip]` → `[Done]` → `[Queue collapsed]` → `[Note collapsed]`

Files: `src/index.css` (today-*, home-*), `StartNowDashboard.tsx`, `HomeCommandCentre.tsx`

---

### Tasks (`TaskInbox.tsx`)

**Direction:** Crisp inbox — obvious three-action row.

| Keep | Change |
|------|--------|
| Task kind filters | White task cards, `1px #E3E0DA` border, subtle shadow |
| Schedule modal flow | Blue **Add to today**; outlined **Schedule**; **Open in Study** as primary or secondary based on queue state |
| Optional date/time/location lines | Sans task title; reduce badge count (hide mode/status on card face) |
| Inline form | Flat white form panel; larger labels; less pill density |

Files: `TaskInbox.tsx`, `TaskScheduleModal.tsx`, `index.css` (task-*, inline-form)

---

### Study (`StudyDashboard.tsx`)

**Direction:** Cockpit / workspace — timer is the hero.

| Keep | Change |
|------|--------|
| Focus hero + timer face | Surround with white workspace panel (Job Search `main`-like) |
| Template cards | Smaller visual weight than timer; border-only cards |
| English journey / listening draw | Journey = progress blue; draw = soft rose accent (already partially there) |
| Import card on Integrations not Study | Already moved — keep Integrations styling tidy |

Files: `StudyDashboard.tsx`, `index.css` (study-*, english-*)

---

### Plan (`BlockQueueView`, `DailyPlanView`)

**Direction:** Optional planning tool — queue as **menu**, not backlog wall.

| Keep | Change |
|------|--------|
| “Start here” next block | Blue Start; queue list visually lighter than Today |
| Manual reorder | Clear block status chips (color-coded: not_started / in_progress / done) |
| AI plan / check-in | Collapse behind “Plan tools” — secondary surface `#F7F4F0` |

Files: `BlockQueueView.tsx`, `DailyPlanView.tsx`, `index.css` (block-queue-*, plan-*)

---

### Iris365 (`Iris365.tsx`)

**Direction:** Momentum dashboard — numbers pop.

| Keep | Change |
|------|--------|
| Countdown / daily check-in | White stat cards; thicker progress bars (min 8px) |
| Proof / growth sections | Use accent blue for progress; warm accent for streak celebration only |
| Avoid pale-on-pale | Text secondary for copy, primary for numbers |

Files: `Iris365.tsx`, `index.css` (iris365-*, dopamine-*)

---

### Exercise (`ExerciseTab.tsx`)

**Direction:** Light, encouraging, simple.

| Keep | Change |
|------|--------|
| `life-system-card` structure | Green success tint for completed movement |
| Stat row | Tabular numbers, sans |
| Chinese soft copy font | Only on quote lines, not buttons |

Files: `ExerciseTab.tsx`, `index.css` (exercise-*, life-*)

---

### Media (`MediaTab.tsx`)

**Direction:** Entertainment log — fun but clean.

| Keep | Change |
|------|--------|
| Scoped `--media-*` tokens | Shift media accent to rose `#C98F8A`, keep white cards |
| Separate from Study visually | No brown primary — rose or outlined buttons |
| Filter chips | Media soft background |

Files: `MediaTab.tsx`, `index.css` (media-tab-page)

---

### Integrations (`AIAssistant.tsx`, calendar cards)

**Direction:** Technical but tidy.

| Keep | Change |
|------|--------|
| Connection status chips | Color-code: connected=green faint, needs_reconnect=warning |
| Expression import compact card | Blue Import button; collapse JSON/debug |
| Calendar integration | White card, clear scope list — no gradient card |

Files: `AIAssistant.tsx`, `index.css` (calendar-integration-*, ai-*, scope-status)

---

### Focus Mode (`StartNowDashboard` active session, Study focus hero)

**Direction:** Preserve centered elegance — **do not corporate-ify**.

| Keep | Change |
|------|--------|
| Serif timer | Warm backdrop `#F3EBE3` — slightly cleaner, less gradient noise |
| Minimal chrome | Complete = warm cocoa; abandon = danger muted (already `#b56a5f`) |
| Centered action bar | White floating bar OK; primary Complete stays warm not blue |

Files: `index.css` (today-active-*, study-focus-*)

---

## Top 10 visual changes (prioritized)

| # | Current problem | Recommended change | Files | Type | Risk |
|---|-----------------|-------------------|-------|------|------|
| 1 | Low contrast text (`#9A8B80` labels) | Raise muted text to `#7A726A`; darken section labels; sentence-case | `index.css` `:root`, label selectors | CSS-only | **Low** |
| 2 | Brown primary on all actions | Blue `#6F96D6` `.btn-primary`; warm variant for Focus complete only | `index.css` `.btn-primary`, Focus overrides | CSS-only | **Low** |
| 3 | Cards blend into page | White `#FFFFFF` cards, `#E3E0DA` border, light shadow; page `#F4F2EE` | `index.css` card/task/home-block selectors | CSS-only | **Low** |
| 4 | Serif on every page title | Sans display for Tasks/Plan/Study/Integrations; serif only Today optional + Focus timer | `index.css` `.page-title`, component headings | CSS + minor TSX | **Low** |
| 5 | Decorative Today art (coffee, notebook, ✦) | Remove or gate behind “comfort mode”; default clean Next card | `index.css` today-next-*, home-secondary-panel | CSS-only | **Low** |
| 6 | Weak task action hierarchy | Blue primary for main action; secondary outline for others; reduce badge noise | `TaskInbox.tsx`, `index.css` task-action-* | Component + CSS | **Medium** |
| 7 | Nav tabs feel inactive | Active = blue soft bg + primary text; increase inactive contrast | `index.css` `.nav-tab` | CSS-only | **Low** |
| 8 | Status chips all beige | Semantic chip colors (today=blue, calendar=purple-muted, done=green, life=warm) | `index.css` `.badge-*` | CSS-only | **Medium** |
| 9 | Progress bars pale | Thicker bars, blue fill, numeric label beside bar | `index.css` progress selectors, `StartNowDashboard`, `Iris365` | CSS + minor TSX | **Medium** |
| 10 | 14k-line theme soup | Consolidate to single `:root`; delete obsolete theme blocks; document tokens | `index.css` | CSS refactor | **Medium** — test all tabs |

---

## Suggested Phase 1 implementation prompt

Use this prompt for the first implementation pass (CSS-first, no behavior changes):

```
Implement Iris Daily Hub Visual Refresh — Phase 1 (tokens + global chrome only).

Reference: iris_daily_hub_visual_refresh_audit.md

Goals:
- Keep Focus Mode elegant (serif timer, warm complete button).
- Shift Daily Hub to Korean clean workspace: light cream shell, white cards, blue primary actions.
- Do NOT change routing, data, localStorage keys, or task/session behavior.

Scope:
1. Consolidate src/index.css :root into ONE token block using audit hex values:
   Background #F4F2EE, Surface #FFFFFF, Border #E3E0DA,
   Text primary #2A2522, Text muted #7A726A,
   Accent primary #6F96D6, Accent soft #EEF4FC,
   Warm accent #9D725E, Media #C98F8A,
   Success/Warning/Danger muted pairs from audit.

2. Update global components ONLY:
   - body/app-shell/page background
   - .card, .task-card, .home-block-card, .block-queue-card, .inline-form
   - .btn-primary (blue), .btn-secondary (white outline)
   - .btn-primary warm override for .today-active-actions Complete only
   - .nav-tab active/inactive states
   - .page-title → sans (Bricolage Grotesque or Inter); keep .today-active-timer serif
   - .section-label → sentence case, darker muted color
   - Remove decorative ::after (✧ ♡) and Today coffee/notebook CSS art

3. Improve contrast:
   - Form labels 0.8125rem semibold
   - .task-done opacity min 0.65 not 0.45
   - Input borders #E3E0DA, focus ring #6F96D6

4. Add Inter font import if not present.

5. Do NOT restyle every page-specific widget yet — stop after global tokens + buttons + cards + nav + typography base.

Verify: npm run build, visual check on Today / Tasks / Study / Focus active session.

Deliver: ui_refresh_phase1_notes.md with before/after token table.
```

---

## Out of scope (this audit)

- Component rewrites or layout changes (sidebar migration)
- Feature removal (grounding banner, hero image)
- Dark mode
- Mobile-specific nav redesign
- Accessibility audit beyond contrast notes

---

## Files referenced

| Area | Primary files |
|------|---------------|
| Global styles | `src/index.css` |
| Shell / nav | `src/App.tsx` |
| Today | `src/components/HomeCommandCentre.tsx`, `src/components/StartNowDashboard.tsx` |
| Tasks | `src/components/TaskInbox.tsx`, `src/components/TaskScheduleModal.tsx` |
| Study | `src/components/StudyDashboard.tsx` |
| Plan | `src/components/BlockQueueView.tsx`, `src/components/DailyPlanView.tsx` |
| Iris365 | `src/components/Iris365.tsx` |
| Exercise / Media | `src/components/ExerciseTab.tsx`, `src/components/MediaTab.tsx` |
| Integrations | `src/components/AIAssistant.tsx` |
| Comparison | `iris-job-search-hub/src/styles.css` |
| Prior actionability audit | `iris_daily_hub_actionability_audit.md` |

---

## Summary judgment

Daily Hub’s **product architecture is moving toward action-first** (Today → Study → Done). Its **visual system still tells an older story** — beige diary, brown buttons, serif headers, decorative flourishes. The refresh is not about going cold or corporate; it is about **letting warmth be an accent while blue-white workspace clarity carries daily decisions**.

Expression Review Hub’s copy is the right north star: **“One clear next step, not a dashboard to stare at.”** The visual system should match that sentence.
