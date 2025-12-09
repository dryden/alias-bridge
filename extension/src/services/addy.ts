import { logger } from './logger'

// Default API URL for cloud hosted instance
const DEFAULT_API_URL = 'https://app.addy.io/api/v1';

export interface AddyAccountDetails {
    id: string;
    username: string;
    default_alias_domain?: string;
    default_alias_format?: string;
    subscription?: string;
    // Add other fields as needed
}

export interface AddyDomainDetails {
    domain: string;
    catch_all: boolean | null;
    [key: string]: any;
}

/**
 * Normalizes the base URL to ensure it ends with /api/v1
 * If the user provides the root domain (e.g. https://my-instance.com), it appends /api/v1
 */
export const normalizeBaseUrl = (url?: string): string => {
    if (!url || !url.trim()) return DEFAULT_API_URL;

    let cleaned = url.trim();
    // Remove trailing slash
    if (cleaned.endsWith('/')) {
        cleaned = cleaned.slice(0, -1);
    }

    // If it already ends with /api/v1, return it
    if (cleaned.endsWith('/api/v1')) {
        return cleaned;
    }

    // If it ends with /api, append /v1
    if (cleaned.endsWith('/api')) {
        return `${cleaned}/v1`;
    }

    // Otherwise append /api/v1
    const result = `${cleaned}/api/v1`;
    // logger.debug('addy', 'normalizeBaseUrl', { input: url, output: result });
    return result;
};

export const verifyToken = async (token: string, baseUrl?: string): Promise<AddyAccountDetails> => {
    const apiUrl = normalizeBaseUrl(baseUrl);
    logger.info('addy', 'verifyToken using API URL:', apiUrl);
    const response = await fetch(`${apiUrl}/account-details`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        // Try to parse error message
        try {
            const errorData = await response.json();
            throw new Error(errorData.message || `API Error: ${response.status}`);
        } catch (e) {
            // Check if it's a network error (like DNS resolution failure)
            if (e instanceof Error && e.message !== 'Invalid token or network error') {
                throw e;
            }
            throw new Error(`Connection failed: ${response.status} ${response.statusText}`);
        }
    }

    const data = await response.json();
    return data.data;
};

export const SHARED_DOMAINS = [
    'anonaddy.com',
    'anonaddy.me',
    '4wrd.cc',
    'mailer.me',
    'addymail.com',
    'addy.io'
];

// Cache for instance context to prevent redundant API calls
let instanceContextCache: {
    data: { username?: string, effectiveSharedDomains: string[], defaultAliasDomain?: string },
    timestamp: number,
    key: string // composite key of apiUrl + token (or just apiUrl if token is stable per session logic)
} | null = null;
let instanceContextPromise: Promise<{ username?: string, effectiveSharedDomains: string[], defaultAliasDomain?: string }> | null = null;

// Helper to fetch instance context (active shared domains, etc.)
// This is the Source of Truth for what domains are "shared" on this instance
const fetchInstanceContext = async (apiUrl: string, headers: any): Promise<{ username?: string, effectiveSharedDomains: string[], defaultAliasDomain?: string }> => {
    const cacheKey = apiUrl; // Simple key, assuming headers/token don't change rapidly for the same URL in this context
    const now = Date.now();
    const CACHE_TTL = 10000; // 10 seconds cache

    // Return cached data if valid
    if (instanceContextCache && instanceContextCache.key === cacheKey && (now - instanceContextCache.timestamp < CACHE_TTL)) {
        return instanceContextCache.data;
    }

    // Return pending promise if in flight
    if (instanceContextPromise) {
        return instanceContextPromise;
    }

    instanceContextPromise = (async () => {
        // Only include default cloud domains if we are actually ON the cloud instance
        // For self-hosted, we should rely purely on what the API tells us
        // Robust check for cloud instance (handle potential slash differences or alternatives)
        const isCloudInstance = apiUrl.includes('app.addy.io') || apiUrl.includes('app.anonaddy.com') || apiUrl === DEFAULT_API_URL;

        let effectiveSharedDomains = isCloudInstance ? [...SHARED_DOMAINS] : [];
        let username: string | undefined;
        let defaultAliasDomain: string | undefined;

        try {
            const accountRes = await fetch(`${apiUrl}/account-details`, { headers });
            if (accountRes.ok) {
                const accountData = await accountRes.json();
                username = accountData.data?.username;
                const activeShared = accountData.data?.active_shared_domains;
                defaultAliasDomain = accountData.data?.default_alias_domain;

                logger.info('Addy', 'FetchInstanceContext details:', {
                    username,
                    activeSharedCount: Array.isArray(activeShared) ? activeShared.length : 'not-array',
                    defaultAliasDomain
                });

                if (Array.isArray(activeShared)) {
                    effectiveSharedDomains = [...effectiveSharedDomains, ...activeShared];
                }

                // Heuristic for Self-Hosted instances where active_shared_domains might be empty
                // If default_alias_domain is present and clearly NOT a username subdomain (e.g. "unbox.at" vs "009.unbox.at"),
                // we assume it is a Shared Root Domain. This ensures we can generate "009.unbox.at".
                if (defaultAliasDomain && username) {
                    const userPrefix = `${username}.`.toLowerCase();
                    // If default domain is NOT a subdomain of the user, treat it as a root shared domain
                    if (!defaultAliasDomain.toLowerCase().startsWith(userPrefix)) {
                        effectiveSharedDomains.push(defaultAliasDomain);
                    }
                }
                // defaultAliasDomain is NOT a shared root, so don't add it to effectiveSharedDomains
                // It will be returned separately to be added to the final list directly

                // Deduplicate
                effectiveSharedDomains = [...new Set(effectiveSharedDomains)];
            } else {
                logger.warn('Addy', 'FetchInstanceContext failed response:', accountRes.status);
            }
        } catch (err) {
            logger.warn('Addy', 'FetchInstanceContext exception:', err);
        }

        const result = { username, effectiveSharedDomains, defaultAliasDomain };

        // Update cache
        instanceContextCache = {
            data: result,
            timestamp: Date.now(),
            key: cacheKey
        };
        instanceContextPromise = null; // Clear promise

        return result;
    })();

    return instanceContextPromise;
};

export const resetInstanceContextCache = () => {
    instanceContextCache = null;
    instanceContextPromise = null;
};


export const getDomainDetails = async (token: string, domain: string, baseUrl?: string): Promise<AddyDomainDetails | null> => {
    try {
        const apiUrl = normalizeBaseUrl(baseUrl);
        logger.info('addy', `getDomainDetails - Fetching details for: ${domain} (API: ${apiUrl})`);

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        // 1. Try to fetch custom domains first (most common for power users)
        try {
            const domainsResponse = await fetch(`${apiUrl}/domains`, { headers });
            if (domainsResponse.ok) {
                const domainsData = await domainsResponse.json();
                const domainData = domainsData.data?.find((d: any) => d.domain === domain);

                if (domainData) {
                    logger.debug('Addy', 'Found custom domain:', { domain: domainData.domain, catch_all: domainData.catch_all });
                    return {
                        domain: domainData.domain,
                        catch_all: domainData.catch_all ?? true,
                        ...domainData
                    };
                }
            }
        } catch (e) {
            logger.warn('Addy', 'Failed to fetch custom domains', e);
        }

        // 2. Fetch Instance Context (Shared Domains)
        const { effectiveSharedDomains } = await fetchInstanceContext(apiUrl, headers);

        // 3. Check if it's a Shared Domain (Root or Subdomain)
        const parts = domain.split('.');
        const potentialSharedDomain = parts.length >= 2 ? parts.slice(1).join('.') : null;

        const isRootShared = effectiveSharedDomains.includes(domain);
        const isSubdomainShared = potentialSharedDomain && effectiveSharedDomains.includes(potentialSharedDomain);

        if (isRootShared || isSubdomainShared) {
            logger.debug('Addy', 'Identified as shared domain type:', { domain, isRootShared, isSubdomainShared });

            // Shared domains usually don't support catch-all, UNLESS it's a username subdomain (user.shared.com)
            // AND the user has specifically enabled it.
            // Default to null (unknown) to avoid falsely blocking generation if API fails.
            let catchAllStatus: boolean | null = null;

            if (isSubdomainShared) {
                const potentialUsername = parts[0];
                try {
                    const usernamesRes = await fetch(`${apiUrl}/usernames`, { headers });
                    if (usernamesRes.ok) {
                        const usernamesData = await usernamesRes.json();
                        const userEntry = usernamesData.data?.find((u: any) => u.username === potentialUsername);
                        if (userEntry) {
                            // Addy.io API returns catch_all as boolean for usernames
                            catchAllStatus = !!userEntry.catch_all;
                            logger.debug('Addy', `Found username ${potentialUsername} settings, catch-all:`, catchAllStatus);
                        } else {
                            // User not found in list -> likely not a valid username subdomain for this account
                            // Could be a coincidence string. Safe to assume false, OR keep as null?
                            // Safest is false if we are sure we fetched the Full List and they weren't there.
                            // But usually fetch returns all usernames.
                            logger.debug('Addy', `Username ${potentialUsername} not found in account usernames list.`);
                            catchAllStatus = false;
                        }
                    } else {
                        // API Error fetching usernames -> Unknown status
                        logger.warn('Addy', 'Failed to fetch usernames, status:', usernamesRes.status);
                        catchAllStatus = null;
                    }
                } catch (err) {
                    logger.warn('Addy', 'Exception fetching usernames for catch-all check', err);
                    catchAllStatus = null;
                }
            } else {
                // Root shared domains (e.g. anonaddy.com) never support catch-all for users
                catchAllStatus = false;
            }

            return {
                domain: domain,
                catch_all: catchAllStatus,
                shared: true
            };
        }

        logger.debug('Addy', 'Domain details not found:', domain);
        return null;

    } catch (error) {
        logger.error('Addy', 'Failed to fetch domain details for', domain, ':', error);
        return null;
    }
};

export const getDomains = async (token: string, baseUrl?: string): Promise<string[]> => {
    try {
        const apiUrl = normalizeBaseUrl(baseUrl);
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        // 1. Fetch Instance Context (Username & Shared Domains)
        const { username: mainUsername, effectiveSharedDomains, defaultAliasDomain } = await fetchInstanceContext(apiUrl, headers);

        logger.info('Addy', 'Instance context fetched:', { mainUsername, effectiveSharedDomainsCount: effectiveSharedDomains.length, defaultAliasDomain });

        // 2. Fetch Additional Usernames
        const usernamesRes = await fetch(`${apiUrl}/usernames`, { headers });
        const usernamesData = usernamesRes.ok ? await usernamesRes.json() : { data: [] };
        const additionalUsernames = usernamesData.data?.map((u: any) => u.username) || [];

        const allUsernames = [mainUsername, ...additionalUsernames].filter(Boolean);

        // 3. Fetch Custom Domains
        const domainsRes = await fetch(`${apiUrl}/domains`, { headers });
        const domainsData = domainsRes.ok ? await domainsRes.json() : { data: [] };
        const customDomains = domainsData.data?.map((d: any) => d.domain) || [];

        // 4. Construct the full list
        let fullList: string[] = [];

        // Add User Subdomains (username.shareddomain)
        for (const username of allUsernames) {
            for (const shared of effectiveSharedDomains) {
                fullList.push(`${username}.${shared}`);
            }
        }

        // Add Custom Domains
        fullList.push(...customDomains);

        // Add Default Alias Domain (often username.shared.com)
        if (defaultAliasDomain) {
            fullList.push(defaultAliasDomain);
        }

        // Add Shared Domains (Root) - though usually users can't create aliases here directly without subdomain
        // but included for completeness or if instance allows
        fullList.push(...effectiveSharedDomains);

        // Deduplicate final list
        const finalList = [...new Set(fullList)];
        logger.info('Addy', 'Final domain list count:', finalList.length);
        return finalList;

    } catch (error) {
        logger.error('Addy', 'Failed to fetch domains', error);
        // Fallback for extreme failure cases
        return ['addy.io', 'anonaddy.com', 'anonaddy.me'];
    }
};

export const getDomainId = async (token: string, domainName: string, baseUrl?: string): Promise<number | null> => {
    try {
        const apiUrl = normalizeBaseUrl(baseUrl);
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        logger.debug('Addy', 'getDomainId - Looking up ID for domain:', domainName);

        // Fetch custom domains to get the domain ID
        const domainsRes = await fetch(`${apiUrl}/domains`, { headers });
        if (domainsRes.ok) {
            const domainsData = await domainsRes.json();
            logger.debug('Addy', 'getDomainId - All domains fetched:', domainsData.data?.map((d: any) => ({ id: d.id, domain: d.domain })));

            const domainData = domainsData.data?.find((d: any) => d.domain === domainName);
            if (domainData && domainData.id) {
                logger.debug('Addy', 'Found domain ID:', { domain: domainName, id: domainData.id });
                return domainData.id;
            } else {
                logger.debug('Addy', 'getDomainId - Domain not found in list:', { searchingFor: domainName, availableDomains: domainsData.data?.map((d: any) => d.domain) });
            }
        } else {
            logger.error('Addy', 'getDomainId - Failed to fetch domains:', domainsRes.status, domainsRes.statusText);
        }

        logger.debug('Addy', 'Domain ID not found for:', domainName);
        return null;
    } catch (error) {
        logger.error('Addy', 'Error fetching domain ID:', error);
        return null;
    }
};
