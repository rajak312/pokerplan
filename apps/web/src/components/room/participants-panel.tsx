'use client';

import { displayNameSchema, type ParticipantDTO } from '@pokerplan/shared';
import { Check, Crown, Eye, MoreHorizontal, Pencil, UserMinus, Vote } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { Menu, type MenuItem } from '@/components/ui/menu';
import { Avatar, Panel } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { saveName } from '@/lib/guest';
import { roomActions } from '@/lib/room-actions';
import { selectIsFacilitator, selectMe, useRoomStore } from '@/lib/room-store';

export function ParticipantsPanel() {
  const participants = useRoomStore((s) => s.state!.participants);
  const meId = useRoomStore((s) => s.state!.me.participantId);
  const me = useRoomStore(selectMe);
  const isFacilitator = useRoomStore(selectIsFacilitator);
  const revealed = useRoomStore((s) => s.state!.round?.revealed ?? false);
  const [renaming, setRenaming] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<ParticipantDTO | null>(null);

  // Online first, then by join order — keeps the list stable while people vote.
  const sorted = [...participants].sort((a, b) => Number(b.isOnline) - Number(a.isOnline));
  const online = participants.filter((p) => p.isOnline).length;

  return (
    <Panel>
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <h2 className="text-sm font-semibold">
          Participants{' '}
          <span className="ml-1 font-normal text-muted tabular-nums">
            {online}/{participants.length}
          </span>
        </h2>
      </div>
      <ul className="max-h-[50vh] divide-y divide-border/70 overflow-y-auto xl:max-h-[calc(100dvh-330px)]">
        {sorted.map((p) => {
          const isMe = p.id === meId;
          const items: MenuItem[] = [];
          if (isMe) {
            items.push({
              label: 'Change my name',
              icon: <Pencil />,
              onSelect: () => setRenaming(true),
            });
          }
          if (isFacilitator && !isMe) {
            items.push(
              {
                label: 'Make facilitator',
                icon: <Crown />,
                onSelect: () => void roomActions.transfer(p.id),
              },
              {
                label: 'Remove from room',
                icon: <UserMinus />,
                danger: true,
                onSelect: () => setConfirmRemove(p),
              },
            );
          }
          return (
            <li
              key={p.id}
              className={cn('flex items-center gap-3 px-4 py-2.5', !p.isOnline && 'opacity-60')}
            >
              <span className="relative">
                <Avatar id={p.id} name={p.name} className="size-8 text-[11px]" />
                <span
                  className={cn(
                    'absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-surface',
                    p.isOnline ? 'bg-success' : 'bg-subtle',
                  )}
                  aria-label={p.isOnline ? 'online' : 'offline'}
                  role="img"
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">{p.name}</span>
                  {isMe && <span className="shrink-0 text-xs font-normal text-subtle">(you)</span>}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted">
                  {p.isFacilitator && (
                    <span className="inline-flex items-center gap-1 text-warning">
                      <Crown className="size-3" /> Facilitator
                    </span>
                  )}
                  {p.isFacilitator && (p.isSpectator || !p.isOnline) && <span aria-hidden>·</span>}
                  {p.isSpectator ? (
                    <span className="inline-flex items-center gap-1">
                      <Eye className="size-3" /> Spectator
                    </span>
                  ) : !p.isOnline ? (
                    'Offline'
                  ) : !p.isFacilitator ? (
                    'Voter'
                  ) : null}
                </p>
              </div>
              {!p.isSpectator && (
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition',
                    p.hasVoted
                      ? revealed
                        ? 'w-auto min-w-6 bg-primary-soft px-1.5 text-primary'
                        : 'bg-success-soft text-success'
                      : 'border border-dashed border-border-strong',
                  )}
                  aria-label={
                    p.hasVoted ? (revealed ? `voted ${p.vote}` : 'voted') : 'not voted yet'
                  }
                  title={p.hasVoted ? 'Voted' : 'Not voted yet'}
                >
                  {p.hasVoted &&
                    (revealed ? p.vote : <Check className="size-3.5" strokeWidth={3} />)}
                </span>
              )}
              {items.length > 0 ? (
                <Menu
                  items={items}
                  trigger={(t) => (
                    <button
                      {...t}
                      type="button"
                      className="-mr-1.5 rounded-md p-1 text-subtle transition hover:bg-surface-2 hover:text-fg"
                      aria-label={`Actions for ${p.name}`}
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  )}
                />
              ) : (
                <span className="w-5" aria-hidden />
              )}
            </li>
          );
        })}
      </ul>
      {me && (
        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={() => void roomActions.setSpectator(!me.isSpectator)}
            className="flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-sm transition hover:bg-surface-2"
            role="switch"
            aria-checked={me.isSpectator}
          >
            <span className="flex items-center gap-2">
              {me.isSpectator ? (
                <Eye className="size-4 text-muted" />
              ) : (
                <Vote className="size-4 text-muted" />
              )}
              Spectator mode
            </span>
            <span
              className={cn(
                'relative h-5 w-9 rounded-full transition',
                me.isSpectator ? 'bg-primary' : 'bg-surface-3',
              )}
              aria-hidden
            >
              <span
                className={cn(
                  'absolute top-0.5 size-4 rounded-full bg-white shadow transition-all',
                  me.isSpectator ? 'left-[18px]' : 'left-0.5',
                )}
              />
            </span>
          </button>
        </div>
      )}

      {me && <RenameDialog open={renaming} onClose={() => setRenaming(false)} current={me.name} />}
      <Dialog
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        title={`Remove ${confirmRemove?.name ?? ''}?`}
        description="They’ll be disconnected and won’t be able to rejoin this room with this device."
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmRemove(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (confirmRemove) void roomActions.remove(confirmRemove.id);
              setConfirmRemove(null);
            }}
          >
            Remove
          </Button>
        </div>
      </Dialog>
    </Panel>
  );
}

function RenameDialog({
  open,
  onClose,
  current,
}: {
  open: boolean;
  onClose: () => void;
  current: string;
}) {
  const [name, setName] = useState(current);
  const [error, setError] = useState<string>();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    if (await roomActions.rename(parsed.data)) {
      saveName(parsed.data);
      onClose();
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Change your name">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Display name" error={error}>
          {(p) => (
            <Input
              {...p}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
            />
          )}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Dialog>
  );
}
