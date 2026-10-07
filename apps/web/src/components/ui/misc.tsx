import type { HTMLAttributes, ReactNode } from 'react';
import { avatarHue, initials } from '@/lib/format';
import { cn } from '@/lib/cn';

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border bg-surface-2 px-1 font-mono text-[10px] font-medium text-muted',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

const badgeTones = {
  neutral: 'bg-surface-2 text-muted border-border',
  primary: 'bg-primary-soft text-primary border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
} as const;

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof badgeTones }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Avatar({ id, name, className }: { id: string; name: string; className?: string }) {
  const hue = avatarHue(id);
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
        className,
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 70% 45%))`,
      }}
    >
      {initials(name)}
    </span>
  );
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn('rounded-2xl border border-border bg-surface shadow-card', className)}
      {...props}
    />
  );
}
