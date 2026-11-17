import Dexie, { type EntityTable } from "dexie";
import { businessDate, formatAmount, isEntryDate, parseAmount } from "./daily-entry";

export interface Department {
  id: string;
  name: string;
  nameKey: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  deactivatedAt: string | null;
  revision: number;
}

export interface SharedExpense {
  id: string;
  date: string;
  expensesMinor: number;
  expenseComment: string | null;
  updatedAt: string;
  revision: number;
}

export interface DailyRecord extends SharedExpense {
  departmentId: string;
  salesMinor: number;
}

export interface ExpenseInputs {
  expenses: string;
  expenseComment: string;
}

export interface DepartmentInputs extends ExpenseInputs {
  sales: string;
}

export interface DailyEntryInputs {
  date: string;
  departments: Record<string, DepartmentInputs>;
  sharedExpenses: ExpenseInputs;
}

export interface DailyDraft extends DailyEntryInputs {
  updatedAt: string;
  version?: string;
}

export interface LoadedDailyEntry {
  inputs: DailyEntryInputs;
  departments: Department[];
  records: DailyRecord[];
  sharedExpense: SharedExpense | undefined;
  draftVersion: string | undefined;
}

export type FinanceChange =
  | { entity: "department"; record: Department }
  | { entity: "daily-record"; record: DailyRecord }
  | { entity: "shared-expense"; record: SharedExpense };

export type PendingOperation = {
  sequence?: number;
  id: string;
  recordId: string;
  createdAt: string;
  expectedRevision: number | null;
} & FinanceChange;

export interface SyncConflict {
  entity: FinanceChange["entity"];
  recordId: string;
  operationId?: string;
}

export interface SyncMetadata {
  id: "cloud";
  cursor: number;
  checkedAt: string | null;
  conflict: SyncConflict | null;
}

export interface RecoveryCopy {
  id: string;
  date: string;
  savedAt: string;
  records: DailyRecord[];
  sharedExpense?: SharedExpense;
}

const recoveryLimit = 20;

export class DepartmentError extends Error {}
export class DailyEntryError extends Error {}
export class CloudRecordConflict extends Error {
  constructor(readonly conflict: SyncConflict) {
    super("The phone and Supabase have different records for the same entry.");
  }
}

// The original departments can be used to enter dates before the app was set up.
const foundingDepartmentIds = new Set([
  "16000000-0000-4000-8000-000000000001",
  "16000000-0000-4000-8000-000000000002",
  "16000000-0000-4000-8000-000000000003",
  "16000000-0000-4000-8000-000000000004",
  "16000000-0000-4000-8000-000000000005",
]);

export function departmentDates(department: Department) {
  return {
    openedOn: foundingDepartmentIds.has(department.id) ? "0001-01-01" : businessDate(new Date(department.createdAt)),
    closedOn: department.deactivatedAt ? businessDate(new Date(department.deactivatedAt)) : null,
  };
}

function departmentsForDate(
  departments: Department[],
  date: string,
  records: DailyRecord[],
  draft?: DailyEntryInputs,
) {
  const recorded = new Set(records.map((record) => record.departmentId));
  return departments.filter((department) => {
    if (recorded.has(department.id) || draft?.departments[department.id] !== undefined) return true;
    const { openedOn, closedOn } = departmentDates(department);
    return openedOn <= date && (closedOn === null || date < closedOn);
  });
}

function draftVersion(draft: DailyDraft | undefined) {
  return draft?.version ?? draft?.updatedAt;
}

function validateEntryDate(date: string) {
  if (!isEntryDate(date)) throw new DailyEntryError("Choose today or an earlier date.");
}

function requireAmount(input: string) {
  const amount = parseAmount(input);
  if (typeof amount === "string") throw new DailyEntryError(amount);
  return amount;
}

export class FinanceDatabase extends Dexie {
  readonly departments!: EntityTable<Department, "id">;
  readonly dailyRecords!: EntityTable<DailyRecord, "id">;
  readonly sharedExpenses!: EntityTable<SharedExpense, "id">;
  readonly drafts!: EntityTable<DailyDraft, "date">;
  readonly pendingOperations!: EntityTable<PendingOperation, "sequence">;
  readonly syncMetadata!: EntityTable<SyncMetadata, "id">;
  readonly recoveryCopies!: EntityTable<RecoveryCopy, "id">;

  constructor(readonly project: string, readonly ownerId: string) {
    super("levelgrid-finance:" + project + ":" + ownerId);
    this.version(1).stores({
      departments: "id, position, nameKey",
      dailyRecords: "id, &[departmentId+date], date",
      sharedExpenses: "id, &date",
      drafts: "date",
      pendingOperations: "++sequence, &id, [entity+recordId]",
    });
    this.version(2).stores({
      syncMetadata: "id",
      recoveryCopies: "id, savedAt",
    });
  }

  initializeDepartments(departments: Department[]) {
    return this.transaction("rw", this.departments, async () => {
      if (await this.departments.count() === 0) {
        await this.departments.bulkAdd(departments);
      }
    });
  }

  addDepartment(input: string) {
    const name = input.trim().replace(/\s+/g, " ");
    const nameKey = name.toLowerCase();
    if (!name) throw new DepartmentError("Enter a department name.");
    if (nameKey === "finance expenses") {
      throw new DepartmentError("Finance Expenses is already available as a shared expense.");
    }

    return this.transaction("rw", this.departments, this.pendingOperations, async () => {
      const active = await this.departments.where("nameKey").equals(nameKey)
        .and((department) => department.deactivatedAt === null).first();
      if (active) throw new DepartmentError("This department is already active.");

      const last = await this.departments.orderBy("position").last();
      const now = new Date().toISOString();
      const department: Department = {
        id: crypto.randomUUID(), name, nameKey, position: (last?.position ?? 0) + 1,
        createdAt: now, updatedAt: now, deactivatedAt: null, revision: 1,
      };
      await this.departments.add(department);
      await this.pendingOperations.add({
        id: crypto.randomUUID(), recordId: department.id, entity: "department",
        createdAt: now, expectedRevision: null, record: department,
      });
    });
  }

  deactivateDepartment(id: string) {
    return this.transaction("rw", this.departments, this.pendingOperations, async () => {
      const current = await this.departments.get(id);
      if (!current) throw new DepartmentError("This department is unavailable.");
      if (current.deactivatedAt !== null) return;

      const now = new Date().toISOString();
      const department = {
        ...current, deactivatedAt: now, updatedAt: now, revision: current.revision + 1,
      };
      await this.departments.put(department);
      await this.pendingOperations.add({
        id: crypto.randomUUID(), recordId: id, entity: "department",
        createdAt: now, expectedRevision: current.revision, record: department,
      });
    });
  }

  async latestDraftDate() {
    return (await this.drafts.orderBy("date").last())?.date;
  }

  loadDailyEntry(date: string): Promise<LoadedDailyEntry> {
    validateEntryDate(date);
    return this.transaction("r", this.departments, this.dailyRecords, this.sharedExpenses, this.drafts, async () => {
      const [allDepartments, records, sharedExpense, draft] = await Promise.all([
        this.departments.orderBy("position").toArray(),
        this.dailyRecords.where("date").equals(date).toArray(),
        this.sharedExpenses.where("date").equals(date).first(),
        this.drafts.get(date),
      ]);
      const departments = departmentsForDate(allDepartments, date, records, draft);
      const byDepartment = new Map(records.map((record) => [record.departmentId, record]));
      const inputs: DailyEntryInputs = {
        date,
        departments: Object.fromEntries(departments.map(({ id }) => {
          const record = byDepartment.get(id);
          return [id, draft?.departments[id] ?? {
            sales: record ? formatAmount(record.salesMinor) : "",
            expenses: record ? formatAmount(record.expensesMinor) : "",
            expenseComment: record?.expenseComment ?? "",
          }];
        })),
        sharedExpenses: draft?.sharedExpenses ?? {
          expenses: sharedExpense ? formatAmount(sharedExpense.expensesMinor) : "",
          expenseComment: sharedExpense?.expenseComment ?? "",
        },
      };
      return { inputs, departments, records, sharedExpense, draftVersion: draftVersion(draft) };
    });
  }

  saveDailyDraft(inputs: DailyEntryInputs, expectedVersion: string | undefined) {
    validateEntryDate(inputs.date);
    return this.transaction("rw", this.drafts, async () => {
      const draft = await this.drafts.get(inputs.date);
      if (draftVersion(draft) !== expectedVersion) {
        throw new DailyEntryError("This draft changed in another window. Reopen the entry to see the current draft.");
      }
      const version = crypto.randomUUID();
      await this.drafts.put({ ...inputs, version, updatedAt: new Date().toISOString() });
      return version;
    });
  }

  confirmDailyEntry(entry: LoadedDailyEntry, inputs: DailyEntryInputs, expectedDraftVersion: string | undefined) {
    const { date } = inputs;
    validateEntryDate(date);
    if (date !== entry.inputs.date) throw new DailyEntryError("Reopen the entry for the selected date.");

    return this.transaction(
      "rw", [this.departments, this.dailyRecords, this.sharedExpenses, this.drafts, this.pendingOperations, this.recoveryCopies],
      async () => {
        const [allDepartments, records, sharedExpense, draft] = await Promise.all([
          this.departments.orderBy("position").toArray(),
          this.dailyRecords.where("date").equals(date).toArray(),
          this.sharedExpenses.where("date").equals(date).first(),
          this.drafts.get(date),
        ]);
        const originalRevisions = new Map(entry.records.map(({ id, revision }) => [id, revision]));
        if (
          draftVersion(draft) !== expectedDraftVersion ||
          records.length !== originalRevisions.size ||
          records.some(({ id, revision }) => originalRevisions.get(id) !== revision) ||
          sharedExpense?.id !== entry.sharedExpense?.id ||
          sharedExpense?.revision !== entry.sharedExpense?.revision
        ) {
          throw new DailyEntryError("This day changed while it was open. Reopen the entry to review the current values.");
        }

        const departments = departmentsForDate(allDepartments, date, records, inputs);
        const currentByDepartment = new Map(records.map((record) => [record.departmentId, record]));
        const updatedAt = new Date().toISOString();
        const updates: DailyRecord[] = [];
        const operations: PendingOperation[] = [];
        const previousRecords: DailyRecord[] = [];
        let previousSharedExpense: SharedExpense | undefined;
        for (const { id: departmentId } of departments) {
          const values = inputs.departments[departmentId];
          if (!values) {
            throw new DailyEntryError("Departments changed while this day was open. Reopen the entry to review them.");
          }
          const current = currentByDepartment.get(departmentId);
          const salesMinor = requireAmount(values.sales);
          const expensesMinor = requireAmount(values.expenses);
          const expenseComment = values.expenseComment.trim() || null;
          if (
            current?.salesMinor === salesMinor &&
            current.expensesMinor === expensesMinor &&
            current.expenseComment === expenseComment
          ) continue;

          const record: DailyRecord = {
            id: current?.id ?? crypto.randomUUID(), departmentId, date, salesMinor, expensesMinor,
            expenseComment, updatedAt, revision: (current?.revision ?? 0) + 1,
          };
          updates.push(record);
          if (current) previousRecords.push(current);
          operations.push({
            id: crypto.randomUUID(), recordId: record.id, entity: "daily-record",
            createdAt: updatedAt, expectedRevision: current?.revision ?? null, record,
          });
        }

        const expensesMinor = requireAmount(inputs.sharedExpenses.expenses);
        const expenseComment = inputs.sharedExpenses.expenseComment.trim() || null;
        if (sharedExpense?.expensesMinor !== expensesMinor || sharedExpense.expenseComment !== expenseComment) {
          const record: SharedExpense = {
            id: sharedExpense?.id ?? crypto.randomUUID(), date, expensesMinor, expenseComment,
            updatedAt, revision: (sharedExpense?.revision ?? 0) + 1,
          };
          await this.sharedExpenses.put(record);
          previousSharedExpense = sharedExpense;
          operations.push({
            id: crypto.randomUUID(), recordId: record.id, entity: "shared-expense",
            createdAt: updatedAt, expectedRevision: sharedExpense?.revision ?? null, record,
          });
        }
        if (updates.length > 0) await this.dailyRecords.bulkPut(updates);
        if (operations.length > 0) await this.pendingOperations.bulkAdd(operations);
        if (previousRecords.length > 0 || previousSharedExpense) {
          await this.recoveryCopies.add({
            id: crypto.randomUUID(), date, savedAt: updatedAt, records: previousRecords, sharedExpense: previousSharedExpense,
          });
          await this.trimRecoveryCopies();
        }
        await this.drafts.delete(date);
      },
    );
  }

  async cloudState(): Promise<SyncMetadata> {
    return await this.syncMetadata.get("cloud") ?? { id: "cloud", cursor: 0, checkedAt: null, conflict: null };
  }

  acknowledgeUpload(acknowledged: PendingOperation[], conflict: SyncConflict | null) {
    return this.transaction("rw", this.pendingOperations, this.syncMetadata, async () => {
      for (const operation of acknowledged) {
        if (operation.sequence === undefined) throw new Error("Missing queue position");
        const saved = await this.pendingOperations.get(operation.sequence);
        if (saved?.id === operation.id) await this.pendingOperations.delete(operation.sequence);
      }
      await this.syncMetadata.put({ ...await this.cloudState(), conflict });
    });
  }

  applyCloudPage(previousCursor: number, cursor: number, changes: FinanceChange[], complete: boolean) {
    return this.transaction(
      "rw", [this.departments, this.dailyRecords, this.sharedExpenses, this.pendingOperations, this.syncMetadata],
      async () => {
        const state = await this.cloudState();
        if (state.cursor !== previousCursor) return false;
        for (const change of changes) {
          await this.applyCloudRecord(change);
        }
        await this.syncMetadata.put({
          ...state, cursor, conflict: null, checkedAt: complete ? new Date().toISOString() : state.checkedAt,
        });
        return true;
      },
    );
  }

  private async applyCloudRecord(change: FinanceChange) {
    const { entity, record } = change;
    if (await this.pendingOperations.where("[entity+recordId]").equals([entity, record.id]).first()) return;

    if (entity === "department") {
      const sameName = await this.departments.where("nameKey").equals(record.nameKey)
        .and((row) => row.id !== record.id && row.deactivatedAt === null).first();
      if (sameName && record.deactivatedAt === null) {
        throw new CloudRecordConflict({ entity, recordId: sameName.id });
      }
      const previous = await this.departments.get(record.id);
      if (!previous || previous.revision <= record.revision) await this.departments.put(record);
    } else if (entity === "daily-record") {
      const previous = await this.dailyRecords.where("[departmentId+date]").equals([record.departmentId, record.date]).first();
      if (previous && previous.id !== record.id) {
        throw new CloudRecordConflict({ entity, recordId: previous.id });
      }
      if (!previous || previous.revision <= record.revision) await this.dailyRecords.put(record);
    } else {
      const previous = await this.sharedExpenses.where("date").equals(record.date).first();
      if (previous && previous.id !== record.id) {
        throw new CloudRecordConflict({ entity, recordId: previous.id });
      }
      if (!previous || previous.revision <= record.revision) await this.sharedExpenses.put(record);
    }
  }

  async trimRecoveryCopies() {
    const excess = await this.recoveryCopies.count() - recoveryLimit;
    if (excess > 0) {
      const oldest = await this.recoveryCopies.orderBy("savedAt").limit(excess).primaryKeys();
      await this.recoveryCopies.bulkDelete(oldest);
    }
  }
}
