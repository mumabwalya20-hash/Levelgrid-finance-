import {
  CalendarDays, ChartNoAxesColumnIncreasing, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, ReceiptText, Wallet,
} from "lucide-react";
import { businessDate, formatEntryDate, isCalendarDate } from "./finance/daily-entry";
import { formatMoney, formatMonth, missingRecordNotices, stepReportDate, type FinanceReport, type PeriodMode } from "./finance/reporting";

export function PeriodSelector({ date, mode, onDate, onMode }: {
  date: string;
  mode: PeriodMode;
  onDate: (date: string) => void;
  onMode: (mode: PeriodMode) => void;
}) {
  const today = businessDate();
  const month = mode === "month";
  const value = month ? date.slice(0, 7) : date;
  const max = month ? today.slice(0, 7) : today;
  const min = month ? "0001-01" : "0001-01-01";
  return (
    <section className="reporting-controls" aria-label="Reporting period">
      <div className="reporting-mode" role="group" aria-label="Summary by">
        <button type="button" aria-pressed={month} onClick={() => onMode("month")}>Month</button>
        <button type="button" aria-pressed={!month} onClick={() => onMode("day")}>Day</button>
      </div>
      <div className="reporting-period">
        <button className="icon-button month-arrow" type="button" aria-label={`Previous ${mode}`}
          disabled={value <= min} onClick={() => onDate(stepReportDate(date, mode, -1))}>
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <div className="month-field">
          <CalendarDays size={18} aria-hidden="true" />
          <span aria-hidden="true">{month ? formatMonth(value) : formatEntryDate(value)}</span>
          <ChevronDown size={15} aria-hidden="true" />
          <input
            aria-label={month ? "Reporting month" : "Reporting date"}
            type={month ? "month" : "date"}
            min={min}
            max={max}
            value={value}
            onChange={(event) => {
              const selected = event.currentTarget.value;
              const next = month ? selected + "-01" : selected;
              if (isCalendarDate(next) && next <= today) onDate(next);
            }}
          />
        </div>
        <button className="icon-button month-arrow" type="button" aria-label={`Next ${mode}`}
          disabled={value >= max} onClick={() => onDate(stepReportDate(date, mode, 1))}>
          <ChevronRight size={22} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

export function FinancialSummary({ report }: { report?: FinanceReport }) {
  const totals = report?.days.length ? report.totals : undefined;
  const coverage = report ? missingRecordNotices(report).join(" ") : "";
  return (
    <section aria-label="Financial summary">
      <div className="summary">
        <div className="summary-card sales-card">
          <div className="summary-icon sales-icon">
            <ChartNoAxesColumnIncreasing size={25} aria-hidden="true" />
          </div>
          <div>
            <p className="summary-label">Total Sales</p>
            <p className="summary-value">{totals ? formatMoney(totals.sales) : "—"}</p>
          </div>
          <small className="currency">ZMW</small>
        </div>
        <div className="summary-card">
          <div className="summary-icon expense-icon">
            <ReceiptText size={19} aria-hidden="true" />
          </div>
          <div>
            <p className="summary-label">Total Expenses</p>
            <p className="summary-value expense-value">{totals ? formatMoney(totals.expenses) : "—"}</p>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon balance-icon">
            <Wallet size={19} aria-hidden="true" />
          </div>
          <div>
            <p className="summary-label">Overall Balance</p>
            <p className="summary-value">{totals ? formatMoney(totals.balance) : "—"}</p>
          </div>
        </div>
      </div>
      {report && totals && (
        <>
          <details className="department-totals">
            <summary>Department totals</summary>
            <dl className="expense-breakdown">
              <div><dt>Departmental expenses</dt><dd>{formatMoney(totals.departmentExpenses)}</dd></div>
              <div><dt>Finance Expenses</dt><dd>{formatMoney(totals.financeExpenses)}</dd></div>
            </dl>
            <ul>
              {report.departments.map((department) => (
                <li key={department.id}>
                  <h3>{department.name} {department.inactive && <small>Inactive</small>}</h3>
                  <dl>
                    <div><dt>Sales</dt><dd>{formatMoney(department.sales)}</dd></div>
                    <div><dt>Expenses</dt><dd>{formatMoney(department.expenses)}</dd></div>
                    <div><dt>Balance</dt><dd>{formatMoney(department.balance)}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          </details>
          {coverage && <p className="coverage-note">{coverage}</p>}
        </>
      )}
    </section>
  );
}

export function RecentDailyRecords({ report, mode, failed, onOpen }: {
  report?: FinanceReport;
  mode: PeriodMode;
  failed: boolean;
  onOpen: (date: string) => void;
}) {
  const recent = report?.days.slice(-5).reverse();
  let notice = "Loading recent records…";
  if (failed) notice = "Couldn't load recent records.";
  else if (report) notice = `No confirmed records for this ${mode}.`;
  return (
    <section className="recent-records" aria-labelledby="recent-title">
      <h2 id="recent-title">Recent daily records</h2>
      {recent?.length ? (
        <ul className="recent-list">
          {recent.map((day) => (
            <li key={day.date}>
              <button className="recent-record" type="button" aria-haspopup="dialog"
                aria-label={`View or edit ${formatEntryDate(day.date)}`} onClick={() => onOpen(day.date)}>
                <CalendarDays size={18} aria-hidden="true" />
                <span className="record-description">
                  <time dateTime={day.date}>{formatEntryDate(day.date)}</time>
                  <small>{day.incomplete ? "Incomplete · " : ""}Balance {formatMoney(day.balance)}</small>
                </span>
                <span>View / Edit</span>
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-records">
          <span className="record-icon"><ClipboardList size={19} aria-hidden="true" /></span>
          <p>{notice}</p>
        </div>
      )}
    </section>
  );
}
