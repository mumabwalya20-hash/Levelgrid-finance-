"use client";

import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { BackupError, createBackup, readBackup, restoreBackup, restoreCorrectionDraft, type FinanceBackup } from "./finance/backup";
import { businessDate, formatEntryDate } from "./finance/daily-entry";
import { DailyEntryError, type FinanceDatabase, type RecoveryCopy } from "./finance/database";
import { downloadFile } from "./finance/download";

const correctionDate = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lusaka",
});

export function BackupsPanel({ database, onRestore, onOpenEntry }: {
  database: FinanceDatabase;
  onRestore: () => void;
  onOpenEntry: (date: string) => void;
}) {
  const [copies, setCopies] = useState<RecoveryCopy[]>();
  const [backup, setBackup] = useState<FinanceBackup>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();

  useEffect(() => {
    const subscription = liveQuery(() => database.recoveryCopies.orderBy("savedAt").reverse().toArray()).subscribe({
      next: setCopies,
      error: () => setMessage({ text: "Couldn't load previous values.", error: true }),
    });
    return () => subscription.unsubscribe();
  }, [database]);

  async function perform(action: () => Promise<void>, fallback: string) {
    if (busy) return;
    setMessage(undefined);
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setMessage({
        text: error instanceof BackupError || error instanceof DailyEntryError ? error.message : fallback,
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }

  function download() {
    void perform(async () => {
      const data = await createBackup(database);
      const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
      downloadFile(blob, `levelgrid-finance-backup-${businessDate()}.json`);
      setMessage({ text: "Backup download started." });
    }, "Couldn't prepare the backup. Try again.");
  }

  function chooseFile(file: File) {
    setBackup(undefined);
    void perform(async () => {
      setBackup(readBackup(await file.text(), database));
    }, "Couldn't open the backup file. Try again.");
  }

  function restore(data: FinanceBackup) {
    void perform(async () => {
      await restoreBackup(database, data);
      setBackup(undefined);
      setMessage({ text: "Backup restored on this phone. Open Recent daily records to check the entries." });
      onRestore();
    }, "Couldn't restore the backup. The phone's records were kept.");
  }

  return (
    <div className="finance-form">
      <p className="form-help">
        An emergency backup includes saved records, drafts and pending changes. Keep the file somewhere private, separate from this phone.
      </p>
      <button className="action" type="button" onClick={download} disabled={busy}>Download emergency backup</button>
      <label className="form-field">
        Choose backup file
        <input
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) chooseFile(file);
          }}
        />
      </label>
      {backup && (
        <div className="panel-confirmation">
          <p>Backup saved {correctionDate.format(new Date(backup.createdAt))}</p>
          <p>{backup.dailyRecords.length} department entries, {backup.sharedExpenses.length} Finance Expenses entries,
            {" "}{backup.drafts.length} drafts and {backup.pendingOperations.length} pending changes.</p>
          <button type="button" className="action action-primary" disabled={busy} onClick={() => restore(backup)}>Restore backup</button>
        </div>
      )}
      {message && <p role={message.error ? "alert" : "status"} className={message.error ? "entry-error" : "form-feedback"}>{message.text}</p>}
      <div>
        <h3 className="entry-title">Previous values</h3>
        {copies?.length ? (
          <ul className="panel-list">
            {copies.map((copy) => (
              <li key={copy.id} className="department-row">
                <div>
                  <time dateTime={copy.date}>{formatEntryDate(copy.date)}</time>
                  <p className="form-help">Replaced {correctionDate.format(new Date(copy.savedAt))}</p>
                </div>
                <button className="action" type="button" disabled={busy} onClick={() => {
                  void perform(async () => {
                    onOpenEntry(await restoreCorrectionDraft(database, copy.id));
                  }, "Couldn't load the previous values.");
                }}>Load into draft</button>
              </li>
            ))}
          </ul>
        ) : <p className="form-help">{copies ? "Previous values appear here after you correct a saved entry." : "Loading previous values…"}</p>}
      </div>
    </div>
  );
}
