import { formatAmount, isCalendarDate } from "./daily-entry";
import type {
  DailyDraft, DailyRecord, Department, FinanceDatabase, PendingOperation, RecoveryCopy, SharedExpense,
} from "./database";

export class BackupError extends Error {}

export interface FinanceBackup {
  format: "levelgrid-finance";
  version: 1;
  project: string;
  ownerId: string;
  createdAt: string;
  departments: Department[];
  dailyRecords: DailyRecord[];
  sharedExpenses: SharedExpense[];
  drafts: DailyDraft[];
  pendingOperations: PendingOperation[];
  recoveryCopies: RecoveryCopy[];
}

function backupTables(database: FinanceDatabase) {
  return [
    database.departments, database.dailyRecords, database.sharedExpenses,
    database.drafts, database.pendingOperations, database.recoveryCopies,
  ];
}

export function createBackup(database: FinanceDatabase): Promise<FinanceBackup> {
  return database.transaction("r", backupTables(database), async () => {
    const [departments, dailyRecords, sharedExpenses, drafts, pendingOperations, recoveryCopies] = await Promise.all([
      database.departments.toArray(), database.dailyRecords.toArray(), database.sharedExpenses.toArray(),
      database.drafts.toArray(), database.pendingOperations.orderBy("sequence").toArray(), database.recoveryCopies.toArray(),
    ]);
    return {
      format: "levelgrid-finance", version: 1, project: database.project, ownerId: database.ownerId,
      createdAt: new Date().toISOString(), departments, dailyRecords, sharedExpenses, drafts, pendingOperations, recoveryCopies,
    };
  });
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function id(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
}

function timestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}

function date(value: unknown): value is string {
  return typeof value === "string" && isCalendarDate(value);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function storedRecord(value: Record<string, unknown>) {
  return id(value.id) && timestamp(value.updatedAt) && positiveInteger(value.revision);
}

function department(value: unknown): value is Department {
  return object(value) && storedRecord(value) && typeof value.name === "string" &&
    value.name.length > 0 && value.name === value.name.trim().replace(/\s+/g, " ") &&
    value.nameKey === value.name.toLowerCase() && value.nameKey !== "finance expenses" &&
    positiveInteger(value.position) && timestamp(value.createdAt) &&
    (value.deactivatedAt === null || timestamp(value.deactivatedAt));
}

function sharedExpense(value: unknown): value is SharedExpense {
  return object(value) && storedRecord(value) && date(value.date) && Number.isSafeInteger(value.expensesMinor) &&
    (value.expenseComment === null || typeof value.expenseComment === "string");
}

function dailyRecord(value: unknown): value is DailyRecord {
  return object(value) && id(value.departmentId) && Number.isSafeInteger(value.salesMinor) && sharedExpense(value);
}

function expenseInputs(value: unknown) {
  return object(value) && typeof value.expenses === "string" && typeof value.expenseComment === "string";
}

function draft(value: unknown): value is DailyDraft {
  return object(value) && date(value.date) && timestamp(value.updatedAt) &&
    (value.version === undefined || id(value.version)) && expenseInputs(value.sharedExpenses) &&
    object(value.departments) && Object.entries(value.departments).every(([key, input]) =>
      id(key) && object(input) && typeof input.sales === "string" && expenseInputs(input),
    );
}

function operation(value: unknown): value is PendingOperation {
  if (!object(value) || !id(value.id) || !id(value.recordId) || !timestamp(value.createdAt) ||
      (value.expectedRevision !== null && !positiveInteger(value.expectedRevision)) ||
      !positiveInteger(value.sequence) || !object(value.record) || value.record.id !== value.recordId ||
      value.record.revision !== (value.expectedRevision ?? 0) + 1) {
    return false;
  }
  if (value.entity === "department") return department(value.record);
  if (value.entity === "daily-record") return dailyRecord(value.record);
  return value.entity === "shared-expense" && sharedExpense(value.record);
}

function recoveryCopy(value: unknown): value is RecoveryCopy {
  return object(value) && id(value.id) && date(value.date) && timestamp(value.savedAt) &&
    list(value.records, dailyRecord) && value.records.every((row) => row.date === value.date) &&
    (value.sharedExpense === undefined || (sharedExpense(value.sharedExpense) && value.sharedExpense.date === value.date));
}

function list<T>(value: unknown, validate: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(validate);
}

function unique<T>(records: T[], key: (record: T) => string) {
  return new Set(records.map(key)).size === records.length;
}

export function readBackup(contents: string, database: FinanceDatabase): FinanceBackup {
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch {
    throw new BackupError("Choose a valid Levelgrid Finance backup file.");
  }
  if (!object(value) || value.format !== "levelgrid-finance" || value.version !== 1) {
    throw new BackupError("Choose a Levelgrid Finance backup file from a supported version.");
  }
  if (value.ownerId !== database.ownerId || value.project !== database.project) {
    throw new BackupError("This backup belongs to a different Supabase project or Owner account.");
  }
  if (!timestamp(value.createdAt) || !list(value.departments, department) ||
      !list(value.dailyRecords, dailyRecord) || !list(value.sharedExpenses, sharedExpense) ||
      !list(value.drafts, draft) || !list(value.pendingOperations, operation) || !list(value.recoveryCopies, recoveryCopy)) {
    throw new BackupError("The backup has missing or invalid records.");
  }
  const departmentIds = new Set(value.departments.map((row) => row.id));
  const recorded = {
    department: new Map(value.departments.map((row) => [row.id, row.revision])),
    "daily-record": new Map(value.dailyRecords.map((row) => [row.id, row.revision])),
    "shared-expense": new Map(value.sharedExpenses.map((row) => [row.id, row.revision])),
  };
  if (!unique(value.departments, (row) => row.id) ||
      !unique(value.departments.filter((row) => row.deactivatedAt === null), (row) => row.nameKey) ||
      !unique(value.dailyRecords, (row) => row.id) || !unique(value.dailyRecords, (row) => row.departmentId + row.date) ||
      !unique(value.sharedExpenses, (row) => row.id) || !unique(value.sharedExpenses, (row) => row.date) ||
      !unique(value.drafts, (row) => row.date) || !unique(value.recoveryCopies, (row) => row.id) ||
      !unique(value.pendingOperations, (row) => row.id) ||
      value.dailyRecords.some((row) => !departmentIds.has(row.departmentId)) ||
      value.drafts.some((row) => Object.keys(row.departments).some((key) => !departmentIds.has(key))) ||
      value.pendingOperations.some((row, index, queue) =>
        row.sequence! <= (queue[index - 1]?.sequence ?? 0) ||
        (recorded[row.entity].get(row.recordId) ?? 0) < row.record.revision ||
        (row.entity === "daily-record" && !departmentIds.has(row.record.departmentId)),
      )) {
    throw new BackupError("The backup has duplicate records or missing links between records.");
  }
  return {
    format: value.format, version: value.version, ownerId: value.ownerId, project: value.project,
    createdAt: value.createdAt, departments: value.departments, dailyRecords: value.dailyRecords,
    sharedExpenses: value.sharedExpenses, drafts: value.drafts, pendingOperations: value.pendingOperations,
    recoveryCopies: value.recoveryCopies,
  };
}

function mergeRecords<T extends { id: string; revision: number }>(
  current: T[], recovered: T[], pendingIds: Set<string>,
) {
  const result = new Map(current.map((record) => [record.id, record]));
  for (const record of recovered) {
    const currentRecord = result.get(record.id);
    if (!currentRecord || currentRecord.revision < record.revision || pendingIds.has(record.id)) {
      result.set(record.id, record);
    }
  }
  return [...result.values()];
}

export function restoreBackup(database: FinanceDatabase, backup: FinanceBackup) {
  return database.transaction("rw", [...backupTables(database), database.syncMetadata], async () => {
    if (await database.pendingOperations.count() || await database.drafts.count()) {
      throw new BackupError("Finish drafts and sync this phone's pending changes before restoring a backup file.");
    }
    const [departments, records, expenses] = await Promise.all([
      database.departments.toArray(), database.dailyRecords.toArray(), database.sharedExpenses.toArray(),
    ]);
    const pendingIds = (entity: PendingOperation["entity"]) => new Set(
      backup.pendingOperations.filter((row) => row.entity === entity).map((row) => row.recordId),
    );
    const mergedDepartments = mergeRecords(departments, backup.departments, pendingIds("department"));
    const mergedRecords = mergeRecords(records, backup.dailyRecords, pendingIds("daily-record"));
    const mergedExpenses = mergeRecords(expenses, backup.sharedExpenses, pendingIds("shared-expense"));
    if (!unique(mergedDepartments.filter((row) => row.deactivatedAt === null), (row) => row.nameKey) ||
        !unique(mergedRecords, (row) => row.departmentId + row.date) || !unique(mergedExpenses, (row) => row.date)) {
      throw new BackupError("This phone and the backup have different records for the same entry. Both copies were kept.");
    }
    await database.departments.bulkPut(mergedDepartments);
    await database.dailyRecords.bulkPut(mergedRecords);
    await database.sharedExpenses.bulkPut(mergedExpenses);
    await database.drafts.bulkAdd(backup.drafts);
    await database.pendingOperations.bulkAdd(backup.pendingOperations.map(({ sequence: _sequence, ...row }) => row));
    await database.recoveryCopies.bulkPut(backup.recoveryCopies);
    await database.trimRecoveryCopies();
    await database.syncMetadata.delete("cloud");
  });
}

export async function restoreCorrectionDraft(database: FinanceDatabase, id: string) {
  const copy = await database.recoveryCopies.get(id);
  if (!copy) throw new BackupError("This correction copy is no longer available.");
  const entry = await database.loadDailyEntry(copy.date);
  if (entry.draftVersion !== undefined) {
    throw new BackupError("Finish the draft for this date before loading previous values.");
  }
  const inputs = entry.inputs;
  for (const record of copy.records) {
    if (inputs.departments[record.departmentId]) {
      inputs.departments[record.departmentId] = {
        sales: formatAmount(record.salesMinor),
        expenses: formatAmount(record.expensesMinor),
        expenseComment: record.expenseComment ?? "",
      };
    }
  }
  if (copy.sharedExpense) {
    inputs.sharedExpenses = {
      expenses: formatAmount(copy.sharedExpense.expensesMinor),
      expenseComment: copy.sharedExpense.expenseComment ?? "",
    };
  }
  await database.saveDailyDraft(inputs, entry.draftVersion);
  return copy.date;
}
