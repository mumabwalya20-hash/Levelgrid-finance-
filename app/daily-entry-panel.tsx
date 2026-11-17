"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  DailyEntryError,
  type DailyEntryInputs,
  type Department,
  type DepartmentInputs,
  type FinanceDatabase,
  type LoadedDailyEntry,
} from "./finance/database";
import { businessDate, formatAmount, formatEntryDate, isEntryDate, parseAmount } from "./finance/daily-entry";

function amountError(value: string) {
  const result = parseAmount(value);
  return typeof result === "string" ? result : undefined;
}

function validateStep(inputs: DailyEntryInputs, department?: Department): { sales?: string; expenses?: string } {
  return department ? {
    sales: amountError(inputs.departments[department.id].sales),
    expenses: amountError(inputs.departments[department.id].expenses),
  } : { expenses: amountError(inputs.sharedExpenses.expenses) };
}

function firstIncompleteStep(inputs: DailyEntryInputs, departments: Department[]) {
  const index = departments.findIndex((department) => {
    const errors = validateStep(inputs, department);
    return errors.sales || errors.expenses;
  });
  if (index >= 0) return index;
  return validateStep(inputs).expenses ? departments.length : departments.length + 1;
}

function AmountField({ name, label, value, error, onChange }: {
  name: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="form-field">
      <label htmlFor={name}>{label} (ZMW)</label>
      <input
        id={name}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        required
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : "zero-amount-help"}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {error && <p id={`${name}-error`} className="entry-error" role="alert">{error}</p>}
    </div>
  );
}

function ReviewAmount({ label, value }: { label: string; value: string }) {
  const amount = parseAmount(value);
  return (
    <div>
      <dt>{label}</dt>
      <dd>{typeof amount === "number" ? "K " + formatAmount(amount) : "Check amount"}</dd>
    </div>
  );
}

function EntryReview({ departments, inputs, onEdit, disabled }: {
  departments: Department[];
  inputs: DailyEntryInputs;
  onEdit: (step: number) => void;
  disabled: boolean;
}) {
  const rows = [
    ...departments.map(({ id, name }) => ({ id, name, ...inputs.departments[id] })),
    { id: "finance-expenses", name: "Finance Expenses", ...inputs.sharedExpenses, sales: undefined },
  ];
  return (
    <ul className="entry-review">
      {rows.map(({ id, name, sales, expenses, expenseComment }, index) => (
        <li key={id}>
          <div className="entry-review-heading">
            <h4>{name}</h4>
            <button type="button" className="action" aria-label={`Edit ${name}`} disabled={disabled} onClick={() => onEdit(index)}>
              Edit
            </button>
          </div>
          <dl>
            {sales !== undefined && <ReviewAmount label="Sales" value={sales} />}
            <ReviewAmount label="Expenses" value={expenses} />
          </dl>
          {expenseComment.trim() && <p className="form-help">{expenseComment.trim()}</p>}
        </li>
      ))}
    </ul>
  );
}

function DailyEntryForm({ database, entry, onBack, onSaved }: {
  database: FinanceDatabase;
  entry: LoadedDailyEntry;
  onBack: () => void;
  onSaved: (date: string) => void;
}) {
  const [inputs, setInputs] = useState(entry.inputs);
  const [step, setStep] = useState(() => {
    const hasSavedValues = entry.draftVersion !== undefined || entry.records.length > 0 || entry.sharedExpense;
    return hasSavedValues ? firstIncompleteStep(entry.inputs, entry.departments) : 0;
  });
  const [returnToReview, setReturnToReview] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [draftStatus, setDraftStatus] = useState(entry.draftVersion === undefined ? "" : "Draft saved on this phone.");
  const [draftError, setDraftError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const savedVersion = useRef(entry.draftVersion);
  const draftWrites = useRef(Promise.resolve());
  const latestWrite = useRef(0);
  const stepHeading = useRef<HTMLHeadingElement>(null);

  const reviewStep = entry.departments.length + 1;
  const reviewing = step === reviewStep;
  const department = entry.departments[step];
  const departmentInputs = department ? inputs.departments[department.id] : undefined;
  const expenseInputs = departmentInputs ?? inputs.sharedExpenses;
  const errors = showErrors ? validateStep(inputs, department) : {};

  useEffect(() => {
    stepHeading.current?.focus();
  }, [step]);

  function saveDraft(values: DailyEntryInputs) {
    const write = ++latestWrite.current;
    setDraftStatus("Saving draft…");
    setDraftError("");
    draftWrites.current = draftWrites.current.then(async () => {
      try {
        savedVersion.current = await database.saveDailyDraft(values, savedVersion.current);
        if (write === latestWrite.current) setDraftStatus("Draft saved on this phone.");
      } catch (error) {
        if (write === latestWrite.current) {
          setDraftStatus("");
          setDraftError(error instanceof DailyEntryError ? error.message : "Couldn't save the draft on this phone. Try again.");
        }
      }
    });
  }

  function changeInputs(changes: Partial<DepartmentInputs>) {
    const next = department ? {
      ...inputs,
      departments: { ...inputs.departments, [department.id]: { ...inputs.departments[department.id], ...changes } },
    } : { ...inputs, sharedExpenses: { ...inputs.sharedExpenses, ...changes } };
    setInputs(next);
    saveDraft(next);
  }

  function goToStep(next: number, editingReview = false) {
    setShowErrors(false);
    setConfirmError("");
    setReturnToReview(editingReview);
    setStep(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirming) return;
    if (!reviewing) {
      const problems = validateStep(inputs, department);
      if (problems.sales || problems.expenses) {
        setShowErrors(true);
        const field = event.currentTarget.elements.namedItem(problems.sales ? "sales-amount" : "expense-amount");
        if (field instanceof HTMLElement) field.focus();
        return;
      }
      goToStep(returnToReview ? reviewStep : step + 1);
      return;
    }

    const incomplete = firstIncompleteStep(inputs, entry.departments);
    if (incomplete !== reviewStep) {
      goToStep(incomplete, true);
      setShowErrors(true);
      return;
    }
    setConfirmError("");
    setConfirming(true);
    try {
      await draftWrites.current;
      await database.confirmDailyEntry(entry, inputs, savedVersion.current);
      onSaved(inputs.date);
    } catch (error) {
      setConfirmError(error instanceof DailyEntryError ? error.message : "Couldn't save this day on the phone. Try again.");
    } finally {
      setConfirming(false);
    }
  }

  function previous() {
    if (step === 0) onBack();
    else goToStep(step - 1);
  }

  return (
    <form className="finance-form" noValidate onSubmit={submit}>
      <div className="entry-context">
        <time dateTime={inputs.date}>{formatEntryDate(inputs.date)}</time>
        <span role="status">{draftStatus}</span>
      </div>
      {reviewing ? (
        <>
          <h3 className="entry-title" ref={stepHeading} tabIndex={-1}>Review daily entry</h3>
          <EntryReview departments={entry.departments} inputs={inputs} onEdit={(index) => goToStep(index, true)} disabled={confirming} />
        </>
      ) : (
        <>
          <div className="entry-step">
            <p>Step {step + 1} of {reviewStep}</p>
            <h3 className="entry-title" ref={stepHeading} tabIndex={-1}>{department?.name ?? "Finance Expenses"}</h3>
          </div>
          <p id="zero-amount-help" className="form-help">Type 0 when the amount is zero.</p>
          {departmentInputs && (
            <AmountField name="sales-amount" label="Sales amount" value={departmentInputs.sales}
              error={errors.sales} onChange={(sales) => changeInputs({ sales })} />
          )}
          <AmountField name="expense-amount" label={department ? "Expense amount" : "Finance expenses"}
            value={expenseInputs.expenses} error={errors.expenses} onChange={(expenses) => changeInputs({ expenses })} />
          <label className="form-field">
            Expense comment (optional)
            <textarea rows={2} value={expenseInputs.expenseComment}
              onChange={(event) => changeInputs({ expenseComment: event.currentTarget.value })} />
          </label>
        </>
      )}
      {draftError && (
        <div className="entry-retry">
          <p className="entry-error" role="alert">{draftError}</p>
          <button type="button" className="action" disabled={confirming} onClick={() => saveDraft(inputs)}>Retry draft save</button>
        </div>
      )}
      {confirmError && <p className="entry-error" role="alert">{confirmError}</p>}
      <div className="entry-actions">
        <button className="action" type="button" onClick={previous}
          disabled={confirming || (step === 0 && draftStatus === "Saving draft…")}>
          {step === 0 ? "Change date" : "Previous"}
        </button>
        <button className="action action-primary" type="submit" disabled={confirming}>
          {reviewing ? (confirming ? "Saving…" : "Confirm and save") : step === reviewStep - 1 || returnToReview ? "Review entry" : "Next"}
        </button>
      </div>
    </form>
  );
}

export function DailyEntryPanel({ database, initialDate, onSaved, onClose }: {
  database: FinanceDatabase;
  initialDate?: string;
  onSaved: (date: string) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(initialDate ?? "");
  const [draftDate, setDraftDate] = useState<string>();
  const [selectingDefault, setSelectingDefault] = useState(initialDate === undefined);
  const [entry, setEntry] = useState<LoadedDailyEntry>();
  const [savedDate, setSavedDate] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialDate !== undefined) return;
    let active = true;
    void database.latestDraftDate().catch(() => undefined).then((latest) => {
      if (!active) return;
      const savedDraft = latest && isEntryDate(latest) ? latest : undefined;
      setDraftDate(savedDraft);
      setDate(savedDraft ?? businessDate());
      setSelectingDefault(false);
    });
    return () => { active = false; };
  }, [database, initialDate]);

  async function selectDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || selectingDefault) return;
    setLoading(true);
    setError("");
    try {
      setEntry(await database.loadDailyEntry(date));
    } catch (error) {
      setError(error instanceof DailyEntryError ? error.message : "Couldn't open this date. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (savedDate) {
    return (
      <div className="finance-form">
        <p className="panel-confirmation" role="status">Entry for {formatEntryDate(savedDate)} saved on this phone.</p>
        <button className="action action-primary" type="button" onClick={onClose}>Done</button>
      </div>
    );
  }
  if (entry) {
    return (
      <DailyEntryForm database={database} entry={entry} onBack={() => setEntry(undefined)} onSaved={(confirmedDate) => {
        setSavedDate(confirmedDate);
        onSaved(confirmedDate);
      }} />
    );
  }

  let continueLabel = "Continue";
  if (loading) continueLabel = "Opening…";
  else if (date === draftDate) continueLabel = "Resume draft";
  else if (date === initialDate) continueLabel = "Edit entry";

  return (
    <form className="finance-form" noValidate onSubmit={selectDate}>
      <label className="form-field">
        Record date
        <input
          type="date"
          min="0001-01-01"
          max={businessDate()}
          required
          value={date}
          disabled={loading || selectingDefault}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            setDate(event.currentTarget.value);
            setError("");
          }}
        />
      </label>
      {error && <p className="entry-error" role="alert">{error}</p>}
      <button className="action action-primary" type="submit" disabled={loading || selectingDefault}>
        {continueLabel}
      </button>
    </form>
  );
}
