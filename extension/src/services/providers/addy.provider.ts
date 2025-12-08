import type { AliasProvider } from './types';
import { verifyToken, getDomains, getDomainDetails, normalizeBaseUrl, SHARED_DOMAINS } from '../addy';
import { logger } from '../logger';

export class AddyProvider implements AliasProvider {
    id = 'addy';
    name = 'Addy.io';

    async verifyToken(token: string, baseUrl?: string): Promise<boolean> {
        try {
            await verifyToken(token, baseUrl);
            return true;
        } catch (e) {
            return false;
        }
    }

    async getDomains(token: string, baseUrl?: string): Promise<string[]> {
        return getDomains(token, baseUrl);
    }

    generateAddress(localPart: string, domain: string): string {
        return `${localPart}@${domain}`;
    }

    async createAlias(alias: string, token: string, domain?: string, hostname?: string, baseUrl?: string): Promise<{ success: boolean; error?: string; isCatchAllDomain?: boolean; createdAlias?: string }> {
        try {
            const apiUrl = normalizeBaseUrl(baseUrl);
            logger.debug('addy.provider', `Creating alias (API: ${apiUrl}):`, { alias, domain });

            // Case 1: Server-side generation (no specific alias provided)
            // This happens when catch-all is disabled and we want Addy to generate the alias
            if ((!alias || alias === '(Generating from server...)') && domain) {
                logger.debug('addy.provider', 'Requesting server-side generation for domain:', domain);

                const response = await fetch(`${apiUrl}/aliases`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        domain: domain,
                        format: 'uuid', // Default to UUID for server-generated aliases
                        description: hostname ? `Created by Alias Bridge for ${hostname}` : 'Created by Alias Bridge'
                    })
                });

                const responseData = await response.json();
                logger.debug('addy.provider', 'Create response:', response.status, responseData);

                if (response.ok) {
                    const createdAlias = responseData.data?.email || responseData.data?.address;
                    logger.debug('addy.provider', 'Server generated alias:', createdAlias);
                    return { success: true, createdAlias };
                }

                return {
                    success: false,
                    error: `${response.status}: ${responseData.message || 'Unknown error'}`
                };
            }

            // Case 2: Custom alias creation (alias provided)
            // Parse the alias
            const atIndex = alias.indexOf('@');
            if (atIndex === -1) {
                return { success: false, error: 'Invalid alias format' };
            }

            const localPart = alias.substring(0, atIndex);
            const aliasDomain = alias.substring(atIndex + 1);

            logger.debug('addy.provider', 'Parsed -', { localPart, domain: aliasDomain });

            // Check if this is a username domain (e.g., 0309.4wrd.cc) or root shared domain
            const parts = aliasDomain.split('.');
            const potentialSharedDomain = parts.length >= 2 ? parts.slice(1).join('.') : null;

            let isUsernameOrSharedDomain = false;

            // Detect if it's a username domain format
            if (potentialSharedDomain && SHARED_DOMAINS.includes(potentialSharedDomain)) {
                logger.debug('addy.provider', 'Username domain detected:', aliasDomain);
                isUsernameOrSharedDomain = true;
            }

            // Detect if it's a root shared domain
            if (SHARED_DOMAINS.includes(aliasDomain)) {
                logger.debug('addy.provider', 'Root shared domain detected:', aliasDomain);
                isUsernameOrSharedDomain = true;
            }

            // For these domain types, check actual catch-all status
            if (isUsernameOrSharedDomain) {
                const domainDetails = await getDomainDetails(token, aliasDomain, baseUrl);
                logger.debug('addy.provider', 'Domain details fetched:', domainDetails);

                if (domainDetails && domainDetails.catch_all === true) {
                    logger.debug('addy.provider', 'Domain has catch-all enabled, no API call needed:', aliasDomain);
                    return { success: true, isCatchAllDomain: true };
                } else {
                    logger.debug('addy.provider', 'Domain has catch-all disabled, API call needed:', aliasDomain);
                    // Username/shared domains don't need domain ID lookup, proceed directly to API call
                }
            }

            // For custom domains, verify domain exists first
            if (!isUsernameOrSharedDomain) {
                logger.debug('addy.provider', 'Custom domain detected, verifying domain exists...');
                const domainDetails = await getDomainDetails(token, aliasDomain, baseUrl);
                if (!domainDetails) {
                    logger.error('addy.provider', 'Failed to find domain:', aliasDomain);
                    return {
                        success: false,
                        error: `Unable to find domain "${aliasDomain}". Please check that this domain is properly configured in your Addy account.`
                    };
                }
            }

            logger.debug('addy.provider', 'Creating alias via API with domain:', aliasDomain);

            // Create alias via Addy API with custom format
            // Using format: "custom" tells Addy to use the exact local_part we specified
            const response = await fetch(`${apiUrl}/aliases`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    local_part: localPart,
                    domain: aliasDomain,
                    format: 'custom',
                    description: hostname ? `Created by Alias Bridge for ${hostname}` : 'Created by Alias Bridge'
                })
            });

            const responseData = await response.json();
            logger.debug('addy.provider', 'Create response:', response.status, responseData);

            if (response.ok) {
                const createdAlias = responseData.data?.address || alias;
                logger.debug('addy.provider', 'Alias successfully created:', createdAlias);
                logger.debug('addy.provider', 'Expected alias:', alias);
                logger.debug('addy.provider', 'Match:', createdAlias === alias ? 'YES' : 'NO - mismatch');
                return { success: true, createdAlias };
            }

            // Handle specific 422 errors
            if (response.status === 422) {
                const errorMessage = responseData.message?.toLowerCase() || '';
                const errors = responseData.errors || {};

                logger.debug('addy.provider', '422 Error details:', { message: responseData.message, errors });

                // Check if it's an "alias already exists" error
                if (errorMessage.includes('alias') || errorMessage.includes('exists')) {
                    logger.debug('addy.provider', 'Alias already exists (422)');
                    return { success: true, createdAlias: alias };
                }

                // If it's a domain field error
                if (errors.domain || errorMessage.includes('domain')) {
                    logger.error('addy.provider', 'Domain field error');
                    return {
                        success: false,
                        error: `Domain error: ${responseData.message || 'The domain could not be applied'}`
                    };
                }
            }

            return {
                success: false,
                error: `${response.status}: ${responseData.message || 'Unknown error'}`
            };

        } catch (e) {
            logger.error('addy.provider', 'Exception creating alias:', e);
            return { success: false, error: String(e) };
        }
    }
}
