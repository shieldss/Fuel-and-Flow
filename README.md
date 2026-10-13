# Fuel & Flow

A colorful, mobile-first food, energy and recovery tracker built as a static PWA, using the same GitHub Pages architecture as HoopTrack and 30 Days of…. No framework, API key, subscription or backend is required.

## Start using it

1. Open **Today** and choose a date. Add food manually or start from **Your usual foods**. Check portions against your labels; preset nutrition is estimated.
2. Save energy before/after training, sleep, fluids, weight, waist, training duration, recovery and notes. Mark the food log complete only after all meals and caloric drinks are logged.
3. Open **Trends** for daily, weekly or monthly logs. Weight comparisons use the most recent seven calendar days against the prior seven, excluding missing measurements. Energy and sleep averages exclude missing entries. Calorie averages use complete food logs only.
4. Use **ChatGPT → Review results** to generate a day/week/month prompt. Copy it into ChatGPT and coordinate practical adjustments.
5. Use **ChatGPT → Plan next week**. Choose a Monday, generate and copy the prompt, then paste it into ChatGPT. The prompt requests a strict seven-day JSON response with estimated per-meal nutrition.
6. Paste the complete response into **Bring your meal plan back**. Choose the matching Monday, validate it, inspect daily totals and meal details, then confirm import.
7. Use **Meal plan → Log eaten** to copy one planned serving into that date’s actual food log. Edit actual food afterward if the portion changed. Repeated servings are allowed, with confirmation.
8. Export a backup from **Settings** regularly. Restore a backup to move your data to another browser or device.

## GitHub Pages setup

The downloadable `fuel-and-flow-github-v1.0.0.zip` contains the app files at its root.

1. Create a GitHub repository named `fuel-and-flow` in your own account.
2. Extract the ZIP and upload all contents, including the `icons` folder, to the repository’s `main` branch. `index.html` must be at the repository root, not inside a second folder. Include the `.nojekyll` file if your file picker hides it.
3. In the repository, go to **Settings → Pages → Deploy from a branch → main → / (root)** and save.
4. Open the URL shown by GitHub Pages when deployment completes. All asset URLs are relative, so project subdirectories work.
5. In Android Chrome, use the browser menu to **Install app** or **Add to Home screen**. Open the app once online before expecting offline behavior.

GitHub Pages serves static code; the diary remains local to your browser. The separate private ChatGPT-hosted version has its own storage. Move data between them with backup export/import. Private-host authentication may require a network connection even though the app shell supports offline use.

## Local-only profile

New installations have a blank personal profile, no recurring sessions and no prefilled usual foods. Enter your profile and targets in Settings, and add sessions and foods as needed. These values, food logs and plans live in local browser storage and your exported backup files. Existing browser data and older backups are preserved during upgrades. Blank fields mean unknown. Generated ChatGPT prompts include personal context only when you choose to generate and copy them. No personal profile or daily log is sent to GitHub.

## Backup and import behavior

Backups are JSON with `version`, `profile`, `days` and `plans`. Restoration validates the contents and asks before replacing current device data. ChatGPT meal-plan import accepts plain JSON or a JSON code fence, validates seven unique dates for the selected week, and previews all meals. It replaces only planned meals for those dates. Actual food, check-ins and profile settings are unaffected.

Meals require `name`, `time` (HH:MM), `portion`, and numeric `calories`, `protein`, `carbs`, `fat`. The plan format is shown in the generated prompt. The app rejects malformed dates, duplicate/missing dates, wrong weeks, missing portions, invalid times and invalid nutrition. It does not independently verify nutritional accuracy or food suitability.

No data automatically syncs, and no messages are sent by the app. Opening ChatGPT and copying data are explicit user actions. Device storage can be removed by clearing browser data. Multiple open tabs share the same local dataset.

## Development

This source checkout serves files from `dist/`. The standalone ZIP puts those same files at its root. Use a static HTTP server; JavaScript modules and service workers do not work reliably by opening `index.html` as a `file://` URL.

Tests: `npm test` (Node 22+ recommended; no dependency installation needed). The suite checks calendar boundaries, nutrition totals, partial/missing data, backup restoration, meal-plan validation, and UI workflows using a minimal DOM harness. Browser visual and installation checks were not available in the build environment.

To release updated files, bump the shell cache version in `sw.js`. The service worker uses network-first requests with cached offline fallbacks and deletes only this app’s old caches.

## v1.1: usual foods, copying and meal/photo imports

- **Today → Your usual foods**: add, edit, or delete reusable foods. Editing a usual food never changes meals already logged. Meal forms can also save their serving as a usual food. This list is included in backups; old backups receive the original starter list once.
- **Add meal / Edit a meal → Copy this meal to other days**: choose a week, select dates or the entire Monday–Sunday week, and choose the meal plan or the eaten-food log. The saved meal date is excluded from copies. Copies add servings, preserve check-ins, and do not overwrite other meals. Eaten-food copies make the destination food logs partial for review.
- **Today or ChatGPT → Import meal / photo**: optionally select the original photo to read JPEG EXIF DateTimeOriginal, confirm the date/time, and add portion notes. Generate and copy the prompt, attach the photo separately in ChatGPT, and paste its JSON response back. No API key and no photo upload by this app.
- **Timestamp limits**: the app reads original capture timestamps from JPEG EXIF only. HEIC, screenshots, and stripped images may have no readable capture time. It never uses file modification time as capture time. If unavailable, enter the date/time from your photo Details screen, or leave it unknown and fill it in during meal review. Camera wall-clock time needs confirmation when traveling across timezones.
- **Import review**: accepts 1–100 meals in JSON with schemaVersion 1 and a meals array. Review/edit each meal’s date, time, name, portion, calories, protein, carbs and fat. Unknown date/time can be null in the response, but eaten/planned entries need confirmed values before saving. Import into the eaten-food log, meal plan, or usual foods; optionally save imported entries as usual foods too. Imports add servings rather than overwrite records. Photo macro estimates are approximate.

Twenty automated checks cover the core logic and UI flows with a minimal DOM harness. Browser visual QA was unavailable in this environment.

## v1.2: blue identity and editable training

The interface uses a blue palette and a new Fuel & Flow monogram, wave and energy mark. The same logo is used for the favicon, home-screen icons and header.

Open **Settings → Edit weekly schedule**, **Today → Edit schedule**, or **Meal plan → Your weekly rhythm → Edit schedule**. Add, edit or delete recurring sessions with a weekday, training type, title, optional time/duration, and intensity. Multiple sessions per day are supported. Empty days default to rest. Future unlogged days and ChatGPT prompts use the schedule. Historical recorded training types are preserved. The schedule is included in backup export/import; absent schedules start empty. Pre-BJJ snack labels follow the scheduled class time.

Planned **Add meal** and **Edit meal** forms include **Fill from Usual foods**. Choosing a food fills the name, portion, usual time and nutrition for review while keeping the chosen date. **Edit planned meals → Add from Usual foods** opens the same form for a new planned serving. This does not log food as eaten or change the reusable food.

29 automated checks passed. Browser visual testing remained unavailable; the generated icon artwork was visually inspected.

Personal profile fields, including Sex (Male/Female), are entered in Settings and saved only to device storage. Published application source uses blank profile defaults. Existing locally saved values are preserved.

## v1.3: workout intensity and copying

Workout intensity is selected from **Light**, **Moderate**, or **Hard**. Older free-text values migrate to the closest option (for example, Easy → Light and Moderate–hard → Hard).

In **Weekly training schedule**, use a workout’s copy icon or open its Add/Edit form. Expand **Copy workout to other days**, choose weekdays or **Entire Monday–Sunday week**, and save. The source day is saved once; each other selected day receives a separate recurring session with its own ID. Copies retain the time, duration, type and intensity, add to existing sessions, and do not modify historical logs. All schedule data stays in local browser storage and backups.

33 automated checks passed; browser visual QA was unavailable.

## v1.4: weekly groceries

A **Grocery list** appears below the selected week’s Meal plan. It derives foods from planned portion descriptions, combines matching names/units and sums explicitly stated quantities. Unclear descriptions remain visible for review; mixed units are kept separate. Expand an item to see its original portions and source meals. Check items off as you shop, or use **Copy list**. Checkmarks are local, week-specific, included in backups, and no longer apply to an item if its quantity or use count changes. The list recalculates when planned meals are added, edited, removed or imported; eaten-food logs and other weeks are excluded. 36 automated checks passed.

## v1.4.2: swipe meal actions

On Today and Meal plan, swipe a meal **right** to reveal a blue **Edit** button and red **Delete** button with icons. Swipe left or tap the exposed meal content to close the tray. Vertical scrolling stays available. Desktop users can drag with a mouse; keyboard users can focus a meal and press Right Arrow/Enter/Space to expose actions, or Left Arrow/Escape to close them. Only one tray opens at a time. Delete always asks for confirmation; deleting a planned meal does not delete logged food. Gesture and deletion behavior are covered by automated checks; on-device visual QA was unavailable.

## v1.4.3: discoverable row actions

Each meal includes an arrow and **Swipe right for options** indicator. Tap the indicator to expose the same buttons without swiping. Usual-food rows now expose Edit/Delete through the same tray; weekly workouts expose purple Copy, blue Edit and red Delete. Primary actions such as Log this food remain visible. Grocery checkboxes stay visible because they are the main shopping action. Swipes preserve vertical scrolling, support mouse/keyboard interaction, and destructive actions retain confirmations.

## v1.5: nutrition profiles selected by scheduled BJJ

Settings now contains **BJJ Training Day Goals** and **Non-BJJ Day Goals**, each with independent calories, protein, carbs and fat. Their editable starter values are 2200/165/235/67 and 2000/165/170/73 respectively. Macro-derived calories are shown using 4/4/9; a difference from the calorie target is informational and never rewrites either value. A live **Weekly Nutrition Goals** preview displays each date, its profile, totals and daily averages.

`getNutritionGoalsForDate(date, state)` in `nutrition-tools.js` is the shared selector. It uses the existing local-date helpers and looks for any exact `BJJ` workout on that weekday in the recurring schedule. BJJ plus weights and multiple BJJ sessions use one BJJ profile; all other combinations use Non-BJJ. The actual training type recorded in the diary does not override this schedule rule. Changes to scheduled sessions or goal settings recalculate every relevant view immediately.

Today and Meal plan show active-profile labels, calorie/macro goals, remaining amounts and attainment. Add/Edit meal forms preview the selected date’s totals after saving, excluding the original entry while editing. Meal Plan still starts on the local current day. Reports include every date’s goals and provisional/confirmed attainment. Period target totals sum the goals for individual dates. Confirmed totals compare completed food logs with targets for those same dates; partial/missing logs are not confirmed deficits. Historical food entries remain unchanged, while target comparisons reflect current goal settings and the current recurring schedule. ChatGPT planning/review prompts include both profiles and date-specific targets; deprecated single-target fields are omitted from generated prompt context.

### Migration

The existing local-storage key and overall backup schema version stay unchanged. `nutritionSettingsVersion: 1` versions the new `nutritionGoals` settings. On reading an old saved state or backup, absent BJJ/Non-BJJ profiles are initialized to the requested starter values; saved custom two-profile values are preserved. Legacy single-target values remain stored under the profile for compatibility but are no longer used by dashboards or new prompts. All other profile values, actual meals, planned meals, energy, hydration, weight, grocery checks, reusable foods and training sessions are preserved. The startup migration saves the validated state without clearing storage. New backups include both profiles; older backups remain readable.

### Verification and deployment

53 automated checks pass, covering classification, schedule moves/additions/deletions/copies, independent targets, complete-versus-partial reports, legacy migration, preserved logs/settings, local persistence/reopening, and service-worker precaching/offline module and navigation responses. UI checks use the existing minimal DOM harness. Live Android/desktop visual and installation testing were unavailable. The blue responsive layouts, swipe controls, GitHub Pages configuration, manifest identity and offline shell are retained. Asset URLs and the service-worker cache are versioned to v1.5.0 for installed PWA updates.

## v1.6.0 — Recipes, recovery and planning tools

Extends the existing blue PWA without changing its navigation or local storage key (`fuel-and-flow-v1`). GitHub Pages deployment remains unchanged. No personal profile values are bundled in the repository.

- Today / Meal Plan: Recipes library (add/edit/delete), batch ingredient quantities and batch nutrition divided by yield; fill either meal editor from a recipe or usual food. Serving multiplier scales calories/macros together from a retained base. Existing Usual foods Edit/Delete swipe actions remain intact; changing the library does not rewrite logged meals.
- Today: Optional sleep quality, soreness and stress (1–5), plus the existing sleep/energy/recovery fields. Meal and scheduled-workout timeline shows local times, nearest-session spacing and energy entries.
- Trends: BJJ/non-BJJ weekly comparison, complete-log attainment, recovery averages, copyable ChatGPT weekly review, and a rolling seven-day weight plot alongside weigh-ins and accessible exact-value table. Missing values are excluded and sample counts displayed.
- Meal Plan: Swipe for Swap/Edit/Delete; swap from usual foods or recipes with a servings preview and updated remaining targets. Planned-versus-eaten view links meals logged through Log eaten, retains original swapped plans, and supports explicit skip/undo. Older unlinked logs are not guessed or treated as skipped.
- Groceries: Recipe quantities and scaled portions aggregate when names/units match; compatible kg/g, lb/oz and L/ml normalize. Structured recipe ingredients are preferred to free text. Pantry names can be maintained in bulk or marked per grocery item. Pantry items stay visible and are omitted from the copied shopping list. Skipped meals are excluded from grocery quantities and planned totals.
- Settings: Configurable in-app backup reminders, last-export timestamp, restore content preview, a download-current-backup action before confirmed replacement, and visible version/update controls. Offline assets include the new module and version manifest. Update checks work online; reloading retains local data.

### Additive data migration

Backup `version:1` and nutrition settings version are retained. `featureVersion:1` adds recipes, pantry, backup settings, optional recovery fields, meal serving metadata, explicit meal-plan links and historical goal/schedule snapshots. Legacy plans receive stable per-date meal IDs; historical actual logs keep their saved nutrition and IDs. Empty/custom lists and existing goal profiles are retained. Restore validation preserves the new fields and accepts older v1 backups.

Marking a food log complete captures its nutrition goals and recurring schedule. Later goal or schedule changes apply to unsaved dates; saved historical snapshots are retained even if that log is subsequently reopened for edits. Current-week Settings preview always shows current prospective settings. On first upgrade, existing complete logs without snapshots capture current settings with the explicit label “Migrated completed log; original targets unknown, current settings captured.” The app cannot reconstruct targets that were never stored.

Reminders appear inside the app, not as background OS notifications. Recipe nutrition is user-entered for the whole batch; no external nutrition lookup or account sync is introduced. Grocery aggregation does not guess ingredient synonyms or ambiguous portions. The timeline describes scheduled sessions, not verified attendance.

### Verification

Node integration and calculation tests cover serving scaling without compounding, recipe snapshots and roundtrip backups, frozen historical targets and future dynamic schedule changes, legacy data preservation, meal swaps/links/skips, recovery validation, pantry and quantity totals, weight sample counts, backup reminder intervals, restore preview, existing Usual foods editing/deletion, all original app tabs/workflows, and offline shell assets. No browser-control capability is available in this environment, so visual/device QA remains an explicit verification limit.

## v1.7.0 — Food database lookup

Adds inline food search to actual/planned/Usual food meal editors and to the recipe editor, keeping all existing screens and interactions. Open Food Facts name search and product-barcode lookup work without a key. The name-search route uses OFF's legacy text-search endpoint because the current product API does not provide equivalent full-text search. Product lookup uses API v3. Camera scanning uses the browser's BarcodeDetector when supported, stops tracks on close/stop, and leaves manual barcode entry available. Barcode photos are processed locally; no images are uploaded.

Selected food nutrition is reviewed before populating meal fields or adding an ingredient's nutrition to a recipe batch. Users choose grams, weight ounces, measured label servings or milliliters where the source basis is volume. No density or unknown serving weight is invented. Missing macros remain null/blank and require user entry before use. Energy in kJ is explicitly converted to kcal; absent calories are never estimated automatically from macros. USDA normalization supports both search and detail nutrient structures and available Atwater energy records. Branded ml records retain a volume basis.

Food source links, original lookup portion, nutrition basis, retrieval date and manual-adjustment flags travel with saved meals/Usual foods and recipes and survive backup/restore. Editing a recipe or source does not refresh existing food logs. Lookups are cached separately under `fuel-and-flow-food-cache-v1` (up to 60 recent queries/results), with cached offline fallback identified as stale. Search is user-triggered, not per keystroke, with a rolling request cap and request timeouts. OFF attribution and license links are shown in the lookup UI.

USDA search is prepared but disabled until its server proxy is configured. `api/food.js` and `vercel.json` provide a tested Vercel function for the existing repository, leaving GitHub Pages hosting intact. USDA_API_KEY belongs only in the backend's secret environment; the browser and repository never receive it. Settings stores only the HTTPS proxy endpoint and rejects URLs containing credentials or query parameters. The existing private ChatGPT Site's audience is unchanged. See `api/README.md` for backend configuration, limits and remaining registration/hosting prerequisites.

Verification includes live Open Food Facts name-search and v3 barcode responses (HTTP 200, CORS enabled), fixtures for food/unit conversion and missing macros, cache/offline/error handling, proxy origin/parameter checks and credential isolation, and integration tests demonstrating that lookup review changes only the editor until the meal is explicitly saved. Live camera hardware and browser visual testing are not available in the managed environment.
