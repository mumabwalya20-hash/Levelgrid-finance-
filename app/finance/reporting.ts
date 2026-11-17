import { businessDate, formatEntryDate } from "./daily-entry";
import { departmentDates, type Department, type FinanceDatabase } from "./database";

export type PeriodMode = "month" | "day";

export interface ReportPeriod {
  from: string;
  through: string;
}

export const reportNames = {
  daily: "Daily business report",
  monthly: "Monthly combined financial summary",
  department: "Department-specific report",
  range: "Custom date-range report",
};

export type ReportKind = keyof typeof reportNames;

interface Amounts {
  sales: bigint;
  departmentExpenses: bigint;
  financeExpenses: bigint;
}

export interface ReportTotals extends Amounts {
  expenses: bigint;
  balance: bigint;
}

export interface ReportDay extends ReportTotals {
  date: string;
  incomplete: boolean;
}

interface DepartmentTotal extends ReportTotals {
  id: string;
  name: string;
  inactive: boolean;
}

interface ExpenseNote {
  date: string;
  department: string;
  comment: string;
}

export interface FinanceReport {
  period: ReportPeriod;
  coveredThrough: string;
  department: Department | undefined;
  totals: ReportTotals;
  departments: DepartmentTotal[];
  days: ReportDay[];
  missingDays: number;
  incompleteDays: number;
  pendingChanges: number;
  notes: ExpenseNote[];
}

const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC", year: "numeric", month: "long",
});
const moneyFormatter = new Intl.NumberFormat("en-GB");
const zero = BigInt(0);
const ngweePerKwacha = BigInt(100);
const dayMilliseconds = 86_400_000;

export function formatMonth(month: string) {
  return monthFormatter.format(new Date(month + "-01T00:00:00Z"));
}

export function monthPeriod(month: string): ReportPeriod {
  const [year, number] = month.split("-").map(Number);
  const end = new Date(0);
  end.setUTCFullYear(year, number, 0);
  return { from: month + "-01", through: end.toISOString().slice(0, 10) };
}

export function stepReportDate(date: string, mode: PeriodMode, offset: number) {
  const value = new Date(date + "T00:00:00Z");
  if (mode === "month") value.setUTCMonth(value.getUTCMonth() + offset, 1);
  else value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

export function periodForDate(date: string, mode: PeriodMode): ReportPeriod {
  return mode === "month" ? monthPeriod(date.slice(0, 7)) : { from: date, through: date };
}

export function formatPeriod(period: ReportPeriod) {
  if (period.from === period.through) return formatEntryDate(period.from);
  return formatEntryDate(period.from) + " to " + formatEntryDate(period.through);
}

export function formatMoney(minor: bigint) {
  const magnitude = minor < zero ? -minor : minor;
  const kwacha = moneyFormatter.format(magnitude / ngweePerKwacha);
  const ngwee = (magnitude % ngweePerKwacha).toString().padStart(2, "0");
  return (minor < zero ? "-K " : "K ") + kwacha + "." + ngwee;
}

export function missingRecordNotices(report: FinanceReport) {
  const notices: string[] = [];
  if (report.missingDays === 1) notices.push("1 day has no confirmed entries.");
  else if (report.missingDays > 1) notices.push(`${report.missingDays} days have no confirmed entries.`);
  if (report.incompleteDays === 1) notices.push("1 day has incomplete entries.");
  else if (report.incompleteDays > 1) notices.push(`${report.incompleteDays} days have incomplete entries.`);
  return notices;
}

function emptyAmounts(): Amounts {
  return { sales: zero, departmentExpenses: zero, financeExpenses: zero };
}

function withTotals(amounts: Amounts): ReportTotals {
  const expenses = amounts.departmentExpenses + amounts.financeExpenses;
  return { ...amounts, expenses, balance: amounts.sales - expenses };
}

function minDate(first: string, second: string) {
  return first < second ? first : second;
}

function calendarDays(from: string, through: string) {
  if (through < from) return 0;
  return (Date.parse(through + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / dayMilliseconds + 1;
}

function activeInPeriod(department: ReturnType<typeof departmentDates>, from: string, through: string) {
  return from <= through && department.openedOn <= through &&
    (department.closedOn === null || (from < department.closedOn && department.openedOn < department.closedOn));
}

interface DayEntries {
  amounts: Amounts;
  departments: Set<string>;
  hasFinance: boolean;
}

export async function loadFinanceReport(database: FinanceDatabase, period: ReportPeriod, departmentId?: string): Promise<FinanceReport> {
  const coveredThrough = minDate(period.through, businessDate());
  const [departments, records, shared, pending] = await database.transaction(
    "r", [database.departments, database.dailyRecords, database.sharedExpenses, database.pendingOperations],
    () => Promise.all([
      database.departments.orderBy("position").toArray(),
      period.from > coveredThrough ? [] : database.dailyRecords.where("date")
        .between(period.from, coveredThrough, true, true)
        .filter((row) => departmentId === undefined || row.departmentId === departmentId).toArray(),
      departmentId !== undefined || period.from > coveredThrough ? [] : database.sharedExpenses.where("date")
        .between(period.from, coveredThrough, true, true).toArray(),
      database.pendingOperations.toArray(),
    ]),
  );
  const department = departments.find((item) => item.id === departmentId);
  const departmentNames = new Map(departments.map((item) => [item.id, item.name]));
  const datesByDepartment = new Map(departments.map((item) => [item.id, departmentDates(item)]));
  const amounts = emptyAmounts();
  const byDay = new Map<string, DayEntries>();
  const byDepartment = new Map<string, Amounts>();
  const notes: ExpenseNote[] = [];

  function entriesOn(date: string) {
    let entries = byDay.get(date);
    if (!entries) {
      entries = { amounts: emptyAmounts(), departments: new Set(), hasFinance: false };
      byDay.set(date, entries);
    }
    return entries;
  }

  for (const record of records) {
    const sales = BigInt(record.salesMinor);
    const expenses = BigInt(record.expensesMinor);
    const day = entriesOn(record.date);
    day.amounts.sales += sales;
    day.amounts.departmentExpenses += expenses;
    day.departments.add(record.departmentId);
    const subtotal = byDepartment.get(record.departmentId) ?? emptyAmounts();
    subtotal.sales += sales;
    subtotal.departmentExpenses += expenses;
    byDepartment.set(record.departmentId, subtotal);
    amounts.sales += sales;
    amounts.departmentExpenses += expenses;
    if (record.expenseComment?.trim()) {
      notes.push({ date: record.date, department: departmentNames.get(record.departmentId) ?? "Department", comment: record.expenseComment.trim() });
    }
  }
  for (const expense of shared) {
    const day = entriesOn(expense.date);
    day.hasFinance = true;
    const value = BigInt(expense.expensesMinor);
    day.amounts.financeExpenses += value;
    amounts.financeExpenses += value;
    if (expense.expenseComment?.trim()) {
      notes.push({ date: expense.date, department: "Finance Expenses", comment: expense.expenseComment.trim() });
    }
  }

  const days: ReportDay[] = [...byDay.entries()].map(([date, entries]) => {
    const incomplete = departmentId === undefined && (!entries.hasFinance || departments.some((item) => {
      const dates = datesByDepartment.get(item.id)!;
      return activeInPeriod(dates, date, date) && !entries.departments.has(item.id);
    }));
    return { date, ...withTotals(entries.amounts), incomplete };
  }).sort((left, right) => left.date.localeCompare(right.date));

  let missingDays = Math.max(0, calendarDays(period.from, coveredThrough) - days.length);
  if (department) {
    const { openedOn, closedOn } = datesByDepartment.get(department.id)!;
    const from = period.from > openedOn ? period.from : openedOn;
    const through = closedOn && closedOn <= coveredThrough ? stepReportDate(closedOn, "day", -1) : coveredThrough;
    missingDays = Math.max(0, calendarDays(from, through) - days.filter(({ date }) => from <= date && date <= through).length);
  }

  const pendingChanges = pending.filter((change) => {
    if (change.entity === "department") {
      if (departmentId !== undefined) return change.recordId === departmentId;
      const dates = datesByDepartment.get(change.recordId);
      return byDepartment.has(change.recordId) || (dates !== undefined && activeInPeriod(dates, period.from, coveredThrough));
    }
    if (change.record.date < period.from || change.record.date > coveredThrough) return false;
    return departmentId === undefined || (change.entity === "daily-record" && change.record.departmentId === departmentId);
  }).length;

  const departmentTotals: DepartmentTotal[] = departments.flatMap((item) => {
    const subtotal = byDepartment.get(item.id);
    return subtotal ? [{ id: item.id, name: item.name, inactive: item.deactivatedAt !== null, ...withTotals(subtotal) }] : [];
  });
  for (const [id, subtotal] of byDepartment) {
    if (!departmentNames.has(id)) departmentTotals.push({ id, name: "Department", inactive: false, ...withTotals(subtotal) });
  }

  return {
    period, coveredThrough, department, totals: withTotals(amounts), days,
    departments: departmentTotals, missingDays, incompleteDays: days.filter((day) => day.incomplete).length, pendingChanges,
    notes: notes.sort((left, right) => left.date.localeCompare(right.date)),
  };
}
