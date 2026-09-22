export class AttemptOperationQueue {
  private readonly tails = new Map<string, Promise<void>>();

  run<T>(attemptId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(attemptId) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(operation);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.tails.set(attemptId, tail);
    void tail.finally(() => {
      if (this.tails.get(attemptId) === tail) this.tails.delete(attemptId);
    });
    return result;
  }
}
