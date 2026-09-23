"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { getServerTheme, getTheme, setTheme, subscribeToTheme } from "@/lib/client/theme";
import styles from "./theme-controls.module.css";

export function ThemeControls() {
  const [open, setOpen] = useState(false);
  const theme = useSyncExternalStore(subscribeToTheme, getTheme, getServerTheme);
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    container.current?.querySelector<HTMLInputElement>("input:checked")?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={container}
      className={styles.settings}
      onBlurCapture={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-label="Настройки внешнего вида"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9.4 3-.5 2a8 8 0 0 0-1.5.9l-2-.6-2.6 4.4 1.5 1.4a8 8 0 0 0 0 1.8l-1.5 1.4 2.6 4.4 2-.6a8 8 0 0 0 1.5.9l.5 2h5.2l.5-2a8 8 0 0 0 1.5-.9l2 .6 2.6-4.4-1.5-1.4a8 8 0 0 0 0-1.8l1.5-1.4-2.6-4.4-2 .6a8 8 0 0 0-1.5-.9l-.5-2Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      {open && (
        <div id={id} className={styles.popover} role="dialog" aria-label="Настройки внешнего вида">
          <fieldset className={styles.options}>
            <legend>Тема оформления</legend>
            {(["light", "dark"] as const).map((value) => (
              <label key={value} className={styles.option}>
                <input
                  type="radio"
                  name={`${id}-theme`}
                  value={value}
                  checked={theme === value}
                  onChange={() => setTheme(value)}
                />
                <span>{value === "light" ? "Светлая" : "Тёмная"}</span>
              </label>
            ))}
          </fieldset>
        </div>
      )}
    </div>
  );
}
