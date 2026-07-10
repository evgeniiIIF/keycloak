const refreshPromises = new Map<string, Promise<void>>();

export function isRefreshing(sessionId: string): Promise<void> | undefined {
  return refreshPromises.get(sessionId);
}

export function startRefresh(sessionId: string): { done: Promise<void>; release: () => void } {
  let release!: () => void;
  const done = new Promise<void>((resolve) => {
    release = resolve;
  });
  refreshPromises.set(sessionId, done);
  return {
    done,
    release: () => {
      release();
      refreshPromises.delete(sessionId);
    },
  };
}
