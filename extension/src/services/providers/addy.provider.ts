import type { AliasProvider } from './types';
import { verifyToken, getDomains } from '../addy';

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

    async createAlias(alias: string, token: string): Promise<{ success: boolean; error?: string }> {
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
            const SHARED_DOMAINS = ['anonaddy.com', 'anonaddy.me', '4wrd.cc', 'mailer.me', 'addymail.com', 'addy.io'];
            const potentialSharedDomain = parts.length >= 2 ? parts.slice(1).join('.') : null;

            if (potentialSharedDomain && SHARED_DOMAINS.includes(potentialSharedDomain)) {
                console.log('[Addy.io] Username domain detected (catch-all), no API call needed:', domain);
                return { success: true };
            }

            // For custom domains, call the API
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
                    domain_id: domain, // This might need to be domain ID instead
                    description: 'Created by Alias Bridge'
                })
            });

            const responseData = await response.json();
            console.log('[Addy.io] Create response:', response.status, responseData);

            if (response.ok) {
                return { success: true };
            }

            if (response.status === 422) {
                // Likely already exists
                return { success: true };
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
