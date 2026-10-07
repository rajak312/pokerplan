import { AlertTriangle, DoorOpen, SearchX } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Spinner } from '@/components/ui/spinner';
import { ThemeToggle } from '@/components/theme';

const content = {
  'not-found': {
    icon: SearchX,
    title: 'Room not found',
    body: 'This room doesn’t exist or the link is incomplete. Double-check the invite link, or start a new session.',
  },
  removed: {
    icon: DoorOpen,
    title: 'You left this room',
    body: 'The facilitator removed you from this session.',
  },
  error: {
    icon: AlertTriangle,
    title: 'Something went wrong',
    body: 'We couldn’t join the room. Please refresh the page to try again.',
  },
} as const;

export function FullPageMessage({ kind, detail }: { kind: keyof typeof content; detail?: string }) {
  const c = content[kind];
  return (
    <div className="flex min-h-dvh flex-col">
      <MinimalHeader />
      <main className="flex flex-1 items-center justify-center px-5 pb-20">
        <div className="max-w-md animate-rise text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-muted">
            <c.icon className="size-6" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">{c.title}</h1>
          <p className="mt-2 text-muted">{detail && kind !== 'removed' ? detail : c.body}</p>
          <Link
            href="/#create"
            className="mt-7 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-fg transition hover:bg-primary-hover"
          >
            Create a new room
          </Link>
        </div>
      </main>
    </div>
  );
}

export function MinimalHeader() {
  return (
    <header className="flex h-16 items-center justify-between px-5">
      <Logo />
      <ThemeToggle />
    </header>
  );
}

export function RoomSkeleton({ slowStart }: { slowStart: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col" aria-busy="true">
      <div className="h-16 border-b border-border bg-surface/60" />
      <div className="mx-auto grid w-full max-w-[1440px] flex-1 gap-5 p-5 lg:grid-cols-[300px_1fr_280px]">
        <div className="hidden h-96 animate-pulse rounded-2xl bg-surface-2 lg:block" />
        <div className="flex flex-col gap-5">
          <div className="h-36 animate-pulse rounded-2xl bg-surface-2" />
          <div className="flex h-80 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border text-sm text-muted">
            <Spinner className="text-primary" label="Connecting to room" />
            <p className="font-medium text-fg">Connecting to the room…</p>
            {slowStart && (
              <p className="max-w-sm animate-fade-in text-center text-xs leading-relaxed">
                The server may be waking up from sleep (free hosting). This can take up to a minute
                — hang tight.
              </p>
            )}
          </div>
        </div>
        <div className="hidden h-72 animate-pulse rounded-2xl bg-surface-2 lg:block" />
      </div>
    </div>
  );
}
