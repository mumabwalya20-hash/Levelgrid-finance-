# Levelgrid Finance feature roadmap

This roadmap follows the [approved revised master blueprint](MASTER_BLUEPRINT.md).

## Feature order and dependencies

| Feature | Depends on | Deliverable |
| --- | --- | --- |
| 01 — Foundation and One-Page PWA | Approved blueprint | Installable Android PWA and offline application shell |
| 02 — Authentication and Offline Database | 01 | Private login and secure local and cloud data foundations |
| 03 — Guided Daily Entry | 02 | Offline drafts, confirmation and corrections |
| 04 — Reliable Sync and Recovery | 03 | Incremental synchronization, conflict handling and recovery |
| 05 — Dashboard and PDF Reports | 04 | Local summaries, record access and offline PDFs |
| 06 — Testing and Release | 01–05 | End-to-end acceptance evidence and release readiness |

## Design reference

Use **Levelgrid Enterprises Financial Records** as the display name and the supplied Levelgrid Enterprises logo as the brand reference. The attached mockup guides a light-only theme with a white background, orange primary actions and blue headings, totals and secondary actions.

| View | Layout cues from the mockup |
| --- | --- |
| Login | Levelgrid brand at the top, email and password fields, device sign-in option, orange Login button |
| Main page | Month selector, prominent sales total, expenses and balance cards, orange Enter Daily Sales action, PDF Reports and Departments actions, recent records and sync status |
| Daily entry panel | Date selector, step progress, current department name, amount fields, optional expense comment and Previous/Next controls |

The progress indicator follows the configured departments plus the Finance Expenses step. The written blueprint governs navigation, data and approval behavior.

## Feature 01 — Foundation and One-Page PWA

Set up the static Next.js and TypeScript application, installable Android PWA, offline shell and single-page layout. Define how the main page presents inline panels and dialogs. Use the visual cues above for the shell and its main actions.

### Acceptance checks

Install and launch on Android. Reopen the installed shell with the phone offline after initial online setup. Check the page and its panels on a phone-size screen.

## Feature 02 — Authentication and Offline Database

Set up Supabase Auth for the private account, account-scoped PostgreSQL tables and RLS, and a Dexie database for departments, daily records, shared expenses, drafts and the pending operations used by Features 03 and 04. Seed the five operating departments exactly once. Provide addition and deactivation from department management and preserve historical associations. Establish the trusted-device state from an online sign-in.

### Acceptance checks

The Owner can sign in, close and reopen the PWA offline after establishing device trust, and manage departments from the main page. A deactivated department's historical records remain readable. Check unauthorized data access using synthetic records and verify the first-use and reconnection behavior.

### Trusted-device behavior

An online Owner sign-in can establish device trust. The trusted app can reopen its account-specific database offline. On app open, foregrounding and reconnect, it checks the session and Owner access with Supabase when reachable.

Sign-out removes device trust and keeps records, drafts and pending operations on the device. A session or Owner access revoked in Supabase locks the app once verified online. Signing in online with the same account makes its local data available again.

## Feature 03 — Guided Daily Entry

Provide date selection, one operating department per step, shared Finance Expenses, review and confirmation. Start new amount fields blank. Require an explicit numeric entry for each sales or expense amount, including Finance Expenses. Enter `0` for zero. Block advancement from a step when a required amount on that step is blank and recheck all required amounts at confirmation. Autosave incomplete drafts while the Owner works. When confirming or correcting, write confirmed values and pending operations together. Use stable identities and a uniqueness rule for department and date so editing reopens the existing entry. Keep shared Finance Expenses tied to the selected day.

### Acceptance checks

- Resume an incomplete draft after closing the PWA and verify the amounts already entered are retained.
- Leave the sales amount blank with an expense entered and verify that Next is blocked. Repeat with the departmental expense amount blank and with Finance Expenses blank. Verify that final confirmation also rejects any blank required amount.
- Type `0` for zero sales and expenses, confirm the day offline and distinguish that confirmed zero day from a missing day.
- Validate exact edits to ZMW amounts with up to two decimal places. Reopen an existing day, save a correction and verify the same confirmed entry is updated and pending.
- Verify that interrupted local saves leave a consistent set of records and pending operations.

### Design details to settle

Define which departments appear when entering a past date after a department was added or deactivated, and define the permitted amount range. Use the Lusaka calendar date for business records.

## Feature 04 — Reliable Sync and Recovery

Implement online-save, open/foreground, reconnect and manual sync triggers. Batch incremental operations where appropriate. Return the prior outcome when retrying an already applied operation. Check the expected revision before applying a new operation and preserve local work if a conflict occurs. Show pending and conflict status, and retain a small rolling copy of prior values after corrections. Request persistent browser storage where supported. Provide an emergency backup file and a controlled restore process for synchronized records and for records included in a usable backup.

### Acceptance checks

Retry after cloud success with the acknowledgement interrupted and verify one cloud result. Verify that acknowledgement of an earlier edit leaves a newer unsynced edit pending. Confirm that an unexpected cloud revision preserves the local edit and surfaces a conflict. Recover prior values after a correction, recover synchronized data on a fresh installation, and verify recovery using an emergency backup. Check the notice for changes that exist only on the phone.

### Design details to settle

Define rolling recovery retention, the restore and conflict resolution flows, and which local records and pending operations a backup must preserve for safe recovery.

## Feature 05 — Dashboard and PDF Reports

Use confirmed local records for date filters, balances and recent records with edit access. Generate daily business, combined monthly, department and custom date-range PDFs with the same calculation rules and the applicable data notices.

| Value | Calculation |
| --- | --- |
| Department balance | Department sales − department expenses |
| Business sales | Sum of department sales |
| Departmental expenses | Sum of department expenses |
| Business expenses | Departmental expenses + Finance Expenses |
| Business balance | Business sales − business expenses |

### Acceptance checks

Reconcile the on-screen and PDF figures with a known dataset including shared expenses, deactivated departments, confirmed zeros, missing records and pending sync. Verify that every report can be generated while offline and shows the applicable missing-data or unsynchronized-data notice.

## Feature 06 — Testing and Release

Run the full workflow on the intended Android phone and a fresh installation. Cover offline startup and entry, resume after interrupted work, editing, upload retries and conflicts, recovery, access controls and offline PDFs. Observe Supabase requests and CPU during idle periods, typical daily entry, reconnect with a pending queue and a fresh-device restore. Verify that ordinary on-device navigation and reports use local data and that ordinary sync avoids repeated transfers of unchanged records.

### Acceptance checks

Record pass/fail evidence for the blueprint acceptance conditions, including the observed Supabase activity, and record the Owner's release decision after review.
