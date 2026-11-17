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

function PanelContent({
  panel,
  setPanel,
}: {
  panel: "more" | "settings" | "install";
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

  return <p className="panel-note">Open this page in Chrome on Android. In the browser menu, choose Install app or Add to Home screen.</p>;
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
          {panel === "more" || panel === "settings" || panel === "install"
            ? <PanelContent panel={panel} setPanel={setPanel} />
            : children}
        </div>
      )}
    </dialog>
  );
}
