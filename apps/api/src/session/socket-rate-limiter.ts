/** Fixed-window limiter per socket — protects the DB from runaway clients. */
export class SocketRateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit = 60,
    private readonly windowMs = 10_000,
  ) {}

  allow(socketId: string, now = Date.now()): boolean {
    const w = this.windows.get(socketId);
    if (!w || now - w.start >= this.windowMs) {
      this.windows.set(socketId, { start: now, count: 1 });
      return true;
    }
    w.count += 1;
    return w.count <= this.limit;
  }

  forget(socketId: string): void {
    this.windows.delete(socketId);
  }
}
