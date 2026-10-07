'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { StoryDTO } from '@pokerplan/shared';
import { GripVertical, ListTodo, MoreHorizontal, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Menu } from '@/components/ui/menu';
import { Panel } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { roomActions } from '@/lib/room-actions';
import { selectIsFacilitator, useRoomStore } from '@/lib/room-store';
import { StoryDialog } from './story-dialog';

export function StoriesPanel() {
  const stories = useRoomStore((s) => s.state!.stories);
  const currentId = useRoomStore((s) => s.state!.currentStoryId);
  const isFacilitator = useRoomStore(selectIsFacilitator);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<StoryDTO | null>(null);
  const [deleting, setDeleting] = useState<StoryDTO | null>(null);
  // Optimistic order while the server confirms a drag.
  const [localOrder, setLocalOrder] = useState<{ base: StoryDTO[]; ids: string[] } | null>(null);

  const ordered = useMemo(() => {
    if (!localOrder || localOrder.base !== stories) return stories;
    const byId = new Map(stories.map((s) => [s.id, s]));
    return localOrder.ids.map((id) => byId.get(id)).filter((s): s is StoryDTO => Boolean(s));
  }, [stories, localOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = ordered.map((s) => s.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setLocalOrder({ base: stories, ids: next });
    void roomActions.reorder(next);
  };

  const estimated = stories.filter((s) => s.status === 'ESTIMATED').length;

  return (
    <Panel>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Stories</h2>
          <p className="text-xs text-muted tabular-nums">
            {stories.length === 0
              ? 'Queue is empty'
              : `${estimated} of ${stories.length} estimated`}
          </p>
        </div>
        {isFacilitator && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" /> Add
          </Button>
        )}
      </div>

      {stories.length > 0 && (
        <div className="h-1 bg-surface-2" aria-hidden>
          <div
            className="h-full bg-success transition-all duration-500"
            style={{ width: `${(estimated / stories.length) * 100}%` }}
          />
        </div>
      )}

      {stories.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-surface-2 text-muted">
            <ListTodo className="size-5" />
          </span>
          <p className="mt-3 text-sm font-medium">No stories yet</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {isFacilitator
              ? 'Add the backlog items you want to estimate. You can paste a whole list at once.'
              : 'The facilitator hasn’t added stories yet.'}
          </p>
          {isFacilitator && (
            <Button size="sm" className="mt-4" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" /> Add stories
            </Button>
          )}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ordered.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ol className="max-h-[60vh] space-y-1 overflow-y-auto p-2 lg:max-h-[calc(100dvh-260px)]">
              {ordered.map((story, i) => (
                <StoryRow
                  key={story.id}
                  story={story}
                  index={i}
                  current={story.id === currentId}
                  canEdit={isFacilitator}
                  onEdit={() => setEditing(story)}
                  onDelete={() => setDeleting(story)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <StoryDialog open={adding} onClose={() => setAdding(false)} />
      <StoryDialog
        open={editing !== null}
        story={editing ?? undefined}
        onClose={() => setEditing(null)}
      />
      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete story?"
        description={`“${deleting?.title ?? ''}” and its voting history will be permanently deleted.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (deleting) void roomActions.deleteStory(deleting.id);
              setDeleting(null);
            }}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </Panel>
  );
}

function StoryRow({
  story,
  index,
  current,
  canEdit,
  onEdit,
  onDelete,
}: {
  story: StoryDTO;
  index: number;
  current: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: story.id,
    disabled: !canEdit,
  });
  const done = story.status === 'ESTIMATED';

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group relative flex items-start gap-2 rounded-xl border px-2 py-2.5 transition-colors',
        current
          ? 'border-primary/50 bg-primary-soft/70 shadow-[inset_3px_0_0_var(--primary)]'
          : 'border-transparent hover:bg-surface-2',
        isDragging && 'z-10 border-border bg-surface shadow-lift',
      )}
      aria-current={current ? 'step' : undefined}
    >
      {canEdit ? (
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          type="button"
          className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-subtle opacity-60 transition group-hover:opacity-100 hover:text-fg active:cursor-grabbing"
          aria-label={`Reorder “${story.title}”`}
        >
          <GripVertical className="size-4" />
        </button>
      ) : (
        <span className="w-1" />
      )}
      <span
        className={cn(
          'mt-px flex size-5 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-semibold',
          current ? 'bg-primary text-primary-fg' : 'bg-surface-3 text-muted',
        )}
      >
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-[13px] leading-snug font-medium break-words',
            done && !current && 'text-muted',
          )}
        >
          {story.title}
        </p>
        {current && <p className="mt-0.5 text-[11px] font-semibold text-primary">Estimating now</p>}
      </div>
      {story.finalEstimate && (
        <span
          className="shrink-0 rounded-md bg-success-soft px-1.5 py-0.5 font-mono text-xs font-bold text-success"
          title="Final estimate"
        >
          {story.finalEstimate}
        </span>
      )}
      {canEdit && (
        <Menu
          items={[
            ...(!current
              ? [
                  {
                    label: done ? 'Re-estimate' : 'Estimate now',
                    icon: <Play />,
                    onSelect: () => void roomActions.select(story.id),
                  },
                ]
              : []),
            { label: 'Edit', icon: <Pencil />, onSelect: onEdit },
            { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: onDelete },
          ]}
          trigger={(t) => (
            <button
              {...t}
              type="button"
              className="-my-0.5 rounded-md p-1 text-subtle opacity-0 transition group-hover:opacity-100 hover:bg-surface-3 hover:text-fg focus-visible:opacity-100 aria-expanded:opacity-100 max-lg:opacity-100"
              aria-label={`Actions for “${story.title}”`}
            >
              <MoreHorizontal className="size-4" />
            </button>
          )}
        />
      )}
    </li>
  );
}
