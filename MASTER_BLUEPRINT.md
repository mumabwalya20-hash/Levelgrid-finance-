# Daily Finance — Revised Master Blueprint

| Item | Proposal |
| --- | --- |
| Status | Proposed for approval |
| Platform | Android Next.js PWA |
| Users | One private account, one primary phone |
| Architecture | Offline-first, Supabase cloud synchronization |
| Interface | One-page application |
| Currency | ZMW |
| Priority | Data safety, simplicity and low server CPU use |
| Implementation | Awaiting explicit Owner approval |

## 1. Business Purpose

A simple financial application for recording daily total sales and expenses, showing balances, and generating PDF reports.

The application excludes complex accounting, stock control, employee management and transaction-by-transaction product sales.

## 2. Departments

Begin with five operating departments:

1. Chibombo Distributors
2. Chibombo Stationery
3. Chiyuni Stationery
4. Factory
5. Laundry

Finance Expenses remain a separate shared-expense section.

More departments can be added from the main page. Deactivated departments retain their historical figures.

## 3. One-Page Interface

The entire application operates on one main page.

- Application title and synchronization status
- Current reporting month/date selector
- Total sales, total expenses and overall balance
- Prominent Enter Daily Sales button
- PDF Reports button
- Add / Manage Departments button
- Recent daily records with editing access
- Small More menu for settings, manual sync, backups and sign-out

All actions open as inline panels, expanded sections or modal dialogs on the same page. The login interface appears only when authentication is needed.

## 4. Guided Daily Sales Form

After pressing Enter Daily Sales, the user can follow these steps.

1. Choose today or a previous date.
2. Enter Chibombo Distributors sales, expenses and optional expense comment.
3. Continue through the remaining operating departments one at a time.
4. Enter Finance Expenses and optional comment.
5. Review the complete day's figures.
6. Confirm and save.

The form automatically saves unfinished drafts.

Blank amounts count as zero. Monetary values are validated and stored accurately to two decimal places.

One confirmed entry per department per day is allowed. Existing confirmed entries can be reopened and edited.

## 5. Financial Summary

The application calculates the following amounts.

- Sales per department
- Expenses per department
- Balance per department
- Total business sales
- Total departmental expenses
- Shared Finance Expenses
- Total business expenses
- Overall business balance

Finance Expenses are subtracted once from the combined business balance and remain separate from individual department balances.

Missing days must remain distinguishable from explicitly confirmed zero-sales days.

## 6. Offline Storage and Synchronization

The phone is the primary data-entry device.

### Local-first saving

All records and pending synchronization operations are saved in IndexedDB through atomic database transactions.

### Cloud synchronization

Pending changes are uploaded to Supabase. Successful uploads are acknowledged before their pending status is cleared.

Operations use stable record identifiers and safe retry behavior to prevent duplicates.

Synchronization occurs at these points.

- A confirmed entry is saved while online.
- The app opens or returns to the foreground.
- Network connectivity is restored.
- The user presses Sync Now.

Foreground use and Sync Now are the supported ways to catch up with pending changes.

### Conflict handling

For one primary writing device, use record identifiers and revisions. If an unexpected cloud version conflict occurs, preserve the pending local record and notify the user.

This is a proposed safety improvement to the earlier last-edited-wins decision.

## 7. Data Recovery Protection

- Keep local pending changes until successful synchronization.
- Request persistent browser storage where supported.
- Retain a small, rolling recovery copy of previous confirmed values when corrections are made.
- Maintain a restorable cloud copy of synchronized records.
- Provide a manual emergency backup file option.
- Provide a controlled recovery procedure for replacing or reinstalling the phone.
- Clearly warn when unsynchronized entries remain.

The recovery copies are technical safeguards. PDFs are the only regular reports. An emergency backup file is used to recover data.

Phone failure before synchronization or an independent backup can still cause the loss of unsynchronized records. The application must make this risk visible.

## 8. Technical Stack

| Component | Selected technology |
| --- | --- |
| Application | Next.js + TypeScript |
| Installation | Android PWA |
| Offline database | IndexedDB / Dexie |
| Online authentication | Supabase Auth |
| Cloud storage | Supabase PostgreSQL |
| Hosting | Static hosting, such as Vercel |
| Synchronization | Lightweight client-side sync |
| Reports | Client-side PDF generation |

Supabase Row Level Security must protect the private account's data.

Offline authentication relies on previously established trusted device state. Session revocation can be verified when online access returns.

## 9. Low CPU and Resource Usage

The app must avoid the following sources of server work.

- Continuous database polling
- Supabase Realtime subscriptions
- Background cron jobs
- Unnecessary server-side rendering
- Per-second dashboard queries
- Repeated downloading of unchanged financial records
- Excessive database triggers or large data processing jobs

Financial calculations should happen locally. Data synchronization should be incremental and batched where appropriate. Synchronization is designed around foreground use and explicit user actions.

## 10. PDF Reports

All reports are accessible from the same main page.

- Daily business report
- Monthly combined financial summary
- Department-specific report
- Custom date-range report

Reports can be generated offline from the locally available records.

Reports generated with missing or unsynchronized data must include a clear notice.

## 11. Implementation Sequence

| Feature | Scope |
| --- | --- |
| 01 — Foundation and One-Page PWA | Android installation, single-page layout, offline shell and basic application structure |
| 02 — Authentication and Offline Database | Private Supabase login, IndexedDB, department records and secure cloud schema |
| 03 — Guided Daily Entry | One-at-a-time department form, drafts, duplicate prevention, confirmation and corrections |
| 04 — Reliable Sync and Recovery | Durable pending queue, automatic retry, conflict protection, recovery copies and emergency backup |
| 05 — Dashboard and PDF Reports | Local calculations, date filters, daily records and PDF generation |
| 06 — Testing and Release | Offline tests, interrupted synchronization, duplicate retries, recovery from accidental edits, phone-replacement recovery, security tests and CPU monitoring |

Each feature requires successful testing before acceptance. See [Feature roadmap](FEATURE_ROADMAP.md) for dependencies and proposed checks.

## 12. Required Acceptance Conditions

The application must meet these conditions.

- Open offline after initial installation and setup.
- Operate entirely from one main page.
- Save financial records without internet access.
- Preserve incomplete drafts.
- Prevent duplicate daily department records.
- Allow corrections to existing records.
- Recover safely from interrupted synchronization.
- Preserve local pending data and flag unexpected cloud conflicts.
- Clearly identify unprotected, unsynchronized entries.
- Support recovery of previously synchronized data on a replacement phone.
- Generate accurate PDF reports.
- Keep normal server resource consumption minimal.

## 13. Approval Status

This is a revised planning proposal incorporating the latest requirements. It carries forward the original business requirements and proposes refinements to synchronization conflicts and recovery copies.

Application implementation requires the Owner's explicit approval of this revised master blueprint.
