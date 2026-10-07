'use client';

import { DECKS, DECK_TYPES, createRoomSchema, valueCards, type DeckType } from '@pokerplan/shared';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { getGuestToken, getSavedName, saveName } from '@/lib/guest';

const noop = () => () => {};

export function CreateRoomForm() {
  const router = useRouter();
  const savedName = useSyncExternalStore(noop, getSavedName, () => '');
  const [name, setName] = useState('');
  const [deck, setDeck] = useState<DeckType>('FIBONACCI');
  const [facilitatorName, setFacilitatorName] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();

  const create = useMutation({
    mutationFn: api.createRoom,
    onSuccess: (room, input) => {
      if (input.facilitatorName) saveName(input.facilitatorName);
      router.push(`/r/${room.id}`);
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input = {
      name,
      deck,
      facilitatorName: facilitatorName ?? savedName,
      guestToken: getGuestToken(),
    };
    const parsed = createRoomSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    create.mutate(input);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Field label="Room name" error={error}>
        {(p) => (
          <Input
            {...p}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sprint 24 refinement"
            maxLength={60}
            autoComplete="off"
          />
        )}
      </Field>

      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-sm font-medium">Card deck</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {DECK_TYPES.map((type) => {
            const d = DECKS[type];
            const selected = deck === type;
            return (
              <label
                key={type}
                className={cn(
                  'relative flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3 transition',
                  selected
                    ? 'border-primary bg-primary-soft/60 ring-1 ring-primary'
                    : 'border-border bg-surface hover:border-border-strong',
                )}
              >
                <input
                  type="radio"
                  name="deck"
                  value={type}
                  checked={selected}
                  onChange={() => setDeck(type)}
                  className="sr-only"
                />
                <span className="flex items-center justify-between text-[13px] font-semibold">
                  {d.label}
                  <span
                    className={cn(
                      'flex size-4 items-center justify-center rounded-full border transition',
                      selected
                        ? 'border-primary bg-primary text-primary-fg'
                        : 'border-border-strong',
                    )}
                    aria-hidden
                  >
                    {selected && <Check className="size-3" strokeWidth={3} />}
                  </span>
                </span>
                <span className="flex gap-1" aria-hidden>
                  {valueCards(type)
                    .slice(0, 6)
                    .map((c) => (
                      <span
                        key={c}
                        className="flex h-6 min-w-5 items-center justify-center rounded-[5px] border border-border bg-surface px-1 font-mono text-[10px] font-semibold text-muted"
                      >
                        {c}
                      </span>
                    ))}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <Field
        label="Your name"
        optional
        hint="You'll be the facilitator. Leave empty to choose when you join."
      >
        {(p) => (
          <Input
            {...p}
            value={facilitatorName ?? savedName}
            onChange={(e) => setFacilitatorName(e.target.value)}
            placeholder="e.g. Priya"
            maxLength={32}
            autoComplete="nickname"
          />
        )}
      </Field>

      {create.isError && (
        <p
          className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-sm text-danger"
          role="alert"
        >
          {create.error.message}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={create.isPending || create.isSuccess}
      >
        Create room <ArrowRight className="size-4" />
      </Button>
      <p className="text-center text-xs text-subtle">
        No account needed. Anyone with the link can join.
      </p>
    </form>
  );
}
