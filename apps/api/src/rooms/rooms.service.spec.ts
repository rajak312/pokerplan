import { type TestingModule } from '@nestjs/testing';
import { createServiceModule, newToken } from '../../test/test-app';
import { hashToken } from '../common/ids';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { RoomsService } from './rooms.service';

describe('RoomsService (database)', () => {
  let moduleRef: TestingModule;
  let rooms: RoomsService;
  let session: SessionService;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleRef = await createServiceModule();
    rooms = moduleRef.get(RoomsService);
    session = moduleRef.get(SessionService);
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(() => moduleRef.close());

  it('creates a room with an open first round and the facilitator seat', async () => {
    const token = newToken();
    const info = await rooms.create({
      name: 'Sprint 1',
      deck: 'FIBONACCI',
      facilitatorName: 'Asha',
      guestToken: token,
    });

    expect(info.id).toMatch(/^[a-z0-9]{10}$/);
    expect(info.participantCount).toBe(1);

    const room = await session.loadRoom(info.id);
    expect(room.currentRound).toMatchObject({ number: 1, storyId: null, revealedAt: null });
    expect(room.participants).toHaveLength(1);
    expect(room.facilitatorId).toBe(room.participants[0]!.id);
    // Only the hash of the guest token is stored.
    expect(room.creatorTokenHash).toBe(hashToken(token));
    expect(room.participants[0]!.tokenHash).not.toBe(token);
  });

  it('defers the facilitator seat until the creator joins when no name is given', async () => {
    const token = newToken();
    const info = await rooms.create({ name: 'No name', deck: 'TSHIRT', guestToken: token });
    expect((await session.loadRoom(info.id)).facilitatorId).toBeNull();

    const stranger = await session.join(info.id, hashToken(newToken()), 'Ben');
    expect((await session.loadRoom(info.id)).facilitatorId).toBeNull();

    const creator = await session.join(info.id, hashToken(token), 'Chloe');
    const room = await session.loadRoom(info.id);
    expect(room.facilitatorId).toBe(creator.participantId);
    expect(room.facilitatorId).not.toBe(stranger.participantId);
  });

  it('returns public info and 404s for unknown rooms', async () => {
    const info = await rooms.create({
      name: 'Info',
      deck: 'POWERS_OF_TWO',
      guestToken: newToken(),
    });
    await expect(rooms.getInfo(info.id)).resolves.toMatchObject({
      name: 'Info',
      deck: 'POWERS_OF_TWO',
      storyCount: 0,
    });
    await expect(rooms.getInfo('zzzzzzzzzz')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('summarises finalized stories, revealed rounds and total points', async () => {
    const token = newToken();
    const info = await rooms.create({
      name: 'Summary',
      deck: 'FIBONACCI',
      facilitatorName: 'Fay',
      guestToken: token,
    });
    const fac = await session.join(info.id, hashToken(token));
    const dev = await session.join(info.id, hashToken(newToken()), 'Dev');
    const facCtx = { roomId: info.id, participantId: fac.participantId };
    const devCtx = { roomId: info.id, participantId: dev.participantId };

    await session.addStories(facCtx, [{ title: 'Login page' }, { title: 'Password reset' }]);

    // Story 1: two rounds, finalized at 5.
    let room = await session.loadRoom(info.id);
    await session.castVote(facCtx, room.currentRoundId!, '3');
    await session.castVote(devCtx, room.currentRoundId!, '8');
    await session.reveal(facCtx, room.currentRoundId!);
    await session.resetRound(facCtx, room.currentRoundId!);
    room = await session.loadRoom(info.id);
    await session.castVote(facCtx, room.currentRoundId!, '5');
    await session.castVote(devCtx, room.currentRoundId!, '5');
    await session.reveal(facCtx, room.currentRoundId!);
    await session.finalize(facCtx, { roundId: room.currentRoundId!, value: '5', advance: true });

    // Story 2: finalized at 8.
    room = await session.loadRoom(info.id);
    await session.castVote(devCtx, room.currentRoundId!, '8');
    await session.reveal(facCtx, room.currentRoundId!);
    await session.finalize(facCtx, { roundId: room.currentRoundId!, value: '8', advance: true });

    const summary = await rooms.getSummary(info.id);
    expect(summary.totals).toEqual({ stories: 2, estimated: 2, points: 13, rounds: 3 });
    expect(summary.stories[0]).toMatchObject({
      title: 'Login page',
      finalEstimate: '5',
      status: 'ESTIMATED',
    });
    expect(summary.stories[0]!.rounds).toHaveLength(2);
    expect(summary.stories[0]!.rounds[1]!.stats).toMatchObject({ consensus: true, average: 5 });
    expect(summary.stories[0]!.rounds[0]!.votes).toEqual([
      { participantName: 'Dev', value: '8' },
      { participantName: 'Fay', value: '3' },
    ]);
    expect(summary.participants.map((p) => p.name)).toEqual(['Fay', 'Dev']);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
