"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { businessDate, isCalendarDate } from "./finance/daily-entry";
import type { Department, FinanceDatabase } from "./finance/database";
import { downloadFile } from "./finance/download";
import { loadFinanceReport, monthPeriod, periodForDate, reportNames, type PeriodMode, type ReportKind } from "./finance/reporting";

export function ReportsPanel({ database, departments, date, mode }: {
  database: FinanceDatabase;
  departments: Department[];
  date: string;
  mode: PeriodMode;
}) {
  const today = businessDate();
  const selectedPeriod = periodForDate(date, mode);
  const [kind, setKind] = useState<ReportKind>(mode === "month" ? "monthly" : "daily");
  const [day, setDay] = useState(date);
  const [month, setMonth] = useState(date.slice(0, 7));
  const [from, setFrom] = useState(selectedPeriod.from);
  const [through, setThrough] = useState(selectedPeriod.through < today ? selectedPeriod.through : today);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>();
  const open = useRef(false);
  useEffect(() => {
    open.current = true;
    return () => { open.current = false; };
  }, []);

  const departmentId = selectedDepartment || departments.find((department) => department.deactivatedAt === null)?.id || departments[0]?.id;
  const hasRange = kind === "range" || kind === "department";

  async function download(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setNotice(undefined);

    const start = kind === "monthly" ? month + "-01" : kind === "daily" ? day : from;
    const end = hasRange ? through : start;
    if (!isCalendarDate(start) || !isCalendarDate(end) || end < start || end > today) {
      setNotice({ text: "Choose valid dates in order, up to today.", error: true });
      return;
    }
    if (kind === "department" && !departmentId) {
      setNotice({ text: "Choose a department.", error: true });
      return;
    }

    const period = kind === "monthly" ? monthPeriod(month) : { from: start, through: end };
    setBusy(true);
    try {
      const [report, { createReportPdf }] = await Promise.all([
        loadFinanceReport(database, period, kind === "department" ? departmentId : undefined),
        import("./finance/report-pdf"),
      ]);
      const pdf = await createReportPdf(report, kind);
      if (!open.current) return;
      const departmentSuffix = report.department?.name.normalize("NFKD").toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
      const dates = kind === "monthly" ? month : start === end ? start : `${start}_${end}`;
      const filename = ["levelgrid-finance", kind, departmentSuffix, dates].filter(Boolean).join("-");
      downloadFile(pdf, filename + ".pdf");
      setNotice({ text: "PDF download started." });
    } catch {
      if (open.current) setNotice({ text: "Couldn't create the PDF. Try again.", error: true });
    } finally {
      if (open.current) setBusy(false);
    }
  }

  return (
    <form className="finance-form" onSubmit={download} noValidate>
      <div className="form-field">
        <label htmlFor="pdf-report-type">Report type</label>
        <select id="pdf-report-type" value={kind} onChange={(event) => {
          setKind(event.currentTarget.value as ReportKind);
          setNotice(undefined);
        }}>
          {Object.entries(reportNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {kind === "daily" && (
        <label className="form-field">
          Report date
          <input type="date" min="0001-01-01" max={today} value={day} onChange={(event) => setDay(event.currentTarget.value)} />
        </label>
      )}
      {kind === "monthly" && (
        <label className="form-field">
          Report month
          <input type="month" min="0001-01" max={today.slice(0, 7)} value={month}
            onChange={(event) => setMonth(event.currentTarget.value)} />
        </label>
      )}
      {kind === "department" && (
        <div className="form-field">
          <label htmlFor="pdf-department">Department</label>
          <select id="pdf-department" value={departmentId ?? ""} onChange={(event) => setSelectedDepartment(event.currentTarget.value)}>
            {departments.length === 0 && <option value="">No departments available</option>}
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}{department.deactivatedAt ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}
      {hasRange && (
        <>
          <label className="form-field">
            From
            <input type="date" min="0001-01-01" max={today} value={from} onChange={(event) => setFrom(event.currentTarget.value)} />
          </label>
          <label className="form-field">
            Through
            <input type="date" min={from || "0001-01-01"} max={today} value={through}
              onChange={(event) => setThrough(event.currentTarget.value)} />
          </label>
        </>
      )}
      {notice && <p className={notice.error ? "entry-error" : "form-feedback"} role={notice.error ? "alert" : "status"}>{notice.text}</p>}
      <button className="action action-primary" type="submit" disabled={busy}>
        {busy ? "Preparing PDF…" : "Download PDF"}
      </button>
    </form>
  );
}
