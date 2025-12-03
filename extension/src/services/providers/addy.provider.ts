import type { AliasProvider } from './types';
import { verifyToken, getDomains, getDomainDetails, SHARED_DOMAINS } from '../addy';

export class AddyProvider implements AliasProvider {
    id = 'addy';
    name = 'Addy.io';

    async verifyToken(token: string): Promise<boolean> {
        try {
            await verifyToken(token);
            return true;
        } catch (e) {
            return false;
        }
    }

    async getDomains(token: string): Promise<string[]> {
        return getDomains(token);
    }

    generateAddress(localPart: string, domain: string): string {
        return `${localPart}@${domain}`;
    }

    async createAlias(alias: string, token: string, domain?: string): Promise<{ success: boolean; error?: string; isCatchAllDomain?: boolean; createdAlias?: string }> {
        try {
            console.log('[Addy.io] Creating alias:', { alias, domain });

            // Case 1: Server-side generation (no specific alias provided)
            // This happens when catch-all is disabled and we want Addy to generate the alias
            if ((!alias || alias === '(Generating from server...)') && domain) {
                console.log('[Addy.io] Requesting server-side generation for domain:', domain);

                const response = await fetch('https://app.addy.io/api/v1/aliases', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        domain: domain,
                        format: 'uuid', // Default to UUID for server-generated aliases
                        description: 'Created by Alias Bridge'
                    })
                });

                const responseData = await response.json();
                console.log('[Addy.io] Create response:', response.status, responseData);

                if (response.ok) {
                    const createdAlias = responseData.data?.email || responseData.data?.address;
                    console.log('[Addy.io] ✓ Server generated alias:', createdAlias);
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

            console.log('[Addy.io] Parsed -', { localPart, domain: aliasDomain });

            // Check if this is a username domain (e.g., 0309.4wrd.cc) or root shared domain
            const parts = aliasDomain.split('.');
            const potentialSharedDomain = parts.length >= 2 ? parts.slice(1).join('.') : null;

            let isUsernameOrSharedDomain = false;

            // Detect if it's a username domain format
            if (potentialSharedDomain && SHARED_DOMAINS.includes(potentialSharedDomain)) {
                console.log('[Addy.io] Username domain detected:', aliasDomain);
                isUsernameOrSharedDomain = true;
            }

            // Detect if it's a root shared domain
            if (SHARED_DOMAINS.includes(aliasDomain)) {
                console.log('[Addy.io] Root shared domain detected:', aliasDomain);
                isUsernameOrSharedDomain = true;
            }

            // For these domain types, check actual catch-all status
            if (isUsernameOrSharedDomain) {
                const domainDetails = await getDomainDetails(token, aliasDomain);
                console.log('[Addy.io] Domain details fetched:', domainDetails);

                if (domainDetails && domainDetails.catch_all === true) {
                    console.log('[Addy.io] Domain has catch-all enabled, no API call needed:', aliasDomain);
                    return { success: true, isCatchAllDomain: true };
                } else {
                    console.log('[Addy.io] Domain has catch-all disabled, API call needed:', aliasDomain);
                    // Username/shared domains don't need domain ID lookup, proceed directly to API call
                }
            }

            // For custom domains, verify domain exists first
            if (!isUsernameOrSharedDomain) {
                console.log('[Addy.io] Custom domain detected, verifying domain exists...');
                const domainDetails = await getDomainDetails(token, aliasDomain);
                if (!domainDetails) {
                    console.error('[Addy.io] Failed to find domain:', aliasDomain);
                    return {
                        success: false,
                        error: `Unable to find domain "${aliasDomain}". Please check that this domain is properly configured in your Addy account.`
                    };
                }
            }

            console.log('[Addy.io] Creating alias via API with domain:', aliasDomain);

            // Create alias via Addy API with custom format
            // Using format: "custom" tells Addy to use the exact local_part we specified
            const response = await fetch('https://app.addy.io/api/v1/aliases', {
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
                    description: 'Created by Alias Bridge'
                })
            });

            const responseData = await response.json();
            console.log('[Addy.io] Create response:', response.status, responseData);

            if (response.ok) {
                const createdAlias = responseData.data?.address || alias;
                console.log('[Addy.io] ✓ Alias successfully created:', createdAlias);
                console.log('[Addy.io] Expected alias:', alias);
                console.log('[Addy.io] Match:', createdAlias === alias ? 'YES ✓' : 'NO - mismatch');
                return { success: true, createdAlias };
            }

            // Handle specific 422 errors
            if (response.status === 422) {
                const errorMessage = responseData.message?.toLowerCase() || '';
                const errors = responseData.errors || {};

                console.log('[Addy.io] 422 Error details:', { message: responseData.message, errors });

                // Check if it's an "alias already exists" error
                if (errorMessage.includes('alias') || errorMessage.includes('exists')) {
                    console.log('[Addy.io] Alias already exists (422)');
                    return { success: true, createdAlias: alias };
                }

                // If it's a domain field error
                if (errors.domain || errorMessage.includes('domain')) {
                    console.error('[Addy.io] Domain field error');
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
            console.error('[Addy.io] Exception creating alias:', e);
            return { success: false, error: String(e) };
        }
    }
}
