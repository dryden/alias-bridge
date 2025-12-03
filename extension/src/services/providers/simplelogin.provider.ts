import type { AliasProvider } from './types';

const BASE_URL = 'https://app.simplelogin.io/api';

export class SimpleLoginProvider implements AliasProvider {
    id = 'simplelogin';
    name = 'SimpleLogin';

    async verifyToken(token: string): Promise<boolean> {
        try {
            const response = await fetch(`${BASE_URL}/user_info`, {
                headers: {
                    'Authentication': token
                }
            });
            return response.ok;
        } catch (e) {
            return false;
        }
    }

    async getDomains(token: string): Promise<string[]> {
        const headers = {
            'Authentication': token,
            'Content-Type': 'application/json'
        };

        try {
            const domains: string[] = [];

            // 1. Get Custom Domains
            try {
                const customDomainsRes = await fetch(`${BASE_URL}/custom_domains`, { headers });
                if (customDomainsRes.ok) {
                    const customDomainsData = await customDomainsRes.json();
                    if (Array.isArray(customDomainsData)) {
                        customDomainsData.forEach((d: any) => {
                            if (d.domain_name) domains.push(d.domain_name);
                        });
                    }
                }
            } catch (e) {
                console.warn('Failed to fetch custom domains', e);
            }

            // 2. Get Alias Options (for shared domains/suffixes)
            try {
                const optionsRes = await fetch(`${BASE_URL}/v5/alias/options`, { headers });
                if (optionsRes.ok) {
                    const optionsData = await optionsRes.json();
                    if (optionsData.suffixes && Array.isArray(optionsData.suffixes)) {
                        optionsData.suffixes.forEach((s: any) => {
                            const suffix = typeof s === 'string' ? s : s.suffix;
                            if (suffix) domains.push(suffix);
                        });
                    }
                }
            } catch (e) {
                console.warn('Failed to fetch alias options', e);
            }

            // Remove duplicates
            return Array.from(new Set(domains));

        } catch (error) {
            console.error('Failed to fetch SimpleLogin domains', error);
            return [];
        }
    }

    generateAddress(localPart: string, domain: string): string {
        // Clean localPart for SimpleLogin - remove hyphens and other unsupported characters
        // This ensures the displayed alias matches what will be created on the server
        let cleanLocalPart = localPart.toLowerCase().replace(/[^a-z0-9_.]/g, '');

        // Limit length
        if (cleanLocalPart.length > 64) {
            cleanLocalPart = cleanLocalPart.substring(0, 64);
        }

        // Remove leading/trailing dots and underscores
        cleanLocalPart = cleanLocalPart.replace(/^[._]+|[._]+$/g, '');

        if (!cleanLocalPart || cleanLocalPart.length === 0) {
            cleanLocalPart = 'alias';
        }

        if (domain.includes('@')) {
            return `${cleanLocalPart}${domain}`;
        }
        return `${cleanLocalPart}@${domain}`;
    }


    async createAlias(alias: string, token: string): Promise<{ success: boolean; error?: string; isCatchAllDomain?: boolean; createdAlias?: string }> {
        try {
            console.log('[SimpleLogin] Creating alias on server:', alias);

            // Parse the alias - check if it's a suffix (contains @ before the final domain)
            // e.g., "localpart.suffix@domain.com" where ".suffix@domain.com" is the full suffix
            const atIndex = alias.indexOf('@');
            if (atIndex === -1) {
                return { success: false, error: 'Invalid alias format' };
            }

            const localPart = alias.substring(0, atIndex);
            const domainPart = alias.substring(atIndex + 1);

            console.log('[SimpleLogin] Parsed -', { localPart, domainPart, fullAlias: alias });

            // First, get mailboxes
            const mailboxesRes = await fetch(`${BASE_URL}/v2/mailboxes`, {
                headers: { 'Authentication': token }
            });

            if (!mailboxesRes.ok) {
                const errorText = await mailboxesRes.text();
                console.error('[SimpleLogin] Failed to fetch mailboxes:', errorText);
                return { success: false, error: `Failed to fetch mailboxes: ${errorText}` };
            }

            const mailboxesData = await mailboxesRes.json();
            console.log('[SimpleLogin] Mailboxes fetched:', mailboxesData);

            if (!mailboxesData.mailboxes || mailboxesData.mailboxes.length === 0) {
                return { success: false, error: 'No mailboxes found' };
            }

            const mailboxId = mailboxesData.mailboxes[0].id;

            // Get alias options to check available suffixes
            console.log('[SimpleLogin] Fetching alias options...');
            const optionsRes = await fetch(`${BASE_URL}/v5/alias/options`, {
                headers: { 'Authentication': token }
            });

            if (!optionsRes.ok) {
                const errorText = await optionsRes.text();
                console.error('[SimpleLogin] Failed to get options:', errorText);
                return { success: false, error: `Failed to get options: ${errorText}` };
            }

            const optionsData = await optionsRes.json();
            console.log('[SimpleLogin] Options fetched, found', optionsData.suffixes?.length || 0, 'suffixes');

            // Check if this is a suffix-based alias
            // Suffixes look like: [".word@domain.com", "@domain.com", etc]
            const fullSuffix = `@${domainPart}`;
            const matchingSuffix = optionsData.suffixes?.find((s: any) => {
                const suffixStr = typeof s === 'string' ? s : s.suffix;
                // Match either exact @domain or .something@domain
                return suffixStr === fullSuffix || (suffixStr.startsWith('.') && suffixStr.endsWith(fullSuffix));
            });

            if (matchingSuffix) {
                // This is a suffix-based alias
                const suffixStr = typeof matchingSuffix === 'string' ? matchingSuffix : matchingSuffix.suffix;
                const signedSuffix = typeof matchingSuffix === 'string' ? matchingSuffix : matchingSuffix.signed_suffix;

                console.log('[SimpleLogin] Using suffix-based alias:', { suffixStr, signedSuffix });

                // The prefix is everything before the suffix
                // For ".word@domain.com" suffix and "myalias.word@domain.com" alias, prefix is "myalias"
                let prefix = localPart;
                if (suffixStr.startsWith('.')) {
                    // Remove the suffix word part from localPart
                    const suffixWord = suffixStr.substring(0, suffixStr.indexOf('@'));
                    if (localPart.endsWith(suffixWord)) {
                        prefix = localPart.substring(0, localPart.length - suffixWord.length);
                    }
                }

                // Clean the prefix - SimpleLogin only accepts lowercase letters, numbers, and underscores
                // Remove hyphens and other special characters
                prefix = prefix.toLowerCase().replace(/[^a-z0-9_]/g, '');

                // Limit length (SimpleLogin max 30 chars)
                if (prefix.length > 30) {
                    prefix = prefix.substring(0, 30);
                }

                if (!prefix || prefix.length === 0) {
                    prefix = 'alias';
                }

                // Remove leading/trailing underscores
                prefix = prefix.replace(/^_+|_+$/g, '');

                console.log('[SimpleLogin] Creating with cleaned prefix:', { prefix, signedSuffix, suffixStr });

                // Create alias with suffix
                const response = await fetch(`${BASE_URL}/v3/alias/custom/new`, {
                    method: 'POST',
                    headers: {
                        'Authentication': token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        alias_prefix: prefix,
                        signed_suffix: signedSuffix,
                        mailbox_ids: [mailboxId],
                        note: 'Created by Alias Bridge'
                    })
                });

                const responseData = await response.json();
                console.log('[SimpleLogin] Create response:', response.status, responseData);

                if (response.ok) {
                    console.log('[SimpleLogin] ✓ Alias successfully created');
                    return { success: true, createdAlias: responseData.alias };
                }

                if (response.status === 409) {
                    console.log('[SimpleLogin] ✓ Alias already exists (409)');
                    return { success: true, createdAlias: alias }; // Already exists, assume requested alias is valid
                }

                console.error('[SimpleLogin] ✗ Failed to create alias:', response.status, responseData);
                return { success: false, error: `${response.status}: ${JSON.stringify(responseData)}` };
            } else {
                // For custom domains, use the full alias
                console.log('[SimpleLogin] Creating custom domain alias:', alias);

                const response = await fetch(`${BASE_URL}/v2/alias/custom/new`, {
                    method: 'POST',
                    headers: {
                        'Authentication': token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        alias: alias,
                        mailbox_ids: [mailboxId],
                        note: 'Created by Alias Bridge'
                    })
                });

                const responseData = await response.json();
                console.log('[SimpleLogin] Create response:', response.status, responseData);

                if (response.ok) {
                    console.log('[SimpleLogin] ✓ Alias successfully created');
                    return { success: true, createdAlias: responseData.alias };
                }

                if (response.status === 409) {
                    console.log('[SimpleLogin] ✓ Alias already exists (409)');
                    return { success: true, createdAlias: alias }; // Already exists
                }

                console.error('[SimpleLogin] ✗ Failed to create alias:', response.status, responseData);
                return { success: false, error: `${response.status}: ${JSON.stringify(responseData)}` };
            }
        } catch (e) {
            console.error('[SimpleLogin] ✗ Exception creating alias:', e);
            return { success: false, error: String(e) };
        }
    }
}
