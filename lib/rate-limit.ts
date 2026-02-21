import { LRUCache } from 'lru-cache';

type Options = {
  interval: number;
  uniqueTokenPerInterval: number;
};

export default function Ratelimit(options: Options) {
  const tokenCache = new LRUCache<string, number[]>({
    max: 500,
    ttl: options.interval * 60 * 1000,
  });

  return {
    check: async (limit: number, token: string) => {
      const tokenCount = tokenCache.get(token) || [];
      const now = Date.now();

      const windowStart = now - options.interval * 60 * 1000;
      const requestsInWindow = tokenCount.filter((t) => t > windowStart);

      const success = requestsInWindow.length < limit;

      if (!success) {
        return { success: false };
      }

      const updatedTokenCount = [...requestsInWindow, now];
      tokenCache.set(token, updatedTokenCount);

      return { success: true };
    },
  };
}