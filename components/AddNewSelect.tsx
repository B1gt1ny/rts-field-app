"use client";

import { Children, isValidElement, useEffect, useId, useRef, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/client-auth";
import { dropdownDefinition, type DropdownKey, type DropdownOption, type DropdownOptions } from "@/lib/dropdown-options";
import { useAuthUser } from "./AuthGate";
import type { Employee } from "@/lib/types";

const addValue = "__rts_add_new__";
const aliasPrefix = "__rts_label__";
let cachedOptions: DropdownOptions = {};
let loadingOptions: Promise<void> | undefined;
const listeners = new Set<(options: DropdownOptions) => void>();
const employeeListeners = new Set<(employee: Employee) => void>();
let createdEmployees: Employee[] = [];
let cachedAccount = "";

function selectAccount(account: string) {
  if (cachedAccount === account) return;
  cachedAccount = account;
  cachedOptions = {};
  createdEmployees = [];
  loadingOptions = undefined;
}

function accountKey(user: ReturnType<typeof useAuthUser>) {
  return user ? `${user.id}:${user.role}` : "";
}

export function useNewEmployees(setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>) {
  const user = useAuthUser();
  const account = accountKey(user);
  const canAdd = user?.role === "Admin" || user?.role === "Manager";
  selectAccount(account);
  useEffect(() => {
    if (!canAdd) return;
    const add = (employee: Employee) => { if (cachedAccount !== account) return; setEmployees((old) => old.some((item) => item.id === employee.id) ? old : [...old, employee]); };
    employeeListeners.add(add);
    return () => { employeeListeners.delete(add); };
  }, [setEmployees, account, canAdd]);
}

function publish(options: DropdownOptions) {
  cachedOptions = options;
  for (const listener of listeners) listener(options);
}

function loadOptions(account: string) {
  if (!loadingOptions) loadingOptions = authFetch("/api/dropdown-options").then(async (response) => {
    if (!response.ok) throw new Error("Choices unavailable.");
    const options = await response.json();
    if (cachedAccount === account) publish(options);
  }).catch(() => { if (cachedAccount === account) loadingOptions = undefined; });
  return loadingOptions;
}

function readOptions(children: ReactNode): DropdownOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string; children?: ReactNode }>(child)) return [];
    if (child.type !== "option") return readOptions(child.props.children);
    const label = Children.toArray(child.props.children).join("");
    return [{ label, value: String(child.props.value ?? label) }];
  });
}

type Props = SelectHTMLAttributes<HTMLSelectElement> & { choiceKey: DropdownKey };

export function AddNewSelect(props: Props) {
  const user = useAuthUser();
  const account = accountKey(user);
  selectAccount(account);
  return <AccountSelect key={account} {...props} account={account} />;
}

function AccountSelect({ account, choiceKey, children, value, defaultValue, name, onChange, disabled, ...props }: Props & { account: string }) {
  const user = useAuthUser();
  const router = useRouter();
  const canAdd = user?.role === "Admin" || user?.role === "Manager";
  const definition = dropdownDefinition(choiceKey);
  const [registry, setRegistry] = useState(cachedOptions);
  const [newEmployees, setNewEmployees] = useState(createdEmployees);
  const baseOptions = readOptions(children);
  const [uncontrolledValue, setUncontrolledValue] = useState(String(defaultValue ?? baseOptions[0]?.value ?? ""));
  const canonicalValue = String(value ?? uncontrolledValue);
  const [chosenLabel, setChosenLabel] = useState<DropdownOption>();
  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [meaning, setMeaning] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const titleId = useId();
  const inputId = useId();
  const additions = canAdd ? registry[choiceKey] || [] : [];
  const recordOptions = canAdd && (choiceKey === "employee" || choiceKey === "crew") ? newEmployees.map((employee) => ({ label: employee.name, value: choiceKey === "crew" ? employee.name : employee.id })) : [];
  const extraOptions = [...additions, ...recordOptions].filter((option) => !baseOptions.some((base) => base.label.toLocaleLowerCase() === option.label.toLocaleLowerCase() && base.value === option.value));
  const optionValue = (option: DropdownOption) => definition.values ? aliasPrefix + option.label : option.value;
  const renderedValue = definition.values && chosenLabel?.value === canonicalValue && extraOptions.some((option) => option.label === chosenLabel.label)
    ? aliasPrefix + chosenLabel.label : canonicalValue;
  const meanings = baseOptions.filter((option) => definition.values?.includes(option.value));

  useEffect(() => {
    if (!canAdd) return;
    const updateRegistry = (options: DropdownOptions) => { if (cachedAccount === account) setRegistry(options); };
    listeners.add(updateRegistry);
    const addEmployee = (employee: Employee) => { if (cachedAccount !== account) return; setNewEmployees((old) => old.some((item) => item.id === employee.id) ? old : [...old, employee]); };
    employeeListeners.add(addEmployee);
    setRegistry(cachedOptions);
    void loadOptions(account);
    return () => { listeners.delete(updateRegistry); employeeListeners.delete(addEmployee); };
  }, [canAdd, account]);

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
  }, [open]);

  useEffect(() => {
    const form = selectRef.current?.form;
    const reset = () => { setUncontrolledValue(String(defaultValue ?? baseOptions[0]?.value ?? "")); setChosenLabel(undefined); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [defaultValue, baseOptions[0]?.value]);

  function close() {
    dialogRef.current?.close();
    setOpen(false);
    selectRef.current?.focus();
  }

  function emit(valueToSave: string) {
    const select = selectRef.current;
    if (!select) return;
    setUncontrolledValue(valueToSave);
    // Existing handlers receive the stored value, never an action/label token.
    const target = new Proxy(select, { get(element, property) {
      if (property === "value") return valueToSave;
      const result = Reflect.get(element, property, element);
      return typeof result === "function" ? result.bind(element) : result;
    } });
    onChange?.({ target, currentTarget: target, type: "change" } as React.ChangeEvent<HTMLSelectElement>);
  }

  async function addOption(event: React.FormEvent) {
    event.stopPropagation();
    event.preventDefault();
    if (!canAdd || cachedAccount !== account) return;
    const label = newLabel.trim();
    if (!label) { setError("Enter a new choice."); return; }
    const existing = [...baseOptions, ...extraOptions].find((option) => option.label.toLocaleLowerCase() === label.toLocaleLowerCase());
    if (existing) {
      setChosenLabel(existing);
      emit(existing.value);
      close();
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (choiceKey === "employee" || choiceKey === "crew") {
        const response = await authFetch("/api/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: label }) });
        const employee = await response.json() as Employee & { error?: string };
        if (!response.ok) throw new Error(employee.error || "The employee could not be saved.");
        if (cachedAccount !== account) return;
        createdEmployees = [...createdEmployees, employee];
        for (const listener of employeeListeners) listener(employee);
        setChosenLabel(undefined);
        emit(choiceKey === "crew" ? employee.name : employee.id);
        close();
        return;
      }
      const option = { label, value: definition.values ? meaning : label };
      const response = await authFetch("/api/dropdown-options", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: choiceKey, option }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The choice could not be saved.");
      if (cachedAccount !== account) return;
      publish(data);
      setChosenLabel(option);
      emit(option.value);
      close();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The choice could not be saved."); }
    finally { setSaving(false); }
  }

  return <>
    <select {...props} ref={selectRef} disabled={disabled} value={renderedValue} onChange={(event) => {
      if (event.target.value === addValue) {
        if (choiceKey === "job") { router.push("/jobs/new"); return; }
        setNewLabel("");
        setMeaning(meanings.find((option) => option.value === canonicalValue)?.value ?? meanings[0]?.value ?? "");
        setError("");
        setOpen(true);
        return;
      }
      const selected = extraOptions.find((option) => optionValue(option) === event.target.value);
      setChosenLabel(selected);
      emit(selected?.value ?? event.target.value);
    }}>
      {canAdd && <option value={addValue}>Add new</option>}
      {children}
      {extraOptions.map((option) => <option key={option.label} value={optionValue(option)}>{option.label}</option>)}
      {![...baseOptions, ...extraOptions].some((option) => option.value === canonicalValue) && canonicalValue && <option value={canonicalValue}>{canonicalValue}</option>}
    </select>
    {name && <input type="hidden" name={name} value={canonicalValue} disabled={disabled} />}
    {open && createPortal(<dialog ref={dialogRef} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!saving) close(); }} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-content/10 bg-surface p-5 text-content shadow-xl backdrop:bg-black/50">
      <form onSubmit={addOption} className="space-y-4">
        <h2 id={titleId} className="text-xl font-bold">Add new {definition.label.toLowerCase()}</h2>
        <label htmlFor={inputId} className="block"><span className="label">New choice</span><input id={inputId} autoFocus className="field" value={newLabel} onChange={(event) => setNewLabel(event.target.value)} maxLength={100} required disabled={saving} /></label>
        {definition.values && <label className="block"><span className="label">Use the same meaning as</span><select className="field" value={meaning} onChange={(event) => setMeaning(event.target.value)} disabled={saving}>{meanings.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span className="mt-2 block text-sm text-content/65">The new label uses this choice’s existing behavior{choiceKey === "userRole" ? " and access permissions" : ""}.</span></label>}
        {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
        <div className="flex gap-3"><button type="button" className="btn-secondary flex-1" onClick={close} disabled={saving}>Cancel</button><button type="submit" className="btn-primary flex-1" disabled={saving || !newLabel.trim()}>{saving ? "Saving…" : "Add and select"}</button></div>
      </form>
    </dialog>, document.body)}
  </>;
}
