# Plan 2 — Device ergonomics and core journeys

**State:** planned. **Dependency:** P0 API/data contract; integrate P1 layout/manifest work. **Goal:** the household can use all essential functions on phones, tablets and desktop, with correct recipe actions. Preserve the AinaDara design language and static export; no new backend architecture in this phase.

## Files

Existing: `src/components/{sidebar,ui,cook-mode,recipe-detail,command-palette}.tsx`, component tests, `src/app/{layout.tsx,globals.css}`, `src/app/(app)/{layout.tsx,pantry/page.tsx,meal-plan/page.tsx,shopping/page.tsx,recipes/page.tsx}`, relevant API-facing actions in `src/lib/store.ts`/`data-sync.tsx` after P0 migration. Proposed: a navigation overflow/account sheet, wake-lock hook, small responsive helpers and journey regressions. Prefer modifying shared primitives over per-page patches.

## Task 1 — Reachable navigation on every width

- [ ] Capture the initial 360/390px phone, 768/820px tablet, 1024px and 1440px layouts. Include keyboard-open and iPad narrow Split View. Use available width/capability rather than user-agent device detection.
- [ ] Replace eight squeezed mobile navigation destinations with a small set of primary actions plus an accessible More/account surface. Ensure **every** existing route remains reachable, including analytics/learn/explore, and expose invitation, sign-out, theme and search currently confined to the desktop sidebar.
- [ ] Evaluate a tablet rail/two-column layout where content benefits; it is a proposed design, not a mandatory breakpoint prescription. Retain a usable narrow layout when iPad Split View becomes phone width.
- [ ] Set `viewport-fit=cover` through Next's viewport API; apply top/bottom safe-area padding to fixed surfaces and account for actual bottom-nav height in content. Use dynamic viewport units with fallback where appropriate; test physical notches/home indicators rather than asserting CSS support proves correctness.
- [ ] Make active navigation, accessible names, focus order and back behavior consistent. Include the release/version display in a mobile-reachable area.

## Task 2 — Forms, dialogs and touch controls

- [ ] Give `Modal` proper dialog naming/semantics, focus entry/trap/restore, Escape close, background interaction control and bounded scrolling. Preserve user input on recoverable failures; place feedback with the field/action it concerns.
- [ ] Ensure touch targets meet the project's minimum 44 CSS pixels, aiming for 48 where practical. Check small close buttons, steppers, sidebar links, meal removal, theme controls and dense rows—not only primary buttons.
- [ ] Use readable input fonts (at least 16 CSS pixels where needed to avoid iPhone focus zoom), suitable input modes and explicit labels. Preserve pinch zoom and 200% text zoom. Verify keyboard does not obscure submit/action controls; avoid globally disabling scroll/overscroll where nested dialogs need it.
- [ ] Test light/dark contrast, reduced motion, focus visibility, screen-reader announcements and long household/item/recipe names. Replace hover-only affordances with persistent or explicit touch-accessible actions.

## Task 3 — Equivalent touch/keyboard pantry and meal actions

- [ ] Keep pointer drag behavior optional. Add menu/select controls to move pantry items between zones and move/swap/remove meals by day/slot; all operations must work without drag.
- [ ] Test cancel, same-target move, occupied slot, double tap, network error and return after lock. Use P0's validated API operation contracts; do not reproduce multi-write race conditions in UI state.
- [ ] For scanner/photo flows, request permissions only after user action, show meaningful denied/unavailable/insecure-context errors, stop camera tracks on exit/background, and retain manual barcode/item entry. Test rotated preview and permission recovery on actual phones.
- [ ] Make shopping quick-add and done controls usable one-handed. Show pending/error state and avoid presenting an unconfirmed API mutation as synced. P5 adds offline states; coordinate UI slots now.

## Task 4 — Kitchen/cook mode

- [ ] Put next/previous/finish controls where reachable, keep step text readable in phone portrait and iPad landscape, and support a clean exit with restored focus. Handle recipes with zero steps and long steps without broken counters.
- [ ] Add a feature-detected screen-wake-lock hook active only during cooking. Reacquire appropriately on visibility return; release on exit/unmount. A denied/unsupported wake lock must not block cooking. No promise that all installed/native runtimes support it.
- [ ] Preserve current step/checkmarks across recoverable UI lifecycle transitions without leaking across households. Distinguish local progress from the server-side “cooked” mutation.
- [ ] Prevent duplicate finish actions while pending; show a retryable error without a false success. Test partial/network failure through P0's idempotent compound operation, not several unchecked client writes.

## Task 5 — Correct saved/scaled recipe actions

- [ ] Add regressions for a built-in recipe and a saved recipe. Current action lookup uses built-ins even when UI offers saved recipes; carry an explicit resolved recipe identity/content contract into the API layer rather than silently falling back.
- [ ] Pass selected servings through add-missing and cook operations. Verify quantity/unit conversion, fractional values, insufficient stock, duplicate ingredients, and no negative inventory; distinguish nutrition display from actual pantry deductions.
- [ ] Coordinate atomic inventory + usage logging with P0/P5 server operations. Preserve historical usage references when an item is later deleted. Do not queue or retry a non-idempotent compound action as an offline convenience.
- [ ] Confirm two household members see consistent resulting inventory and usage after simultaneous actions. Reconcile optimistic state from server response; never let a frontend test substitute for API authorization/transaction checks.

## Exit and self-review

- [ ] Typecheck, unit/interaction regressions and export build pass; add focused browser journeys alongside the changes before P3 expands coverage.
- [ ] All routes and account actions reachable on phone/tablet; no clipped actions/overflow at tested widths or zoom levels.
- [ ] Touch and keyboard users can complete pantry → plan → shopping → cook without drag/hover dependencies.
- [ ] Saved/scaled recipe behavior and duplicate/failed actions have API-backed evidence.
- [ ] Physical device limitations remain explicit in the ledger; update screenshots/docs only for verified behavior. Rollback retains backend-compatible schemas and operation contracts.
