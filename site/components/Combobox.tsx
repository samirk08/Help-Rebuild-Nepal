"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { Option } from "@/lib/districts";

/**
 * Searchable single-select following the ARIA 1.2 combobox pattern.
 *
 * With 77 districts a plain <select> is unusable on a phone, but a JS-only
 * widget would lock out anyone whose bundle failed — a real risk on the
 * connections this site is built for. So the server, and the first client
 * render, emit a native grouped <select>; the combobox replaces it only once
 * JavaScript has actually run. Same `name`, same submitted value either way.
 */
export default function Combobox({
  name,
  options,
  placeholder,
  emptyLabel,
  describedBy,
}: {
  name: string;
  options: Option[];
  placeholder: string;
  emptyLabel: string;
  describedBy?: string;
}) {
  const [enhanced, setEnhanced] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [value, setValue] = useState("");
  const [active, setActive] = useState(0);

  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setEnhanced(true), []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    // Match the displayed label and the underlying English value, so a Nepali
    // reader can type either script.
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => setActive(0), [query]);

  // Close when focus or a click leaves the widget entirely.
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  if (!enhanced) {
    return (
      <select className="select" name={name} defaultValue="" aria-describedby={describedBy}>
        <option value="">{placeholder}</option>
        {renderGrouped(options)}
      </select>
    );
  }

  const commit = (option: Option) => {
    setValue(option.value);
    setQuery(option.label);
    setOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => {
        if (matches.length === 0) return 0;
        return (i + delta + matches.length) % matches.length;
      });
      return;
    }

    if (e.key === "Home" && open) {
      e.preventDefault();
      setActive(0);
      return;
    }

    if (e.key === "End" && open) {
      e.preventDefault();
      setActive(Math.max(0, matches.length - 1));
      return;
    }

    if (e.key === "Enter") {
      if (open && matches[active]) {
        e.preventDefault();
        commit(matches[active]);
      }
      return;
    }

    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
      return;
    }

    if (e.key === "Tab") setOpen(false);
  };

  const activeId = matches[active] ? `${listId}-opt-${active}` : undefined;

  return (
    <div className="combobox" ref={rootRef}>
      <input type="hidden" name={name} value={value} />
      <input
        ref={inputRef}
        className="input combobox__input"
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? activeId : undefined}
        aria-describedby={describedBy}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setValue("");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {open ? (
        <ul className="combobox__list" id={listId} role="listbox">
          {matches.length === 0 ? (
            <li className="combobox__empty" role="presentation">
              {emptyLabel}
            </li>
          ) : (
            matches.map((option, i) => {
              const showGroup = option.group && option.group !== matches[i - 1]?.group;
              return (
                <li key={option.value} role="presentation">
                  {showGroup ? <p className="combobox__group">{option.group}</p> : null}
                  <div
                    id={`${listId}-opt-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className="combobox__option"
                    // Pointer-down beats blur, so the click lands before the list closes.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commit(option);
                    }}
                    onMouseEnter={() => setActive(i)}
                  >
                    {option.label}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}

function renderGrouped(options: Option[]) {
  const out: React.ReactNode[] = [];
  let group: string | undefined;
  let bucket: Option[] = [];

  const flush = () => {
    if (!bucket.length) return;
    const items = bucket.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ));
    out.push(
      group ? (
        <optgroup key={group} label={group}>
          {items}
        </optgroup>
      ) : (
        <optgroup key="__ungrouped" label="—">
          {items}
        </optgroup>
      )
    );
    bucket = [];
  };

  for (const option of options) {
    if (option.group !== group) {
      flush();
      group = option.group;
    }
    bucket.push(option);
  }
  flush();

  return out;
}
