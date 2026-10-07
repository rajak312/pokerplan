import type { Ack, ClientEventName, ClientToServerEvents, StoryInput } from '@pokerplan/shared';
import { toast } from 'sonner';
import { emitWithAck, type AppSocket } from './socket';
import { useRoomStore } from './room-store';

let activeSocket: AppSocket | null = null;

export function setActiveSocket(socket: AppSocket | null): void {
  activeSocket = socket;
}

type PayloadOf<E extends ClientEventName> = Parameters<ClientToServerEvents[E]>[0];

/** Sends an action; surfaces failures as toasts. Resolves `true` on success. */
async function send<E extends ClientEventName>(event: E, payload: PayloadOf<E>): Promise<boolean> {
  if (!activeSocket?.connected) {
    toast.error('You are offline — reconnecting…');
    return false;
  }
  const ack = (await emitWithAck(activeSocket, event, payload)) as Ack<unknown>;
  if (!ack.ok) {
    toast.error(ack.error.message);
    return false;
  }
  return true;
}

const store = () => useRoomStore.getState();
const roundId = () => store().state?.round?.id ?? '';

/** Every live-session command, typed end-to-end through `@pokerplan/shared`. */
export const roomActions = {
  async vote(value: string | null): Promise<void> {
    const id = roundId();
    if (!id) return;
    store().setOptimisticVote({ roundId: id, value });
    const ok = await send('vote:cast', { roundId: id, value });
    if (!ok) store().setOptimisticVote(null);
  },
  reveal: () => send('round:reveal', { roundId: roundId() }),
  reset: () => send('round:reset', { roundId: roundId() }),
  finalize: (value: string, advance = true) =>
    send('round:finalize', { roundId: roundId(), value, advance }),
  next: () => send('story:next', { fromStoryId: store().state?.currentStoryId ?? null }),
  select: (storyId: string) => send('story:select', { storyId }),
  addStories: (stories: StoryInput[]) => send('story:add', { stories }),
  updateStory: (storyId: string, story: StoryInput) => send('story:update', { storyId, ...story }),
  deleteStory: (storyId: string) => send('story:delete', { storyId }),
  reorder: (orderedIds: string[]) => send('story:reorder', { orderedIds }),
  setSpectator: (spectator: boolean) => send('participant:spectator', { spectator }),
  rename: (name: string) => send('participant:rename', { name }),
  remove: (participantId: string) => send('participant:remove', { participantId }),
  transfer: (participantId: string) => send('facilitator:transfer', { participantId }),
  startTimer: (durationSec: number) => send('timer:start', { durationSec }),
  stopTimer: () => send('timer:stop', {}),
};
