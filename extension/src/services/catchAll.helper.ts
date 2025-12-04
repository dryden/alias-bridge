/**
 * Helper function to check and update catch-all status for a domain
 * Consolidates logic used in both App.tsx and ProviderCard.tsx
 */

import { logger } from './logger'
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
  logger.debug('catchAllHelper', 'Checking catch-all status for domain:', domain)
  logger.debug('catchAllHelper', 'Token available:', !!token)

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
      logger.debug('catchAllHelper', 'Cache miss, fetching from API')
      const details = await getDomainDetails(token, domain)
      logger.debug('catchAllHelper', 'getDomainDetails returned:', details)

      if (details) {
        isCatchAllEnabledValue = details.catch_all === true
        // Cache the result
        await domainCacheService.setCachedCatchAllStatus(
          providerId,
          token,
          domain,
          isCatchAllEnabledValue
        )
        logger.debug('catchAllHelper', 'Cached catch-all status:', {
          domain,
          isCatchAllEnabled: isCatchAllEnabledValue
        })
      } else {
        logger.debug('catchAllHelper', 'No details returned for domain:', domain)
        return {
          isCatchAllEnabled: null,
          newConfig: currentConfig
        }
      }
    } else {
      logger.debug('catchAllHelper', 'Cache hit for domain:', domain, 'isCatchAllEnabled:', isCatchAllEnabledValue)
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
      logger.debug('catchAllHelper', 'Setting waitServerConfirmation: false due to catch_all=true')
    } else {
      // Catch-all disabled: server confirmation is required
      logger.debug('catchAllHelper', 'Setting waitServerConfirmation: true due to catch_all=false')
    }

    return {
      isCatchAllEnabled: isCatchAllEnabledValue,
      newConfig
    }
  } catch (error) {
    logger.error('catchAllHelper', 'Error checking catch-all status:', error)
    return {
      isCatchAllEnabled: null,
      newConfig: currentConfig
    }
  }
}
