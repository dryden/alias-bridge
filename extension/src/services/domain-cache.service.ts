/**
 * Domain Cache Service
 * Caches domain lists and catch-all status with TTL to avoid frequent API calls
 */

interface CacheEntry {
  domains: string[]
  catchAllStatus: Record<string, boolean> // domain -> catch-all status
  timestamp: number
}

type CacheStore = Record<string, CacheEntry>

const CACHE_TTL = 1000 * 60 * 60 // 1 hour in milliseconds
const STORAGE_KEY = 'domainCache'

export const domainCacheService = {
  /**
   * Get cached domains for a provider if still valid
   */
  async getCachedDomains(providerId: string, token: string): Promise<string[] | null> {
    const cache = await this.getCache()
    const cacheKey = this.getCacheKey(providerId, token)
    const entry = cache[cacheKey]

    if (!entry) return null

    const now = Date.now()
    const isExpired = now - entry.timestamp > CACHE_TTL

    if (isExpired) {
      // Cache expired, remove it
      delete cache[cacheKey]
      await this.saveCache(cache)
      return null
    }

    return entry.domains
  },

  /**
   * Set cached domains for a provider
   */
  async setCachedDomains(providerId: string, token: string, domains: string[]): Promise<void> {
    const cache = await this.getCache()
    const cacheKey = this.getCacheKey(providerId, token)

    // Preserve existing catch-all status if present
    const existingEntry = cache[cacheKey]
    const existingCatchAllStatus = existingEntry?.catchAllStatus || {}

    cache[cacheKey] = {
      domains,
      catchAllStatus: existingCatchAllStatus,
      timestamp: Date.now()
    }

    await this.saveCache(cache)
  },

  /**
   * Get cached catch-all status for a domain if still valid
   */
  async getCachedCatchAllStatus(providerId: string, token: string, domain: string): Promise<boolean | null> {
    const cache = await this.getCache()
    const cacheKey = this.getCacheKey(providerId, token)
    const entry = cache[cacheKey]

    if (!entry) return null

    const now = Date.now()
    const isExpired = now - entry.timestamp > CACHE_TTL

    if (isExpired) {
      return null
    }

    return entry.catchAllStatus[domain] ?? null
  },

  /**
   * Set cached catch-all status for a domain
   */
  async setCachedCatchAllStatus(providerId: string, token: string, domain: string, isCatchAllEnabled: boolean): Promise<void> {
    const cache = await this.getCache()
    const cacheKey = this.getCacheKey(providerId, token)

    if (!cache[cacheKey]) {
      cache[cacheKey] = {
        domains: [],
        catchAllStatus: {},
        timestamp: Date.now()
      }
    }

    cache[cacheKey].catchAllStatus[domain] = isCatchAllEnabled
    await this.saveCache(cache)
  },

  /**
   * Invalidate cache for a provider
   */
  async invalidateCache(providerId: string, token: string): Promise<void> {
    const cache = await this.getCache()
    const cacheKey = this.getCacheKey(providerId, token)

    delete cache[cacheKey]
    await this.saveCache(cache)
  },

  /**
   * Clear all cache
   */
  async clearCache(): Promise<void> {
    await this.saveCache({})
  },

  /**
   * Generate unique cache key from provider id and token
   */
  getCacheKey(providerId: string, token: string): string {
    return `${providerId}:${token.substring(0, 8)}`
  },

  /**
   * Get cache from storage
   */
  async getCache(): Promise<CacheStore> {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
          resolve((result[STORAGE_KEY] as CacheStore) || {})
        })
      } else {
        resolve({})
      }
    })
  },

  /**
   * Save cache to storage
   */
  async saveCache(cache: CacheStore): Promise<void> {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STORAGE_KEY]: cache }, () => resolve())
      } else {
        resolve()
      }
    })
  }
}
