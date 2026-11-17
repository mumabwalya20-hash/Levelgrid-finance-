# Levelgrid Finance progress

## Current status

| Item | State |
| --- | --- |
| Revised master blueprint | Approved by the Owner on 16 November 2026 |
| Feature roadmap | Approved |
| Application implementation | Features 01–05 merged and verified for release |
| Application tests | Feature 06 browser, database and deployment checks passed |
| Production release | Released on 17 November 2026. [Levelgrid Finance](https://levelgrid-finance.vercel.app/) |

## Feature tracker

| Feature | Implementation | Test evidence | Acceptance |
| --- | --- | --- | --- |
| 01 — Foundation and One-Page PWA | Implemented | Static build, types, installability, panel navigation and offline reopen verified in Chromium | Owner Android check passed on 17 November 2026 |
| 02 — Authentication and Offline Database | Implemented | Static build, Chromium with simulated Supabase Auth and PostgreSQL-compatible schema tests passed | Owner reported Feature 02 passed on 17 November 2026 |
| 03 — Guided Daily Entry | Implemented | TypeScript, static build, phone-size Chromium and IndexedDB checks passed | Owner confirmed the Android test passed on 17 November 2026 |
| 04 — Reliable Sync and Recovery | Implemented | PostgreSQL-compatible migration and browser checks passed | Owner confirmed Feature 04 passed on 17 November 2026 |
| 05 — Dashboard and PDF Reports | Implemented | Offline dashboard, four PDF formats and pagination checked with synthetic records | Owner confirmed the Android test passed on 17 November 2026 |
| 06 — Testing and Release | Released from `main` | Final browser, PostgreSQL-compatible, performance and Vercel smoke checks passed | Owner confirmed checks and approved release on 17 November 2026 |

## Decision log

- **16 November 2026** — Prepared the revised master blueprint, contributor instructions and proposed feature roadmap for Owner review. The proposal calls for revision checks, preservation of pending local changes on conflict and a small rolling recovery copy after corrections.
- **16 November 2026** — The Owner approved the revised master blueprint and roadmap with one correction. Required sales and expense amounts must be entered before advancing or confirming, and the Owner enters `0` for a zero amount.
- **16 November 2026** — Implemented the branded one-page shell, reporting-month control, panels, web app manifest and versioned offline cache.
- **17 November 2026** — Merged the Android-tested Feature 01 branch. Started Feature 02 with Owner sign-in, device trust, Dexie storage, department management and an account-scoped cloud schema.
- **17 November 2026** — Merged Feature 02 into `main`. [Pull request #3](https://github.com/mumabwalya20-hash/Levelgrid-finance-/pull/3)
- **17 November 2026** — Implemented the guided daily form, per-date drafts, review, and offline confirmation and corrections. Department selection follows the business date and preserves departments already included in a draft or confirmed entry.
- **17 November 2026** — The Owner approved Feature 03 and requested one address for phone testing. The `testing` branch is used for every Vercel Preview at that address. [Owner test address](https://levelgrid-finance.vercel.app/)
- **17 November 2026** — Merged Feature 03 and published it at the fixed test address from `testing`. [Pull request #4](https://github.com/mumabwalya20-hash/Levelgrid-finance-/pull/4)
- **17 November 2026** — Implemented incremental Supabase sync, upload receipts, revision conflict protection, the latest 20 correction copies and emergency backup and restore.
- **17 November 2026** — The Owner accepted Feature 04 and authorized Feature 05. [Pull request #5](https://github.com/mumabwalya20-hash/Levelgrid-finance-/pull/5)
- **17 November 2026** — Implemented month and day dashboard filters, departmental totals, recent record balances and four offline PDF report types.
- **17 November 2026** — The Owner accepted Feature 05 after Android testing. [Pull request #6](https://github.com/mumabwalya20-hash/Levelgrid-finance-/pull/6)
- **17 November 2026** — The Owner confirmed the final checks and approved the production release. [Released app](https://levelgrid-finance.vercel.app/)

## Feature 01 verification

- Installed from the lockfile, checked TypeScript types and built the static export.
- Chromium reported zero installability errors. The service worker cached 24 files, including the shell and its assets.
- Checked layouts at 320, 390, 412 and 768 CSS pixels. Month navigation worked across a year boundary. The main actions and More options opened panels on the same page.
- Closed the preview tab, stopped the server, simulated offline mode and reopened the page in a fresh tab. The cached page opened, showed **Offline** and **Ready offline**, and its panels worked. The reporting month followed the Lusaka date across a month boundary.

- The Owner confirmed that the Android phone test passed on the Vercel staging build of commit `a18e4d3`.

## Feature 02 verification

- TypeScript and the static production build passed.
- At a phone-size viewport, Chromium with a simulated Supabase endpoint covered first-use offline lock, wrong password, wrong account, trusted offline reopen, and revocation on reconnect.
- IndexedDB checks covered department seeding, add and deactivate, preservation of a historical zero entry, and rollback when the pending operation could not be written. Offline sign-out locked access while preserving pending changes for the same Owner's next online sign-in.
- The migration passed PostgreSQL-compatible checks for one-time department seeding, anonymous and non-Owner isolation, revoked sessions, and unique daily records with retained department history.

## Feature 03 verification

- TypeScript and the static production export passed.
- Chromium with simulated Auth reopened the PWA offline and restored an unfinished draft after closing the tab. Checks covered 320 and 390 CSS pixel widths, blank-field rejection at every stage, and explicit zero amounts. An all-zero confirmed day appeared in Recent daily records.
- A forced duplicate pending-operation ID aborted the entire confirmation, preserving the draft. Retry confirmed the day once. Corrections kept record IDs, advanced revisions only for changed records, and stored decimal amounts exactly.
- IndexedDB checks exercised date-effective department selection, compatibility with older drafts, concurrent draft writes, and rejection of stale confirmations. Calendar and amount checks covered Lusaka midnight, leap dates and the existing cloud amount limits.

## Feature 04 verification

- TypeScript and the static production export passed. Existing records and pending operations survived an IndexedDB upgrade at the same origin.
- Applied the migration to PostgreSQL-compatible fixtures with existing records. Checked Owner-only RPC access, revoked sessions, bounded pages, exact amounts, retry receipts and expected revisions.
- Chromium with simulated Auth and real PostgreSQL-compatible sync functions covered a missing migration, a cloud commit with a lost acknowledgement, a newer correction made during upload, reconnect, and a conflict that kept the phone and cloud versions.
- Recovered previous values into a draft. On a fresh browser, restored the cloud copy, rejected a backup for another Owner, then restored a valid backup with offline entries and a draft.
- Reproduced the older Feature 02 placeholders at the fixed address while an earlier app window remained open. Verified that the new shell activates after its assets are cached. A normal refresh loaded Features 03 and 04 while the earlier tab remained open. A failed shell install kept offline access working, and an update preserved pending changes and a saved draft.

## Feature 05 verification

- TypeScript and the static export passed. Chromium reopened offline and downloaded daily business, monthly combined, department and custom date-range PDFs. Reporting generated no Supabase requests while offline.
- Matched dashboard and PDF amounts to synthetic entries with Finance Expenses, inactive department history, pending work, missing and incomplete dates, confirmed zeros and a live correction. Totals remained exact for negative values and combined figures above JavaScript's safe integer range.
- Checked 320 and 390 pixel dashboard layouts, the rendered A4 PDFs, repeated table headings and multi-page numbering. Feature 04 sync, backup, recovery and update checks continued to pass.

## Feature 06 verification

- Verified the accepted application code in `main` commit `38bddf2d5017fabbade1c34db7380134a12dacd8`. TypeScript and the static export passed. The offline shell cached 27 files.
- Final browser tests passed for trusted offline startup, draft recovery, explicit zero entry, atomic saves, editing, interrupted upload retries, conflict preservation, backup restore and cloud restore in a fresh browser. Offline PDF downloads and exact amounts passed for all four report types.
- The PostgreSQL-compatible fixture passed the migration, Owner-only access, revoked session, duplicate replay, revision conflict and bounded download checks. A sync with no new changes returned an empty page.
- Verified the installed app address serves Vercel Production from `main`. The app shell, manifest, service worker and cached report assets loaded successfully. The production build uses the same Finance Supabase connection settings as the accepted preview.

### Request counts with synthetic records

| Activity | Auth requests | Department reads | Upload batches | Download pages | Fixture RPC process CPU (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Eight seconds idle | 0 | 0 | 0 | 0 | 0 |
| Date navigation and opening reports | 0 | 0 | 0 | 0 | 0 |
| Normal online day save | 0 | 0 | 1 | 1 | 5.5 |
| Reconnect with a pending change | 1 | 1 | 1 | 1 | 4.0 |
| Fresh sign-in and cloud restore | 1 | 1 | 0 | 1 | 2.7 |

CPU timings describe the local PostgreSQL-compatible fixture. Measurement in the live Supabase project's metrics remains outstanding.
