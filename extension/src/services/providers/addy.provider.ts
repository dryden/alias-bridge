import type { AliasProvider } from './types';
import { verifyToken, getDomains, getDomainDetails, normalizeBaseUrl } from '../addy';
import { logger } from '../logger';

export class AddyProvider implements AliasProvider {
    id = 'addy';
    name = 'Addy.io';

    async verifyToken(token: string, baseUrl?: string): Promise<boolean> {
        logger.info('AddyProvider', 'verifyToken called', { baseUrl });
        try {
            await verifyToken(token, baseUrl);
            return true;
        } catch (e) {
            return false;
        }
    }

    async getDomains(token: string, baseUrl?: string): Promise<string[]> {
        logger.info('AddyProvider', 'getDomains called', { baseUrl });
        return getDomains(token, baseUrl);
    }

    generateAddress(localPart: string, domain: string): string {
        return `${localPart}@${domain}`;
    }

    async createAlias(alias: string, token: string, domain?: string, hostname?: string, baseUrl?: string, format?: string): Promise<{ success: boolean; error?: string; isCatchAllDomain?: boolean; createdAlias?: string }> {
        try {
            const apiUrl = normalizeBaseUrl(baseUrl);
            logger.debug('addy.provider', `Creating alias (API: ${apiUrl}):`, { alias, domain, format });

            // Detect if this is Server Generation Mode or Custom Alias Creation
            // If alias is empty OR looks like a placeholder, AND we have a domain, it's server gen.
            const isServerGeneration = !alias || alias === '(Generating from server...)';

            if (isServerGeneration && domain) {
                logger.debug('addy.provider', 'Requesting server-side generation for domain:', domain, 'Format:', format);

                let apiFormat = 'uuid';
                if (format === 'random') {
                    apiFormat = 'random_characters';
                } else if (format === 'uuid') {
                    apiFormat = 'uuid';
                }

                const response = await fetch(`${apiUrl}/aliases`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        domain: domain,
                        format: apiFormat,
                        description: hostname ? `Created by Alias Bridge for ${hostname}` : 'Created by Alias Bridge'
                    })
                });

                const responseData = await response.json();

                if (response.ok) {
                    const createdAlias = responseData.data?.email || responseData.data?.address;
                    return { success: true, createdAlias };
                }

                return {
                    success: false,
                    error: `${response.status}: ${responseData.message || 'Unknown error'}`
                };
            }

            // Case 2: Custom alias creation (alias provided)
            const atIndex = alias.indexOf('@');
            if (atIndex === -1) {
                return { success: false, error: 'Invalid alias format' };
            }

            const localPart = alias.substring(0, atIndex);
            const aliasDomain = alias.substring(atIndex + 1);

            // Verify domain capabilities
            const domainDetails = await getDomainDetails(token, aliasDomain, baseUrl);

            if (!domainDetails) {
                return { success: false, error: `Unable to verify domain "${aliasDomain}"` };
            }

            if (domainDetails.catch_all === true) {
                logger.debug('addy.provider', 'Domain has catch-all enabled, skipping explicit creation');
                return { success: true, isCatchAllDomain: true, createdAlias: alias };
            }

            // Create custom alias via API
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

            if (response.ok) {
                const createdAlias = responseData.data?.address || alias;
                return { success: true, createdAlias };
            }

            // Handle 422 (Alias exists)
            if (response.status === 422) {
                const errorMessage = responseData.message?.toLowerCase() || '';
                if (errorMessage.includes('alias') || errorMessage.includes('exists')) {
                    return { success: true, createdAlias: alias };
                }
                return { success: false, error: responseData.message || 'Validation error' };
            }

            return { success: false, error: `${response.status}: ${responseData.message || 'Unknown error'}` };

        } catch (e) {
            logger.error('addy.provider', 'Exception creating alias:', e);
            return { success: false, error: String(e) };
        }
    }
}
