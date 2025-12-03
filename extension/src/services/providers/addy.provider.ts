import type { AliasProvider } from './types';
import { verifyToken, getDomains, getDomainId, SHARED_DOMAINS } from '../addy';

const BASE_URL = 'https://app.addy.io/api/v1';

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

            // Check if this is a username domain (e.g., 0309.4wrd.cc)
            // These use catch-all and don't need API creation
            const parts = domain.split('.');
            const potentialSharedDomain = parts.length >= 2 ? parts.slice(1).join('.') : null;

            if (potentialSharedDomain && SHARED_DOMAINS.includes(potentialSharedDomain)) {
                console.log('[Addy.io] Username domain detected (catch-all), no API call needed:', domain);
                return { success: true, isCatchAllDomain: true };
            }

            // Check if it's a root shared domain
            if (SHARED_DOMAINS.includes(domain)) {
                console.log('[Addy.io] Root shared domain detected (catch-all), no API call needed:', domain);
                return { success: true, isCatchAllDomain: true };
            }

            // For custom domains, get the domain ID and call the API
            console.log('[Addy.io] Custom domain detected, fetching domain ID...');
            const domainId = await getDomainId(token, domain);

            if (domainId === null) {
                console.error('[Addy.io] Failed to find domain ID for custom domain:', domain);
                return {
                    success: false,
                    error: `Domain not found: ${domain}`
                };
            }

            console.log('[Addy.io] Creating alias via API with domain_id:', domainId);

            // Create alias via Addy API
            const response = await fetch(`${BASE_URL}/aliases`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    local_part: localPart,
                    domain_id: domainId,
                    description: 'Created by Alias Bridge'
                })
            });

            const responseData = await response.json();
            console.log('[Addy.io] Create response:', response.status, responseData);

            if (response.ok) {
                return { success: true };
            }

            if (response.status === 422) {
                // Check if it's an alias already exists error (common for 422)
                const errorMessage = responseData.message?.toLowerCase() || '';
                if (errorMessage.includes('alias') || errorMessage.includes('exists')) {
                    console.log('[Addy.io] Alias already exists (422)');
                    return { success: true };
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
