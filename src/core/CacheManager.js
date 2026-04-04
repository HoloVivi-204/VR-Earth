/**
 * CacheManager — localStorage cache with TTL
 * Used for NASA GIBS cloud data, World Bank, CelesTrak, etc.
 */
export class CacheManager {
  constructor(storageKey, ttlMs) {
    this.key = storageKey;
    this.ttlMs = ttlMs;
  }

  isFresh() {
    try {
      const ts = localStorage.getItem(this.key + ':ts');
      return ts && (Date.now() - parseInt(ts)) < this.ttlMs;
    } catch { return false; }
  }

  get() {
    try { return localStorage.getItem(this.key + ':data'); }
    catch { return null; }
  }

  set(data) {
    try {
      localStorage.setItem(this.key + ':data', data);
      localStorage.setItem(this.key + ':ts', Date.now().toString());
    } catch (e) {
      console.warn('[CacheManager] Storage full or unavailable:', e);
    }
  }

  clear() {
    localStorage.removeItem(this.key + ':data');
    localStorage.removeItem(this.key + ':ts');
  }
}
