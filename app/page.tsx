"use client";

import { Building2, CirclePlus, Ellipsis, FileText } from "lucide-react";
import { liveQuery } from "dexie";
import { useEffect, useRef, useState } from "react";
import { AppDialog, type AppPanel } from "./app-dialog";
import { BackupsPanel } from "./backups-panel";
import { FinancialSummary, PeriodSelector, RecentDailyRecords } from "./dashboard";
import { DailyEntryPanel } from "./daily-entry-panel";
import { DepartmentPanel } from "./department-panel";
import { businessDate } from "./finance/daily-entry";
import type { Department, FinanceDatabase, SyncMetadata } from "./finance/database";
import { OwnerSession, type OwnerAccess } from "./finance/owner-session";
import { loadFinanceReport, periodForDate, type FinanceReport, type PeriodMode } from "./finance/reporting";
import type { SyncStatus } from "./finance/sync";
import { OwnerSignIn } from "./owner-sign-in";
import { ReportsPanel } from "./reports-panel";
import { SyncPanel } from "./sync-panel";
import { useAppStatus } from "./use-app-status";

const offlineStatusText = {
  preparing: "Preparing offline access",
  ready: "Ready offline",
  unavailable: "Offline setup incomplete",
  development: "Offline access requires a production build",
};

function AppHeader({ onMore }: { onMore?: () => void }) {
  return (
    <header className="app-header">
      <div className="brand">
        <img src="/brand/levelgrid-mark.png" width={50} height={50} alt="" />
        <div>
          <p className="brand-name">Levelgrid Enterprises</p>
          <h1>Financial Records</h1>
        </div>
      </div>
      {onMore && (
        <button
          className="icon-button more-button"
          type="button"
          aria-label="More options"
          aria-haspopup="dialog"
          onClick={onMore}
        >
          <Ellipsis size={23} aria-hidden="true" />
        </button>
      )}
    </header>
  );
}

function FinanceWorkspace({ database, online, syncStatus, syncNow, signOut }: {
  database: FinanceDatabase;
  online: boolean;
  syncStatus: SyncStatus;
  syncNow: () => void;
  signOut: () => boolean;
}) {
  const [reportingDate, setReportingDate] = useState(() => businessDate());
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [panel, setPanel] = useState<AppPanel | null>(null);
  const [entryDate, setEntryDate] = useState<string>();
  const [reportSnapshot, setReportSnapshot] = useState<{ key: string; report?: FinanceReport; failed?: boolean }>();
  const [saved, setSaved] = useState<{ departments: Department[]; pendingCount: number; sync: SyncMetadata }>();
  const [readFailed, setReadFailed] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  const { from, through } = periodForDate(reportingDate, periodMode);
  const reportKey = from + "/" + through;

  useEffect(() => {
    const subscription = liveQuery(() => database.transaction(
      "r",
      database.departments,
      database.pendingOperations,
      database.syncMetadata,
      async () => ({
        departments: await database.departments.orderBy("position").toArray(),
        pendingCount: await database.pendingOperations.count(),
        sync: await database.cloudState(),
      }),
    )).subscribe({ next: setSaved, error: () => setReadFailed(true) });
    return () => subscription.unsubscribe();
  }, [database]);

  useEffect(() => {
    const subscription = liveQuery(() => loadFinanceReport(database, { from, through })).subscribe({
      next: (report) => setReportSnapshot({ key: reportKey, report }),
      error: () => setReportSnapshot({ key: reportKey, failed: true }),
    });
    return () => subscription.unsubscribe();
  }, [database, from, through, reportKey]);

  function openEntry(date?: string) {
    setEntryDate(date);
    setPanel("entry");
  }

  const currentReport = reportSnapshot?.key === reportKey ? reportSnapshot : undefined;
  const pending = saved?.pendingCount ?? 0;
  return (
    <>
      <AppHeader onMore={() => setPanel("more")} />
      <div className="app-content">
        {pending > 0 && (
          <p className="pending-notice" role="status">
            {pending} {pending === 1 ? "change is" : "changes are"} saved only on this phone.
          </p>
        )}
        {saved?.sync.conflict && (
          <div className="pending-notice sync-notice">
            <p role="alert">Sync paused. Your phone's values are still saved.</p>
            <button className="action" type="button" onClick={() => setPanel("sync")}>View sync status</button>
          </div>
        )}
        <PeriodSelector date={reportingDate} mode={periodMode} onDate={setReportingDate} onMode={setPeriodMode} />
        <FinancialSummary report={currentReport?.report} />

        <section className="actions" aria-label="Finance actions">
          <button
            className="action action-primary"
            type="button"
            aria-haspopup="dialog"
            onClick={() => openEntry()}
          >
            <CirclePlus size={22} aria-hidden="true" />
            Enter Daily Sales
          </button>
          <button
            className="action"
            type="button"
            aria-haspopup="dialog"
            onClick={() => setPanel("reports")}
          >
            <FileText size={19} aria-hidden="true" />
            PDF Reports
          </button>
          <button
            className="action"
            type="button"
            aria-haspopup="dialog"
            onClick={() => setPanel("departments")}
          >
            <Building2 size={19} aria-hidden="true" />
            Departments
          </button>
        </section>

        <RecentDailyRecords report={currentReport?.report} mode={periodMode}
          failed={currentReport?.failed ?? false} onOpen={openEntry} />
      </div>

      <AppDialog panel={panel} setPanel={(next) => {
        setPanel(next);
        if (next === "sync") syncNow();
      }}>
        {panel === "entry" && (
          <DailyEntryPanel
            database={database}
            initialDate={entryDate}
            onSaved={(date) => {
              setReportingDate(date);
              syncNow();
            }}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === "reports" && (
          <ReportsPanel database={database} departments={saved?.departments ?? []} date={reportingDate} mode={periodMode} />
        )}
        {panel === "departments" && (
          <DepartmentPanel database={database} departments={saved?.departments} readFailed={readFailed} onSaved={syncNow} />
        )}
        {panel === "sync" && (
          <SyncPanel state={saved?.sync} status={syncStatus} pending={pending} online={online}
            syncNow={syncNow} openBackups={() => setPanel("backups")} />
        )}
        {panel === "backups" && (
          <BackupsPanel database={database} onRestore={syncNow} onOpenEntry={openEntry} />
        )}
        {panel === "signOut" && (
          <div className="sign-out-panel">
            <p className="panel-note">
              Your records and pending changes stay on this phone. Sign in online with the same account to open them again.
            </p>
            {signOutFailed && <p className="form-feedback" role="alert">Couldn't remove offline access. Try signing out again.</p>}
            <button className="action action-primary" type="button" onClick={() => {
              if (!signOut()) setSignOutFailed(true);
            }}>
              Sign out
            </button>
          </div>
        )}
      </AppDialog>
    </>
  );
}

export default function FinancePage() {
  const [access, setAccess] = useState<OwnerAccess>({ screen: "checking" });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const session = useRef<OwnerSession | null>(null);
  const { isOnline, offlineStatus, updateReady } = useAppStatus();

  useEffect(() => {
    const owner = new OwnerSession(setAccess, setSyncStatus);
    session.current = owner;
    owner.start();
    return () => {
      owner.dispose();
      session.current = null;
    };
  }, []);

  const connected = access.screen === "finance" && access.offline ? false : isOnline;
  const appStatus = offlineStatus === "ready" && !(access.screen === "finance" && access.trusted)
    ? "App shell cached"
    : offlineStatusText[offlineStatus];

  return (
    <main className="app-shell">
      {access.screen === "finance" ? (
        <FinanceWorkspace
          key={access.database.name}
          database={access.database}
          online={connected === true}
          syncStatus={syncStatus}
          syncNow={() => session.current?.syncNow()}
          signOut={() => session.current?.signOut() ?? false}
        />
      ) : (
        <>
          <AppHeader />
          <OwnerSignIn
            access={access}
            isOnline={isOnline}
            signIn={async (email, password, trustDevice) => {
              await session.current?.signIn(email, password, trustDevice);
            }}
          />
        </>
      )}
      <footer className="app-footer" role="status">
        <span className="connection">
          <span
            className={connected === true ? "status-dot status-dot-online" : "status-dot"}
            aria-hidden="true"
          />
          {connected === null ? "Checking connection" : connected ? "Online" : "Offline"}
        </span>
        {updateReady ? (
          <button className="action" type="button" onClick={() => window.location.reload()}>Update app</button>
        ) : <span>{appStatus}</span>}
      </footer>
    </main>
  );
}
