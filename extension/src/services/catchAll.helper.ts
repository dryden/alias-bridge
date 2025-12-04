/**
 * Helper function to check and update catch-all status for a domain
 * Consolidates logic used in both App.tsx and ProviderCard.tsx
 */

import { getDomainDetails } from './addy'
import { domainCacheService } from './domain-cache.service'
import type { ProviderConfig } from './providers/types'

interface CatchAllCheckResult {
  isCatchAllEnabled: boolean | null
  newConfig: ProviderConfig
}

export async function checkAndUpdateCatchAllStatus(
  providerId: string,
  token: string,
  domain: string,
  currentConfig: ProviderConfig
): Promise<CatchAllCheckResult> {
  console.log('[catchAllHelper] Checking catch-all status for domain:', domain)
  console.log('[catchAllHelper] Token available:', !!token)

  let isCatchAllEnabledValue: boolean | null = null

  try {
    // Try to get from cache first
    isCatchAllEnabledValue = await domainCacheService.getCachedCatchAllStatus(
      providerId,
      token,
      domain
    )

    if (isCatchAllEnabledValue === null) {
      // Cache miss, fetch from API
      console.log('[catchAllHelper] Cache miss, fetching from API')
      const details = await getDomainDetails(token, domain)
      console.log('[catchAllHelper] getDomainDetails returned:', details)

      if (details) {
        isCatchAllEnabledValue = details.catch_all === true
        // Cache the result
        await domainCacheService.setCachedCatchAllStatus(
          providerId,
          token,
          domain,
          isCatchAllEnabledValue
        )
        console.log('[catchAllHelper] Cached catch-all status:', {
          domain,
          isCatchAllEnabled: isCatchAllEnabledValue
        })
      } else {
        console.log('[catchAllHelper] No details returned for domain:', domain)
        return {
          isCatchAllEnabled: null,
          newConfig: currentConfig
        }
      }
    } else {
      console.log('[catchAllHelper] Cache hit for domain:', domain, 'isCatchAllEnabled:', isCatchAllEnabledValue)
    }

    // Update config based on catch-all status
    const newDomainCatchAllStatus = {
      ...currentConfig.domainCatchAllStatus,
      [domain]: isCatchAllEnabledValue
    }

    const newConfig: ProviderConfig = {
      ...currentConfig,
      domainCatchAllStatus: newDomainCatchAllStatus,
      waitServerConfirmation: !isCatchAllEnabledValue
    }

    if (isCatchAllEnabledValue) {
      // Catch-all enabled: user cannot use server confirmation
      console.log('[catchAllHelper] Setting waitServerConfirmation: false due to catch_all=true')
    } else {
      // Catch-all disabled: server confirmation is required
      console.log('[catchAllHelper] Setting waitServerConfirmation: true due to catch_all=false')
    }

    return {
      isCatchAllEnabled: isCatchAllEnabledValue,
      newConfig
    }
  } catch (error) {
    console.error('[catchAllHelper] Error checking catch-all status:', error)
    return {
      isCatchAllEnabled: null,
      newConfig: currentConfig
    }
  }
}
