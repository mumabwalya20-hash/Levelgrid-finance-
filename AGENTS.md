# Levelgrid Finance contributor instructions

## Project and approval

- Read [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md) for the requirements and their approval status, [FEATURE_ROADMAP.md](FEATURE_ROADMAP.md) for the feature sequence, and [PROGRESS.md](PROGRESS.md) for the latest recorded state.
- The Owner approved the revised master blueprint on 16 November 2026. Start with Feature 01 and follow the feature sequence.
- Test each feature against its acceptance checks and record results and Owner acceptance in `PROGRESS.md` when they occur.
- Record changes to business behavior in the blueprint and progress notes when the Owner decides them. Keep feature design decisions consistent with the blueprint.
- Use `testing` for Vercel Preview deployments. Publish Owner-approved releases from `main` at the existing installed app address. Verify the production branch and commit at that address. [Owner app address](https://levelgrid-finance.vercel.app/)

## Implementation rules

- Build for one private Owner account and one primary Android phone. Use one main page with the email/password login view shown when authentication is needed. Use inline sections, panels or dialogs for the main actions.
- Use Next.js and TypeScript, IndexedDB with Dexie, and Supabase Auth and PostgreSQL with account-scoped Row Level Security. Keep the PWA statically hosted and calculate totals and generate PDFs locally.
- Confirm daily entries locally. Persist the affected records and their pending synchronization operations in one IndexedDB transaction. Keep operations pending until the matching cloud acknowledgement is durable locally.
- Start new amount fields blank. Require explicit sales and expense amounts, including Finance Expenses, and require the Owner to enter `0` for zero amounts. Block Next when an amount on the current step is blank and block confirmation while any required amount is blank.
- Enforce one confirmed department entry per date. Use exact two-decimal ZMW values, keep drafts distinct from confirmed records, and preserve the distinction between a missing day and a confirmed zero day.
- Treat Finance Expenses as a shared expense and apply them once to the combined balance. Preserve historical figures for deactivated departments.
- Sync incrementally on online save, app open or foregrounding, reconnection and Sync Now. Use stable identifiers and revision checks. Preserve pending local changes and report unexpected conflicts to the Owner.
- Retain correction recovery copies and support emergency backup and controlled restore. Show when a record awaits cloud protection. Use synthetic values in repository examples and tests, and keep real financial records, backup files and credentials in their authorized storage.
