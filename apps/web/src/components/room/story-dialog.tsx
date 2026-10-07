'use client';

import { storyInputSchema, type StoryDTO, type StoryInput } from '@pokerplan/shared';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { roomActions } from '@/lib/room-actions';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Edit mode when provided. */
  story?: StoryDTO;
}

/** Add one story (with link/description), paste many at once, or edit an existing story. */
export function StoryDialog({ open, onClose, story }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={story ? 'Edit story' : 'Add stories'}
      description={story ? undefined : 'Build the queue your team will estimate, in order.'}
    >
      {open && <StoryForm story={story} onDone={onClose} />}
    </Dialog>
  );
}

function StoryForm({ story, onDone }: { story?: StoryDTO; onDone: () => void }) {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [title, setTitle] = useState(story?.title ?? '');
  const [link, setLink] = useState(story?.link ?? '');
  const [description, setDescription] = useState(story?.description ?? '');
  const [bulk, setBulk] = useState('');
  const [errors, setErrors] = useState<
    Partial<Record<'title' | 'link' | 'description' | 'bulk', string>>
  >({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    let stories: StoryInput[];
    if (mode === 'bulk') {
      stories = bulk
        .split('\n')
        .map((l) => l.replace(/^\s*([-*•]|\d+[.)])\s*/, '').trim())
        .filter(Boolean)
        .map((t) => ({ title: t.slice(0, 200) }));
      if (stories.length === 0) return setErrors({ bulk: 'Paste at least one story title' });
      if (stories.length > 50) return setErrors({ bulk: 'Add up to 50 stories at a time' });
    } else {
      const parsed = storyInputSchema.safeParse({ title, link, description });
      if (!parsed.success) {
        const next: typeof errors = {};
        for (const issue of parsed.error.issues) next[issue.path[0] as 'title'] ??= issue.message;
        return setErrors(next);
      }
      stories = [{ title, link, description }];
    }
    setErrors({});
    setBusy(true);
    const ok = story
      ? await roomActions.updateStory(story.id, stories[0]!)
      : await roomActions.addStories(stories);
    setBusy(false);
    if (ok) onDone();
  };

  const count = bulk.split('\n').filter((l) => l.trim()).length;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {!story && (
        <div className="grid grid-cols-2 rounded-xl bg-surface-2 p-1 text-sm" role="tablist">
          {(['single', 'bulk'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                'rounded-lg py-1.5 font-medium transition',
                mode === m ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
              )}
            >
              {m === 'single' ? 'One story' : 'Paste a list'}
            </button>
          ))}
        </div>
      )}

      {mode === 'single' ? (
        <>
          <Field label="Title" error={errors.title}>
            {(p) => (
              <Input
                {...p}
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="As a user, I can reset my password"
              />
            )}
          </Field>
          <Field label="Link" optional error={errors.link} hint="Jira, Linear, GitHub issue…">
            {(p) => (
              <Input
                {...p}
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://"
              />
            )}
          </Field>
          <Field label="Notes" optional error={errors.description}>
            {(p) => (
              <Textarea
                {...p}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Acceptance criteria, context, open questions…"
              />
            )}
          </Field>
        </>
      ) : (
        <Field
          label="Story titles"
          error={errors.bulk}
          hint={
            count
              ? `${count} ${count === 1 ? 'story' : 'stories'} will be added`
              : 'One per line — bullets and numbering are removed.'
          }
        >
          {(p) => (
            <Textarea
              {...p}
              autoFocus
              rows={7}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder={'Login with Google\nShow order history\nExport invoices as PDF'}
            />
          )}
        </Field>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {story
            ? 'Save changes'
            : mode === 'bulk' && count > 1
              ? `Add ${count} stories`
              : 'Add story'}
        </Button>
      </div>
    </form>
  );
}
