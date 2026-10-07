import type { z } from 'zod';
import type { DeckType } from './decks';
import type {
  addStoriesSchema,
  castVoteSchema,
  finalizeSchema,
  joinRoomSchema,
  nextStorySchema,
  participantRefSchema,
  renameSchema,
  reorderStoriesSchema,
  roundActionSchema,
  spectatorSchema,
  startTimerSchema,
  storyRefSchema,
  updateStorySchema,
} from './schemas';

/* ------------------------------------------------------------------ */
/* DTOs                                                                */
/* ------------------------------------------------------------------ */

export type StoryStatus = 'PENDING' | 'ACTIVE' | 'ESTIMATED';

export interface RoomInfo {
  id: string;
  name: string;
  deck: DeckType;
  createdAt: string;
  participantCount: number;
  storyCount: number;
}

export interface ParticipantDTO {
  id: string;
  name: string;
  isFacilitator: boolean;
  isSpectator: boolean;
  isOnline: boolean;
  hasVoted: boolean;
  /** Only populated once the round is revealed — or for your own seat. */
  vote: string | null;
  joinedAt: string;
}

export interface StoryDTO {
  id: string;
  title: string;
  description: string | null;
  link: string | null;
  position: number;
  status: StoryStatus;
  finalEstimate: string | null;
  estimatedAt: string | null;
}

export interface DistributionEntry {
  value: string;
  count: number;
  /** Share of all counted votes, 0..1. */
  ratio: number;
  participantIds: string[];
}

export interface RoundStats {
  /** All votes cast, including `?` and `☕`. */
  totalVotes: number;
  /** Votes that carry an estimate. */
  countedVotes: number;
  average: number | null;
  median: string | null;
  min: string | null;
  max: string | null;
  /** Most common value(s). */
  mode: string[];
  /** Share of counted votes that agree with the most common value, 0..1. */
  agreement: number;
  /** Every counted vote has the same value (and there are at least 2 voters). */
  consensus: boolean;
  /** The deck card the team most likely wants to commit to. */
  suggested: string | null;
  distribution: DistributionEntry[];
  /** Participants whose vote is ≥ 2 cards away from the median. */
  outlierIds: string[];
}

export interface RoundDTO {
  id: string;
  number: number;
  storyId: string | null;
  revealed: boolean;
  revealedAt: string | null;
  stats: RoundStats | null;
}

export interface TimerDTO {
  /** Epoch ms (server clock). */
  endsAt: number;
  durationSec: number;
}

export interface RoomStateDTO {
  /** Monotonic snapshot version — newer snapshots supersede older ones. */
  version: number;
  /** Server clock (epoch ms) at the time the snapshot was produced. */
  serverNow: number;
  room: {
    id: string;
    name: string;
    deck: DeckType;
    facilitatorId: string | null;
    createdAt: string;
  };
  me: { participantId: string };
  participants: ParticipantDTO[];
  stories: StoryDTO[];
  currentStoryId: string | null;
  round: RoundDTO | null;
  timer: TimerDTO | null;
}

export interface SummaryVote {
  participantName: string;
  value: string;
}

export interface SummaryRound {
  id: string;
  number: number;
  revealedAt: string | null;
  votes: SummaryVote[];
  stats: RoundStats | null;
}

export interface SummaryStory extends StoryDTO {
  rounds: SummaryRound[];
}

export interface RoomSummary {
  room: { id: string; name: string; deck: DeckType; createdAt: string };
  participants: { id: string; name: string }[];
  stories: SummaryStory[];
  totals: {
    stories: number;
    estimated: number;
    /** Sum of numeric final estimates (null for non-numeric decks). */
    points: number | null;
    rounds: number;
  };
}

/* ------------------------------------------------------------------ */
/* Socket contracts                                                    */
/* ------------------------------------------------------------------ */

export type ErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'NAME_REQUIRED'
  | 'REMOVED'
  | 'NOT_JOINED'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface AckError {
  code: ErrorCode;
  message: string;
}

export type Ack<T = null> = { ok: true; data: T } | { ok: false; error: AckError };
export type AckCallback<T = null> = (response: Ack<T>) => void;

export interface NoticePayload {
  kind: 'info' | 'success' | 'warning';
  message: string;
}

type In<S extends z.ZodType> = z.input<S>;

export interface ClientToServerEvents {
  'room:join': (
    payload: In<typeof joinRoomSchema>,
    ack: AckCallback<{ participantId: string; state: RoomStateDTO }>,
  ) => void;
  'room:sync': (payload: Record<string, never>, ack: AckCallback<RoomStateDTO>) => void;
  'vote:cast': (payload: In<typeof castVoteSchema>, ack: AckCallback) => void;
  'round:reveal': (payload: In<typeof roundActionSchema>, ack: AckCallback) => void;
  'round:reset': (payload: In<typeof roundActionSchema>, ack: AckCallback) => void;
  'round:finalize': (payload: In<typeof finalizeSchema>, ack: AckCallback) => void;
  'story:next': (payload: In<typeof nextStorySchema>, ack: AckCallback) => void;
  'story:select': (payload: In<typeof storyRefSchema>, ack: AckCallback) => void;
  'story:add': (payload: In<typeof addStoriesSchema>, ack: AckCallback) => void;
  'story:update': (payload: In<typeof updateStorySchema>, ack: AckCallback) => void;
  'story:delete': (payload: In<typeof storyRefSchema>, ack: AckCallback) => void;
  'story:reorder': (payload: In<typeof reorderStoriesSchema>, ack: AckCallback) => void;
  'participant:spectator': (payload: In<typeof spectatorSchema>, ack: AckCallback) => void;
  'participant:rename': (payload: In<typeof renameSchema>, ack: AckCallback) => void;
  'participant:remove': (payload: In<typeof participantRefSchema>, ack: AckCallback) => void;
  'facilitator:transfer': (payload: In<typeof participantRefSchema>, ack: AckCallback) => void;
  'timer:start': (payload: In<typeof startTimerSchema>, ack: AckCallback) => void;
  'timer:stop': (payload: Record<string, never>, ack: AckCallback) => void;
}

export interface ServerToClientEvents {
  'room:state': (state: RoomStateDTO) => void;
  'room:notice': (notice: NoticePayload) => void;
  'room:removed': (payload: { reason: string }) => void;
}

export type ClientEventName = keyof ClientToServerEvents;
