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
            console.log('[Addy.io] Processing alias:', alias);
            console.log('[Addy.io] Note: For Addy with catch-all enabled, aliases are auto-created when mail is received');

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
                    console.log('[Addy.io] ✓ Domain has catch-all enabled - alias will be auto-created when mail arrives:', alias);
                    return { success: true, isCatchAllDomain: true };
                } else {
                    console.log('[Addy.io] Domain has catch-all disabled - user must create alias manually in Addy:', domain);
                    return {
                        success: true,
                        isCatchAllDomain: false,
                        error: `To use a custom alias format with this domain, please create it first in your Addy.io account. The format will be respected once it exists.`
                    };
                }
            }

            // For custom domains, check if catch-all is enabled
            console.log('[Addy.io] Custom domain detected:', domain);
            const domainDetails = await getDomainDetails(token, domain);

            if (domainDetails && domainDetails.catch_all === true) {
                console.log('[Addy.io] ✓ Custom domain has catch-all enabled - alias will be auto-created when mail arrives:', alias);
                return { success: true, isCatchAllDomain: true };
            } else {
                console.log('[Addy.io] Custom domain catch-all disabled or not found - user must create alias manually:', domain);
                return {
                    success: true,
                    isCatchAllDomain: false,
                    error: `To use a custom alias format with this domain, please create it first in your Addy.io account. The format will be respected once it exists.`
                };
            }

        } catch (e) {
            console.error('[Addy.io] Exception processing alias:', e);
            return { success: false, error: String(e) };
        }
    }
}
