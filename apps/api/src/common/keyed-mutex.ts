/**
 * Serialises async work per key (room id). Every mutation + broadcast for a room runs
 * through this queue so snapshots are always emitted in the order mutations happened.
 */
export class KeyedMutex {
  private readonly tails = new Map<string, Promise<unknown>>();

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const result = previous.then(task, task);
    const tail = result.catch(() => undefined);
    this.tails.set(key, tail);
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });
    return result;
  }

  /** Resolves once every queued task has settled (used for graceful shutdown). */
  async idle(): Promise<void> {
    while (this.tails.size > 0) await Promise.all(this.tails.values());
  }
}
