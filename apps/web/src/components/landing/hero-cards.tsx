import { cn } from '@/lib/cn';

const seats = [
  { name: 'Priya', value: '5', hue: 262 },
  { name: 'Marco', value: '5', hue: 190 },
  { name: 'Aisha', value: '8', hue: 330 },
  { name: 'Ken', value: '5', hue: 30 },
];

/** Decorative, static preview of a revealed round. */
export function HeroCards({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)} aria-hidden>
      <div className="flex items-end justify-center gap-3 sm:gap-4">
        {seats.map((s, i) => (
          <div
            key={s.name}
            className="flex animate-rise flex-col items-center gap-2"
            style={{ animationDelay: `${150 + i * 90}ms` }}
          >
            <div
              className={cn(
                'flex h-20 w-14 items-center justify-center rounded-xl border-2 bg-surface text-2xl font-bold shadow-card sm:h-24 sm:w-16',
                s.value === '5' ? 'border-primary text-primary' : 'border-warning text-warning',
              )}
              style={{
                rotate: `${(i - 1.5) * 4}deg`,
                translate: `0 ${(Math.abs(i - 1.5) - 1.5) * 6}px`,
              }}
            >
              {s.value}
            </div>
            <span className="text-xs font-medium text-muted">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
