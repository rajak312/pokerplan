import { type INestApplication } from '@nestjs/common';
import type {
  Ack,
  ClientToServerEvents,
  NoticePayload,
  RoomInfo,
  RoomStateDTO,
  RoomSummary,
  ServerToClientEvents,
} from '@pokerplan/shared';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { createE2eApp, newToken } from './test-app';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

/** A connected test user that records every snapshot and notice it receives. */
class TestUser {
  readonly socket: Client;
  readonly states: RoomStateDTO[] = [];
  readonly notices: NoticePayload[] = [];
  removed = false;

  constructor(
    url: string,
    readonly token = newToken(),
  ) {
    this.socket = io(url, { auth: { token }, transports: ['websocket'], forceNew: true });
    this.socket.on('room:state', (s) => this.states.push(s));
    this.socket.on('room:notice', (n) => this.notices.push(n));
    this.socket.on('room:removed', () => (this.removed = true));
  }

  get state(): RoomStateDTO {
    const s = this.states.at(-1);
    if (!s) throw new Error('no state received yet');
    return s;
  }

  connected(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket.connected) return resolve();
      this.socket.once('connect', () => resolve());
      this.socket.once('connect_error', reject);
    });
  }

  /** Emits an event and resolves with its typed acknowledgement. */
  emit<E extends keyof ClientToServerEvents>(
    event: E,
    payload: Parameters<ClientToServerEvents[E]>[0],
  ): Promise<Parameters<Parameters<ClientToServerEvents[E]>[1]>[0]> {
    return new Promise((resolve) => {
      // socket.io-client's typed emit can't infer generic event params, hence the cast.
      (this.socket.emit as (e: string, p: unknown, cb: (r: unknown) => void) => void)(
        event,
        payload,
        (res) => resolve(res as Parameters<Parameters<ClientToServerEvents[E]>[1]>[0]),
      );
    });
  }

  /** Waits until a snapshot matching `predicate` arrives. */
  waitFor(predicate: (s: RoomStateDTO) => boolean, timeoutMs = 3000): Promise<RoomStateDTO> {
    const existing = this.states.at(-1);
    if (existing && predicate(existing)) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket.off('room:state', handler);
        reject(new Error('Timed out waiting for room state'));
      }, timeoutMs);
      const handler = (s: RoomStateDTO) => {
        if (!predicate(s)) return;
        clearTimeout(timer);
        this.socket.off('room:state', handler);
        resolve(s);
      };
      this.socket.on('room:state', handler);
    });
  }

  close(): void {
    this.socket.disconnect();
  }
}

function expectOk<T>(ack: Ack<T>): T {
  if (!ack.ok) throw new Error(`Expected ok ack, got ${ack.error.code}: ${ack.error.message}`);
  return ack.data;
}

describe('SessionGateway (e2e)', () => {
  let app: INestApplication;
  let url: string;
  const users: TestUser[] = [];

  const user = (token?: string) => {
    const u = new TestUser(url, token);
    users.push(u);
    return u;
  };

  beforeAll(async () => {
    ({ app, url } = await createE2eApp());
  });

  afterEach(async () => {
    users.splice(0).forEach((u) => u.close());
    // Let the server process the disconnects before the next test / teardown.
    await new Promise((r) => setTimeout(r, 100));
  });

  afterAll(async () => {
    await app.close();
  });

  async function createRoom(token: string, facilitatorName = 'Fiona'): Promise<RoomInfo> {
    const res = await request(app.getHttpServer())
      .post('/rooms')
      .send({ name: 'Sprint 7', deck: 'FIBONACCI', facilitatorName, guestToken: token })
      .expect(201);
    return res.body as RoomInfo;
  }

  it('exposes health and validates REST input', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200, /"database":"up"/);
    const bad = await request(app.getHttpServer())
      .post('/rooms')
      .send({ name: '', deck: 'NOPE', guestToken: 'x' })
      .expect(400);
    expect(bad.body).toMatchObject({ code: 'VALIDATION' });
    await request(app.getHttpServer()).get('/rooms/zzzzzzzzzz').expect(404);
    await request(app.getHttpServer()).get('/rooms/NOT-VALID').expect(400);
  });

  it('rejects socket connections without a guest token', async () => {
    const socket: Client = io(url, { transports: ['websocket'], forceNew: true });
    const error = await new Promise<Error>((resolve) => socket.once('connect_error', resolve));
    expect(error.message).toMatch(/guest token/i);
    socket.disconnect();
  });

  it('runs a full session: join → vote (hidden) → reveal → finalize → summary', async () => {
    const fiona = user();
    const room = await createRoom(fiona.token);
    const dan = user();
    await Promise.all([fiona.connected(), dan.connected()]);

    // The creator rejoins their pre-created seat without a name; a new guest must give one.
    const fJoin = expectOk(await fiona.emit('room:join', { roomId: room.id }));
    expect(fJoin.state.room.facilitatorId).toBe(fJoin.participantId);
    const noName = await dan.emit('room:join', { roomId: room.id });
    expect(noName).toMatchObject({ ok: false, error: { code: 'NAME_REQUIRED' } });
    const dJoin = expectOk(await dan.emit('room:join', { roomId: room.id, name: 'Dan' }));

    await fiona.waitFor((s) => s.participants.filter((p) => p.isOnline).length === 2);

    // Stories
    expectOk(
      await fiona.emit('story:add', {
        stories: [
          { title: 'Checkout flow', link: 'https://example.com/PP-1' },
          { title: 'Search' },
        ],
      }),
    );
    const withStories = await dan.waitFor((s) => s.stories.length === 2);
    expect(withStories.currentStoryId).toBe(withStories.stories[0]!.id);
    const roundId = withStories.round!.id;

    // Dan can't run the session.
    const forbidden = await dan.emit('round:reveal', { roundId });
    expect(forbidden).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    // Votes are hidden from others until reveal.
    expectOk(await dan.emit('vote:cast', { roundId, value: '8' }));
    const fionaView = await fiona.waitFor(
      (s) => s.participants.find((p) => p.id === dJoin.participantId)?.hasVoted === true,
    );
    expect(fionaView.participants.find((p) => p.id === dJoin.participantId)!.vote).toBeNull();
    expect(dan.state.participants.find((p) => p.id === dJoin.participantId)!.vote).toBe('8');

    expectOk(await fiona.emit('vote:cast', { roundId, value: '5' }));
    const invalid = await fiona.emit('vote:cast', { roundId, value: '7' });
    expect(invalid).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });

    // Reveal (twice — idempotent).
    expectOk(await fiona.emit('round:reveal', { roundId }));
    expectOk(await fiona.emit('round:reveal', { roundId }));
    const revealed = await dan.waitFor((s) => s.round?.revealed === true);
    expect(revealed.participants.find((p) => p.id === fJoin.participantId)!.vote).toBe('5');
    expect(revealed.round!.stats).toMatchObject({ average: 6.5, median: '6.5', suggested: '8' });

    // Finalize and advance.
    expectOk(await fiona.emit('round:finalize', { roundId, value: '8' }));
    const advanced = await dan.waitFor((s) => s.currentStoryId === s.stories[1]!.id);
    expect(advanced.stories[0]).toMatchObject({ finalEstimate: '8', status: 'ESTIMATED' });
    expect(advanced.round).toMatchObject({ revealed: false, number: 1 });
    await new Promise((r) => setTimeout(r, 50));
    expect(dan.notices.some((n) => n.message.includes('Saved 8'))).toBe(true);

    const summary = (
      await request(app.getHttpServer()).get(`/rooms/${room.id}/summary`).expect(200)
    ).body as RoomSummary;
    expect(summary.totals).toMatchObject({ stories: 2, estimated: 1, points: 8 });
    expect(summary.stories[0]!.rounds[0]!.votes).toHaveLength(2);
  });

  it('keeps the same seat across reconnects and resyncs state', async () => {
    const fiona = user();
    const room = await createRoom(fiona.token);
    await fiona.connected();
    const first = expectOk(await fiona.emit('room:join', { roomId: room.id }));
    const r1 = first.state.round!.id;
    expectOk(await fiona.emit('vote:cast', { roundId: r1, value: '3' }));
    fiona.close();

    // Same token, new socket (e.g. page refresh) — same participant, vote preserved.
    const again = user(fiona.token);
    await again.connected();
    const second = expectOk(await again.emit('room:join', { roomId: room.id }));
    expect(second.participantId).toBe(first.participantId);
    expect(second.state.participants).toHaveLength(1);
    expect(second.state.participants[0]!.vote).toBe('3');

    const sync = expectOk(await again.emit('room:sync', {}));
    expect(sync.round!.id).toBe(r1);
  });

  it('tracks presence and hands over the facilitator role after the grace period', async () => {
    const fiona = user();
    const room = await createRoom(fiona.token);
    const dan = user();
    await Promise.all([fiona.connected(), dan.connected()]);
    expectOk(await fiona.emit('room:join', { roomId: room.id }));
    const d = expectOk(await dan.emit('room:join', { roomId: room.id, name: 'Dan' }));

    fiona.close();
    const offline = await dan.waitFor((s) =>
      s.participants.some((p) => p.isFacilitator && !p.isOnline),
    );
    expect(offline.room.facilitatorId).not.toBe(d.participantId);

    // FACILITATOR_GRACE_MS is 300ms in .env.test
    const handedOver = await dan.waitFor((s) => s.room.facilitatorId === d.participantId);
    expect(handedOver.participants.find((p) => p.id === d.participantId)!.isFacilitator).toBe(true);
  });

  it('lets the facilitator remove a participant', async () => {
    const fiona = user();
    const room = await createRoom(fiona.token);
    const dan = user();
    await Promise.all([fiona.connected(), dan.connected()]);
    expectOk(await fiona.emit('room:join', { roomId: room.id }));
    const d = expectOk(await dan.emit('room:join', { roomId: room.id, name: 'Dan' }));

    expectOk(await fiona.emit('participant:remove', { participantId: d.participantId }));
    await fiona.waitFor((s) => s.participants.length === 1);
    await new Promise((r) => setTimeout(r, 50));
    expect(dan.removed).toBe(true);
    const rejoin = await dan.emit('room:join', { roomId: room.id });
    expect(rejoin).toMatchObject({ ok: false, error: { code: 'REMOVED' } });
  });

  it('syncs a round timer to every client and validates its duration', async () => {
    const fiona = user();
    const room = await createRoom(fiona.token);
    await fiona.connected();
    const join = expectOk(await fiona.emit('room:join', { roomId: room.id }));
    const roundId = join.state.round!.id;
    expectOk(await fiona.emit('vote:cast', { roundId, value: '5' }));

    const tooShort = await fiona.emit('timer:start', { durationSec: 1 });
    expect(tooShort).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });

    expectOk(await fiona.emit('timer:start', { durationSec: 10 }));
    const running = await fiona.waitFor((s) => s.timer !== null);
    expect(running.timer!.endsAt - running.serverNow).toBeGreaterThan(9000);

    expectOk(await fiona.emit('timer:stop', {}));
    await fiona.waitFor((s) => s.timer === null);
  });
});
