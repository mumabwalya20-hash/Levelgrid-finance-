# Levelgrid Finance progress

## Current status

| Item | State |
| --- | --- |
| Revised master blueprint | Approved by the Owner on 16 November 2026 |
| Feature roadmap | Approved |
| Application implementation | Features 01 and 02 merged. Feature 03 pending |
| Application tests | Feature 02 static build, simulated Auth, PostgreSQL-compatible policy checks and Owner testing passed |

## Feature tracker

| Feature | Implementation | Test evidence | Acceptance |
| --- | --- | --- | --- |
| 01 — Foundation and One-Page PWA | Implemented | Static build, types, installability, panel navigation and offline reopen verified in Chromium | Owner Android check passed on 17 November 2026 |
| 02 — Authentication and Offline Database | Implemented | Static build, Chromium with simulated Supabase Auth and PostgreSQL-compatible schema tests passed | Owner reported Feature 02 passed on 17 November 2026 |
| 03 — Guided Daily Entry | Pending | Pending | Pending |
| 04 — Reliable Sync and Recovery | Pending | Pending | Pending |
| 05 — Dashboard and PDF Reports | Pending | Pending | Pending |
| 06 — Testing and Release | Pending | Pending | Pending |

## Decision log

- **16 November 2026** — Prepared the revised master blueprint, contributor instructions and proposed feature roadmap for Owner review. The proposal calls for revision checks, preservation of pending local changes on conflict and a small rolling recovery copy after corrections.
- **16 November 2026** — The Owner approved the revised master blueprint and roadmap with one correction. Required sales and expense amounts must be entered before advancing or confirming, and the Owner enters `0` for a zero amount.
- **16 November 2026** — Implemented the branded one-page shell, reporting-month control, panels, web app manifest and versioned offline cache.
- **17 November 2026** — Merged the Android-tested Feature 01 branch. Started Feature 02 with Owner sign-in, device trust, Dexie storage, department management and an account-scoped cloud schema.
- **17 November 2026** — Merged Feature 02 into `main`. [Pull request #3](https://github.com/mumabwalya20-hash/Levelgrid-finance-/pull/3)

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

## Next action

[Feature 03 — Guided Daily Entry](FEATURE_ROADMAP.md#feature-03--guided-daily-entry) is next. Set the rules for department selection on past dates and the supported amount range, then implement the dated form, draft saving and corrections.
