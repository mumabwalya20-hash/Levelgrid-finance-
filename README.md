# Levelgrid Enterprises Financial Records

Levelgrid Finance is a planned private Android PWA for recording daily sales and expenses in ZMW, viewing balances and generating PDF reports.

Feature 01 provides the one-page application shell and offline startup. The [progress tracker](PROGRESS.md) records verification and acceptance.

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

## Check Feature 01 on Android

Use the Feature 01 staging build for these checks.

1. Open the HTTPS preview in Chrome and wait for **Ready offline** in the app footer.
2. Open Chrome's menu and select **Install app** or **Add to Home screen**. Launch the app from the home screen.
3. Select a reporting month. Open and close **Enter Daily Sales**, **PDF Reports**, **Departments**, and **More** from the main page.
4. Turn off Wi-Fi and mobile data. Close the app, then reopen it from the home screen. Check that the main page and panels open and the footer shows **Offline**.

## Set up Feature 02 for testing

1. Use a dedicated Supabase testing project. In Authentication settings, enable email/password sign-in and disable new user sign-ups.
2. Run the [Feature 02 migration](supabase/migrations/20261117000000_finance_foundation.sql) in that project's SQL Editor. Keep the `finance_private` schema outside the Data API's exposed schemas.
3. Create an email/password test Owner in **Authentication → Users**. Confirm the user and copy its UUID. Replace the placeholder in this SQL and run it in the testing project's SQL Editor. This registers the Owner and seeds all five operating departments once.

```sql
insert into finance_private.owner (user_id)
values ('YOUR_TEST_OWNER_UUID'::uuid)
on conflict (user_id) do nothing;
```

Set the following variables in the Vercel **Preview** environment, then deploy the Feature 02 branch with the static build settings above.

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | HTTPS URL of the testing project |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | That project's `sb_publishable_…` key |

The static build embeds both values in the browser bundle. Enter the Owner password in the app's sign-in form.

## Check Feature 02 on Android

1. Open the Feature 02 preview URL in Chrome and install it. Use the same URL throughout the test so the app can reopen the same local database.
2. Before the first sign-in, go offline and reopen. Check that the sign-in screen stays locked. Reconnect and check that an incorrect password leaves the screen locked.
3. Sign in online with **Trust this device for offline access** selected. Check that Departments shows the five operating departments and the footer says **Ready offline**.
4. Go offline, close the app, and reopen it from the home screen. Add a test department and deactivate it in the same panel. Check that it appears in **Inactive departments** and that the main page shows the pending changes.
5. Use **More → Sign out** while offline. Reopen the app and check that it asks you to sign in. Reconnect and sign in with the same Owner. Check that the inactive department and pending changes are still there.

Department changes are saved on the device with their pending operations. Cloud synchronization of those changes is part of Feature 04.
