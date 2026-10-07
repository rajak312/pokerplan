import Link from 'next/link';
import { cn } from '@/lib/cn';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden>
      <defs>
        <linearGradient id="pp-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c6cff" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <rect
        x="9"
        y="3"
        width="18"
        height="24"
        rx="4"
        fill="url(#pp-logo)"
        opacity="0.35"
        transform="rotate(12 18 15)"
      />
      <rect x="5" y="5" width="18" height="24" rx="4" fill="url(#pp-logo)" />
      <path d="M14 11.5l2.2 4.5-2.2 4.5-2.2-4.5z" fill="#fff" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        'inline-flex items-center gap-2 rounded-lg font-semibold tracking-tight',
        className,
      )}
      aria-label="PokerPlan home"
    >
      <LogoMark className="size-7" />
      <span className="text-[17px]">
        Poker<span className="text-primary">Plan</span>
      </span>
    </Link>
  );
}
