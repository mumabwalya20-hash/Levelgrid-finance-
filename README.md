# Levelgrid Enterprises Financial Records

Levelgrid Finance is a private Android PWA for recording daily sales and expenses in ZMW, viewing balances and generating PDF reports.

The [progress tracker](PROGRESS.md) records implementation, verification and acceptance.

| File | Contents |
| --- | --- |
| [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md) | Business requirements, architecture and acceptance conditions |
| [FEATURE_ROADMAP.md](FEATURE_ROADMAP.md) | Feature sequence, design reference and acceptance checks |
| [AGENTS.md](AGENTS.md) | Contributor instructions and implementation rules |
| [PROGRESS.md](PROGRESS.md) | Decision log and current feature status |

## Build the application

Use Node.js 22 or newer.

```sh
npm ci
npm run typecheck
npm run build
```

Deploy the `out/` directory on static HTTPS hosting. For a Vercel preview, set the framework preset to **Other**, the build command to `npm run build`, and the output directory to `out`.

To serve the production build on the build computer, run `python3 -m http.server 4173 --bind 127.0.0.1 --directory out` and open [localhost port 4173](http://127.0.0.1:4173/).

## Vercel deployments

Use `testing` for Preview builds and `main` for Owner-approved Production releases. Configure Production to use the Finance Supabase project already used by the installed app. Verify the production commit at the fixed address after deployment. [Open Levelgrid Finance](https://levelgrid-finance.vercel.app/)

Install the PWA from that address once. If an older installation shows feature placeholders, refresh the app address in Chrome while online, then reopen the installed app.

For future releases, finish any open entry and tap **Update app** in the footer when it appears. The app reloads once the new offline shell is ready. Keep the phone's site data so the same installation keeps drafts and pending changes.

## Check Feature 01 on Android

1. Open the [test address](https://levelgrid-finance.vercel.app/) in Chrome and wait for **Ready offline** in the app footer.
2. Open Chrome's menu and select **Install app** or **Add to Home screen**. Launch the app from the home screen.
3. Select a reporting month. Open and close **Enter Daily Sales**, **PDF Reports**, **Departments**, and **More** from the main page.
4. Turn off Wi-Fi and mobile data. Close the app, then reopen it from the home screen. Check that the main page and panels open and the footer shows **Offline**.

## Set up Feature 02 for testing

1. Open the Supabase project configured for the preview. In Authentication settings, enable email/password sign-in and disable new user sign-ups.
2. Run the [Feature 02 migration](supabase/migrations/20261117000000_finance_foundation.sql) in that project's SQL Editor. Keep the `finance_private` schema outside the Data API's exposed schemas.
3. Create an email/password test Owner in **Authentication → Users**. Confirm the user and copy its UUID. Replace the placeholder in this SQL and run it in the testing project's SQL Editor. This registers the Owner and seeds all five operating departments once.

```sql
insert into finance_private.owner (user_id)
values ('YOUR_TEST_OWNER_UUID'::uuid)
on conflict (user_id) do nothing;
```

Set the following variables in the Vercel **Preview** environment, then deploy `testing` with the static build settings above.

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | HTTPS URL of the testing project |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | That project's `sb_publishable_…` key |

The static build embeds both values in the browser bundle. Enter the Owner password in the app's sign-in form.

## Check Feature 02 on Android

1. Launch the installed app from the [test address](https://levelgrid-finance.vercel.app/).
2. Before the first sign-in, go offline and reopen. Check that the sign-in screen stays locked. Reconnect and check that an incorrect password leaves the screen locked.
3. Sign in online with **Trust this device for offline access** selected. Check that Departments shows the five operating departments and the footer says **Ready offline**.
4. Go offline, close the app, and reopen it from the home screen. Add a test department and deactivate it in the same panel. Check that it appears in **Inactive departments** and that the main page shows the pending changes.
5. Use **More → Sign out** while offline. Reopen the app and check that it asks you to sign in. Reconnect and sign in with the same Owner. Check that the inactive department and pending changes are still there.

Department changes are saved on the device with their pending operations. Cloud synchronization of those changes is part of Feature 04.

## Check Feature 03 on Android

Launch the app from the [test address](https://levelgrid-finance.vercel.app/) and sign in with the configured Owner account. Select **Trust this device for offline access** and wait for **Ready offline**. Use test figures in the preview.

1. Turn off Wi-Fi and mobile data. Open **Enter Daily Sales**, choose today or an earlier date and continue.
2. Enter `0` in Expense amount and leave Sales amount blank. Tap **Next** and check that the form stays on the same step. Enter `0` in Sales amount, clear Expense amount and repeat the check.
3. Fill both amounts and add a test comment. When **Draft saved on this phone** appears, close and reopen the preview while offline. Tap **Enter Daily Sales** and **Resume draft**. Use **Previous** if needed to check the two amounts and comment.
4. Enter an amount in every department field. On Finance Expenses, tap **Review entry** with the amount blank to check that it is required. Type `0` and continue to review.
5. Check the figures, then tap **Confirm and save** and **Done**. Check that the date appears under **Recent daily records** and that the app shows pending changes.
6. Tap that day's **View / Edit**, select a department on the review screen and change a figure to `0.29`. Save and reopen to verify the exact amount and a single record for that date in the recent list.

Feature 03 uses the existing Supabase setup. Confirmed entries and drafts are stored on the phone under the preview address. Feature 04 adds cloud synchronization.

## Enable Feature 04

Run the [Feature 04 migration](supabase/migrations/20261117000004_finance_sync.sql) once in the SQL Editor of the existing Finance Supabase project. It runs after the Feature 02 migration and keeps the existing Owner and tables. The first online sync will also upload changes already awaiting sync on the phone.

## Check Feature 04 on Android

Open the installed app while online at the existing test address and tap **Update app** when available. [Open Levelgrid Finance](https://levelgrid-finance.vercel.app/)

1. Turn off Wi-Fi and mobile data. Confirm a day with test figures and check the pending notice on the main page.
2. Reconnect. Open **More → Sync Now** and wait for **Your saved entries are up to date**. Reopen and correct the day, then check that the pending notice clears again.
3. In **More → Backups**, choose **Load into draft** beside the correction. Check the earlier figures in **Enter Daily Sales** and review them before confirming.
4. Download an emergency backup while offline with a test draft or pending change. The file contains financial data, so keep it in a private location away from the phone.
5. On a fresh browser profile, sign in at the same address with the same Owner. Verify the cloud-restored dates. In **More → Backups**, choose the downloaded file, review its contents and select **Restore backup**. Confirm that the draft or pending changes are present.

For a phone replacement, sign in with the same Owner and let the cloud check finish before making new entries. The emergency backup also recovers work that had not reached Supabase. Restore it on a device with no unfinished drafts or pending changes of its own.

If sync pauses on a conflict, use **More → Sync Now** to find the conflicting record ID and **Open Backups** to export the phone's data. Keep the file and compare the phone values with the Supabase record before deciding how to reconcile them. Pending changes stay on the phone during this review.

## Check Feature 05 on Android

Open the installed app online and tap **Update app** in the footer if it appears. [Open Levelgrid Finance](https://levelgrid-finance.vercel.app/)

1. Select a **Month** or **Day** with known entries. Check **Total Sales**, **Total Expenses** and **Overall Balance**. Under **Department totals**, verify departmental expenses, Finance Expenses and each department's balance.
2. Select a day with confirmed zeros and a day with no entries. Confirm the zero day shows K 0.00 and opens in **Recent daily records**. Select **View / Edit** to review or correct a recorded day.
3. Turn off Wi-Fi and mobile data. Open **PDF Reports** and download the daily, monthly, department and custom date-range reports. Include an inactive department with history when testing the department report.
4. Open the downloaded PDFs and compare their totals with the selected records. Check notices for missing or incomplete dates and for report changes awaiting sync.
