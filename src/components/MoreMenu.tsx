"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./MoreMenu.module.css";

export type MoreMenuItem = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Set for an on/off item: shows a check mark when true. */
  checked?: boolean;
  title?: string;
};

/**
 * A ⋮ button that opens a small menu above it. Closes after a choice, on Escape,
 * or on a tap outside it.
 */
export default function MoreMenu({ items, label = "More actions" }: { items: MoreMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>("[role^=menuitem]:not(:disabled)")?.focus();
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={styles.root}>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        ⋮
      </button>
      {open && (
        <div id={menuId} role="menu" className={styles.menu}>
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
              aria-checked={item.checked}
              disabled={item.disabled}
              title={item.title}
              className={styles.item}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              <span className={styles.check} aria-hidden="true">
                {item.checked ? "✓" : ""}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
