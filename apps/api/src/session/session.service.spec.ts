import { type TestingModule } from '@nestjs/testing';
import { createServiceModule, newToken } from '../../test/test-app';
import { hashToken } from '../common/ids';
import { RoomsService } from '../rooms/rooms.service';
import { type ActorContext, SessionService } from './session.service';

describe('SessionService (database)', () => {
  let moduleRef: TestingModule;
  let rooms: RoomsService;
  let session: SessionService;

  beforeAll(async () => {
    moduleRef = await createServiceModule();
    rooms = moduleRef.get(RoomsService);
    session = moduleRef.get(SessionService);
  });

  afterAll(() => moduleRef.close());

  /** A room with a facilitator, one voter and two stories. */
  async function setup() {
    const facToken = newToken();
    const info = await rooms.create({
      name: 'Room',
      deck: 'FIBONACCI',
      facilitatorName: 'Fac',
      guestToken: facToken,
    });
    const fac = await session.join(info.id, hashToken(facToken));
    const devToken = newToken();
    const dev = await session.join(info.id, hashToken(devToken), 'Dev');
    const facCtx: ActorContext = { roomId: info.id, participantId: fac.participantId };
    const devCtx: ActorContext = { roomId: info.id, participantId: dev.participantId };
    await session.addStories(facCtx, [{ title: 'A' }, { title: 'B' }, { title: 'C' }]);
    const room = await session.loadRoom(info.id);
    return { roomId: info.id, facCtx, devCtx, devToken, room, roundId: room.currentRoundId! };
  }

  const online = () => true;

  it('keeps the same seat for the same guest token (idempotent join)', async () => {
    const { roomId, devToken, devCtx } = await setup();
    const again = await session.join(roomId, hashToken(devToken));
    expect(again).toEqual({ participantId: devCtx.participantId, isNew: false });
    const renamed = await session.join(roomId, hashToken(devToken), 'Dev 2');
    expect(renamed.participantId).toBe(devCtx.participantId);
    const room = await session.loadRoom(roomId);
    expect(room.participants.find((p) => p.id === devCtx.participantId)!.name).toBe('Dev 2');
  });

  it('requires a name for brand new guests', async () => {
    const { roomId } = await setup();
    await expect(session.join(roomId, hashToken(newToken()))).rejects.toMatchObject({
      code: 'NAME_REQUIRED',
    });
  });

  it('adopts the first added story into the empty opening round', async () => {
    const { room } = await setup();
    expect(room.currentRound!.storyId).toBe(room.stories[0]!.id);
    expect(room.stories.map((s) => s.status)).toEqual(['ACTIVE', 'PENDING', 'PENDING']);
  });

  it('hides other votes until reveal but shows your own', async () => {
    const { roomId, facCtx, devCtx, roundId } = await setup();
    await session.castVote(devCtx, roundId, '8');
    await session.castVote(facCtx, roundId, '5');

    const room = await session.loadRoom(roomId);
    const facView = session.buildState(room, facCtx.participantId, online);
    const dev = facView.participants.find((p) => p.id === devCtx.participantId)!;
    expect(dev).toMatchObject({ hasVoted: true, vote: null });
    expect(facView.participants.find((p) => p.id === facCtx.participantId)!.vote).toBe('5');
    expect(facView.round!.stats).toBeNull();

    await session.reveal(facCtx, roundId);
    const revealed = session.buildState(
      await session.loadRoom(roomId),
      facCtx.participantId,
      online,
    );
    expect(revealed.participants.find((p) => p.id === devCtx.participantId)!.vote).toBe('8');
    expect(revealed.round!.stats).toMatchObject({ average: 6.5, countedVotes: 2 });
  });

  it('upserts votes, supports retracting and rejects cards outside the deck', async () => {
    const { roomId, devCtx, roundId } = await setup();
    await session.castVote(devCtx, roundId, '3');
    await session.castVote(devCtx, roundId, '13');
    let room = await session.loadRoom(roomId);
    expect(room.currentRound!.votes).toHaveLength(1);
    expect(room.currentRound!.votes[0]!.value).toBe('13');

    await session.castVote(devCtx, roundId, null);
    room = await session.loadRoom(roomId);
    expect(room.currentRound!.votes).toHaveLength(0);

    await expect(session.castVote(devCtx, roundId, '4')).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });

  it('only lets the facilitator run the session', async () => {
    const { devCtx, roundId } = await setup();
    await expect(session.reveal(devCtx, roundId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(session.addStories(devCtx, [{ title: 'X' }])).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('treats repeated reveal / next-story events as no-ops', async () => {
    const { roomId, facCtx, devCtx, roundId, room } = await setup();
    await session.castVote(devCtx, roundId, '5');
    expect(await session.reveal(facCtx, roundId)).toBe(true);
    expect(await session.reveal(facCtx, roundId)).toBe(false);

    const first = room.stories[0]!.id;
    expect(await session.nextStory(facCtx, first)).toBe(true);
    // A double click sends the same `fromStoryId` again — must not skip story B.
    expect(await session.nextStory(facCtx, first)).toBe(false);
    const after = await session.loadRoom(roomId);
    expect(after.currentRound!.storyId).toBe(room.stories[1]!.id);
    expect(after.stories.map((s) => s.status)).toEqual(['PENDING', 'ACTIVE', 'PENDING']);
  });

  it('rejects votes for a round that is no longer current', async () => {
    const { facCtx, devCtx, roundId, room } = await setup();
    await session.nextStory(facCtx, room.stories[0]!.id);
    await expect(session.castVote(devCtx, roundId, '5')).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('re-vote clears an unrevealed round and starts a new round after reveal', async () => {
    const { roomId, facCtx, devCtx, roundId } = await setup();
    await session.castVote(devCtx, roundId, '5');
    await session.resetRound(facCtx, roundId);
    let room = await session.loadRoom(roomId);
    expect(room.currentRoundId).toBe(roundId);
    expect(room.currentRound!.votes).toHaveLength(0);

    await session.castVote(devCtx, roundId, '5');
    await session.reveal(facCtx, roundId);
    await session.resetRound(facCtx, roundId);
    room = await session.loadRoom(roomId);
    expect(room.currentRoundId).not.toBe(roundId);
    expect(room.currentRound).toMatchObject({ number: 2, revealedAt: null });
  });

  it('finalizes, advances, and falls back to a free round when all stories are done', async () => {
    const { roomId, facCtx, devCtx } = await setup();
    for (const value of ['3', '5', '8']) {
      const room = await session.loadRoom(roomId);
      await session.castVote(devCtx, room.currentRoundId!, value);
      await expect(
        session.finalize(facCtx, { roundId: room.currentRoundId!, value, advance: true }),
      ).rejects.toMatchObject({ code: 'CONFLICT' }); // must reveal first
      await session.reveal(facCtx, room.currentRoundId!);
      await session.finalize(facCtx, { roundId: room.currentRoundId!, value, advance: true });
    }
    const room = await session.loadRoom(roomId);
    expect(room.stories.map((s) => [s.title, s.finalEstimate, s.status])).toEqual([
      ['A', '3', 'ESTIMATED'],
      ['B', '5', 'ESTIMATED'],
      ['C', '8', 'ESTIMATED'],
    ]);
    expect(room.currentRound!.storyId).toBeNull();
  });

  it('moves on when the current story is deleted and reorders stories', async () => {
    const { roomId, facCtx, room } = await setup();
    const [a, b, c] = room.stories;
    await session.deleteStory(facCtx, a!.id);
    expect(await session.deleteStory(facCtx, a!.id)).toBe(false);
    let after = await session.loadRoom(roomId);
    expect(after.currentRound!.storyId).toBe(b!.id);

    await session.reorderStories(facCtx, [c!.id, b!.id]);
    after = await session.loadRoom(roomId);
    expect(after.stories.map((s) => s.title)).toEqual(['C', 'B']);
    await expect(session.reorderStories(facCtx, [c!.id])).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('spectators cannot vote and their pending vote is withdrawn', async () => {
    const { roomId, devCtx, roundId } = await setup();
    await session.castVote(devCtx, roundId, '5');
    await session.setSpectator(devCtx, true);
    const room = await session.loadRoom(roomId);
    expect(room.currentRound!.votes).toHaveLength(0);
    await expect(session.castVote(devCtx, roundId, '5')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('removes participants and blocks them from rejoining', async () => {
    const { roomId, facCtx, devCtx, devToken } = await setup();
    await expect(session.removeParticipant(facCtx, facCtx.participantId)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await session.removeParticipant(facCtx, devCtx.participantId);
    await expect(session.join(roomId, hashToken(devToken))).rejects.toMatchObject({
      code: 'REMOVED',
    });
    const room = await session.loadRoom(roomId);
    expect(room.participants.map((p) => p.id)).toEqual([facCtx.participantId]);
  });

  it('transfers the facilitator role and reassigns it when the facilitator is offline', async () => {
    const { roomId, facCtx, devCtx } = await setup();
    await session.transferFacilitator(facCtx, devCtx.participantId);
    expect((await session.loadRoom(roomId)).facilitatorId).toBe(devCtx.participantId);
    await expect(session.reveal(facCtx, 'x')).rejects.toMatchObject({ code: 'FORBIDDEN' });

    // Dev goes offline; Fac is the only one online.
    const result = await session.reassignFacilitator(roomId, (id) => id === facCtx.participantId);
    expect(result).toEqual({ name: 'Fac' });
    expect((await session.loadRoom(roomId)).facilitatorId).toBe(facCtx.participantId);
    // Nobody online: nothing to do.
    expect(await session.reassignFacilitator(roomId, () => false)).toBeNull();
  });

  it('expires timers by revealing rounds that have votes', async () => {
    const { roomId, facCtx, devCtx, roundId } = await setup();
    await session.castVote(devCtx, roundId, '5');
    await session.startTimer(facCtx, 10);
    expect(await session.expireTimer(roomId)).toBeNull(); // not due yet

    // Fast-forward: pretend the timer is due.
    await moduleRef.get(RoomsService)['prisma'].room.update({
      where: { id: roomId },
      data: { timerEndsAt: new Date(Date.now() - 1000) },
    });
    expect(await session.expireTimer(roomId)).toEqual({ revealed: true });
    const room = await session.loadRoom(roomId);
    expect(room.currentRound!.revealedAt).not.toBeNull();
    expect(room.timerEndsAt).toBeNull();
  });
});
