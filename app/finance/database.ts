import Dexie, { type EntityTable } from "dexie";

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

interface SharedExpense {
  id: string;
  date: string;
  expensesMinor: number;
  expenseComment: string | null;
  updatedAt: string;
  revision: number;
}

interface DailyRecord extends SharedExpense {
  departmentId: string;
  salesMinor: number;
}

interface DailyDraft {
  date: string;
  departments: Record<string, { sales: string; expenses: string; expenseComment: string }>;
  sharedExpenses: { expenses: string; expenseComment: string };
  updatedAt: string;
}

type PendingOperation = {
  sequence?: number;
  id: string;
  recordId: string;
  createdAt: string;
  expectedRevision: number | null;
} & (
  | { entity: "department"; record: Department }
  | { entity: "daily-record"; record: DailyRecord }
  | { entity: "shared-expense"; record: SharedExpense }
);

export class DepartmentError extends Error {}

export class FinanceDatabase extends Dexie {
  readonly departments!: EntityTable<Department, "id">;
  readonly dailyRecords!: EntityTable<DailyRecord, "id">;
  readonly sharedExpenses!: EntityTable<SharedExpense, "id">;
  readonly drafts!: EntityTable<DailyDraft, "date">;
  readonly pendingOperations!: EntityTable<PendingOperation, "sequence">;

  constructor(project: string, readonly ownerId: string) {
    super("levelgrid-finance:" + project + ":" + ownerId);
    this.version(1).stores({
      departments: "id, position, nameKey",
      dailyRecords: "id, &[departmentId+date], date",
      sharedExpenses: "id, &date",
      drafts: "date",
      pendingOperations: "++sequence, &id, [entity+recordId]",
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
}
