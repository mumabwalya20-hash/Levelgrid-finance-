import type { SupabaseClient } from "@supabase/supabase-js";
import { CloudRecordConflict, type Department, type FinanceChange, type FinanceDatabase, type PendingOperation } from "./database";

export type SyncStatus = "idle" | "working" | "setup" | "retry";

export interface CloudDepartment {
  id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
  deactivated_at: string | null;
  revision: number;
}

export function departmentFromCloud(row: CloudDepartment): Department {
  return {
    id: row.id,
    name: row.name,
    nameKey: row.name.toLowerCase(),
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deactivatedAt: row.deactivated_at,
    revision: row.revision,
  };
}

function encodeRecord(change: FinanceChange) {
  const { entity, record } = change;
  const common = { id: record.id, updated_at: record.updatedAt, revision: record.revision };
  if (entity === "department") {
    return {
      ...common,
      name: record.name,
      position: record.position,
      created_at: record.createdAt,
      deactivated_at: record.deactivatedAt,
    };
  }
  const expense = {
    ...common,
    business_date: record.date,
    expenses_minor: record.expensesMinor,
    expense_comment: record.expenseComment,
  };
  return entity === "daily-record"
    ? { ...expense, department_id: record.departmentId, sales_minor: record.salesMinor }
    : expense;
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid sync response");
  }
  return value as Record<string, unknown>;
}

function decodeRecord(value: unknown): FinanceChange {
  const change = object(value);
  const record = object(change.record);
  const { id, revision, updated_at: updatedAt } = record;
  if (typeof id !== "string" || typeof updatedAt !== "string" ||
      typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1) {
    throw new Error("Invalid cloud record");
  }
  const common = { id, revision, updatedAt };
  if (change.entity === "department") {
    const { name, position, created_at: createdAt, deactivated_at: deactivatedAt } = record;
    if (typeof name === "string" && typeof position === "number" && typeof createdAt === "string" &&
        (deactivatedAt === null || typeof deactivatedAt === "string")) {
      return { entity: change.entity, record: departmentFromCloud({
        id, name, position, created_at: createdAt, updated_at: updatedAt, deactivated_at: deactivatedAt, revision,
      }) };
    }
  } else {
    const { business_date: date, expense_comment: expenseComment, expenses_minor: expensesMinor } = record;
    if (typeof date === "string" && (expenseComment === null || typeof expenseComment === "string") &&
        typeof expensesMinor === "number" && Number.isSafeInteger(expensesMinor)) {
      const expense = { ...common, date, expensesMinor, expenseComment };
      if (change.entity === "shared-expense") return { entity: change.entity, record: expense };
      const { department_id: departmentId, sales_minor: salesMinor } = record;
      if (change.entity === "daily-record" && typeof departmentId === "string" &&
          typeof salesMinor === "number" && Number.isSafeInteger(salesMinor)) {
        return { entity: change.entity, record: { ...expense, departmentId, salesMinor } };
      }
    }
  }
  throw new Error("Invalid cloud record");
}

function uploadResult(data: unknown, sent: PendingOperation[]) {
  const result = object(data);
  const ids = result.acknowledged;
  if (!Array.isArray(ids) || ids.length > sent.length || ids.some((id, index) => sent[index].id !== id)) {
    throw new Error("Unexpected upload acknowledgement");
  }
  const expectedConflict = sent[ids.length];
  const conflict = result.conflict === null ? null : object(result.conflict);
  if (conflict ? (
    conflict.id !== expectedConflict?.id ||
    conflict.entity !== expectedConflict?.entity ||
    conflict.recordId !== expectedConflict?.recordId
  ) : expectedConflict !== undefined) {
    throw new Error("Incomplete upload acknowledgement");
  }
  return { acknowledged: sent.slice(0, ids.length), conflict: conflict ? {
    entity: expectedConflict.entity, recordId: expectedConflict.recordId, operationId: expectedConflict.id,
  } : null };
}

const uploadLimit = 40;
const downloadLimit = 100;

export async function syncFinance(
  database: FinanceDatabase, client: SupabaseClient, active: () => boolean,
): Promise<Exclude<SyncStatus, "working">> {
  try {
    while (active()) {
      const sent = await database.pendingOperations.orderBy("sequence").limit(uploadLimit).toArray();
      if (sent.length === 0 || !active()) break;
      const response = await client.rpc("finance_sync_upload", {
        p_operations: sent.map((operation) => ({
          id: operation.id,
          entity: operation.entity,
          recordId: operation.recordId,
          expectedRevision: operation.expectedRevision,
          record: encodeRecord(operation),
        })),
      });
      if (!active()) return "idle";
      if (response.error) return response.error.code === "PGRST202" ? "setup" : "retry";
      const { acknowledged, conflict } = uploadResult(response.data, sent);
      await database.acknowledgeUpload(acknowledged, conflict);
      if (conflict) return "idle";
    }

    while (active()) {
      const { cursor } = await database.cloudState();
      const response = await client.rpc("finance_sync_download", { p_after: cursor, p_limit: downloadLimit });
      if (!active()) return "idle";
      if (response.error) return response.error.code === "PGRST202" ? "setup" : "retry";
      const page = object(response.data);
      const next = page.cursor;
      if (typeof next !== "number" || !Number.isSafeInteger(next) || next < cursor ||
          !Array.isArray(page.changes) || page.changes.length > downloadLimit ||
          (page.changes.length === 0 ? next !== cursor : next === cursor)) {
        throw new Error("Invalid cloud page");
      }
      const complete = page.changes.length < downloadLimit;
      const saved = await database.applyCloudPage(cursor, next, page.changes.map(decodeRecord), complete);
      if (saved && complete) return "idle";
    }
    return "idle";
  } catch (error) {
    if (!active()) return "idle";
    if (error instanceof CloudRecordConflict) {
      await database.acknowledgeUpload([], error.conflict);
      return "idle";
    }
    return "retry";
  }
}
