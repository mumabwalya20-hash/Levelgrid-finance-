"use client";

import { type FormEvent, useState } from "react";
import { DepartmentError, type Department, type FinanceDatabase } from "./finance/database";

export function DepartmentPanel({
  database,
  departments,
  readFailed,
  onSaved,
}: {
  database: FinanceDatabase;
  departments: Department[] | undefined;
  readFailed: boolean;
  onSaved: () => void;
}) {
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function save(change: () => Promise<void>) {
    if (saving) return;
    setSaving(true);
    setFeedback("");
    try {
      await change();
      setFeedback("Change saved on this phone.");
      onSaved();
    } catch (error) {
      setFeedback(error instanceof DepartmentError ? error.message : "Couldn't save the change. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("department"));
    void save(async () => {
      await database.addDepartment(name);
      form.reset();
    });
  }

  if (readFailed) return <p className="panel-note" role="alert">Couldn't read the saved departments.</p>;
  if (!departments) return <p className="panel-note" role="status">Loading departments…</p>;

  const active = departments.filter((department) => department.deactivatedAt === null);
  const inactive = departments.filter((department) => department.deactivatedAt !== null);
  const selected = active.find((department) => department.id === deactivateId);

  return (
    <div className="department-panel">
      <form className="finance-form" onSubmit={add}>
        <label className="form-field">
          <span>Department name</span>
          <input name="department" type="text" required />
        </label>
        <button className="action action-primary" type="submit" disabled={saving}>Add department</button>
      </form>

      {feedback && <p className="form-feedback" role="status">{feedback}</p>}
      {active.length === 0 && <p className="panel-note">No active departments.</p>}
      <ul className="panel-list">
        {active.map((department) => (
          <li className="department-row" key={department.id}>
            <span>{department.name}</span>
            <button
              className="action"
              type="button"
              aria-label={"Deactivate " + department.name}
              onClick={() => setDeactivateId(department.id)}
              disabled={saving}
            >
              Deactivate
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <section className="panel-confirmation" aria-label="Confirm deactivation">
          <p>Deactivate <strong>{selected.name}</strong>? Its records will stay in your history.</p>
          <div className="confirmation-actions">
            <button className="action" type="button" disabled={saving} onClick={() => setDeactivateId(null)}>Cancel</button>
            <button
              className="action"
              type="button"
              disabled={saving}
              onClick={() => void save(async () => {
                await database.deactivateDepartment(selected.id);
                setDeactivateId(null);
              })}
            >
              Confirm deactivation
            </button>
          </div>
        </section>
      )}
      {inactive.length > 0 && (
        <section aria-labelledby="inactive-departments">
          <h3 id="inactive-departments">Inactive departments</h3>
          <ul className="panel-list">
            {inactive.map((department) => <li key={department.id}>{department.name}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
