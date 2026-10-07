'use client';

import { Keyboard } from 'lucide-react';
import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/misc';

const rows: [string[], string][] = [
  [['0–9'], 'Vote — type the card value (1 then 3 for 13)'],
  [['X', 'S', 'M', 'L'], 'Vote with T-shirt sizes (XS, XL, XXL…)'],
  [['H'], 'Vote ½ (modified Fibonacci)'],
  [['?'], 'Not sure'],
  [['C'], 'Coffee break ☕'],
  [['Esc'], 'Withdraw your vote'],
  [['R'], 'Reveal cards (facilitator)'],
  [['N'], 'Next story after reveal (facilitator)'],
];

export function ShortcutsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden size-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg sm:inline-flex"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts"
      >
        <Keyboard className="size-[18px]" />
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Keyboard shortcuts"
        description="Vote without touching the mouse."
      >
        <ul className="divide-y divide-border">
          {rows.map(([keys, label]) => (
            <li key={label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="text-muted">{label}</span>
              <span className="flex shrink-0 gap-1">
                {keys.map((k) => (
                  <Kbd key={k} className="h-6 min-w-6 px-1.5 text-[11px]">
                    {k}
                  </Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}
