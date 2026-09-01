
type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

class DataCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private static instance: DataCache;
  private readonly storagePrefix = 'mp_datacache_';

  private constructor() {
    // Warm up memory cache from localStorage on startup if available
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(this.storagePrefix)) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed: CacheEntry<any> = JSON.parse(raw);
              const actualKey = key.slice(this.storagePrefix.length);
              this.cache.set(actualKey, parsed);
            }
          }
        }
      } catch {
        // Ignore localStorage access restrictions
      }
    }
  }

  static getInstance(): DataCache {
    if (!DataCache.instance) {
      DataCache.instance = new DataCache();
    }
    return DataCache.instance;
  }

  set(key: string, data: any, ttl = 300000) { // Default 5 minutes TTL
    const entry: CacheEntry<any> = {
      data,
      timestamp: Date.now() + ttl
    };
    
    this.cache.set(key, entry);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.storagePrefix + key, JSON.stringify(entry));
      } catch (e) {
        console.warn('Failed to save to local cache storage:', e);
      }
    }
  }

  get(key: string, allowStale = true): any | null {
    let entry = this.cache.get(key);

    if (!entry && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.storagePrefix + key);
        if (raw) {
          entry = JSON.parse(raw);
          if (entry) {
            this.cache.set(key, entry);
          }
        }
      } catch {
        // Ignore JSON error
      }
    }

    if (!entry) return null;
    
    // If not allowStale and timestamp expired, invalidate
    if (!allowStale && Date.now() > entry.timestamp) {
      this.invalidate(key);
      return null;
    }
    
    return entry.data;
  }

  getSync<T>(key: string, fallback: T): T {
    const data = this.get(key, true);
    return data !== null && data !== undefined ? data : fallback;
  }

  invalidate(key?: string) {
    if (key) {
      this.cache.delete(key);
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(this.storagePrefix + key);
        } catch {}
      }
    } else {
      this.cache.clear();
      if (typeof window !== 'undefined') {
        try {
          const toRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(this.storagePrefix)) {
              toRemove.push(k);
            }
          }
          toRemove.forEach(k => localStorage.removeItem(k));
        } catch {}
      }
    }
  }
}

export const dataCache = DataCache.getInstance();

