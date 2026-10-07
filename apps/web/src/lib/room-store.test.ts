import type { RoomStateDTO } from '@pokerplan/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { selectIsFacilitator, selectMyVote, useRoomStore } from './room-store';

function state(version: number, vote: string | null = null): RoomStateDTO {
  return {
    version,
    serverNow: Date.now() + 1000,
    room: { id: 'abcdefghij', name: 'R', deck: 'FIBONACCI', facilitatorId: 'me', createdAt: '' },
    me: { participantId: 'me' },
    participants: [
      {
        id: 'me',
        name: 'Me',
        isFacilitator: true,
        isSpectator: false,
        isOnline: true,
        hasVoted: vote !== null,
        vote,
        joinedAt: '',
      },
    ],
    stories: [],
    currentStoryId: null,
    round: { id: 'r1', number: 1, storyId: null, revealed: false, revealedAt: null, stats: null },
    timer: null,
  };
}

describe('room store', () => {
  beforeEach(() => useRoomStore.getState().reset('abcdefghij'));

  it('ignores snapshots older than the current one', () => {
    useRoomStore.getState().applyState(state(10, '5'));
    useRoomStore.getState().applyState(state(9, '3'));
    expect(selectMyVote(useRoomStore.getState())).toBe('5');
  });

  it('tracks the server clock offset', () => {
    useRoomStore.getState().applyState(state(1));
    expect(useRoomStore.getState().clockOffset).toBeGreaterThan(900);
  });

  it('prefers an in-flight optimistic vote for the current round', () => {
    useRoomStore.getState().applyState(state(1, '3'));
    useRoomStore.getState().setOptimisticVote({ roundId: 'r1', value: '8' });
    expect(selectMyVote(useRoomStore.getState())).toBe('8');
    useRoomStore.getState().setOptimisticVote({ roundId: 'old', value: '13' });
    expect(selectMyVote(useRoomStore.getState())).toBe('3');
  });

  it('derives the facilitator flag', () => {
    useRoomStore.getState().applyState(state(1));
    expect(selectIsFacilitator(useRoomStore.getState())).toBe(true);
  });
});
