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
import { useEffect, useState } from "react";
import { AppDialog, type AppPanel } from "./app-dialog";
import { useAppStatus } from "./use-app-status";

const businessMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lusaka",
  year: "numeric",
  month: "2-digit",
});

const reportMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  year: "numeric",
  month: "long",
});

function currentBusinessMonth() {
  const parts = businessMonthFormatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")!.value;
  const month = parts.find((part) => part.type === "month")!.value;
  return year + "-" + month;
}

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

export default function FinancePage() {
  const [month, setMonth] = useState("");
  const [panel, setPanel] = useState<AppPanel | null>(null);
  const { isOnline, offlineStatus } = useAppStatus();

  useEffect(() => {
    setMonth(currentBusinessMonth());
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <img src="/brand/levelgrid-mark.png" width={50} height={50} alt="" />
          <div>
            <p className="brand-name">Levelgrid Enterprises</p>
            <h1>Financial Records</h1>
          </div>
        </div>
        <button
          className="icon-button more-button"
          type="button"
          aria-label="More options"
          aria-haspopup="dialog"
          onClick={() => setPanel("more")}
        >
          <Ellipsis size={23} aria-hidden="true" />
        </button>
      </header>

      <div className="app-content">
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
            onClick={() => setPanel("entry")}
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
          <div className="empty-records">
            <span className="record-icon">
              <ClipboardList size={19} aria-hidden="true" />
            </span>
            <p>No confirmed records for this month.</p>
          </div>
        </section>
      </div>

      <footer className="app-footer" role="status">
        <span className="connection">
          <span
            className={isOnline === true ? "status-dot status-dot-online" : "status-dot"}
            aria-hidden="true"
          />
          {isOnline === null ? "Checking connection" : isOnline ? "Online" : "Offline"}
        </span>
        <span>{offlineStatusText[offlineStatus]}</span>
      </footer>

      <AppDialog panel={panel} setPanel={setPanel} />
    </main>
  );
}
