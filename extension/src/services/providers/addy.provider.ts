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

    async createAlias(alias: string, token: string): Promise<{ success: boolean; error?: string; isCatchAllDomain?: boolean }> {
        try {
            console.log('[Addy.io] Creating alias:', alias);

            // Parse the alias
            const atIndex = alias.indexOf('@');
            if (atIndex === -1) {
                return { success: false, error: 'Invalid alias format' };
            }

            const localPart = alias.substring(0, atIndex);
            const domain = alias.substring(atIndex + 1);

            console.log('[Addy.io] Parsed -', { localPart, domain });

            // Check if this is a username domain (e.g., 0309.4wrd.cc) or root shared domain
            const parts = domain.split('.');
            const potentialSharedDomain = parts.length >= 2 ? parts.slice(1).join('.') : null;

            let isUsernameOrSharedDomain = false;

            // Detect if it's a username domain format
            if (potentialSharedDomain && SHARED_DOMAINS.includes(potentialSharedDomain)) {
                console.log('[Addy.io] Username domain detected:', domain);
                isUsernameOrSharedDomain = true;
            }

            // Detect if it's a root shared domain
            if (SHARED_DOMAINS.includes(domain)) {
                console.log('[Addy.io] Root shared domain detected:', domain);
                isUsernameOrSharedDomain = true;
            }

            // For these domain types, check actual catch-all status
            if (isUsernameOrSharedDomain) {
                const domainDetails = await getDomainDetails(token, domain);
                console.log('[Addy.io] Domain details fetched:', domainDetails);

                if (domainDetails && domainDetails.catch_all === true) {
                    console.log('[Addy.io] Domain has catch-all enabled, no API call needed:', domain);
                    return { success: true, isCatchAllDomain: true };
                } else {
                    console.log('[Addy.io] Domain has catch-all disabled, API call needed:', domain);
                    // Username/shared domains don't need domain ID lookup, proceed directly to API call
                }
            }

            // For custom domains, verify domain exists first
            if (!isUsernameOrSharedDomain) {
                console.log('[Addy.io] Custom domain detected, verifying domain exists...');
                const domainDetails = await getDomainDetails(token, domain);
                if (!domainDetails) {
                    console.error('[Addy.io] Failed to find domain:', domain);
                    return {
                        success: false,
                        error: `Unable to find domain "${domain}". Please check that this domain is properly configured in your Addy account.`
                    };
                }
            }

            console.log('[Addy.io] Creating alias via API with domain:', domain);

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
                    domain: domain,
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
                return { success: true };
            }

            // Handle specific 422 errors
            if (response.status === 422) {
                const errorMessage = responseData.message?.toLowerCase() || '';
                const errors = responseData.errors || {};

                console.log('[Addy.io] 422 Error details:', { message: responseData.message, errors });

                // Check if it's an "alias already exists" error
                if (errorMessage.includes('alias') || errorMessage.includes('exists')) {
                    console.log('[Addy.io] Alias already exists (422)');
                    return { success: true };
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
