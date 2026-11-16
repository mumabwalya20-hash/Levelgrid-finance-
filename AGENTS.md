# Levelgrid Finance contributor instructions

## Project and approval

- Read [MASTER_BLUEPRINT.md](MASTER_BLUEPRINT.md) for the requirements and their approval status, [FEATURE_ROADMAP.md](FEATURE_ROADMAP.md) for the feature sequence, and [PROGRESS.md](PROGRESS.md) for the latest recorded state.
- Application implementation requires explicit Owner approval of the revised master blueprint. While approval is pending, work on the planning documents.
- Follow the feature sequence after approval. Test each feature against its acceptance checks and record results and Owner acceptance in `PROGRESS.md` when they occur.
- Record changes to business behavior in the blueprint and progress notes when the Owner decides them. Keep feature design decisions consistent with the blueprint.

## Implementation rules after approval

- Build for one private Owner account and one primary Android phone. Use one main page with the email/password login view shown when authentication is needed. Use inline sections, panels or dialogs for the main actions.
- Use Next.js and TypeScript, IndexedDB with Dexie, and Supabase Auth and PostgreSQL with account-scoped Row Level Security. Keep the PWA statically hosted and calculate totals and generate PDFs locally.
- Confirm daily entries locally. Persist the affected records and their pending synchronization operations in one IndexedDB transaction. Keep operations pending until the matching cloud acknowledgement is durable locally.
- Enforce one confirmed department entry per date. Use exact two-decimal ZMW values, keep drafts distinct from confirmed records, and preserve the distinction between a missing day and a confirmed zero day.
- Treat Finance Expenses as a shared expense and apply them once to the combined balance. Preserve historical figures for deactivated departments.
- Sync incrementally on online save, app open or foregrounding, reconnection and Sync Now. Use stable identifiers and revision checks. Preserve pending local changes and report unexpected conflicts to the Owner.
- Retain correction recovery copies and support emergency backup and controlled restore. Show when a record awaits cloud protection. Use synthetic values in repository examples and tests, and keep real financial records, backup files and credentials in their authorized storage.
