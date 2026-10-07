import { z } from 'zod';
import { DECK_TYPES } from './decks';

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export const ROOM_ID_PATTERN = /^[a-z0-9]{10}$/;

export const roomIdSchema = z.string().regex(ROOM_ID_PATTERN, 'Invalid room id');
export const entityIdSchema = z.string().min(1).max(64);

/** Random client-generated secret that identifies a guest across refreshes. */
export const guestTokenSchema = z
  .string()
  .min(20, 'Invalid guest token')
  .max(200, 'Invalid guest token');

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Please enter your name')
  .max(32, 'Name must be 32 characters or fewer');

export const roomNameSchema = z
  .string()
  .trim()
  .min(1, 'Please name your room')
  .max(60, 'Room name must be 60 characters or fewer');

export const deckTypeSchema = z.enum(DECK_TYPES);

/** Optional free text — blank strings become `undefined`. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || undefined)
    .optional();

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), {
    message: 'Link must start with http:// or https://',
  })
  .transform((v) => v || undefined)
  .optional();

/* ------------------------------------------------------------------ */
/* REST                                                                */
/* ------------------------------------------------------------------ */

export const createRoomSchema = z.object({
  name: roomNameSchema,
  deck: deckTypeSchema,
  facilitatorName: optionalText(32),
  guestToken: guestTokenSchema,
});
export type CreateRoomInput = z.input<typeof createRoomSchema>;
export type CreateRoomPayload = z.output<typeof createRoomSchema>;

/* ------------------------------------------------------------------ */
/* Socket payloads                                                     */
/* ------------------------------------------------------------------ */

export const joinRoomSchema = z.object({
  roomId: roomIdSchema,
  name: displayNameSchema.optional(),
});

export const castVoteSchema = z.object({
  roundId: entityIdSchema,
  /** `null` retracts the vote. */
  value: z.string().min(1).max(8).nullable(),
});

export const roundActionSchema = z.object({ roundId: entityIdSchema });

export const finalizeSchema = z.object({
  roundId: entityIdSchema,
  value: z.string().trim().min(1, 'Pick an estimate').max(8),
  /** Move on to the next pending story after saving. */
  advance: z.boolean().default(true),
});

export const nextStorySchema = z.object({
  /** The story the client believes is current — makes the event idempotent. */
  fromStoryId: entityIdSchema.nullable(),
});

export const storyInputSchema = z.object({
  title: z.string().trim().min(1, 'Story title is required').max(200),
  description: optionalText(2000),
  link: optionalUrl,
});
export type StoryInput = z.input<typeof storyInputSchema>;

export const addStoriesSchema = z.object({
  stories: z.array(storyInputSchema).min(1).max(50),
});

export const updateStorySchema = storyInputSchema.extend({ storyId: entityIdSchema });

export const storyRefSchema = z.object({ storyId: entityIdSchema });

export const reorderStoriesSchema = z.object({
  orderedIds: z.array(entityIdSchema).min(1).max(500),
});

export const spectatorSchema = z.object({ spectator: z.boolean() });

export const renameSchema = z.object({ name: displayNameSchema });

export const participantRefSchema = z.object({ participantId: entityIdSchema });

export const TIMER_PRESETS = [30, 60, 120, 180, 300] as const;

export const startTimerSchema = z.object({
  durationSec: z.number().int().min(10).max(1800),
});

export type JoinRoomPayload = z.output<typeof joinRoomSchema>;
export type CastVotePayload = z.output<typeof castVoteSchema>;
export type RoundActionPayload = z.output<typeof roundActionSchema>;
export type FinalizePayload = z.output<typeof finalizeSchema>;
export type NextStoryPayload = z.output<typeof nextStorySchema>;
export type AddStoriesPayload = z.output<typeof addStoriesSchema>;
export type UpdateStoryPayload = z.output<typeof updateStorySchema>;
export type StoryRefPayload = z.output<typeof storyRefSchema>;
export type ReorderStoriesPayload = z.output<typeof reorderStoriesSchema>;
export type SpectatorPayload = z.output<typeof spectatorSchema>;
export type RenamePayload = z.output<typeof renameSchema>;
export type ParticipantRefPayload = z.output<typeof participantRefSchema>;
export type StartTimerPayload = z.output<typeof startTimerSchema>;
