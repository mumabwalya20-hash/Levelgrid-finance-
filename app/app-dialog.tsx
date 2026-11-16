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
import { useEffect, useRef } from "react";

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

const departments = [
  "Chibombo Distributors",
  "Chibombo Stationery",
  "Chiyuni Stationery",
  "Factory",
  "Laundry",
];

const reports = [
  "Daily business report",
  "Monthly combined financial summary",
  "Department-specific report",
  "Custom date-range report",
];

const panelNotes = {
  entry: "Daily sales and expense entry is part of Feature 03.",
  reports: "PDF generation is part of Feature 05.",
  departments: "Adding and deactivating departments is part of Feature 02.",
  install: "Open this page in Chrome on Android. In the browser menu, choose Install app or Add to Home screen.",
  sync: "Cloud synchronization is part of Feature 04.",
  backups: "Creating and restoring backups is part of Feature 04.",
  signOut: "Account sign-in and sign-out are part of Feature 02.",
};

function PanelContent({
  panel,
  setPanel,
}: {
  panel: AppPanel;
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

  const items = panel === "departments" ? departments : panel === "reports" ? reports : null;
  return (
    <>
      {items && (
        <ul className="panel-list">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
      <p className="panel-note">{panelNotes[panel]}</p>
    </>
  );
}

export function AppDialog({
  panel,
  setPanel,
}: {
  panel: AppPanel | null;
  setPanel: (panel: AppPanel | null) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fromMore = moreActions.some((action) => action.panel === panel);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (panel && dialog) {
      if (!dialog.open) dialog.showModal();
      headingRef.current?.focus();
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
          <PanelContent panel={panel} setPanel={setPanel} />
        </div>
      )}
    </dialog>
  );
}
