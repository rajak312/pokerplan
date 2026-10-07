'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface MenuProps {
  trigger: (props: {
    ref: React.Ref<HTMLButtonElement>;
    onClick: () => void;
    'aria-haspopup': 'menu';
    'aria-expanded': boolean;
    'aria-controls': string;
  }) => ReactNode;
  items: MenuItem[];
  align?: 'start' | 'end';
}

/** Small accessible dropdown menu (arrow keys, Esc, outside click). */
export function Menu({ trigger, items, align = 'end' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const first = listRef.current?.querySelector<HTMLButtonElement>(
      '[role="menuitem"]:not(:disabled)',
    );
    first?.focus();
    const onPointer = (e: PointerEvent) => {
      if (
        !listRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const els = [
      ...(listRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ?? []),
    ];
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') els[(i + 1) % els.length]?.focus();
    else if (e.key === 'ArrowUp') els[(i - 1 + els.length) % els.length]?.focus();
    else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
      triggerRef.current?.focus();
    } else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="relative">
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen((o) => !o),
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': id,
      })}
      {open && (
        <div
          ref={listRef}
          id={id}
          role="menu"
          onKeyDown={onKeyDown}
          className={cn(
            'absolute top-full z-40 mt-1.5 min-w-48 animate-pop rounded-xl border border-border bg-surface p-1 shadow-lift',
            align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition focus:outline-none disabled:opacity-40',
                item.danger
                  ? 'text-danger hover:bg-danger-soft focus:bg-danger-soft'
                  : 'text-fg hover:bg-surface-2 focus:bg-surface-2',
              )}
            >
              {item.icon && <span className="text-muted [&>svg]:size-4">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
