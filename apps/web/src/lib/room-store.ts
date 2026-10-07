import type { RoomStateDTO } from '@pokerplan/shared';
import { create } from 'zustand';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting';
export type JoinStatus = 'pending' | 'needs-name' | 'joined' | 'removed' | 'not-found' | 'error';

interface RoomStore {
  roomId: string | null;
  connection: ConnectionStatus;
  /** True once the socket has connected at least once (distinguishes cold start from reconnect). */
  everConnected: boolean;
  join: JoinStatus;
  joinError: string | null;
  state: RoomStateDTO | null;
  /** serverNow − clientNow, used to render timers in server time. */
  clockOffset: number;
  /** Vote shown immediately while the server confirms it. */
  optimisticVote: { roundId: string; value: string | null } | null;

  reset: (roomId: string) => void;
  setConnection: (status: ConnectionStatus) => void;
  setJoin: (status: JoinStatus, error?: string | null) => void;
  applyState: (state: RoomStateDTO) => void;
  setOptimisticVote: (vote: { roundId: string; value: string | null } | null) => void;
}

export const useRoomStore = create<RoomStore>()((set, get) => ({
  roomId: null,
  connection: 'connecting',
  everConnected: false,
  join: 'pending',
  joinError: null,
  state: null,
  clockOffset: 0,
  optimisticVote: null,

  reset: (roomId) =>
    set({
      roomId,
      connection: 'connecting',
      everConnected: false,
      join: 'pending',
      joinError: null,
      state: null,
      clockOffset: 0,
      optimisticVote: null,
    }),

  setConnection: (connection) =>
    set((s) => ({ connection, everConnected: s.everConnected || connection === 'connected' })),

  setJoin: (join, joinError = null) => set({ join, joinError }),

  applyState: (state) => {
    const current = get().state;
    // Snapshots are versioned by the server; never let a late packet roll state back.
    if (current && current.room.id === state.room.id && state.version < current.version) return;
    const optimistic = get().optimisticVote;
    set({
      state,
      clockOffset: state.serverNow - Date.now(),
      optimisticVote: optimistic && optimistic.roundId === state.round?.id ? optimistic : null,
    });
  },

  setOptimisticVote: (optimisticVote) => set({ optimisticVote }),
}));

/* ------------------------------------------------------------------ */
/* Derived selectors                                                   */
/* ------------------------------------------------------------------ */

export function selectMe(s: Pick<RoomStore, 'state'>) {
  const state = s.state;
  return state?.participants.find((p) => p.id === state.me.participantId) ?? null;
}

export function selectIsFacilitator(s: Pick<RoomStore, 'state'>): boolean {
  return Boolean(s.state && s.state.room.facilitatorId === s.state.me.participantId);
}

export function selectCurrentStory(s: Pick<RoomStore, 'state'>) {
  const state = s.state;
  return state?.stories.find((st) => st.id === state.currentStoryId) ?? null;
}

/** The card this viewer has selected, preferring an in-flight optimistic vote. */
export function selectMyVote(s: Pick<RoomStore, 'state' | 'optimisticVote'>): string | null {
  if (s.optimisticVote && s.optimisticVote.roundId === s.state?.round?.id) {
    return s.optimisticVote.value;
  }
  return selectMe(s)?.vote ?? null;
}
