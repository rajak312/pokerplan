'use client';

import { DECKS, displayNameSchema, type RoomInfo } from '@pokerplan/shared';
import { ArrowRight, Users } from 'lucide-react';
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { getSavedName } from '@/lib/guest';
import { MinimalHeader } from './states';

const noop = () => () => {};

export function JoinForm({
  info,
  onJoin,
}: {
  info: RoomInfo | undefined;
  onJoin: (name: string) => Promise<boolean>;
}) {
  const saved = useSyncExternalStore(noop, getSavedName, () => '');
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const value = name ?? saved;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = displayNameSchema.safeParse(value);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setError(undefined);
    setBusy(true);
    const ok = await onJoin(parsed.data);
    if (!ok) setBusy(false);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <MinimalHeader />
      <main className="relative flex flex-1 items-center justify-center px-5 pb-20">
        <div className="hero-glow pointer-events-none absolute inset-0" />
        <div className="relative w-full max-w-sm animate-rise rounded-3xl border border-border bg-surface p-7 shadow-lift">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            You&apos;re invited
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight break-words">
            {info?.name ?? 'Planning session'}
          </h1>
          {info && (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
              <Users className="size-4" />
              {info.participantCount === 0
                ? 'Be the first to join'
                : `${info.participantCount} ${info.participantCount === 1 ? 'person' : 'people'} in the room`}
              <span aria-hidden>·</span> {DECKS[info.deck].label}
            </p>
          )}
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <Field label="Your display name" error={error}>
              {(p) => (
                <Input
                  {...p}
                  autoFocus
                  value={value}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex"
                  maxLength={32}
                  autoComplete="nickname"
                />
              )}
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              Join room <ArrowRight className="size-4" />
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-subtle">
            No sign-up. Your seat is remembered on this device.
          </p>
        </div>
      </main>
    </div>
  );
}
