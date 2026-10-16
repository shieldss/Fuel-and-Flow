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

## v1.7.1 — Connected USDA search

The deployed production proxy at `https://fuel-and-flow-api.vercel.app/api/food` is now the default for new installs and previously blank lookup settings; custom saved endpoints remain intact. Open Food Facts requests remain direct even with a USDA proxy configured, and their cache keys remain independent of that proxy. No API key is embedded in the app or repository. The proxy was verified live with a USDA search from the GitHub Pages origin, a food-details/macronutrient conversion through the client utility, and rejection of an unrelated origin. Existing storage key, profiles, logs, recipes, plans, design and hosting workflow are retained.

## v2.0.0 — Focused information architecture

Redesigns organization and interactions in the existing app rather than replacing the tracker. The established blue visual identity, light/dark/system themes, logo, PWA manifest and icon identity, GitHub Pages hosting, USDA proxy and local data models are retained. This release changes presentation and navigation, not diary/schema/storage keys.

| Destination | Focused sections |
| --- | --- |
| Today | Overview, Food log, Check-in, Training / timeline |
| Plan | Meals, Groceries, Weekly training |
| Foods | Usual foods, Recipes |
| Trends | Summary, Nutrition, Weight, History |
| More (mobile) | ChatGPT and direct links to goals, profile, backups, connections, appearance/updates |
| Settings | Overview, Profile, Goals, Connections, Data, App |
| ChatGPT | Review results, Plan a week, Import a plan |

Desktop keeps ChatGPT and Settings directly in its sidebar; mobile has five stable bottom destinations. Focused section navigation stays available while scrolling. Routes support browser Back/Forward and valid direct links without encoding personal data. Invalid routes fall back safely. Plan still initializes to the current local date/week on refresh, even when reopened on a Plan route.

Today Overview contains no forms or long meal lists. Check-in is one form with expandable sleep/recovery, measurements and training/notes groups. Meal rows show name/macros first and expand portions/source details on request; swipe Edit/Delete and planned-meal Swap stay intact, including the swipe indicator within the planned time column. Groceries move to their own week-scoped view, with To buy/All/Checked filters, search and 10-item pagination; right-aligned pantry badges, quantity aggregation, pantry editing, checklist persistence and copying remain supported. Foods gets searchable, paginated lists and direct log/plan actions while retaining swipe Edit/Delete. Monthly history shows 10 dates per page, each linking to the full day's records. Nutrition still shows complete-log averages, date-specific attainment and detailed comparisons; Weight keeps current/previous seven-day averages, sample counts, changes, charts and exact-value tables.

Settings now edits one category at a time. Profile and Appearance saves preserve nutrition goals; Goals preserves all other profile fields and diary records. Each goal profile is labeled in an expandable card, with live macro-calorie information and weekly preview. Backup/restore, reminders and updates are no longer mixed into the profile form.

Meal editors switch between Manual, Search/Scan, Usual foods and Recipes without reconstructing the live form, retaining typed values. Optional copies and goal previews are collapsed. Barcode entry/scanning is a deliberate secondary path. Food search results are paginated six at a time and collapse when reviewing a selected food, with a back-to-results control. Recipes retain ingredient lookup and batch totals, grouped nutrition/notes. Weekly schedule editing shows one weekday at a time; all seven weekdays, multiple workouts, intensity selection, editing, deletion and copying remain available.

Unsaved main forms require a choice before section/menu/date navigation. Updates do not redraw dirty forms; failed storage saves keep main forms visible. Invalid fields inside collapsed groups reveal their containing group. Existing backup validation, historical goals, source metadata, recipes, logs, energy, hydration and training calculations are unchanged. API keys remain server-side.

Verification covers old workflows plus focused routing, separate settings saves, source-mode draft preservation, bounded lists, original-index filtering, unsaved-form guards, single-day workout editing, date defaults after reopening and offline caching of the new `view-tools.js` module. Generated markup from 30 screens/editors was checked for balanced tags, unique IDs and absence of nested forms/labels. Browser/device visual and camera QA remain unavailable in the managed environment.

### v2.0.1 — Focused meal import

Photo-prompt creation and meal-response import use separate steps in the same dialog, preserving entered text when switching. Reviewed meals expand individually, and generated prompt text stays collapsed behind copy/open actions.

### v2.0.2 — Compact check-in heading

The energy icon is constrained to 24 pixels and sits immediately left of the Daily check-in title, preventing the SVG from expanding into a large mobile illustration. No storage or form behavior changes.

### v2.0.3 — Running timeline nutrition

Every timed meal and workout shows cumulative logged calories, protein, carbohydrates and fat. Meals at the same timestamp count before workouts; untimed meals are explicitly excluded from time-specific totals. Planned meals stay excluded, historical schedules stay preserved, and partial logs are labeled. No logged values or storage models change.

### v2.0.4 — Current local meal time

New meals, foods without a time, and imported meals missing a time default to the device’s current local HH:MM for review. Existing times and supplied photo timestamps are preserved. Stored records are not migrated or rewritten.

### v2.1.0 — Water and drink tracker

Today → Water provides 4/8/16/24/32 oz amount presets, custom amounts/types, current local time with editing, calories and optional macros. Each serving can be edited/deleted; the list is paginated. Overview retains hydration progress and adds a direct log shortcut. Timed drinks join the training/fuel timeline and cumulative intake. Dashboard, meal preview, reports and ChatGPT reports include drink nutrition exactly once.

Old daily `water` values remain unchanged as a separately editable previous amount and count alongside new servings. New optional `drinks` arrays are validated and preserved by backups; older backups remain readable. No invented times are assigned to legacy water totals. The former water-number field is removed from Check-in. All drink types count as fluids; nutrition is entered from labels and is not inferred from type. Avoid logging a drink in both Food log and Water. Adding/editing/deleting a drink reopens the complete-log status for review. Service-worker assets/cache are updated; storage key/schema stay unchanged.

### v2.1.1 — Complete ChatGPT handoff context

Day/week/month reports and prompts now include explicit hydration totals/goals/progress, previous untimed amounts, drink nutrition, running food/drink/fluid timeline values at workouts, planned-versus-logged comparisons, and additional recovery/waist/fluid averages. Interpretation text distinguishes scheduled workouts, actual minutes, historical snapshots, partial logs, scaled servings and source estimates. Review and planning prompts include relevant food libraries/pantry; planning adds the current week’s grocery/checklist/existing-plan context. Photo prompts describe beverage volume and the separate manual drink workflow without inventing capture times or adding unsupported import fields.

Copy refreshes Review/Plan prompts from current saved state and the selected period/date. Weekly and meal-import JSON schemas remain unchanged; hydration plans are suggestions in notes and never logged as consumed. Four added checks cover period metrics, supported schemas, unknown/historical context, and fresh copy after new drink data. No stored user data changes.

### v2.1.2 — Check-in rating interpretation

Review and planning prompts now state the exact 1–5 endpoints for sleep quality (poor → excellent), muscle soreness (none → very sore), and stress (low → very high). Report metadata carries the same scales for daily/weekly/monthly summaries. Check-in labels and prompt interpretation share one definition. Recovery remains categorical and sleep duration remains hours; missing ratings are unknown, not zero. No saved ratings are changed.

### v2.1.3 — Daily steps

Daily Check-in includes an optional Steps count. Values are whole numbers from 0–1,000,000; blank means unknown. Backup validation preserves recorded steps and reads older diaries with no steps as unknown. Daily/weekly/monthly reports and review/planning prompts include per-date steps, total recorded steps, tracked-day count and tracked-day average. Missing days are not counted as zero, and steps do not imply calories burned. No existing food, drink, training or recovery values are changed.

### v2.1.4 — Fast AI meal import

Existing meal JSON import now has dedicated Import meals, Food prompt, and Photo prompt tabs. Food prompt accepts an optional food/portion description, date and local time, or supplies a reusable template for the next ChatGPT food question. Copy and open ChatGPT, then paste the returned JSON into Import meals for review. Explicit Paste & review uses clipboard permission only on click and falls back to manual paste.

Food log, ChatGPT and Usual foods provide clearer AI import entry points. Imports can save eaten meals, planned meals or usual foods; the library shortcut selects usual foods by default. Missing dates/times get visible review defaults; portions use multiline inputs. Existing photo capture metadata, strict macro validation, batch review, manual file import and historical food logs remain supported. Failed storage saves retain the review form and prior state. No AI API or new credentials are required.

### v2.2.0 — Connected visual fuel timeline

The day timeline now has a continuous vertical path, distinct meal/drink/training markers, compact event cards, strong time labels and a legend, while retaining cumulative nutrition. Amber cards and dashed path segments highlight gaps strictly longer than four hours between timed logged meals. Markers sit at the four-hour point in chronological order and show full gap duration/from/to times, scheduled training within the interval and logged drink calories. Today can also show an ongoing gap after the last logged meal.

The reminder is a user-selected meal-spacing heuristic, not proof of underfueling. Partial logs suggest checking for missing meals. Drinks remain visible/in calorie totals but do not reset meal spacing. Untimed entries, overnight boundaries, and historical trailing gaps are not inferred. Reports/AI prompts include gap metadata with the same interpretation. No diary or nutrition values are changed. Light/dark and narrow layouts use theme-aware event and amber colors; actual browser/device visual QA remains unavailable.

### v2.3.0 — Plan-based calorie checkpoints

Training/fuel timeline adds cumulative calorie goals at planned meal times and scheduled workout times, with prominent by-BJJ totals and the date’s BJJ/non-BJJ daily goal. Targets sum timed, non-skipped planned meals without scaling them or deducting exercise calories. Logged meals and drinks count once toward progress. Current alerts compare today’s latest due checkpoint with intake through the current local minute; upcoming checkpoints do not alert early, and catch-up intake clears the current alert. Earlier checkpoints retain their at-that-time comparisons. Historical/future dates do not show current behind-plan alerts.

Missing plans provide a direct link to the selected day’s Plan. Zero pre-BJJ planned calories prompt meal timing review. Untimed intake cannot be matched to checkpoints, and incomplete logs are not confirmed deficits. The visible timeline refreshes each minute and on returning to the app while respecting open editors/unsaved forms. These are in-app alerts; there is no background push notification. Reports/AI prompts include the same checkpoint metadata and interpretation. Existing food, drink, goals, schedules and storage schema remain unchanged. Targets support following the meal plan, not guaranteed optimal energy.

### v2.3.1 — Reliable Open Food Facts name search

Replaces browser-direct legacy name searches (observed upstream 503) with the dedicated Search-a-licious API through the existing Vercel food backend, which supplies the app User-Agent and correct CORS. OFF search needs no USDA key and remains independent of custom USDA endpoints. Response projection is done locally because the deployed upstream fields option returned empty objects. Backend cache keys include the provider; malformed/partial/error responses are rejected instead of appearing as empty results.

Search result selection retrieves current product details before portion review so serving sizes and nutrition basis are preserved. Barcode lookup stays direct, source attribution stays OFF, and saved barcode/product data remains cached. The browser timeout and function timeout allow the upstream to finish, and service errors explain alternatives. Existing logs, recipes, goals, schedules, storage keys and USDA secrets are unchanged.

### v2.4.0 — Daily calorie and macro pacing

- Six local-time checkpoints (10 AM, noon, 3 PM, 5 PM, 9 PM, 10 PM) use the applicable BJJ/non-BJJ More → Goals profile, independently of meal plans. The final checkpoint equals all four daily settings exactly. Completed-day snapshots remain preserved.
- BJJ cumulative calorie fractions: 20/40/60/70/90/100%; protein: 20/40/60/65/85/100%; carbohydrate: 20/40/60/75/95/100%; fat: 25/45/60/65/90/100%. This suggested distribution assumes a 6 PM class and reserves evening recovery intake. Non-BJJ days use 20/40/60/75/90/100% for each nutrient. These are app heuristics informed by general nutrient-timing principles, not a validated optimum.
- Actual meal/drink macros, running totals, four-nutrient checkpoint comparisons, and current catch-up alerts share one calculation. Upcoming checkpoints never issue early alerts. Missing logs remain unknown. AI reviews include the new targets and interpretation.
- No settings migration, storage reset, or diary changes. Service-worker cache and asset versions updated to 2.4.0.

### v2.4.1 — Checkpoint meeting ranges

Each checkpoint now shows an inclusive ±10% range for calories, protein, carbohydrate and fat. Below, within and above range use shared calculation logic in the timeline, current status and AI report data. Mixed shortfalls/excesses are labeled outside range. Range bounds are rounded to two decimals and displayed to the same precision. Center targets and saved daily settings remain unchanged, including the final 10 PM targets. No storage migration or changes to logs. Offline cache/assets updated.
