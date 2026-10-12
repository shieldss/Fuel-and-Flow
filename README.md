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
