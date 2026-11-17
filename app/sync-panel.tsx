import type { SyncMetadata } from "./finance/database";
import type { SyncStatus } from "./finance/sync";

const checkedTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lusaka",
});

export function SyncPanel({ state, status, pending, online, syncNow, openBackups }: {
  state?: SyncMetadata;
  status: SyncStatus;
  pending: number;
  online: boolean;
  syncNow: () => void;
  openBackups: () => void;
}) {
  let message = "Ready to check Supabase.";
  if (!online) message = "You're offline. Saved changes will sync when you reconnect.";
  else if (status === "working") message = "Checking Supabase…";
  else if (status === "setup") message = "Apply the Feature 04 migration in Supabase to enable sync.";
  else if (state?.conflict) message = "Sync paused because the phone and Supabase disagree about an entry. The phone's values are still saved.";
  else if (status === "retry") message = "Couldn't finish sync. Your changes stay on this phone. Try again.";
  else if (state?.checkedAt && pending === 0) message = "Your saved entries are up to date.";

  return (
    <div className="finance-form">
      <p className="form-feedback" role="status">{message}</p>
      <dl className="panel-list settings-list">
        <div><dt>Pending changes</dt><dd>{pending}</dd></div>
        {state?.checkedAt && <div><dt>Last cloud check</dt><dd>{checkedTime.format(new Date(state.checkedAt))}</dd></div>}
        {state?.conflict && <div><dt>Conflicting record ID</dt><dd className="sync-record-id">{state.conflict.recordId}</dd></div>}
      </dl>
      {state?.conflict && <button type="button" className="action" onClick={openBackups}>Open Backups</button>}
      <button type="button" className="action action-primary" disabled={!online || status === "working"} onClick={syncNow}>
        {status === "working" ? "Syncing…" : "Sync now"}
      </button>
    </div>
  );
}
