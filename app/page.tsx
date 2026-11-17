"use client";

import {
  Building2,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  ClipboardList,
  Ellipsis,
  FileText,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { liveQuery } from "dexie";
import { useEffect, useRef, useState } from "react";
import { AppDialog, type AppPanel } from "./app-dialog";
import { BackupsPanel } from "./backups-panel";
import { DailyEntryPanel } from "./daily-entry-panel";
import { DepartmentPanel } from "./department-panel";
import { businessDate, formatEntryDate } from "./finance/daily-entry";
import type { Department, FinanceDatabase, SyncMetadata } from "./finance/database";
import { OwnerSession, type OwnerAccess } from "./finance/owner-session";
import type { SyncStatus } from "./finance/sync";
import { OwnerSignIn } from "./owner-sign-in";
import { SyncPanel } from "./sync-panel";
import { useAppStatus } from "./use-app-status";

const reportMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  year: "numeric",
  month: "long",
});

function shiftMonth(value: string, offset: number) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1 + offset, 1);
  return date.toISOString().slice(0, 7);
}

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
  const [month, setMonth] = useState("");
  const [panel, setPanel] = useState<AppPanel | null>(null);
  const [entryDate, setEntryDate] = useState<string>();
  const [recent, setRecent] = useState<{ month: string; dates: string[]; failed?: boolean }>();
  const [saved, setSaved] = useState<{ departments: Department[]; pendingCount: number; sync: SyncMetadata }>();
  const [readFailed, setReadFailed] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  useEffect(() => {
    setMonth(businessDate().slice(0, 7));
  }, []);

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
    if (!month) return;
    const subscription = liveQuery(() => database.recentEntryDates(month)).subscribe({
      next: (dates) => setRecent({ month, dates }),
      error: () => setRecent({ month, dates: [], failed: true }),
    });
    return () => subscription.unsubscribe();
  }, [database, month]);

  function openEntry(date?: string) {
    setEntryDate(date);
    setPanel("entry");
  }

  const recentForMonth = recent?.month === month ? recent : undefined;
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
        <section className="reporting-period" aria-label="Reporting period">
          <button
            className="icon-button month-arrow"
            type="button"
            aria-label="Previous month"
            disabled={!month || month === "0001-01"}
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <div className="month-field">
            <CalendarDays size={18} aria-hidden="true" />
            <span aria-hidden="true">
              {month ? reportMonthFormatter.format(new Date(month + "-01T00:00:00Z")) : "Reporting month"}
            </span>
            <ChevronDown size={15} aria-hidden="true" />
            <input
              aria-label="Reporting month"
              type="month"
              min="0001-01"
              max="9999-12"
              value={month}
              onChange={(event) => {
                if (event.currentTarget.value && event.currentTarget.validity.valid) {
                  setMonth(event.currentTarget.value);
                }
              }}
            />
          </div>
          <button
            className="icon-button month-arrow"
            type="button"
            aria-label="Next month"
            disabled={!month || month === "9999-12"}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        </section>

        <section aria-label="Financial summary">
          <div className="summary">
            <div className="summary-card sales-card">
              <div className="summary-icon sales-icon">
                <ChartNoAxesColumnIncreasing size={25} aria-hidden="true" />
              </div>
              <div>
                <p className="summary-label">Total Sales</p>
                <p className="summary-value">—</p>
              </div>
              <small className="currency">ZMW</small>
            </div>
            <div className="summary-card">
              <div className="summary-icon expense-icon">
                <ReceiptText size={19} aria-hidden="true" />
              </div>
              <div>
                <p className="summary-label">Total Expenses</p>
                <p className="summary-value expense-value">—</p>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon balance-icon">
                <Wallet size={19} aria-hidden="true" />
              </div>
              <div>
                <p className="summary-label">Overall Balance</p>
                <p className="summary-value">—</p>
              </div>
            </div>
          </div>
        </section>

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

        <section className="recent-records" aria-labelledby="recent-title">
          <h2 id="recent-title">Recent daily records</h2>
          {recentForMonth?.dates.length ? (
            <ul className="recent-list">
              {recentForMonth.dates.map((date) => (
                <li key={date}>
                  <button className="recent-record" type="button" aria-haspopup="dialog"
                    aria-label={`View or edit ${formatEntryDate(date)}`} onClick={() => openEntry(date)}>
                    <CalendarDays size={18} aria-hidden="true" />
                    <time dateTime={date}>{formatEntryDate(date)}</time>
                    <span>View / Edit</span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-records">
              <span className="record-icon">
                <ClipboardList size={19} aria-hidden="true" />
              </span>
              <p>{recentForMonth?.failed ? "Couldn't load recent records." :
                recentForMonth ? "No confirmed records for this month." : "Loading recent records…"}</p>
            </div>
          )}
        </section>
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
              setMonth(date.slice(0, 7));
              syncNow();
            }}
            onClose={() => setPanel(null)}
          />
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
  const { isOnline, offlineStatus } = useAppStatus();

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
        <span>{appStatus}</span>
      </footer>
    </main>
  );
}
