"use client";

import {
  Archive,
  ArrowLeft,
  ChevronRight,
  Download,
  LogOut,
  RefreshCw,
  Settings,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

const titles = {
  entry: "Enter Daily Sales",
  reports: "PDF Reports",
  departments: "Departments",
  more: "More",
  install: "Install app",
  settings: "Settings",
  sync: "Sync Now",
  backups: "Backups",
  signOut: "Sign out",
};

export type AppPanel = keyof typeof titles;

const moreActions = [
  { panel: "install", icon: Download },
  { panel: "settings", icon: Settings },
  { panel: "sync", icon: RefreshCw },
  { panel: "backups", icon: Archive },
  { panel: "signOut", icon: LogOut },
] as const satisfies ReadonlyArray<{ panel: AppPanel; icon: typeof Download }>;

const reports = [
  "Daily business report",
  "Monthly combined financial summary",
  "Department-specific report",
  "Custom date-range report",
];

const panelNotes = {
  reports: "PDF generation is part of Feature 05.",
  install: "Open this page in Chrome on Android. In the browser menu, choose Install app or Add to Home screen.",
};

function PanelContent({
  panel,
  setPanel,
}: {
  panel: Exclude<AppPanel, "entry" | "departments" | "sync" | "backups" | "signOut">;
  setPanel: (panel: AppPanel) => void;
}) {
  if (panel === "more") {
    return (
      <ul className="panel-list menu-list">
        {moreActions.map(({ panel: item, icon: Icon }) => (
          <li key={item}>
            <button type="button" onClick={() => setPanel(item)}>
              <Icon size={18} aria-hidden="true" />
              <span>{titles[item]}</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    );
  }
  if (panel === "settings") {
    return (
      <dl className="panel-list settings-list">
        <div><dt>Currency</dt><dd>ZMW</dd></div>
        <div><dt>Business time zone</dt><dd>Africa/Lusaka</dd></div>
      </dl>
    );
  }

  return (
    <>
      {panel === "reports" && (
        <ul className="panel-list">
          {reports.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
      <p className="panel-note">{panelNotes[panel]}</p>
    </>
  );
}

export function AppDialog({
  panel,
  setPanel,
  children,
}: {
  panel: AppPanel | null;
  setPanel: (panel: AppPanel | null) => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fromMore = moreActions.some((action) => action.panel === panel);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (panel) {
      if (!dialog.open) dialog.showModal();
      headingRef.current?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [panel]);

  return (
    <dialog
      className="app-dialog"
      ref={dialogRef}
      aria-labelledby="panel-title"
      onClose={() => setPanel(null)}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      {panel && (
        <div className="panel-surface">
          <header className="panel-header">
            {fromMore && (
              <button
                className="icon-button"
                type="button"
                aria-label="Back to More"
                onClick={() => setPanel("more")}
              >
                <ArrowLeft size={20} aria-hidden="true" />
              </button>
            )}
            <h2 ref={headingRef} id="panel-title" tabIndex={-1}>{titles[panel]}</h2>
            <button
              className="icon-button"
              type="button"
              aria-label="Close panel"
              onClick={() => dialogRef.current?.close()}
            >
              <X size={21} aria-hidden="true" />
            </button>
          </header>
          {panel === "entry" || panel === "departments" || panel === "sync" || panel === "backups" || panel === "signOut"
            ? children
            : <PanelContent panel={panel} setPanel={setPanel} />}
        </div>
      )}
    </dialog>
  );
}
